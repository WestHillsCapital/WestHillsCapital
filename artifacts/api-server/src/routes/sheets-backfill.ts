import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { syncAppointmentToSheet, syncLeadToSheet } from "../lib/google-sheets";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /api/sheets-backfill
 *
 * Resyncs all appointments and leads from PostgreSQL into Google Sheets.
 * Protected by CALENDAR_SETUP_TOKEN (same token used for calendar-setup).
 * Body: { token: string }
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
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    res.status(503).json({ error: "GOOGLE_SHEETS_SPREADSHEET_ID not set." });
    return;
  }

  const db = getDb();
  const results = { appointments: { ok: 0, failed: 0 }, leads: { ok: 0, failed: 0 } };

  // ── Appointments ────────────────────────────────────────────────────────────
  const appts = await db.query<{
    confirmation_id: string; slot_id: string; scheduled_time: Date;
    day_label: string; time_label: string; first_name: string; last_name: string;
    email: string; phone: string; state: string; allocation_type: string;
    allocation_range: string; timeline: string; status: string;
    lead_id: number | null; calendar_event_id: string | null;
    created_at: Date; updated_at: Date;
  }>(`SELECT * FROM appointments ORDER BY created_at ASC`);

  for (const a of appts.rows) {
    try {
      await syncAppointmentToSheet({
        confirmationId:  a.confirmation_id,
        slotId:          a.slot_id,
        scheduledTime:   a.scheduled_time.toISOString(),
        dayLabel:        a.day_label,
        timeLabel:       a.time_label,
        firstName:       a.first_name,
        lastName:        a.last_name,
        email:           a.email,
        phone:           a.phone,
        state:           a.state,
        allocationType:  a.allocation_type,
        allocationRange: a.allocation_range,
        timeline:        a.timeline,
        status:          a.status,
        leadId:          a.lead_id ? String(a.lead_id) : null,
        calendarEventId: a.calendar_event_id,
        createdAt:       a.created_at.toISOString(),
        updatedAt:       a.updated_at.toISOString(),
      });
      results.appointments.ok++;
      logger.info({ confirmationId: a.confirmation_id }, "[Backfill] Appointment synced");
    } catch (err) {
      results.appointments.failed++;
      logger.error({ err, confirmationId: a.confirmation_id }, "[Backfill] Appointment sync failed");
    }
  }

  // ── Leads ───────────────────────────────────────────────────────────────────
  const leads = await db.query<{
    id: number; form_type: string; first_name: string; last_name: string;
    email: string; phone: string | null; state: string | null;
    allocation_type: string | null; allocation_range: string | null;
    timeline: string | null; status: string | null; current_custodian: string | null;
    linked_confirmation_id: string | null; created_at: Date; updated_at: Date;
  }>(`SELECT * FROM leads ORDER BY created_at ASC`);

  for (const l of leads.rows) {
    try {
      await syncLeadToSheet({
        id:                   String(l.id),
        firstName:            l.first_name,
        lastName:             l.last_name,
        email:                l.email,
        phone:                l.phone,
        state:                l.state,
        allocationType:       l.allocation_type,
        allocationRange:      l.allocation_range,
        timeline:             l.timeline,
        formType:             l.form_type,
        status:               l.status,
        currentCustodian:     l.current_custodian,
        linkedConfirmationId: l.linked_confirmation_id,
        createdAt:            l.created_at.toISOString(),
        updatedAt:            l.updated_at.toISOString(),
      });
      results.leads.ok++;
      logger.info({ leadId: l.id }, "[Backfill] Lead synced");
    } catch (err) {
      results.leads.failed++;
      logger.error({ err, leadId: l.id }, "[Backfill] Lead sync failed");
    }
  }

  logger.info({ results }, "[Backfill] Complete");
  res.json({ ok: true, results });
});

export default router;
