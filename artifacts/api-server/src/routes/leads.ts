import { Router, type IRouter } from "express";
import {
  SubmitLeadIntakeBody,
  SubmitLeadIntakeResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// POST /api/leads/intake
router.post("/intake", (req, res) => {
  const parseResult = SubmitLeadIntakeBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: "validation_error",
      message: parseResult.error.message,
    });
    return;
  }

  const lead = parseResult.data;

  // TODO: Integrate with CRM / lead management
  // 1. Log to Google Sheets (set GOOGLE_SHEETS_ID env var)
  // 2. Send internal notification via SendGrid/Postmark (set SENDGRID_API_KEY)
  // 3. Create HubSpot/CRM record if applicable
  // 4. Trigger confirmation email to lead

  console.log(
    `[Leads] New ${lead.formType} lead: ${lead.firstName} ${lead.lastName} <${lead.email}> — ${lead.allocationRange} — ${lead.timeline}`,
  );

  const data = SubmitLeadIntakeResponse.parse({
    success: true,
    message:
      "Your information has been received. A West Hills Capital advisor will contact you within one business day.",
  });

  res.json(data);
});

export default router;
