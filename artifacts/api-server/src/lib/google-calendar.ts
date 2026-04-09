import { google } from "googleapis";
import { logger } from "./logger";

// ── Configuration ─────────────────────────────────────────────────────────────

export const APPOINTMENT_DURATION_MINUTES =
  Number(process.env.APPOINTMENT_DURATION_MINUTES) || 60;

export const APPOINTMENT_BUFFER_MINUTES =
  Number(process.env.APPOINTMENT_BUFFER_MINUTES) || 15;

const BLOCKER_CALENDAR_IDS = (process.env.GOOGLE_BLOCKER_CALENDAR_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const BOOKING_CALENDAR_ID = process.env.GOOGLE_BOOKING_CALENDAR_ID ?? "";

// ── Auth ──────────────────────────────────────────────────────────────────────

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;
  try {
    const credentials = JSON.parse(keyJson);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  } catch (err) {
    logger.error({ err }, "[Calendar] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY");
    return null;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BusyPeriod {
  start: Date;
  end: Date;
}

// ── Read: busy times from blocker calendars ───────────────────────────────────

export async function getBusyPeriods(
  timeMin: Date,
  timeMax: Date
): Promise<BusyPeriod[]> {
  if (BLOCKER_CALENDAR_IDS.length === 0) return [];

  const auth = getAuth();
  if (!auth) {
    logger.warn("[Calendar] No credentials configured — busy check skipped");
    return [];
  }

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const resp = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: BLOCKER_CALENDAR_IDS.map((id) => ({ id })),
      },
    });

    const periods: BusyPeriod[] = [];
    const calendars = resp.data.calendars ?? {};
    for (const calId of BLOCKER_CALENDAR_IDS) {
      const busy = calendars[calId]?.busy ?? [];
      for (const period of busy) {
        if (period.start && period.end) {
          periods.push({
            start: new Date(period.start),
            end: new Date(period.end),
          });
        }
      }
    }

    logger.info(
      { count: periods.length, calendars: BLOCKER_CALENDAR_IDS.length },
      "[Calendar] Fetched busy periods"
    );
    return periods;
  } catch (err) {
    logger.error({ err }, "[Calendar] freebusy query failed — proceeding without busy check");
    return [];
  }
}

// ── Overlap check ─────────────────────────────────────────────────────────────

/**
 * Returns true if the slot (of APPOINTMENT_DURATION_MINUTES length, padded by
 * APPOINTMENT_BUFFER_MINUTES on each side) overlaps any busy period.
 */
export function isSlotBusy(slotStart: Date, busyPeriods: BusyPeriod[]): boolean {
  if (busyPeriods.length === 0) return false;
  const bufferMs = APPOINTMENT_BUFFER_MINUTES * 60 * 1000;
  const durationMs = APPOINTMENT_DURATION_MINUTES * 60 * 1000;
  const windowStart = new Date(slotStart.getTime() - bufferMs);
  const windowEnd = new Date(slotStart.getTime() + durationMs + bufferMs);
  return busyPeriods.some((p) => windowStart < p.end && windowEnd > p.start);
}

// ── Write: create a confirmed booking event ───────────────────────────────────

const ALLOCATION_LABELS: Record<string, string> = {
  physical_delivery: "Physical Home/Vault Delivery",
  ira_rollover: "IRA Rollover / Transfer",
  not_sure: "Not sure yet",
};

const RANGE_LABELS: Record<string, string> = {
  under_50k: "Under $50,000",
  "50k_150k": "$50,000 – $150,000",
  "150k_500k": "$150,000 – $500,000",
  "500k_plus": "$500,000+",
};

const TIMELINE_LABELS: Record<string, string> = {
  ready: "Ready to move forward now",
  within_30_days: "Planning within next 30 days",
  researching: "Just researching options",
};

export async function createBookingEvent(params: {
  confirmationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
  slotStart: Date;
  ownerEmail: string;
}): Promise<string | null> {
  if (!BOOKING_CALENDAR_ID) {
    logger.warn("[Calendar] GOOGLE_BOOKING_CALENDAR_ID not set — event creation skipped");
    return null;
  }

  const auth = getAuth();
  if (!auth) {
    logger.warn("[Calendar] No credentials configured — event creation skipped");
    return null;
  }

  const slotEnd = new Date(
    params.slotStart.getTime() + APPOINTMENT_DURATION_MINUTES * 60 * 1000
  );

  const description = [
    `Confirmation ID: ${params.confirmationId}`,
    ``,
    `Contact`,
    `  Name:  ${params.firstName} ${params.lastName}`,
    `  Email: ${params.email}`,
    `  Phone: ${params.phone}`,
    `  State: ${params.state}`,
    ``,
    `Prequal`,
    `  Structure:  ${ALLOCATION_LABELS[params.allocationType] ?? params.allocationType}`,
    `  Allocation: ${RANGE_LABELS[params.allocationRange] ?? params.allocationRange}`,
    `  Timeline:   ${TIMELINE_LABELS[params.timeline] ?? params.timeline}`,
    ``,
    `West Hills Capital — (800) 867-6768`,
  ].join("\n");

  try {
    const calendar = google.calendar({ version: "v3", auth });
    const event = await calendar.events.insert({
      calendarId: BOOKING_CALENDAR_ID,
      requestBody: {
        summary: `WHC Allocation Call — ${params.firstName} ${params.lastName}`,
        description,
        start: {
          dateTime: params.slotStart.toISOString(),
          timeZone: "America/Chicago",
        },
        end: {
          dateTime: slotEnd.toISOString(),
          timeZone: "America/Chicago",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 15 },
          ],
        },
        status: "confirmed",
      },
    });

    const eventId = event.data.id ?? null;
    logger.info(
      { eventId, confirmationId: params.confirmationId },
      "[Calendar] Booking event created"
    );
    return eventId;
  } catch (err) {
    logger.error({ err }, "[Calendar] Failed to create event — booking still confirmed in DB");
    return null;
  }
}
