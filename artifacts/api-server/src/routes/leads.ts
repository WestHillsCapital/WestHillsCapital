import { Router, type IRouter } from "express";
import {
  SubmitLeadIntakeBody,
  SubmitLeadIntakeResponse,
} from "@workspace/api-zod";
import { getDb } from "../db";
import { syncProspectToPipeline } from "../lib/google-sheets";

const router: IRouter = Router();

// POST /api/leads/intake
router.post("/intake", async (req, res) => {
  const parseResult = SubmitLeadIntakeBody.safeParse(req.body);
  if (!parseResult.success) {
    console.error(
      `[Leads] Validation failed for lead intake — formType="${req.body?.formType}" error: ${parseResult.error.message}`
    );
    res.status(400).json({
      error: "validation_error",
      message: parseResult.error.message,
    });
    return;
  }

  const lead = parseResult.data;
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;

  console.log(
    `[Leads] Received ${lead.formType} lead: ${lead.firstName} ${lead.lastName} <${lead.email}> — ${lead.allocationRange ?? "N/A"} — ${lead.timeline ?? "N/A"} — IP: ${ip}`
  );

  try {
    const db = getDb();
    const result = await db.query<{ id: number; created_at: Date }>(
      `INSERT INTO leads (
        form_type, first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, current_custodian,
        ip_address, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'new')
      RETURNING id, created_at`,
      [
        lead.formType,
        lead.firstName,
        lead.lastName,
        lead.email,
        lead.phone,
        lead.state ?? null,
        lead.allocationType ?? null,
        lead.allocationRange ?? null,
        lead.timeline ?? null,
        lead.currentCustodian ?? null,
        ip,
      ],
    );

    const row = result.rows[0];
    console.log(`[Leads] Saved lead id=${row.id} (${lead.formType}) for ${lead.email}`);

    // Mirror to Prospecting Pipeline (non-blocking)
    syncProspectToPipeline({
      leadId:           String(row.id),
      firstName:        lead.firstName,
      lastName:         lead.lastName,
      email:            lead.email,
      phone:            lead.phone,
      state:            lead.state,
      allocationType:   lead.allocationType,
      allocationRange:  lead.allocationRange,
      timeline:         lead.timeline,
      formType:         lead.formType,
      currentCustodian: lead.currentCustodian,
      createdAt:        row.created_at.toISOString(),
    }).catch((err) => console.error("[Leads] Pipeline sync failed:", err));

  } catch (err) {
    console.error(`[Leads] FAILED to save ${lead.formType} lead for ${lead.email}:`, err);
  }

  const data = SubmitLeadIntakeResponse.parse({
    success: true,
    message:
      "Your information has been received. A West Hills Capital advisor will contact you within one business day.",
  });

  res.json(data);
});

// POST /api/leads/subscribe  (email-only capture from article pages)
router.post("/subscribe", async (req, res) => {
  const email = (req.body?.email ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? null;
  const source = (req.body?.source ?? "article-subscribe").trim();

  console.log(`[Leads/Subscribe] ${email} source=${source} ip=${ip}`);

  try {
    const db = getDb();
    const result = await db.query<{ id: number; created_at: Date }>(
      `INSERT INTO leads (form_type, first_name, last_name, email, ip_address, status)
       VALUES ($1, '', '', $2, $3, 'new')
       RETURNING id, created_at`,
      [source, email, ip],
    );

    const row = result.rows[0];
    console.log(`[Leads/Subscribe] Saved id=${row.id} for ${email}`);

    syncProspectToPipeline({
      leadId:    String(row.id),
      firstName: "",
      lastName:  "",
      email,
      formType:  source,
      createdAt: row.created_at.toISOString(),
    }).catch((err) => console.error("[Leads/Subscribe] Pipeline sync failed:", err));

  } catch (err) {
    console.error(`[Leads/Subscribe] FAILED for ${email}:`, err);
  }

  res.json({ success: true });
});

export default router;
