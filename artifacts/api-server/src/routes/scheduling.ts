import { Router, type IRouter, type Request } from "express";
import {
  GetAvailableSlotsResponse,
  BookAppointmentBody,
  BookAppointmentResponse,
} from "@workspace/api-zod";
import { getDb, recordBookingAttempt } from "../db";
import { sendBookingNotification, sendBookingConfirmation } from "../lib/email";
import { isRateLimited } from "../lib/ratelimit";
import {
  getBusyPeriods,
  isSlotBusy,
  createBookingEvent,
  APPOINTMENT_DURATION_MINUTES,
} from "../lib/google-calendar";
import { mergeAppointmentIntoPipeline } from "../lib/google-sheets";

const router: IRouter = Router();

// ── Scheduling configuration ──────────────────────────────────────────────────
const START_HOUR_CT = 9;   // 9:00 AM CT
const END_HOUR_CT   = 17;  // 5:00 PM CT
const LEAD_TIME_HOURS = 2;
const SLOTS_TO_SHOW = 14;
const DAYS_AHEAD = 14;

// Slot step: how many minutes between candidate slot start times.
// Must divide evenly into 60 for whole-hour alignment. Keep at 60 for now.
const SLOT_STEP_MINUTES = APPOINTMENT_DURATION_MINUTES;

// Rate limit config
const SLOTS_MAX_PER_MIN = 30;
const BOOK_MAX_PER_10_MIN = 3;
const BOOK_WINDOW_MS = 10 * 60 * 1000;

const OWNER_EMAIL = process.env.ADMIN_EMAIL ?? "";

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown"
  );
}

/**
 * Returns the UTC offset for America/Chicago at the given date.
 * Returns -5 during CDT (summer) and -6 during CST (winter).
 * Uses the built-in Intl API — no external packages required.
 */
function getChicagoOffsetHours(date: Date): number {
  const chicago = new Date(date.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const utc     = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return (chicago.getTime() - utc.getTime()) / 3_600_000;
}

function generateAvailableSlots(
  bookedSlotIds: Set<string>,
  busyPeriods: { start: Date; end: Date }[]
) {
  const slots = [];
  const now = new Date();
  let count = 0;
  let dayOffset = 0;

  while (count < SLOTS_TO_SHOW && dayOffset <= DAYS_AHEAD) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    const dayOfWeek = day.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      dayOffset++;
      continue;
    }

    // Compute the correct UTC offset for this specific day (handles DST transitions)
    const ctOffset = getChicagoOffsetHours(day);

    // Iterate candidate start times within the business window
    const stepMs = SLOT_STEP_MINUTES * 60 * 1000;
    for (
      let hour = START_HOUR_CT;
      hour < END_HOUR_CT && count < SLOTS_TO_SHOW;
      hour += SLOT_STEP_MINUTES / 60
    ) {
      const slotDate = new Date(day);
      slotDate.setUTCHours(hour - ctOffset, 0, 0, 0);

      // Skip slots too soon
      const hoursFromNow = (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursFromNow < LEAD_TIME_HOURS) continue;

      // Skip slots booked in our own DB
      const slotId = `slot-${slotDate.getTime()}`;
      if (bookedSlotIds.has(slotId)) continue;

      // Skip slots that overlap Google Calendar busy periods (with buffer)
      if (isSlotBusy(slotDate, busyPeriods)) continue;

      void stepMs; // suppress unused-var warning

      const dayLabel = slotDate.toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      const timeLabel =
        slotDate.toLocaleTimeString("en-US", {
          timeZone: "America/Chicago",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }) + " CT";

      slots.push({
        id: slotId,
        dateTime: slotDate.toISOString(),
        dayLabel,
        timeLabel,
        available: true,
      });

      count++;
    }

    dayOffset++;
  }

  return slots;
}

