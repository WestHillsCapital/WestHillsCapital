import { Router, type IRouter } from "express";
import {
  GetAvailableSlotsResponse,
  BookAppointmentBody,
  BookAppointmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Scheduling configuration ─────────────────────────────────────────────────
// TODO: Replace mock slot generation with Google Calendar API
// Integration pattern:
//   1. Use googleapis npm package with service account credentials
//   2. Set GOOGLE_CALENDAR_ID and GOOGLE_SERVICE_ACCOUNT_KEY in environment variables
//   3. Query freebusy API to find open 45-minute windows
//   4. Create events via calendar.events.insert on booking

const CALL_DURATION_MINUTES = 45;
const BUFFER_MINUTES = 15;
const START_HOUR_CT = 9;
const END_HOUR_CT = 17;
const LEAD_TIME_HOURS = 2;
const SLOTS_TO_SHOW = 12;
const DAYS_AHEAD = 14;

function generateMockSlots() {
  const slots = [];
  const now = new Date();

  // Work in Central Time (UTC-6 standard, UTC-5 daylight)
  // For mock purposes, use UTC-5 (CDT)
  const CT_OFFSET = -5;

  let count = 0;
  let dayOffset = 0;

  while (count < SLOTS_TO_SHOW && dayOffset <= DAYS_AHEAD) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);

    const dayOfWeek = day.getDay();
    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      dayOffset++;
      continue;
    }

    // Generate slots for this day
    for (
      let hour = START_HOUR_CT;
      hour < END_HOUR_CT && count < SLOTS_TO_SHOW;
      hour += 1
    ) {
      // Slot start in CT
      const slotDate = new Date(day);
      slotDate.setUTCHours(hour - CT_OFFSET, 0, 0, 0);

      // Check minimum lead time
      const hoursFromNow =
        (slotDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursFromNow < LEAD_TIME_HOURS) continue;

      // Mock: randomly mark some slots as unavailable (~20% chance)
      const available = Math.random() > 0.2;

      const dayLabel = slotDate.toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        month: "long",
        day: "numeric",
      });

      const timeLabel = slotDate.toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " CT";

      slots.push({
        id: `slot-${slotDate.getTime()}`,
        dateTime: slotDate.toISOString(),
        dayLabel,
        timeLabel,
        available,
      });

      if (available) count++;
    }

    dayOffset++;
  }

  return slots.filter((s) => s.available);
}

// GET /api/scheduling/slots
router.get("/slots", (_req, res) => {
  const slots = generateMockSlots();
  const data = GetAvailableSlotsResponse.parse({
    slots,
    timezone: "America/Chicago",
  });
  res.json(data);
});

// POST /api/scheduling/book
router.post("/book", (req, res) => {
  const parseResult = BookAppointmentBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "validation_error",
      message: parseResult.error.message,
    });
    return;
  }

  const body = parseResult.data;

  // TODO: Integrate with Google Calendar
  // 1. Create a calendar event for the selected slot
  // 2. Send confirmation email via SendGrid/Postmark (set SENDGRID_API_KEY)
  // 3. Log lead to Google Sheets (set GOOGLE_SHEETS_ID)
  // 4. Mark slot as booked to prevent double-booking

  // Find the slot details from mock data (in production, fetch from calendar)
  const slots = generateMockSlots();
  const slot = slots.find((s) => s.id === body.slotId);

  if (!slot) {
    res.status(400).json({
      error: "slot_unavailable",
      message: "The selected appointment slot is no longer available.",
    });
    return;
  }

  const confirmationId = `WHC-${Date.now().toString(36).toUpperCase()}`;

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
