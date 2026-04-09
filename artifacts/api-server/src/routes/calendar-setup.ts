import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { logger } from "../lib/logger";

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

export default router;
