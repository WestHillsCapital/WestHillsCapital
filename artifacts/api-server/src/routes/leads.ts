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
    res.status(400).json({
      error: "validation_error",
      message: parseResult.error.message,
    });
    return;
  }

  const lead = parseResult.data;

  console.log(
    `[Leads] New ${lead.formType} lead: ${lead.firstName} ${lead.lastName} <${lead.email}> — ${lead.allocationRange ?? "N/A"} — ${lead.timeline ?? "N/A"}`,
  );

  try {
    const db = getDb();
    await db.query(
      `INSERT INTO leads (
        form_type, first_name, last_name, email, phone, state,
        allocation_type, allocation_range, timeline, current_custodian, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
        req.ip ?? null,
      ],
    );
  } catch (err) {
    console.error("[Leads] Failed to save lead to database:", err);
  }

  const data = SubmitLeadIntakeResponse.parse({
    success: true,
    message:
      "Your information has been received. A West Hills Capital advisor will contact you within one business day.",
  });

  res.json(data);
});

export default router;
