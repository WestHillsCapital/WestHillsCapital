import { Router, type IRouter } from "express";
import {
  SubmitLeadIntakeBody,
  SubmitLeadIntakeResponse,
} from "@workspace/api-zod";
import { getDb } from "../db";

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
    const result = await db.query(
      `INSERT INTO leads (
        form_type, first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, current_custodian, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
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
    console.log(`[Leads] Saved lead id=${result.rows[0].id} (${lead.formType}) for ${lead.email}`);
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

export default router;
