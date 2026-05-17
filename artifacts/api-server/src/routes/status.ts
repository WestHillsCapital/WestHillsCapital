import { Router, type IRouter } from "express";
import { getDb } from "../db.js";
import { getLastProbeResult } from "../lib/sandboxProbe.js";
import { logger } from "../lib/logger.js";
import { requireProductAuth } from "../middleware/requireProductAuth.js";
import { requireAdminRole } from "../middleware/requireRole.js";

const router: IRouter = Router();

type ComponentStatus = "operational" | "degraded" | "outage" | "unknown";

interface StatusComponent {
  id: string;
  name: string;
  description: string;
  status: ComponentStatus;
  checkedAt: string | null;
}

interface IncidentUpdate {
  body: string;
  status: string;
  created_at: string;
}

// ── Public: current system status ────────────────────────────────────────────
router.get("/", (_req, res) => {
  const probe = getLastProbeResult();

  const interviewOk: boolean | null = probe ? (probe.steps.start?.ok ?? false) : null;
  const pdfOk: boolean | null       = probe ? (probe.steps.generate?.ok ?? false) : null;
  const probeCheckedAt              = probe?.checkedAt ?? null;

  const components: StatusComponent[] = [
    {
      id: "api",
      name: "API",
      description: "Core REST API for all Docuplete operations",
      status: "operational",
      checkedAt: new Date().toISOString(),
    },
    {
      id: "interview_delivery",
      name: "Interview Delivery",
      description: "Client-facing interview session loading and submission",
      status: interviewOk === null ? "unknown" : interviewOk ? "operational" : "degraded",
      checkedAt: probeCheckedAt,
    },
    {
      id: "pdf_generation",
      name: "PDF Generation",
      description: "Document generation and rendering pipeline",
      status: pdfOk === null ? "unknown" : pdfOk ? "operational" : "degraded",
      checkedAt: probeCheckedAt,
    },
    {
      id: "webhooks",
      name: "Webhook Delivery",
      description: "Event delivery to customer-configured endpoints",
      status: "operational",
      checkedAt: new Date().toISOString(),
    },
    {
      id: "email",
      name: "Email",
      description: "Transactional email for interview links, reminders, and invites",
      status: "operational",
      checkedAt: new Date().toISOString(),
    },
    {
      id: "dashboard",
      name: "Dashboard",
      description: "Admin web interface",
      status: "operational",
      checkedAt: new Date().toISOString(),
    },
  ];

  const degraded = components.filter(
    (c) => c.status === "degraded" || c.status === "outage",
  );
  const overall: ComponentStatus = degraded.length > 0 ? "degraded" : "operational";

  res.json({ status: overall, components, checkedAt: new Date().toISOString() });
});

// ── Public: recent incidents ──────────────────────────────────────────────────
router.get("/incidents", async (_req, res) => {
  try {
    const { rows } = await getDb().query<{
      id: number;
      title: string;
      status: string;
      severity: string;
      components: string[];
      body: string;
      updates: IncidentUpdate[];
      created_at: string;
      resolved_at: string | null;
    }>(
      `SELECT id, title, status, severity, components, body, updates, created_at, resolved_at
         FROM status_incidents
        ORDER BY created_at DESC
        LIMIT 50`,
    );
    res.json({ incidents: rows });
  } catch (err) {
    logger.error({ err }, "[Status] Failed to fetch incidents");
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

// ── Admin: create incident ────────────────────────────────────────────────────
router.post("/incidents", requireProductAuth, requireAdminRole, async (req, res) => {
  try {
    const { title, severity = "minor", components = [], body = "" } = req.body as {
      title?: string;
      severity?: string;
      components?: string[];
      body?: string;
    };
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const now = new Date().toISOString();
    const initialUpdates: IncidentUpdate[] = body
      ? [{ body, status: "investigating", created_at: now }]
      : [];
    const { rows } = await getDb().query<{ id: number }>(
      `INSERT INTO status_incidents (title, status, severity, components, body, updates)
       VALUES ($1, 'investigating', $2, $3, $4, $5)
       RETURNING id`,
      [title, severity, components, body, JSON.stringify(initialUpdates)],
    );
    res.status(201).json({ id: rows[0]?.id });
  } catch (err) {
    logger.error({ err }, "[Status] Failed to create incident");
    res.status(500).json({ error: "Failed to create incident" });
  }
});

// ── Admin: update / resolve incident ─────────────────────────────────────────
router.patch("/incidents/:id", requireProductAuth, requireAdminRole, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid incident id" });
      return;
    }
    const { status, body, resolved } = req.body as {
      status?: string;
      body?: string;
      resolved?: boolean;
    };

    const { rows: existing } = await getDb().query<{ updates: IncidentUpdate[] }>(
      `SELECT updates FROM status_incidents WHERE id = $1`,
      [id],
    );
    if (!existing[0]) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }

    const updates = existing[0].updates ?? [];
    if (body) {
      updates.push({
        body,
        status: status ?? "investigating",
        created_at: new Date().toISOString(),
      });
    }

    const { rowCount } = await getDb().query(
      `UPDATE status_incidents
          SET status     = COALESCE($1, status),
              body       = COALESCE($2, body),
              updates    = $3,
              resolved_at = CASE WHEN $4 THEN NOW() ELSE resolved_at END
        WHERE id = $5`,
      [status ?? null, body ?? null, JSON.stringify(updates), resolved ?? false, id],
    );
    if (!rowCount) {
      res.status(404).json({ error: "Incident not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Status] Failed to update incident");
    res.status(500).json({ error: "Failed to update incident" });
  }
});

export default router;