// ── GET /api/scheduling/slots ─────────────────────────────────────────────────
router.get("/slots", async (req, res) => {
  const ip = getIp(req);

  if (isRateLimited(`slots:${ip}`, SLOTS_MAX_PER_MIN, 60_000)) {
    res.status(429).json({
      error: "rate_limited",
      message: "Too many requests. Please wait a moment and try again.",
    });
    return;
  }

  // Load booked slot IDs from DB
  let bookedSlotIds = new Set<string>();
  try {
    const db = getDb();
    const result = await db.query<{ slot_id: string }>(
      `SELECT slot_id FROM appointments WHERE status = 'confirmed' AND scheduled_time > NOW()`
    );
    bookedSlotIds = new Set(result.rows.map((r) => r.slot_id));
  } catch (err) {
    console.error("[Scheduling] Failed to load booked slots:", err);
    res.status(503).json({
      error: "database_unavailable",
      message: "Unable to load available times. Please try again shortly.",
    });
    return;
  }

  // Fetch Google Calendar busy periods for the scheduling window
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + DAYS_AHEAD + 1);
  const busyPeriods = await getBusyPeriods(now, windowEnd);

  const slots = generateAvailableSlots(bookedSlotIds, busyPeriods);
  const data = GetAvailableSlotsResponse.parse({
    slots,
    timezone: "America/Chicago",
  });
  res.json(data);
});

