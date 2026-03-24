import { Router, type IRouter } from "express";
import {
  GetAvailableSlotsResponse,
  BookAppointmentBody,
  BookAppointmentResponse,
} from "@workspace/api-zod";
import { getDb } from "../db";

const router: IRouter = Router();

// ─── Scheduling configuration ─────────────────────────────────────────────────
const START_HOUR_CT = 9;  // 9:00 AM CT
const END_HOUR_CT = 17;   // 5:00 PM CT
const LEAD_TIME_HOURS = 2;
const SLOTS_TO_SHOW = 14;
const DAYS_AHEAD = 14;

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
      if (bookedSlotIds.has(slotId)) continue; // Skip already booked

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

// GET /api/scheduling/slots
router.get("/slots", async (_req, res) => {
  let bookedSlotIds = new Set<string>();
  try {
    const db = getDb();
    const result = await db.query<{ slot_id: string }>(
      `SELECT slot_id FROM appointments WHERE status = 'confirmed' AND scheduled_time > NOW()`
    );
    bookedSlotIds = new Set(result.rows.map((r) => r.slot_id));
  } catch (err) {
    console.error("[Scheduling] Failed to load booked slots:", err);
  }

  const slots = generateAvailableSlots(bookedSlotIds);
  const data = GetAvailableSlotsResponse.parse({
    slots,
    timezone: "America/Chicago",
  });
  res.json(data);
});

// POST /api/scheduling/book
router.post("/book", async (req, res) => {
  const parseResult = BookAppointmentBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "validation_error",
      message: parseResult.error.message,
    });
    return;
  }

  const body = parseResult.data;

  // Get all booked slots to build slot details and verify availability
  let bookedSlotIds = new Set<string>();
  try {
    const db = getDb();
    const result = await db.query<{ slot_id: string }>(
      `SELECT slot_id FROM appointments WHERE status = 'confirmed' AND scheduled_time > NOW()`
    );
    bookedSlotIds = new Set(result.rows.map((r) => r.slot_id));
  } catch (err) {
    console.error("[Scheduling] Failed to load booked slots:", err);
  }

  const slots = generateAvailableSlots(bookedSlotIds);
  const slot = slots.find((s) => s.id === body.slotId);

  if (!slot) {
    res.status(400).json({
      error: "slot_unavailable",
      message: "The selected appointment slot is no longer available.",
    });
    return;
  }

  const confirmationId = `WHC-${Date.now().toString(36).toUpperCase()}`;

  // Save appointment to database
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
    console.log(`[Scheduling] Appointment booked: ${confirmationId} — ${body.firstName} ${body.lastName} @ ${slot.timeLabel} ${slot.dayLabel}`);
  } catch (err) {
    console.error("[Scheduling] Failed to save appointment:", err);
  }

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
