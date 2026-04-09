import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { logger } from "../lib/logger";
import { getDb } from "../db";
import { createBookingEvent } from "../lib/google-calendar";

const router: IRouter = Router();

/**
 * POST /api/calendar-setup
 *
 * One-time utility: creates a "WHC Bookings" calendar owned by the service
 * account, optionally shares it back to a human email for viewing, and returns
 * the calendar ID to paste into Railway as GOOGLE_BOOKING_CALENDAR_ID.
 *
 * Protected by a setup token so it can't be called by anyone else.
 * Body: { token: string, shareWithEmail?: string }
 */
router.post("/", async (req, res) => {
  const SETUP_TOKEN = process.env.CALENDAR_SETUP_TOKEN;

  if (!SETUP_TOKEN) {
    res.status(503).json({ error: "CALENDAR_SETUP_TOKEN env var not set on this server." });
    return;
  }

  if (req.body?.token !== SETUP_TOKEN) {
    res.status(401).json({ error: "Invalid token." });
    return;
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not configured." });
    return;
  }

  let credentials: object;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON." });
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  // 1. Create the calendar
  let calendarId: string;
  try {
    const created = await calendar.calendars.insert({
      requestBody: {
        summary: "WHC Bookings",
        description: "West Hills Capital — confirmed allocation call appointments",
        timeZone: "America/Chicago",
      },
    });
    calendarId = created.data.id!;
    logger.info({ calendarId }, "[CalendarSetup] Calendar created");
  } catch (err) {
    logger.error({ err }, "[CalendarSetup] Failed to create calendar");
    res.status(500).json({ error: "Failed to create calendar.", detail: String(err) });
    return;
  }

  // 2. Optionally share it back to a human email (read-only viewer)
  const shareWithEmail: string | undefined =
    req.body?.shareWithEmail ?? process.env.ADMIN_EMAIL;

  if (shareWithEmail) {
    try {
      await calendar.acl.insert({
        calendarId,
        requestBody: {
          role: "reader",
          scope: { type: "user", value: shareWithEmail },
        },
      });
      logger.info({ shareWithEmail }, "[CalendarSetup] Viewer access granted");
    } catch (err) {
      logger.warn({ err }, "[CalendarSetup] Could not share calendar — continuing");
    }
  }

  // 3. Build the "Add to my calendars" URL the owner can click
  const addToCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;

  res.json({
    success: true,
    calendarId,
    addToCalendarUrl,
    nextSteps: [
      `1. Copy this value into Railway as the env var GOOGLE_BOOKING_CALENDAR_ID: ${calendarId}`,
      `2. Open this URL in your browser to subscribe so you can see bookings: ${addToCalendarUrl}`,
      `3. Once done, remove CALENDAR_SETUP_TOKEN from Railway so this endpoint is disabled.`,
    ],
  });
});

/**
 * POST /api/calendar-setup/share
 *
 * Grants viewer access on an existing service-account-owned calendar to a
 * human Google account. Use when the initial share step failed silently.
 *
 * Body: { token: string, calendarId: string, email: string }
 */
