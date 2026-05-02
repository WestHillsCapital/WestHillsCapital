import { Router, type IRouter, type Response } from "express";
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
    apiKey:   process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL:  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

// ─── SSE helpers ─────────────────────────────────────────────────────────────

function startSSE(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx / Railway buffering
  res.flushHeaders();
}

function sseWrite(res: Response, data: object): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Merlin identity ──────────────────────────────────────────────────────────

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

// ─── Internal tools ───────────────────────────────────────────────────────────

const INTERNAL_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_sessions",
    description: "Search for interview sessions on this account. Use to find sessions by customer name, email, package, or status. Returns a list of matching sessions with key details.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:      { type: "string", description: "Search term (customer name, email, or package name). Leave empty to list recent sessions." },
        status:     { type: "string", enum: ["draft", "in_progress", "generated", "all"], description: "Filter by session status. Default: all." },
        package_id: { type: "number", description: "Filter by specific package ID." },
        limit:      { type: "number", description: "Maximum results to return (1-50). Default: 20." },
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
        query:  { type: "string", description: "Search term to filter packages by name. Leave empty to list all." },
        status: { type: "string", enum: ["active", "draft", "all"], description: "Filter by package status. Default: active." },
        limit:  { type: "number", description: "Maximum results (1-50). Default: 20." },
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
  {
    name: "search_accounts",
    description: "Look up team members on this account. Returns users, their roles, and seat usage. Useful for understanding who has access and how many seats are in use.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:  { type: "string", description: "Search by email address. Leave empty to list all members." },
        role:   { type: "string", enum: ["admin", "member", "all"], description: "Filter by role. Default: all." },
        status: { type: "string", enum: ["active", "pending", "all"], description: "Filter by status. Default: all." },
      },
      required: [],
    },
  },
];

// ─── Tool execution ───────────────────────────────────────────────────────────

