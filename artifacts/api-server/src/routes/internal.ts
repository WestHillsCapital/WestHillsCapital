import { Router, type IRouter } from "express";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /api/internal/leads
// Returns all leads from the DB, newest first (up to 200)
router.get("/leads", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT
        id, form_type, first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, current_custodian,
        status, notes, follow_up_date, owner, linked_confirmation_id,
        created_at, updated_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json({ leads: rows });
  } catch (err) {
    logger.error({ err }, "[Internal] Failed to fetch leads");
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

// GET /api/internal/appointments
// Returns all appointments from the DB, newest first (up to 200)
router.get("/appointments", async (_req, res) => {
  try {
    const db = getDb();
    const { rows } = await db.query(`
      SELECT
        id, confirmation_id, slot_id, scheduled_time, day_label, time_label,
        first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, status,
        lead_id, calendar_event_id, notes, created_at, updated_at
      FROM appointments
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json({ appointments: rows });
  } catch (err) {
    logger.error({ err }, "[Internal] Failed to fetch appointments");
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

export default router;
