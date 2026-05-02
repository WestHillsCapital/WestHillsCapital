import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
export const publicMerlinRouter: IRouter = Router();

function getAnthropicClient(): Anthropic {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_BASE_URL is not set");
  }
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) {
    throw new Error("AI_INTEGRATIONS_ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

// ─── Merlin's identity prompt ────────────────────────────────────────────────

const MERLIN_IDENTITY = `You are Merlin, the AI assistant for Docuplete — a document automation platform for financial advisors and wealth management firms.

Your identity: You are wise, trustworthy, and quietly powerful in the background. The wizard archetype is deliberate — the most trusted advisor, the one who makes difficult things look effortless, who works his craft without fanfare. Document automation is your domain. You use wizard framing with a light touch — it is seasoning, not a costume. Phrases like "consider it handled" and "a little wizardry goes a long way" feel natural from you. You earn trust through accuracy and clarity rather than personality tricks. You never make people feel foolish for not knowing something. You are never sarcastic, never robotic, and never over-explain.`;

const DOCUPLETE_CONCEPTS = `Docuplete concepts you understand deeply:
- Packages: document sets containing PDFs, fields, conditions, and field-to-PDF coordinate mappings. Each package creates sessions.
- Sessions: individual interview instances with a unique token link sent to a customer. A session has status: draft (not started), in_progress (form open), or generated (PDF ready).
- Fields: the questions on a form. Types: text, date, radio, checkbox, dropdown, initials. Each has interviewMode: required, optional, readonly (pre-filled), or omitted (hidden).
- Conditional logic: a field can show or hide based on another field's answer (equals, not_equals, is_answered, is_not_answered operators).
- Submissions: when a customer completes a session and generates their documents. Counted against the account's monthly quota.
- E-sign (email_otp): identity verification via OTP email + drawn or typed signature + RFC 3161 timestamp for legal standing.
- Custom domains: white-label interview links at forms.yourcompany.com via CNAME.
- Submission bank: purchased bundles of extra submissions (50/100/300/500/1000) that supplement plan quotas and roll over for 12 months.
- Plans: Starter ($49/mo, 100 submissions), Pro ($249/mo, 500 submissions), Enterprise ($3k/mo, unlimited). Features are gated by plan tier.
- Prefill: key-value data injected into a session at creation time so the customer doesn't have to re-enter known info.
- Webhooks: HTTP callbacks fired when a session generates documents, used for CRM integrations.
- Google Drive: automatic PDF upload to a linked Drive folder when a session generates.
- HubSpot: contact upsert with extracted field data on session completion.
- API keys: sk_live_… tokens for programmatic session creation via the Docuplete REST API.`;

// ─── Tool definitions for internal Merlin ────────────────────────────────────

const INTERNAL_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_sessions",
    description: "Search for interview sessions on this account. Use to find sessions by customer name, email, package, or status. Returns a list of matching sessions with key details.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term (customer name, email, or package name). Leave empty to list recent sessions." },
        status: { type: "string", enum: ["draft", "in_progress", "generated", "all"], description: "Filter by session status. Default: all." },
        package_id: { type: "number", description: "Filter by specific package ID." },
        limit: { type: "number", description: "Maximum results to return (1-50). Default: 20." },
      },
      required: [],
    },
  },
  {
    name: "get_session_detail",
    description: "Get full details of a specific session including all answers, package info, and status. Use when you need to see exactly what a customer filled in.",
    input_schema: {
      type: "object" as const,
      properties: {
        token: { type: "string", description: "The session token (starts with df_)." },
      },
      required: ["token"],
    },
  },
  {
    name: "search_packages",
    description: "List or search document packages on this account. Returns package names, IDs, field counts, and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term to filter packages by name. Leave empty to list all." },
        status: { type: "string", enum: ["active", "draft", "all"], description: "Filter by package status. Default: active." },
        limit: { type: "number", description: "Maximum results (1-50). Default: 20." },
      },
      required: [],
    },
  },
  {
    name: "get_package_detail",
    description: "Get full details of a package including all fields, their types, interviewModes, conditional logic, and e-sign configuration.",
    input_schema: {
      type: "object" as const,
      properties: {
        package_id: { type: "number", description: "The numeric package ID." },
      },
      required: ["package_id"],
    },
  },
  {
    name: "get_submission_stats",
    description: "Get submission counts and usage statistics for this account. Shows how many submissions were used in different time periods and current plan quota.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: { type: "string", enum: ["today", "this_week", "this_month", "last_month", "all_time"], description: "Time period for stats. Default: this_month." },
      },
      required: [],
    },
  },
  {
    name: "get_billing_summary",
    description: "Get the account's current plan, seat count, submission bank balance, and billing details.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ─── Tool execution (account-scoped) ─────────────────────────────────────────

async function executeInternalTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  accountId: number,
): Promise<string> {
  const db = getDb();

  try {
    if (toolName === "search_sessions") {
      const query = typeof toolInput.query === "string" ? toolInput.query.trim() : "";
      const status = typeof toolInput.status === "string" ? toolInput.status : "all";
      const pkgId = typeof toolInput.package_id === "number" ? toolInput.package_id : null;
      const limit = typeof toolInput.limit === "number" ? Math.min(toolInput.limit, 50) : 20;

      const conditions: string[] = ["s.account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (status && status !== "all") {
        conditions.push(`s.status = $${idx++}`);
        params.push(status);
      }
      if (pkgId) {
        conditions.push(`s.package_id = $${idx++}`);
        params.push(pkgId);
      }
      if (query) {
        conditions.push(`(
          s.token ILIKE $${idx}
          OR p.name ILIKE $${idx}
          OR s.prefill::text ILIKE $${idx}
        )`);
        params.push(`%${query}%`);
        idx++;
      }

      params.push(limit);
      const { rows } = await db.query(
        `SELECT s.token, s.status, s.created_at, s.expires_at, p.name AS package_name,
                s.prefill
           FROM docufill_sessions s
           LEFT JOIN docufill_packages p ON p.id = s.package_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY s.created_at DESC
          LIMIT $${idx}`,
        params,
      );

      if (rows.length === 0) return "No sessions found matching those criteria.";

      const lines = rows.map((r) => {
        const prefill = typeof r.prefill === "object" && r.prefill ? r.prefill as Record<string, unknown> : {};
        const name = [prefill.firstName, prefill.lastName].filter(Boolean).join(" ") || prefill.name || "—";
        const email = prefill.email || "—";
        return `• Token: ${String(r.token).slice(0, 20)}… | Status: ${r.status} | Package: ${r.package_name ?? "?"} | Customer: ${name} (${email}) | Created: ${new Date(r.created_at as string).toLocaleDateString()}`;
      });

      return `Found ${rows.length} session(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "get_session_detail") {
      const token = typeof toolInput.token === "string" ? toolInput.token : "";
      const { rows } = await db.query(
        `SELECT s.token, s.status, s.created_at, s.expires_at, s.answers,
                s.prefill, p.name AS package_name, p.fields AS package_fields,
                s.signer_name, s.signed_at
           FROM docufill_sessions s
           LEFT JOIN docufill_packages p ON p.id = s.package_id
          WHERE s.token = $1 AND s.account_id = $2
          LIMIT 1`,
        [token, accountId],
      );

      if (!rows[0]) return `No session found with token ${token} on this account.`;
      const s = rows[0] as Record<string, unknown>;
      const answers = typeof s.answers === "object" && s.answers ? s.answers as Record<string, unknown> : {};
      const prefill = typeof s.prefill === "object" && s.prefill ? s.prefill as Record<string, unknown> : {};
      const name = [prefill.firstName, prefill.lastName].filter(Boolean).join(" ") || prefill.name || "Unknown";

      const answerLines = Object.entries(answers).slice(0, 30).map(([k, v]) => `  ${k}: ${v}`);
      return [
        `Session: ${s.token}`,
        `Status: ${s.status}`,
        `Package: ${s.package_name}`,
        `Customer: ${name} (${prefill.email ?? "no email"})`,
        `Created: ${new Date(s.created_at as string).toLocaleDateString()}`,
        s.signed_at ? `Signed at: ${new Date(s.signed_at as string).toLocaleString()} by ${s.signer_name}` : "",
        `\nAnswers (${Object.keys(answers).length} fields):\n${answerLines.join("\n")}`,
      ].filter(Boolean).join("\n");
    }

    if (toolName === "search_packages") {
      const query = typeof toolInput.query === "string" ? toolInput.query.trim() : "";
      const status = typeof toolInput.status === "string" && toolInput.status !== "all" ? toolInput.status : null;
      const limit = typeof toolInput.limit === "number" ? Math.min(toolInput.limit, 50) : 20;

      const conditions: string[] = ["account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
      if (query) { conditions.push(`name ILIKE $${idx++}`); params.push(`%${query}%`); }
      params.push(limit);

      const { rows } = await db.query(
        `SELECT id, name, status, auth_level, enable_interview, enable_customer_link,
                jsonb_array_length(COALESCE(fields, '[]'::jsonb)) AS field_count,
                created_at, updated_at
           FROM docufill_packages
          WHERE ${conditions.join(" AND ")}
          ORDER BY updated_at DESC
          LIMIT $${idx}`,
        params,
      );

      if (rows.length === 0) return "No packages found.";
      const lines = rows.map((r) =>
        `• ID ${r.id}: ${r.name} | Status: ${r.status} | Fields: ${r.field_count} | E-sign: ${r.auth_level === "email_otp" ? "yes" : "no"}`,
      );
      return `Found ${rows.length} package(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "get_package_detail") {
      const pkgId = typeof toolInput.package_id === "number" ? toolInput.package_id : null;
      if (!pkgId) return "package_id is required.";

      const { rows } = await db.query(
        `SELECT id, name, status, auth_level, enable_interview, enable_customer_link,
                enable_embed, enable_gdrive, enable_hubspot, webhook_enabled, webhook_url,
                fields, description
           FROM docufill_packages
          WHERE id = $1 AND account_id = $2
          LIMIT 1`,
        [pkgId, accountId],
      );

      if (!rows[0]) return `Package ${pkgId} not found on this account.`;
      const p = rows[0] as Record<string, unknown>;
      const fields = Array.isArray(p.fields) ? p.fields as Array<Record<string, unknown>> : [];

      const fieldLines = fields.map((f) => {
        const cond = f.condition ? ` [shown when ${(f.condition as Record<string, unknown>).fieldId} ${(f.condition as Record<string, unknown>).operator} "${(f.condition as Record<string, unknown>).value ?? ""}"]` : "";
        return `  • ${f.name} (${f.type}) — ${f.interviewMode}${f.sensitive ? " [sensitive]" : ""}${cond}`;
      });

      return [
        `Package ${p.id}: ${p.name}`,
        p.description ? `Description: ${p.description}` : "",
        `Status: ${p.status} | Auth: ${p.auth_level === "email_otp" ? "E-sign (OTP)" : "None"}`,
        `Features: Interview=${p.enable_interview ? "on" : "off"} | Customer links=${p.enable_customer_link ? "on" : "off"} | Drive=${p.enable_gdrive ? "on" : "off"} | HubSpot=${p.enable_hubspot ? "on" : "off"} | Webhook=${p.webhook_enabled ? "on" : "off"}`,
        `\nFields (${fields.length}):\n${fieldLines.join("\n") || "  (none)"}`,
      ].filter(Boolean).join("\n");
    }

    if (toolName === "get_submission_stats") {
      const period = typeof toolInput.period === "string" ? toolInput.period : "this_month";

      const intervalMap: Record<string, string> = {
        today: "NOW() - INTERVAL '1 day'",
        this_week: "DATE_TRUNC('week', NOW())",
        this_month: "DATE_TRUNC('month', NOW())",
        last_month: "DATE_TRUNC('month', NOW()) - INTERVAL '1 month'",
        all_time: "'1970-01-01'::timestamptz",
      };

      const since = intervalMap[period] ?? intervalMap["this_month"];
      const until = period === "last_month" ? "DATE_TRUNC('month', NOW())" : "NOW() + INTERVAL '1 day'";

      const { rows: countRows } = await db.query(
        `SELECT COUNT(*) AS total
           FROM docufill_sessions
          WHERE account_id = $1 AND status = 'generated'
            AND created_at >= ${since} AND created_at < ${until}`,
        [accountId],
      );

      const { rows: byPkg } = await db.query(
        `SELECT p.name, COUNT(*) AS cnt
           FROM docufill_sessions s
           LEFT JOIN docufill_packages p ON p.id = s.package_id
          WHERE s.account_id = $1 AND s.status = 'generated'
            AND s.created_at >= ${since} AND s.created_at < ${until}
          GROUP BY p.name
          ORDER BY cnt DESC
          LIMIT 10`,
        [accountId],
      );

      const total = countRows[0]?.total ?? "0";
      const byPkgLines = byPkg.map((r) => `  • ${r.name ?? "Unknown package"}: ${r.cnt}`);

      return [
        `Submissions ${period.replace(/_/g, " ")}: ${total}`,
        byPkgLines.length ? `\nBy package:\n${byPkgLines.join("\n")}` : "",
      ].filter(Boolean).join("\n");
    }

    if (toolName === "get_billing_summary") {
      const { rows } = await db.query(
        `SELECT plan_tier, seat_limit, submission_bank_balance, bank_expires_at,
                subscription_status, current_period_end
           FROM accounts
          WHERE id = $1 LIMIT 1`,
        [accountId],
      );
      if (!rows[0]) return "Account information not found.";
      const a = rows[0] as Record<string, unknown>;

      const { rows: monthRows } = await db.query(
        `SELECT COUNT(*) AS used
           FROM docufill_sessions
          WHERE account_id = $1 AND status = 'generated'
            AND created_at >= DATE_TRUNC('month', NOW())`,
        [accountId],
      );
      const used = monthRows[0]?.used ?? 0;

      return [
        `Plan: ${String(a.plan_tier ?? "starter").toUpperCase()}`,
        `Seats: ${a.seat_limit ?? 1}`,
        `Subscription: ${a.subscription_status ?? "inactive"}`,
        a.current_period_end ? `Renews: ${new Date(a.current_period_end as string).toLocaleDateString()}` : "",
        `Submissions this month: ${used}`,
        a.submission_bank_balance && Number(a.submission_bank_balance) > 0
          ? `Submission bank: ${a.submission_bank_balance} credits (expires ${a.bank_expires_at ? new Date(a.bank_expires_at as string).toLocaleDateString() : "N/A"})`
          : "Submission bank: 0 credits",
      ].filter(Boolean).join("\n");
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    logger.error({ err, toolName }, "[Merlin] Tool execution error");
    return `Error running ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Internal Merlin chat endpoint ────────────────────────────────────────────
// POST /api/v1/product/merlin/chat
// Requires requireProductAuth + requireAccountId

router.post("/chat", async (req, res): Promise<void> => {
  const { messages } = req.body as {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  const accountId = req.internalAccountId;
  if (!accountId) {
    res.status(401).json({ error: "Account not resolved" });
    return;
  }

  try {
    const client = getAnthropicClient();

    const systemPrompt = [
      MERLIN_IDENTITY,
      "",
      DOCUPLETE_CONCEPTS,
      "",
      "You have access to real-time data through tools. Always use tools to fetch live data rather than guessing. Present results readably — tables for lists, summaries for single records. When the user asks about specific sessions, packages, or stats, call the relevant tool first.",
      "",
      "This is the internal staff interface. You can look up anything on this account. If you don't know something, say so — do not invent data.",
    ].join("\n");

    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Agentic loop: Claude may call tools multiple times before replying
    let finalText = "";
    let loopMessages = [...anthropicMessages];
    const MAX_TOOL_ROUNDS = 5;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: systemPrompt,
        tools: INTERNAL_TOOLS,
        messages: loopMessages,
      });

      if (response.stop_reason === "end_turn") {
        finalText = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");
        break;
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
        const assistantMsg: Anthropic.MessageParam = {
          role: "assistant",
          content: response.content,
        };
        loopMessages.push(assistantMsg);

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            const result = await executeInternalTool(
              block.name,
              block.input as Record<string, unknown>,
              accountId,
            );
            return {
              type: "tool_result" as const,
              tool_use_id: block.id,
              content: result,
            };
          }),
        );

        loopMessages.push({
          role: "user",
          content: toolResults,
        });
        continue;
      }

      // Unexpected stop reason
      finalText = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      break;
    }

    res.json({ reply: finalText || "I'm not sure how to help with that. Could you rephrase?" });
  } catch (err) {
    logger.error({ err }, "[Merlin] Internal chat failed");
    res.status(500).json({ error: "Merlin is temporarily unavailable. Please try again." });
  }
});

// ─── Customer Merlin chat endpoint ────────────────────────────────────────────
// POST /api/v1/docufill/public/sessions/:token/merlin
// Public — scoped to the session token

publicMerlinRouter.post("/sessions/:token/merlin", async (req, res): Promise<void> => {
  const { token } = req.params;
  const { messages, answers } = req.body as {
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    answers?: Record<string, string>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  try {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT s.token, s.status, s.prefill, p.name AS package_name,
              p.fields AS package_fields, p.description AS package_description
         FROM docufill_sessions s
         LEFT JOIN docufill_packages p ON p.id = s.package_id
        WHERE s.token = $1 LIMIT 1`,
      [token],
    );

    if (!rows[0]) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (rows[0].status === "generated") {
      res.status(400).json({ error: "This session is already complete." });
      return;
    }

    const session = rows[0] as Record<string, unknown>;
    const prefill = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
    const fields = Array.isArray(session.package_fields) ? session.package_fields as Array<Record<string, unknown>> : [];
    const currentAnswers = answers ?? {};

    // Build field summary for system prompt
    const interviewFields = fields.filter((f) => f.interviewMode !== "omitted" && f.interviewMode !== "readonly");
    const answeredIds = new Set(Object.keys(currentAnswers).filter((k) => currentAnswers[k]?.trim()));
    const pendingFields = interviewFields.filter((f) => !answeredIds.has(String(f.id)));
    const answeredFields = interviewFields.filter((f) => answeredIds.has(String(f.id)));

    const fieldSummary = interviewFields.map((f) => {
      const val = currentAnswers[String(f.id)];
      const answered = val ? `[answered: "${val}"]` : "[pending]";
      const required = f.interviewMode === "required" ? "required" : "optional";
      let optionStr = "";
      if (Array.isArray(f.options) && f.options.length > 0) {
        optionStr = ` | options: ${(f.options as string[]).join(", ")}`;
      }
      return `  - ${f.name} (id: ${f.id}, type: ${f.type}, ${required}${optionStr}) ${answered}`;
    }).join("\n");

    const prefillSummary = Object.entries(prefill)
      .filter(([, v]) => String(v ?? "").trim())
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    const systemPrompt = [
      MERLIN_IDENTITY,
      "",
      `You are currently helping a customer complete their "${session.package_name}" form. Your role is to guide them through the interview conversationally, asking about one topic at a time. As they answer, you extract the information and return structured field updates so their form fills in automatically.`,
      "",
      `Context about this customer (pre-filled by their advisor):`,
      prefillSummary || "  (no pre-filled data)",
      "",
      `Form fields status (${answeredFields.length} of ${interviewFields.length} answered):`,
      fieldSummary || "  (no fields)",
      "",
      `Pending fields: ${pendingFields.map((f) => f.name).join(", ") || "All fields answered — ready to review."}`,
      "",
      "INTERVIEW RULES:",
      "1. Ask about one field (or related group of fields, like address components) at a time.",
      "2. Be conversational and warm, not robotic or list-driven.",
      "3. When the customer answers, confirm and move to the next pending field.",
      "4. Respect conditional logic — if a field depends on another answer, only ask it when appropriate.",
      "5. If asked why a field is needed, give a plain, honest answer appropriate for financial document contexts.",
      "6. If asked what happens after submission, explain: their documents are generated and sent to their advisor.",
      "7. If there is a question you cannot answer, say so plainly and stay focused on completing the form.",
      "8. If all required fields are answered, let the customer know they are ready to review and submit.",
      "",
      "FIELD UPDATES FORMAT:",
      "After your conversational reply, if you have extracted any field values from this conversation turn, include them on a new line in this exact format:",
      '```field_updates',
      '{"fieldId": "value", "anotherFieldId": "another value"}',
      '```',
      "Only include field IDs that appear in the field list above. Match the value to the expected format for the field type (e.g. date: MM/DD/YYYY, state: 2-letter abbreviation). Do not include field_updates if no new values were extracted.",
      "",
      "For radio/checkbox/dropdown fields, the value must exactly match one of the listed options.",
      "For date fields: use MM/DD/YYYY format.",
      "For state fields: use 2-letter state code (e.g. KS, TX, CA).",
      "For ZIP fields: 5 digits.",
    ].join("\n");

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const fullText = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    // Extract field_updates from the response
    let replyText = fullText;
    let fieldUpdates: Record<string, string> = {};

    const fieldUpdatesMatch = fullText.match(/```field_updates\s*([\s\S]*?)```/);
    if (fieldUpdatesMatch) {
      try {
        fieldUpdates = JSON.parse(fieldUpdatesMatch[1].trim()) as Record<string, string>;
      } catch {
        // ignore parse failure — no field updates
      }
      replyText = fullText.replace(/```field_updates[\s\S]*?```/, "").trim();
    }

    res.json({ reply: replyText, field_updates: fieldUpdates });
  } catch (err) {
    logger.error({ err }, "[Merlin] Customer chat failed");
    res.status(500).json({ error: "Merlin is temporarily unavailable. Please try again." });
  }
});

export default router;