async function executeInternalTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  accountId: number,
): Promise<string> {
  const db = getDb();

  try {
    if (toolName === "search_sessions") {
      const query   = typeof toolInput.query    === "string" ? toolInput.query.trim() : "";
      const status  = typeof toolInput.status   === "string" ? toolInput.status : "all";
      const pkgId   = typeof toolInput.package_id === "number" ? toolInput.package_id : null;
      const limit   = typeof toolInput.limit    === "number" ? Math.min(toolInput.limit, 50) : 20;

      const conditions: string[] = ["s.account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (status && status !== "all") { conditions.push(`s.status = $${idx++}`); params.push(status); }
      if (pkgId) { conditions.push(`s.package_id = $${idx++}`); params.push(pkgId); }
      if (query) {
        conditions.push(`(s.token ILIKE $${idx} OR p.name ILIKE $${idx} OR s.prefill::text ILIKE $${idx})`);
        params.push(`%${query}%`);
        idx++;
      }
      params.push(limit);

      const { rows } = await db.query(
        `SELECT s.token, s.status, s.created_at, p.name AS package_name, s.prefill
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
        const name  = [prefill.firstName, prefill.lastName].filter(Boolean).join(" ") || prefill.name || "—";
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
      const query  = typeof toolInput.query  === "string" ? toolInput.query.trim() : "";
      const status = typeof toolInput.status === "string" && toolInput.status !== "all" ? toolInput.status : null;
      const limit  = typeof toolInput.limit  === "number" ? Math.min(toolInput.limit, 50) : 20;

      const conditions: string[] = ["account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
      if (query)  { conditions.push(`name ILIKE $${idx++}`); params.push(`%${query}%`); }
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
        const cond = f.condition
          ? ` [shown when field "${(f.condition as Record<string, unknown>).fieldId}" ${(f.condition as Record<string, unknown>).operator} "${(f.condition as Record<string, unknown>).value ?? ""}"]`
          : "";
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
        today:       "NOW() - INTERVAL '1 day'",
        this_week:   "DATE_TRUNC('week', NOW())",
        this_month:  "DATE_TRUNC('month', NOW())",
        last_month:  "DATE_TRUNC('month', NOW()) - INTERVAL '1 month'",
        all_time:    "'1970-01-01'::timestamptz",
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
        `SELECT plan_tier, seat_limit, subscription_status, current_period_end
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

      // Bank balance from submission_bank table
      const { rows: bankRows } = await db.query(
        `SELECT COALESCE(SUM(remaining), 0) AS total
           FROM submission_bank
          WHERE account_id = $1 AND remaining > 0 AND expires_at > NOW()`,
        [accountId],
      );

      const used  = monthRows[0]?.used ?? 0;
      const bank  = bankRows[0]?.total ?? 0;

      return [
        `Plan: ${String(a.plan_tier ?? "starter").toUpperCase()}`,
        `Seats: ${a.seat_limit ?? 1}`,
        `Subscription: ${a.subscription_status ?? "inactive"}`,
        a.current_period_end ? `Renews: ${new Date(a.current_period_end as string).toLocaleDateString()}` : "",
        `Submissions this month: ${used}`,
        Number(bank) > 0 ? `Submission bank: ${bank} credits banked` : "Submission bank: 0 credits",
      ].filter(Boolean).join("\n");
    }

    if (toolName === "search_accounts") {
      const query  = typeof toolInput.query  === "string" ? toolInput.query.trim() : "";
      const role   = typeof toolInput.role   === "string" && toolInput.role   !== "all" ? toolInput.role   : null;
      const status = typeof toolInput.status === "string" && toolInput.status !== "all" ? toolInput.status : null;

      const conditions: string[] = ["account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (role) { conditions.push(`role = $${idx++}`); params.push(role); }
      if (status === "pending") {
        conditions.push(`status = 'pending'`);
      } else if (status === "active") {
        conditions.push(`status != 'pending'`);
      }
      if (query) { conditions.push(`email ILIKE $${idx++}`); params.push(`%${query}%`); }

      const { rows } = await db.query(
        `SELECT email, role, status, created_at
           FROM account_users
          WHERE ${conditions.join(" AND ")}
          ORDER BY created_at DESC
          LIMIT 50`,
        params,
      );

      const { rows: seatRows } = await db.query(
        `SELECT seat_limit FROM accounts WHERE id = $1`,
        [accountId],
      );

      const activeCount = rows.filter((r) => r.status !== "pending").length;
      const seatLimit   = seatRows[0]?.seat_limit ?? "?";

      if (rows.length === 0) return "No team members found.";
      const lines = rows.map((r) => `• ${r.email} — ${r.role} · ${r.status}`);
      return [
        `Seats used: ${activeCount} of ${seatLimit}`,
        `\nTeam members (${rows.length}):\n${lines.join("\n")}`,
      ].join("\n");
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    logger.error({ err, toolName }, "[Merlin] Tool execution error");
    return `Error running ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Internal Merlin chat endpoint (SSE streaming) ────────────────────────────
// POST /api/v1/product/merlin/chat

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

  startSSE(res);

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

    let loopMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Tool rounds (non-streaming) — send SSE tool events so the UI can show activity
    const MAX_TOOL_ROUNDS = 4;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 2048,
        system:     systemPrompt,
        tools:      INTERNAL_TOOLS,
        messages:   loopMessages,
      });

      if (response.stop_reason !== "tool_use") {
        // No more tools needed — move on to the streaming final response
        break;
      }

      const toolUseBlocks = response.content.filter(
        (b) => b.type === "tool_use",
      ) as Anthropic.ToolUseBlock[];

      // Notify the client which tools are being called
      sseWrite(res, {
        type: "tool",
        names: toolUseBlocks.map((b) => b.name),
      });

      loopMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await executeInternalTool(
            block.name,
            block.input as Record<string, unknown>,
            accountId,
          );
          return {
            type:        "tool_result" as const,
            tool_use_id: block.id,
            content:     result,
          };
        }),
      );

      loopMessages.push({ role: "user", content: toolResults });
    }

    // Final streaming response
    const finalStream = client.messages.stream({
      model:      "claude-sonnet-4-6",
      max_tokens: 2048,
      system:     systemPrompt,
      tools:      INTERNAL_TOOLS,
      messages:   loopMessages,
    });

    finalStream.on("text", (chunk) => {
      sseWrite(res, { type: "chunk", text: chunk });
    });

    await finalStream.finalMessage();

    sseWrite(res, { type: "done" });
    res.end();
  } catch (err) {
    logger.error({ err }, "[Merlin] Internal chat failed");
    sseWrite(res, { type: "error", message: "Merlin is temporarily unavailable. Please try again." });
    res.end();
  }
});

// ─── Customer Merlin — tool definition ───────────────────────────────────────

const CUSTOMER_FIELD_UPDATE_TOOL: Anthropic.Tool = {
  name: "update_form_fields",
  description: "Record field values extracted from the customer's answer. Call this whenever you have confirmed one or more field values from the conversation. Values must match the field type and allowed options exactly.",
  input_schema: {
    type: "object" as const,
    properties: {
      updates: {
        type: "object" as const,
        description: "Map of field IDs (strings) to values (strings). Use only field IDs listed in the form context.",
        additionalProperties: { type: "string" },
      },
    },
    required: ["updates"],
  },
};

// ─── Customer Merlin chat endpoint (SSE streaming) ────────────────────────────
// POST /api/v1/docufill/public/sessions/:token/merlin

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

  startSSE(res);

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
      sseWrite(res, { type: "error", message: "Session not found." });
      res.end();
      return;
    }

    if (rows[0].status === "generated") {
      sseWrite(res, { type: "error", message: "This session is already complete." });
      res.end();
      return;
    }

    const session       = rows[0] as Record<string, unknown>;
    const prefill       = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
    const fields        = Array.isArray(session.package_fields) ? session.package_fields as Array<Record<string, unknown>> : [];
    const currentAnswers = answers ?? {};

    // Build field summary including conditional logic so Merlin can reason about visibility
    const interviewFields = fields.filter((f) => f.interviewMode !== "omitted" && f.interviewMode !== "readonly");
    const answeredIds     = new Set(Object.keys(currentAnswers).filter((k) => currentAnswers[k]?.trim()));
    const pendingFields   = interviewFields.filter((f) => !answeredIds.has(String(f.id)));
    const answeredFields  = interviewFields.filter((f) => answeredIds.has(String(f.id)));

    const fieldSummary = interviewFields.map((f) => {
      const val      = currentAnswers[String(f.id)];
      const answered = val ? `[answered: "${val}"]` : "[pending]";
      const required = f.interviewMode === "required" ? "required" : "optional";

      let optionStr = "";
      if (Array.isArray(f.options) && f.options.length > 0) {
        optionStr = ` | options: ${(f.options as string[]).join(", ")}`;
      }

      // Include conditional logic so Merlin knows when to ask/skip this field
      let condStr = "";
      const cond = f.condition as Record<string, unknown> | null | undefined;
      if (cond?.fieldId) {
        const triggerField = fields.find((tf) => String(tf.id) === String(cond.fieldId));
        const triggerName  = triggerField ? String(triggerField.name) : String(cond.fieldId);
        condStr = ` | CONDITIONAL: only shown when "${triggerName}" ${cond.operator} "${cond.value ?? ""}"`;
      }

      return `  - ${f.name} (id: ${f.id}, type: ${f.type}, ${required}${optionStr}${condStr}) ${answered}`;
    }).join("\n");

    const prefillSummary = Object.entries(prefill)
      .filter(([, v]) => String(v ?? "").trim())
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    const systemPrompt = [
      MERLIN_IDENTITY,
      "",
      `You are guiding a customer through the "${String(session.package_name)}" form. Your role is to ask about one topic at a time, extract their answers, and call update_form_fields to record them. The form auto-fills as you go.`,
      "",
      `Context about this customer (pre-filled by their advisor):`,
      prefillSummary || "  (no pre-filled data)",
      "",
      `Form fields (${answeredFields.length} of ${interviewFields.length} answered):`,
      fieldSummary || "  (no fields)",
      "",
      `Pending fields: ${pendingFields.map((f) => f.name).join(", ") || "All fields answered — ready to review."}`,
      "",
      "INTERVIEW RULES:",
      "1. Ask about one field (or one natural group, like address components) at a time.",
      "2. Be warm and conversational, not robotic or list-driven.",
      "3. When the customer answers, call update_form_fields immediately with the extracted value, then confirm and move to the next pending field.",
      "4. Respect conditional logic — only ask conditional fields when the triggering condition is met based on already-answered fields.",
      "5. For radio/dropdown/checkbox fields, the value in update_form_fields must exactly match one of the listed options (case-sensitive).",
      "6. For date fields: use MM/DD/YYYY format in update_form_fields.",
      "7. For state fields: use 2-letter state code (e.g. KS, TX, CA) in update_form_fields.",
      "8. For ZIP fields: 5 digits.",
      "9. If a customer seems unsure, offer clarification without making them feel judged.",
      "10. When all required fields are answered, say so and let them know they can switch to the form to review and submit.",
    ].join("\n");

    const client = getAnthropicClient();

    const stream = client.messages.stream({
      model:       "claude-sonnet-4-6",
      max_tokens:  1024,
      system:      systemPrompt,
      tools:       [CUSTOMER_FIELD_UPDATE_TOOL],
      tool_choice: { type: "auto" },
      messages:    messages.map((m) => ({ role: m.role, content: m.content })),
    });

    stream.on("text", (chunk) => {
      sseWrite(res, { type: "chunk", text: chunk });
    });

    const finalMsg = await stream.finalMessage();

    // Extract field_updates from tool calls
    const fieldUpdates: Record<string, string> = {};
    for (const block of finalMsg.content) {
      if (block.type === "tool_use" && block.name === "update_form_fields") {
        const input = block.input as { updates?: Record<string, string> };
        if (input.updates && typeof input.updates === "object") {
          Object.assign(fieldUpdates, input.updates);
        }
      }
    }

    if (Object.keys(fieldUpdates).length > 0) {
      sseWrite(res, { type: "field_updates", updates: fieldUpdates });
    }

    sseWrite(res, { type: "done" });
    res.end();
  } catch (err) {
    logger.error({ err }, "[Merlin] Customer chat failed");
    sseWrite(res, { type: "error", message: "Merlin is temporarily unavailable. Please try again." });
    res.end();
  }
});

export default router;
