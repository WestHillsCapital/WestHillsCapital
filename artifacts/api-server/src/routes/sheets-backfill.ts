import { Router, type IRouter } from "express";
import { getDb } from "../db";
import {
  syncAppointmentToSheet,
  syncLeadToSheet,
  syncProspectToPipeline,
  mergeAppointmentIntoPipeline,
  testSheetsConnection,
} from "../lib/google-sheets";
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
  <p class="sub">Resyncs database records into Google Sheets. Safe to run multiple times.</p>
  <form method="POST">
    <label for="token">Setup Token</label>
    <input type="password" id="token" name="token" placeholder="Paste your CALENDAR_SETUP_TOKEN" required autofocus>
    <label style="margin-top:1rem">Backfill target</label>
    <select name="action" style="width:100%;padding:.625rem .75rem;border:1.5px solid #d1d5db;border-radius:6px;font-size:.95rem;margin-bottom:.25rem">
      <option value="pipeline">Prospecting Pipeline (new unified tab — run this)</option>
      <option value="legacy">Legacy appointments + leads tabs (archive only)</option>
    </select>
    <button type="submit">Run Backfill</button>
  </form>
  <p class="warn">The <strong>Prospecting Pipeline</strong> backfill reads all leads from the database and writes one row per prospect, merging in appointment details where linked. Run it once after deployment to populate historical records.</p>
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

  const action: string = req.body?.action ?? "pipeline";

  // ── Connection check: fail loudly before touching any rows ─────────────────
  const connError = await testSheetsConnection();
  if (connError) {
    logger.error({ connError }, "[Backfill] Sheets connection failed");
    return fail(503, `Google Sheets connection failed: ${connError}`);
  }

  const db = getDb();

  type RowError = { id: string; email: string; error: string };

  function toISO(d: Date | null | undefined): string {
    if (!d) return new Date().toISOString();
    if (typeof (d as unknown as { toISOString?: unknown }).toISOString === "function") return d.toISOString();
    return new Date(d).toISOString();
  }

  function errorTable(errors: RowError[]): string {
    if (!errors.length) return "";
    return `<table style="width:100%;font-size:.78rem;border-collapse:collapse;margin-top:.75rem">
      <tr><th style="text-align:left;padding:3px 6px;background:#fee2e2">ID</th><th style="text-align:left;padding:3px 6px;background:#fee2e2">Email</th><th style="text-align:left;padding:3px 6px;background:#fee2e2">Error</th></tr>
      ${errors.map(e => `<tr><td style="padding:3px 6px;border-top:1px solid #fecaca">${e.id}</td><td style="padding:3px 6px;border-top:1px solid #fecaca">${e.email}</td><td style="padding:3px 6px;border-top:1px solid #fecaca;word-break:break-all">${e.error}</td></tr>`).join("")}
    </table>`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PIPELINE BACKFILL — one row per prospect (lead-first architecture)
  // Reads all leads, upserts each as a prospect row, then merges appointment
  // details for any lead that has a linked appointment.
  // ══════════════════════════════════════════════════════════════════════════
  if (action === "pipeline") {
    const leads = await db.query<{
      id: number; form_type: string; first_name: string; last_name: string;
      email: string; phone: string | null; state: string | null;
      allocation_type: string | null; allocation_range: string | null;
      timeline: string | null; current_custodian: string | null;
      linked_confirmation_id: string | null;
      created_at: Date | null; updated_at: Date | null;
    }>(`SELECT * FROM leads ORDER BY created_at ASC`);

    // Build a lookup: confirmation_id → appointment row (for merge step)
    const appts = await db.query<{
      confirmation_id: string; scheduled_time: Date | null;
      day_label: string; time_label: string;
      lead_id: number | null; calendar_event_id: string | null;
      updated_at: Date | null;
    }>(`SELECT confirmation_id, scheduled_time, day_label, time_label,
               lead_id, calendar_event_id, updated_at
          FROM appointments ORDER BY created_at ASC`);
    const apptByConfId = new Map(appts.rows.map((a) => [a.confirmation_id, a]));

    const results = { prospects: { ok: 0, failed: 0, errors: [] as RowError[] } };

    for (const l of leads.rows) {
      try {
        // Step 1: upsert the prospect row
        await syncProspectToPipeline({
          leadId:               String(l.id),
          firstName:            l.first_name,
          lastName:             l.last_name,
          email:                l.email,
          phone:                l.phone,
          state:                l.state,
          allocationType:       l.allocation_type,
          allocationRange:      l.allocation_range,
          timeline:             l.timeline,
          formType:             l.form_type,
          currentCustodian:     l.current_custodian,
          linkedConfirmationId: l.linked_confirmation_id,
          createdAt:            toISO(l.created_at),
          updatedAt:            toISO(l.updated_at),
        });

        // Step 2: merge appointment details if this lead has a linked appointment
        if (l.linked_confirmation_id) {
          const appt = apptByConfId.get(l.linked_confirmation_id);
          if (appt) {
            await mergeAppointmentIntoPipeline({
              leadId:          String(l.id),
              confirmationId:  l.linked_confirmation_id,
              scheduledTime:   toISO(appt.scheduled_time),
              dayLabel:        appt.day_label,
              timeLabel:       appt.time_label,
              calendarEventId: appt.calendar_event_id,
              updatedAt:       toISO(appt.updated_at),
            });
          }
        }

        results.prospects.ok++;
        logger.info({ leadId: l.id }, "[Backfill] Prospect synced to pipeline");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.prospects.failed++;
        results.prospects.errors.push({ id: String(l.id), email: l.email, error: msg });
        logger.error({ err, leadId: l.id }, "[Backfill] Pipeline prospect sync failed");
      }
    }

    logger.info({ results }, "[Backfill:pipeline] Complete");

    if (wantsJson) { res.json({ ok: true, action: "pipeline", results }); return; }

    const anyFailed = results.prospects.failed > 0;
    const cls = anyFailed ? "fail" : "ok";
    const icon = anyFailed ? "⚠️" : "✅";

    return res.setHeader("Content-Type", "text/html").send(page(`
      <h1>${icon} Pipeline Backfill ${anyFailed ? "completed with errors" : "complete"}</h1>
      <div class="result ${cls}">
        <div class="stat">Prospects: ${results.prospects.ok} synced to Prospecting Pipeline${results.prospects.failed ? `, ${results.prospects.failed} failed` : ""}</div>
        ${errorTable(results.prospects.errors)}
      </div>
      <p class="warn">
        ${anyFailed
          ? "Failed rows are shown above. Each prospect that failed will not appear in the pipeline — the others are safe."
          : "All done. Open the <strong>Prospecting Pipeline</strong> tab in your Master Sheet to confirm the rows are there."}
      </p>
      <a href="/api/sheets-backfill">← Run again</a>
    `));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEGACY BACKFILL — writes to old appointments + leads archive tabs
  // ══════════════════════════════════════════════════════════════════════════
  const results = {
    appointments: { ok: 0, failed: 0, errors: [] as RowError[] },
    leads:        { ok: 0, failed: 0, errors: [] as RowError[] },
  };

  // ── Appointments ────────────────────────────────────────────────────────────
  const appts2 = await db.query<{
    confirmation_id: string; slot_id: string; scheduled_time: Date | null;
    day_label: string; time_label: string; first_name: string; last_name: string;
    email: string; phone: string; state: string; allocation_type: string;
    allocation_range: string; timeline: string; status: string;
    lead_id: number | null; calendar_event_id: string | null;
    created_at: Date | null; updated_at: Date | null;
  }>(`SELECT * FROM appointments ORDER BY created_at ASC`);

  for (const a of appts2.rows) {
    try {
      await syncAppointmentToSheet({
        confirmationId:  a.confirmation_id,
        slotId:          a.slot_id,
        scheduledTime:   toISO(a.scheduled_time),
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
        createdAt:       toISO(a.created_at),
        updatedAt:       toISO(a.updated_at),
      });
      results.appointments.ok++;
      logger.info({ confirmationId: a.confirmation_id }, "[Backfill:legacy] Appointment synced");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.appointments.failed++;
      results.appointments.errors.push({ id: a.confirmation_id, email: a.email, error: msg });
      logger.error({ err, confirmationId: a.confirmation_id }, "[Backfill:legacy] Appointment sync failed");
    }
  }

  // ── Leads ───────────────────────────────────────────────────────────────────
  const leads2 = await db.query<{
    id: number; form_type: string; first_name: string; last_name: string;
    email: string; phone: string | null; state: string | null;
    allocation_type: string | null; allocation_range: string | null;
    timeline: string | null; status: string | null; current_custodian: string | null;
    linked_confirmation_id: string | null; created_at: Date | null; updated_at: Date | null;
  }>(`SELECT * FROM leads ORDER BY created_at ASC`);

  for (const l of leads2.rows) {
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
        createdAt:            toISO(l.created_at),
        updatedAt:            toISO(l.updated_at),
      });
      results.leads.ok++;
      logger.info({ leadId: l.id }, "[Backfill:legacy] Lead synced");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.leads.failed++;
      results.leads.errors.push({ id: String(l.id), email: l.email, error: msg });
      logger.error({ err, leadId: l.id }, "[Backfill:legacy] Lead sync failed");
    }
  }

  logger.info({ results }, "[Backfill:legacy] Complete");

  if (wantsJson) {
    res.json({ ok: true, action: "legacy", results });
    return;
  }

  const anyFailed = results.appointments.failed > 0 || results.leads.failed > 0;
  const cls = anyFailed ? "fail" : "ok";
  const icon = anyFailed ? "⚠️" : "✅";

  res.setHeader("Content-Type", "text/html").send(page(`
    <h1>${icon} Legacy Backfill ${anyFailed ? "completed with errors" : "complete"}</h1>
    <div class="result ${cls}">
      <div class="stat">Appointments: ${results.appointments.ok} synced${results.appointments.failed ? `, ${results.appointments.failed} failed` : ""}</div>
      ${errorTable(results.appointments.errors)}
      <div class="stat" style="margin-top:.75rem">Leads: ${results.leads.ok} synced${results.leads.failed ? `, ${results.leads.failed} failed` : ""}</div>
      ${errorTable(results.leads.errors)}
    </div>
    <p class="warn">
      ${anyFailed
        ? "Failed rows are shown above. Copy the errors and share them to debug further."
        : "All done. Open the appointments and leads archive tabs in your Master Sheet to confirm."}
    </p>
    <a href="/api/sheets-backfill">← Run again</a>
  `));
});

export default router;
