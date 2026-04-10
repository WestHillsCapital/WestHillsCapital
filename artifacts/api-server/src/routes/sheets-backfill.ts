import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { syncAppointmentToSheet, syncLeadToSheet } from "../lib/google-sheets";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── HTML helpers ──────────────────────────────────────────────────────────────

function page(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>WHC · Sheets Backfill</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#f5f5f3;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
    .card{background:#fff;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,.1);padding:2.5rem;max-width:480px;width:100%}
    h1{font-size:1.25rem;font-weight:700;color:#1a1a1a;margin-bottom:.375rem}
    .sub{font-size:.85rem;color:#666;margin-bottom:1.75rem}
    label{display:block;font-size:.85rem;font-weight:600;color:#333;margin-bottom:.375rem}
    input[type=password]{width:100%;padding:.625rem .75rem;border:1.5px solid #d1d5db;border-radius:6px;font-size:.95rem;outline:none;transition:border .15s}
    input[type=password]:focus{border-color:#b8960c}
    button{margin-top:1.25rem;width:100%;padding:.75rem;background:#b8960c;color:#fff;font-size:.95rem;font-weight:600;border:none;border-radius:6px;cursor:pointer;transition:background .15s}
    button:hover{background:#9a7c0a}
    .warn{margin-top:1.25rem;font-size:.8rem;color:#888;border-top:1px solid #eee;padding-top:1rem}
    .result{margin-top:1.5rem;padding:1rem;border-radius:6px;font-size:.9rem;line-height:1.6}
    .ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534}
    .fail{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
    .stat{font-size:1rem;font-weight:700;margin-bottom:.25rem}
    a{color:#b8960c;font-size:.85rem;display:inline-block;margin-top:1.25rem}
  </style>
</head>
<body>
<div class="card">${body}</div>
</body>
</html>`;
}

const FORM_HTML = page(`
  <h1>Sheets Backfill</h1>
  <p class="sub">Resyncs all appointments and leads from the database into Google Sheets. Safe to run multiple times.</p>
  <form method="POST">
    <label for="token">Setup Token</label>
    <input type="password" id="token" name="token" placeholder="Paste your CALENDAR_SETUP_TOKEN" required autofocus>
    <button type="submit">Run Backfill</button>
  </form>
  <p class="warn">This page is temporary. Delete the route from Railway once the backfill is confirmed.</p>
`);

// ── GET: serve the form ───────────────────────────────────────────────────────

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(FORM_HTML);
});

// ── POST: run the backfill ────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  const SETUP_TOKEN = process.env.CALENDAR_SETUP_TOKEN;
  const wantsJson = req.headers["content-type"]?.includes("application/json");

  function fail(status: number, msg: string) {
    if (wantsJson) { res.status(status).json({ error: msg }); return; }
    res.status(status).setHeader("Content-Type", "text/html").send(
      page(`<h1>Error</h1><div class="result fail">${msg}</div><a href="/api/sheets-backfill">← Back</a>`)
    );
  }

  if (!SETUP_TOKEN) return fail(503, "CALENDAR_SETUP_TOKEN env var not set.");
  const token = wantsJson ? req.body?.token : req.body?.token;
  if (token !== SETUP_TOKEN) return fail(401, "Invalid token. Go back and try again.");
  if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID) return fail(503, "GOOGLE_SHEETS_SPREADSHEET_ID not set.");

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

  if (wantsJson) {
    res.json({ ok: true, results });
    return;
  }

  const anyFailed = results.appointments.failed > 0 || results.leads.failed > 0;
  const cls = anyFailed ? "fail" : "ok";
  const icon = anyFailed ? "⚠️" : "✅";

  res.setHeader("Content-Type", "text/html").send(page(`
    <h1>${icon} Backfill ${anyFailed ? "completed with errors" : "complete"}</h1>
    <div class="result ${cls}">
      <div class="stat">Appointments: ${results.appointments.ok} synced${results.appointments.failed ? `, ${results.appointments.failed} failed` : ""}</div>
      <div class="stat">Leads: ${results.leads.ok} synced${results.leads.failed ? `, ${results.leads.failed} failed` : ""}</div>
    </div>
    <p class="warn">
      ${anyFailed
        ? "Some rows failed — check Railway logs for details."
        : "All done. Open your Google Sheet to confirm the rows are there. You can now delete or disable this route."}
    </p>
    <a href="/api/sheets-backfill">← Run again</a>
  `));
});

export default router;
