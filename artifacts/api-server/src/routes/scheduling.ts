import { Router, type IRouter, type Request } from "express";
import {
  GetAvailableSlotsResponse,
  BookAppointmentBody,
  BookAppointmentResponse,
} from "@workspace/api-zod";
import { getDb, recordBookingAttempt } from "../db";
import { sendBookingNotification, sendBookingConfirmation } from "../lib/email";
import { isRateLimited } from "../lib/ratelimit";

const router: IRouter = Router();

// ─── Scheduling configuration ─────────────────────────────────────────────────
const START_HOUR_CT = 9;  // 9:00 AM CT
const END_HOUR_CT = 17;   // 5:00 PM CT
const LEAD_TIME_HOURS = 2;
const SLOTS_TO_SHOW = 14;
const DAYS_AHEAD = 14;

// Rate limit config
const SLOTS_MAX_PER_MIN = 30;       // per IP
const BOOK_MAX_PER_10_MIN = 3;      // per IP:email combo
const BOOK_WINDOW_MS = 10 * 60 * 1000;

function getIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
    req.ip ??
    "unknown"
  );
}

function generateAvailableSlots(bookedSlotIds: Set<string>) {
  const slots = [];
  const now = new Date();
  const CT_OFFSET = -5; // CDT (UTC-5); handles DST conservatively
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

    for (
      let hour = START_HOUR_CT;
      hour < END_HOUR_CT && count < SLOTS_TO_SHOW;
      hour += 1
    ) {
      const slotDate = new Date(day);
      slotDate.setUTCHours(hour - CT_OFFSET, 0, 0, 0);

      const hoursFromNow =
        (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursFromNow < LEAD_TIME_HOURS) continue;

      const slotId = `slot-${slotDate.getTime()}`;
      if (bookedSlotIds.has(slotId)) continue;

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

// ─── GET /api/scheduling/slots ─────────────────────────────────────────────────
router.get("/slots", async (req, res) => {
  const ip = getIp(req);

  if (isRateLimited(`slots:${ip}`, SLOTS_MAX_PER_MIN, 60_000)) {
    res.status(429).json({
      error: "rate_limited",
      message: "Too many requests. Please wait a moment and try again.",
    });
    return;
  }

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

  const slots = generateAvailableSlots(bookedSlotIds);
  const data = GetAvailableSlotsResponse.parse({
    slots,
    timezone: "America/Chicago",
  });
  res.json(data);
});

// ─── POST /api/scheduling/book ─────────────────────────────────────────────────
router.post("/book", async (req, res) => {
  const ip = getIp(req);

  // ── 1. Validate body ──────────────────────────────────────────────────────
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

  // ── 2. Rate limit (per IP:email) ──────────────────────────────────────────
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

  // ── 3. Verify slot is still available (application-level check) ───────────
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

  const slots = generateAvailableSlots(bookedSlotIds);
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

  // ── 4. INSERT appointment — hard failure; partial unique index enforces
  //       database-level slot exclusivity even under concurrent requests ──────
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
      ],
    );
    console.log(`[Scheduling] Appointment saved: ${confirmationId} — ${body.firstName} ${body.lastName} @ ${slot.timeLabel} ${slot.dayLabel}`);
  } catch (err: unknown) {
    // PostgreSQL error code 23505 = unique_violation → slot was taken concurrently
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

  // ── 6. Cross-write to leads (non-fatal) ───────────────────────────────────
  try {
    const db = getDb();
    const updated = await db.query(
      `UPDATE leads
         SET form_type = 'appointment_booked',
             first_name = $2, last_name = $3, phone = $4, state = $5,
             allocation_type = $6, allocation_range = $7, timeline = $8
       WHERE email = $1 AND form_type = 'schedule_prequal'
         AND id = (
           SELECT id FROM leads
           WHERE email = $1 AND form_type = 'schedule_prequal'
           ORDER BY created_at DESC LIMIT 1
         )`,
      [
        body.email,
        body.firstName,
        body.lastName,
        body.phone,
        body.state,
        body.allocationType,
        body.allocationRange,
        body.timeline,
      ]
    );

    if (updated.rowCount === 0) {
      await db.query(
        `INSERT INTO leads (
          form_type, first_name, last_name, email, phone, state,
          allocation_type, allocation_range, timeline, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          "appointment_booked",
          body.firstName,
          body.lastName,
          body.email,
          body.phone,
          body.state,
          body.allocationType,
          body.allocationRange,
          body.timeline,
          ip,
        ]
      );
      console.log(`[Scheduling] New appointment_booked lead created for ${body.email}`);
    } else {
      console.log(`[Scheduling] Upgraded schedule_prequal → appointment_booked for ${body.email}`);
    }
  } catch (err) {
    console.error("[Scheduling] Failed to sync lead record:", err);
  }

  // ── 7. Emails (non-fatal — booking is already confirmed) ──────────────────
  Promise.all([
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
    sendBookingConfirmation({
      to: body.email,
      firstName: body.firstName,
      confirmationId,
      dayLabel: slot.dayLabel,
      timeLabel: slot.timeLabel,
    }),
  ]).catch((err) => console.error("[Scheduling] Email dispatch error:", err));

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