// ── POST /api/scheduling/book ─────────────────────────────────────────────────
router.post("/book", async (req, res) => {
  const ip = getIp(req);

  // ── 1. Validate body ───────────────────────────────────────────────────────
  const parseResult = BookAppointmentBody.safeParse(req.body);
  if (!parseResult.success) {
    await recordBookingAttempt({
      email: req.body?.email ?? "unknown",
      slotId: req.body?.slotId ?? "unknown",
      ipAddress: ip,
      success: false,
      errorCode: "validation_error",
      errorDetail: parseResult.error.message,
    });
    res.status(400).json({
      error: "validation_error",
      message: parseResult.error.message,
    });
    return;
  }

  const body = parseResult.data;

  // ── 2. Rate limit (per IP:email) ───────────────────────────────────────────
  const rlKey = `book:${ip}:${body.email.toLowerCase()}`;
  if (isRateLimited(rlKey, BOOK_MAX_PER_10_MIN, BOOK_WINDOW_MS)) {
    console.warn(`[Scheduling] Rate limited: ${body.email} from ${ip}`);
    await recordBookingAttempt({
      email: body.email,
      slotId: body.slotId,
      ipAddress: ip,
      success: false,
      errorCode: "rate_limited",
      errorDetail: `IP ${ip}`,
    });
    res.status(429).json({
      error: "rate_limited",
      message: "Too many booking attempts. Please wait 10 minutes or call (800) 867-6768.",
    });
    return;
  }

  // ── 3. Verify slot is still available ─────────────────────────────────────
  let bookedSlotIds = new Set<string>();
  try {
    const db = getDb();
    const result = await db.query<{ slot_id: string }>(
      `SELECT slot_id FROM appointments WHERE status = 'confirmed' AND scheduled_time > NOW()`
    );
    bookedSlotIds = new Set(result.rows.map((r) => r.slot_id));
  } catch (err) {
    console.error("[Scheduling] Failed to load booked slots:", err);
    await recordBookingAttempt({
      email: body.email,
      slotId: body.slotId,
      ipAddress: ip,
      success: false,
      errorCode: "database_unavailable",
      errorDetail: String(err),
    });
    res.status(503).json({
      error: "database_unavailable",
      message: "Unable to verify slot availability. Please try again.",
    });
    return;
  }

  // Re-fetch busy periods for booking validation (prevents race with /slots)
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + DAYS_AHEAD + 1);
  const busyPeriods = await getBusyPeriods(now, windowEnd);

  const slots = generateAvailableSlots(bookedSlotIds, busyPeriods);
  const slot = slots.find((s) => s.id === body.slotId);

  if (!slot) {
    console.warn(`[Scheduling] Slot unavailable: ${body.slotId} for ${body.email}`);
    await recordBookingAttempt({
      email: body.email,
      slotId: body.slotId,
      ipAddress: ip,
      success: false,
      errorCode: "slot_unavailable",
      errorDetail: "Slot not found in available list",
    });
    res.status(400).json({
      error: "slot_unavailable",
      message: "The selected appointment slot is no longer available.",
    });
    return;
  }

  const confirmationId = `WHC-${Date.now().toString(36).toUpperCase()}`;

  // ── 4. INSERT appointment ──────────────────────────────────────────────────
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO appointments (
        confirmation_id, slot_id, scheduled_time, day_label, time_label,
        first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        confirmationId,
        body.slotId,
        slot.dateTime,
        slot.dayLabel,
        slot.timeLabel,
        body.firstName,
        body.lastName,
        body.email,
        body.phone,
        body.state,
        body.allocationType,
        body.allocationRange,
        body.timeline,
        "confirmed",
      ]
    );
    console.log(
      `[Scheduling] Appointment saved: ${confirmationId} — ${body.firstName} ${body.lastName} @ ${slot.timeLabel} ${slot.dayLabel}`
    );
  } catch (err: unknown) {
    const pgCode = (err as { code?: string }).code;
    const isSlotConflict = pgCode === "23505";

    console.error(`[Scheduling] INSERT failed (${pgCode}):`, err);

    await recordBookingAttempt({
      email: body.email,
      slotId: body.slotId,
      ipAddress: ip,
      success: false,
      errorCode: isSlotConflict ? "slot_conflict_db" : "db_insert_failed",
      errorDetail: String(err),
    });

    if (isSlotConflict) {
      res.status(409).json({
        error: "slot_unavailable",
        message: "That time slot was just taken. Please select another time.",
      });
    } else {
      res.status(503).json({
        error: "booking_failed",
        message: "Unable to save your appointment. Please call us at (800) 867-6768.",
      });
    }
    return;
  }

  // ── 5. Audit: record successful attempt ───────────────────────────────────
  await recordBookingAttempt({
    email: body.email,
    slotId: body.slotId,
    ipAddress: ip,
    success: true,
    confirmationId,
  });

  // ── 6. Lead linkage + Google Sheets sync (non-fatal) ─────────────────────
  Promise.resolve().then(async () => {
    try {
      const db = getDb();

      // Find or create the lead record; return its ID, status, and timestamps
      const updResult = await db.query<{
        id: number; status: string; created_at: Date; updated_at: Date;
      }>(
        `UPDATE leads
           SET form_type = 'appointment_booked',
               first_name = $2, last_name = $3, phone = $4, state = $5,
               allocation_type = $6, allocation_range = $7, timeline = $8,
               linked_confirmation_id = $9,
               updated_at = NOW()
         WHERE email = $1
           AND id = (
             SELECT id FROM leads WHERE email = $1
             ORDER BY created_at DESC LIMIT 1
           )
         RETURNING id, status, created_at, updated_at`,
        [
          body.email,
          body.firstName, body.lastName, body.phone, body.state,
          body.allocationType, body.allocationRange, body.timeline,
          confirmationId,
        ]
      );

      let leadRow = updResult.rows[0] ?? null;

      if (!leadRow) {
        // No existing lead — create one
        const insResult = await db.query<{
          id: number; status: string; created_at: Date; updated_at: Date;
        }>(
          `INSERT INTO leads (
            form_type, first_name, last_name, email, phone, state,
            allocation_type, allocation_range, timeline, ip_address,
            status, linked_confirmation_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11)
          RETURNING id, status, created_at, updated_at`,
          [
            "appointment_booked",
            body.firstName, body.lastName, body.email, body.phone, body.state,
            body.allocationType, body.allocationRange, body.timeline, ip,
            confirmationId,
          ]
        );
        leadRow = insResult.rows[0] ?? null;
      }

      const leadId = leadRow?.id ?? null;

      // Write lead_id back to the appointment row
      if (leadId) {
        await db.query(
          `UPDATE appointments SET lead_id = $1, updated_at = NOW() WHERE confirmation_id = $2`,
          [leadId, confirmationId]
        );
      }

      // Fetch the appointment's created_at for the sheet
      const apptRow = await db.query<{ created_at: Date; updated_at: Date; calendar_event_id: string | null }>(
        `SELECT created_at, updated_at, calendar_event_id FROM appointments WHERE confirmation_id = $1`,
        [confirmationId]
      );
      const appt = apptRow.rows[0];

      // ── Prospecting Pipeline sync ──────────────────────────────────────
      // The leads route owns prospect row creation (syncProspectToPipeline).
      // The scheduling route only merges appointment fields into that existing
      // row. All lead fields are passed as fallbackLeadData so the function can
      // insert a full row defensively if the leads.ts sync hasn't completed yet
      // or if a booking bypassed the normal lead-first flow.
      if (leadId) {
        await mergeAppointmentIntoPipeline({
          leadId:          String(leadId),
          confirmationId,
          scheduledTime:   slot.dateTime,
          dayLabel:        slot.dayLabel,
          timeLabel:       slot.timeLabel,
          calendarEventId: appt?.calendar_event_id ?? null,
          updatedAt:       appt?.updated_at.toISOString() ?? new Date().toISOString(),
          fallbackLeadData: leadRow ? {
            firstName:       body.firstName,
            lastName:        body.lastName,
            email:           body.email,
            phone:           body.phone ?? null,
            state:           body.state ?? null,
            allocationType:  body.allocationType ?? null,
            allocationRange: body.allocationRange ?? null,
            timeline:        body.timeline ?? null,
            formType:        "appointment_booked",
            createdAt:       leadRow.created_at.toISOString(),
          } : undefined,
        });
      }
    } catch (err) {
      console.error("[Scheduling] Lead linkage / Sheets sync error:", err);
    }
  }).catch((err) => console.error("[Scheduling] Lead linkage wrapper error:", err));

  // ── 7. Google Calendar event + emails (all non-fatal) ────────────────────
  Promise.all([
    // Create calendar event and store the event ID back in appointments
    createBookingEvent({
      confirmationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      state: body.state,
      allocationType: body.allocationType,
      allocationRange: body.allocationRange,
      timeline: body.timeline,
      slotStart: new Date(slot.dateTime),
      ownerEmail: OWNER_EMAIL,
    }).then(async (eventId) => {
      if (!eventId) return;
      try {
        const db = getDb();
        await db.query(
          `UPDATE appointments SET calendar_event_id = $1 WHERE confirmation_id = $2`,
          [eventId, confirmationId]
        );
      } catch (err) {
        console.error("[Scheduling] Failed to store calendar_event_id:", err);
      }
    }),

    // Owner notification email
    sendBookingNotification({
      confirmationId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      state: body.state,
      allocationType: body.allocationType,
      allocationRange: body.allocationRange,
      timeline: body.timeline,
      dayLabel: slot.dayLabel,
      timeLabel: slot.timeLabel,
    }),

    // Prospect confirmation email
    sendBookingConfirmation({
      to: body.email,
      firstName: body.firstName,
      confirmationId,
      dayLabel: slot.dayLabel,
      timeLabel: slot.timeLabel,
      scheduledTime: slot.dateTime,
      phone: body.phone,
      state: body.state,
      allocationType: body.allocationType,
      allocationRange: body.allocationRange,
      timeline: body.timeline,
    }),
  ]).catch((err) => console.error("[Scheduling] Post-booking operations error:", err));

  // ── 8. Respond ────────────────────────────────────────────────────────────
  const data = BookAppointmentResponse.parse({
    confirmationId,
    scheduledTime: slot.dateTime,
    dayLabel: slot.dayLabel,
    timeLabel: slot.timeLabel,
    message: "Your allocation discussion is confirmed.",
  });

  res.json(data);
});

export default router;