router.post("/share", async (req, res) => {
  const SETUP_TOKEN = process.env.CALENDAR_SETUP_TOKEN;

  if (!SETUP_TOKEN) {
    res.status(503).json({ error: "CALENDAR_SETUP_TOKEN env var not set on this server." });
    return;
  }

  if (req.body?.token !== SETUP_TOKEN) {
    res.status(401).json({ error: "Invalid token." });
    return;
  }

  const { calendarId, email } = req.body ?? {};
  if (!calendarId || !email) {
    res.status(400).json({ error: "calendarId and email are required." });
    return;
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) {
    res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not configured." });
    return;
  }

  let credentials: object;
  try {
    credentials = JSON.parse(keyJson);
  } catch {
    res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON." });
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  try {
    await calendar.acl.insert({
      calendarId,
      requestBody: {
        role: "reader",
        scope: { type: "user", value: email },
      },
    });
    logger.info({ calendarId, email }, "[CalendarSetup] Viewer access granted via /share");
  } catch (err) {
    logger.error({ err }, "[CalendarSetup] /share ACL insert failed");
    res.status(500).json({ error: "Failed to grant access.", detail: String(err) });
    return;
  }

  const addToCalendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;

  res.json({
    success: true,
    message: `Viewer access granted to ${email}`,
    addToCalendarUrl,
  });
});

/**
 * POST /api/calendar-setup/backfill
 *
 * Looks up a confirmed appointment by confirmationId, creates the missing
 * Google Calendar event, and stores the event ID back in the DB.
 *
 * Body: { token: string, confirmationId: string }
 */
router.post("/backfill", async (req, res) => {
  const SETUP_TOKEN = process.env.CALENDAR_SETUP_TOKEN;

  if (!SETUP_TOKEN) {
    res.status(503).json({ error: "CALENDAR_SETUP_TOKEN env var not set on this server." });
    return;
  }

  if (req.body?.token !== SETUP_TOKEN) {
    res.status(401).json({ error: "Invalid token." });
    return;
  }

  const { confirmationId } = req.body ?? {};
  if (!confirmationId) {
    res.status(400).json({ error: "confirmationId is required." });
    return;
  }

  const OWNER_EMAIL = process.env.ADMIN_EMAIL ?? "";

  // Fetch the appointment from the DB
  let row: Record<string, string> | null = null;
  try {
    const db = getDb();
    const result = await db.query<Record<string, string>>(
      `SELECT confirmation_id, first_name, last_name, email, phone, state,
              allocation_type, allocation_range, timeline,
              scheduled_time, day_label, time_label, calendar_event_id
       FROM appointments
       WHERE confirmation_id = $1`,
      [confirmationId]
    );
    row = result.rows[0] ?? null;
  } catch (err) {
    res.status(503).json({ error: "Database query failed.", detail: String(err) });
    return;
  }

  if (!row) {
    res.status(404).json({ error: `No appointment found with ID: ${confirmationId}` });
    return;
  }

  if (row.calendar_event_id) {
    res.json({
      success: true,
      alreadyExists: true,
      calendarEventId: row.calendar_event_id,
      message: "This appointment already has a calendar event — no action taken.",
    });
    return;
  }

  // Pre-flight checks before calling createBookingEvent
  const bookingCalendarId = process.env.GOOGLE_BOOKING_CALENDAR_ID;
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!bookingCalendarId) {
    res.status(503).json({ error: "GOOGLE_BOOKING_CALENDAR_ID is not set in Railway." });
    return;
  }

  if (!serviceAccountKey) {
    res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is not set in Railway." });
    return;
  }

  let parsedKey: object;
  try {
    parsedKey = JSON.parse(serviceAccountKey);
  } catch {
    res.status(503).json({ error: "GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON." });
    return;
  }

  // Quick connectivity test — list the calendar to confirm access
  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.GoogleAuth({
      credentials: parsedKey,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const cal = google.calendar({ version: "v3", auth });
    await cal.calendars.get({ calendarId: bookingCalendarId });
  } catch (err) {
    res.status(500).json({
      error: "Service account cannot access the booking calendar.",
      detail: String(err),
      calendarId: bookingCalendarId,
    });
    return;
  }

  // Create the calendar event directly so we can surface the exact error
  const DURATION_MS = (Number(process.env.APPOINTMENT_DURATION_MINUTES) || 60) * 60 * 1000;
  const slotStart = new Date(row.scheduled_time);
  const slotEnd   = new Date(slotStart.getTime() + DURATION_MS);

  let eventId: string | null = null;
  try {
    const { google: goog } = await import("googleapis");
    const auth2 = new goog.auth.GoogleAuth({
      credentials: parsedKey,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
    const cal2 = goog.calendar({ version: "v3", auth: auth2 });
    const event = await cal2.events.insert({
      calendarId: bookingCalendarId,
      requestBody: {
        summary: `WHC Allocation Call — ${row.first_name} ${row.last_name}`,
        description: `Confirmation ID: ${row.confirmation_id}\n\nName: ${row.first_name} ${row.last_name}\nEmail: ${row.email}\nPhone: ${row.phone}\nState: ${row.state}`,
        start: { dateTime: slotStart.toISOString(), timeZone: "America/Chicago" },
        end:   { dateTime: slotEnd.toISOString(),   timeZone: "America/Chicago" },
        status: "confirmed",
      },
    });
    eventId = event.data.id ?? null;
  } catch (err) {
    res.status(500).json({
      error: "events.insert failed",
      detail: String(err),
      calendarId: bookingCalendarId,
    });
    return;
  }

  if (!eventId) {
    res.status(500).json({ error: "events.insert returned no event ID." });
    return;
  }

  // Store the event ID back in the DB
  try {
    const db = getDb();
    await db.query(
      `UPDATE appointments SET calendar_event_id = $1 WHERE confirmation_id = $2`,
      [eventId, confirmationId]
    );
  } catch (err) {
    logger.error({ err }, "[CalendarSetup] Failed to store calendar_event_id after backfill");
  }

  logger.info({ confirmationId, eventId }, "[CalendarSetup] Backfill complete");

  res.json({
    success: true,
    confirmationId,
    calendarEventId: eventId,
    message: `Calendar event created for ${row.first_name} ${row.last_name} — ${row.day_label} at ${row.time_label}`,
  });
});

export default router;
