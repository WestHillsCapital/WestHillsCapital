import { randomBytes } from "crypto";
import { Router, type IRouter, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "../db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
export const publicMerlinRouter: IRouter = Router();

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

function getAnthropicClient(): Anthropic {
  const proxyUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  const proxyKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  // Only use the Replit proxy path if the base URL is actually a valid URL
  if (proxyUrl && proxyKey && isValidUrl(proxyUrl)) {
    return new Anthropic({ apiKey: proxyKey, baseURL: proxyUrl });
  }
  // Fall back to direct Anthropic API key (Railway / production env)
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  throw new Error(
    "No Anthropic credentials configured. Set ANTHROPIC_API_KEY in Railway environment variables.",
  );
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

Your identity: You are wise, trustworthy, and quietly powerful. The wizard archetype is deliberate — the most trusted advisor, the one who makes difficult things look effortless. You work without fanfare. Document automation is your domain. You earn trust through accuracy and clarity, not personality tricks.

Your communication style:
- Lead with the answer, not with process. Don't announce that you're about to do something — just do it.
- Match length to the question. A simple question gets a crisp response. A complex request gets a thorough one. Never pad.
- Be warm and human. Behind every session is a real client's financial life. Behind every staff request is someone trying to do their job well. Treat both with care.
- Ask clarifying questions only when they would genuinely change your response — and ask one at a time, never a list. If you can make a reasonable assumption, make it and say so.
- When presenting data, give it context. Don't just list rows — tell the person what it means or what they should do next.
- Offer next steps naturally when the path forward is obvious. Don't wait to be asked.
- When you create something — a session, a field, a group — confirm it clearly and surface the one thing they need immediately: the link, the ID, the next action.
- For conceptual questions, explain in plain language. Avoid jargon unless the user is clearly technical.
- Wizard framing is seasoning, not a costume. "Consider it done" and "a little wizardry goes a long way" can land well — but only when they fit naturally. You are never theatrical.
- You never make someone feel foolish for not knowing something. You are never sarcastic, never robotic, and never over-explain.`;

const DOCUPLETE_CONCEPTS = `Docuplete concepts you understand deeply:

CORE OBJECTS
- Packages: document sets containing PDFs, fields, conditions, and field-to-PDF coordinate mappings. Each package creates sessions. A package has status: draft or active. Packages can have auth_level "none" (no e-sign) or "email_otp" (e-sign).
- Sessions: individual interview instances with a unique token link. Status: draft (not started), in_progress (form open), or generated (PDF ready). Sessions belong to a package and an account.
- Fields: the questions on a form. Types: text, date, radio, checkbox, dropdown, initials, signature. Each has interviewMode: required (must be answered), optional, readonly (pre-filled, shown but locked), or omitted (hidden, value injected silently). Fields can be sensitive (masked input, e.g. SSN, DOB).
- Conditional logic: a field can show or hide based on another field's answer. Operators: equals, not_equals, is_answered, is_not_answered.

WORKFLOWS — HOW SESSIONS GET CREATED
- Staff Interview: staff opens a package, starts a session, and walks the client through the fields on a call. Staff types in the answers. After saving, staff can generate the packet immediately or send it to the client for signature.
- Customer Link: staff generates a unique public URL for a specific package and sends it to the client. The client opens the link, fills in the fields themselves, and submits — no staff involvement needed during completion.
- Send for Signature: staff completes a Staff Interview (or partial interview), then clicks "Create Signing Link." Docuplete creates a new client-facing session pre-filled with the staff's answers. The client receives a link, must scroll through every document page (mandatory scroll confirmation), and signs electronically. Sensitive fields marked "defer to client" are left blank for the client to fill in securely.
- Batch CSV: staff uploads a CSV where each row becomes a session. Useful for bulk processing (e.g. annual disclosures).
- Embed: packages can be embedded as an iframe on a third-party website.

FIELD LIBRARY & FIELD GROUPS
- Field Library: a shared pool of reusable field definitions available account-wide. Each library field has a label, type, optional validation type (phone, ssn, email, date, zip, currency, etc.), sensitive flag, and whether it is required by default. When a library field is used in a package, the package field links to it via libraryFieldId — updating the library field can cascade to all packages using it.
- Field Groups: named collections of library fields. Staff can insert a group into a package all at once instead of adding fields one by one. Example: "IRA Beneficiary Block" might group beneficiary name, relationship, DOB, and percentage fields. You can create new field groups or list existing ones.
- Field Library Export: available as JSON (full fidelity, includes field groups) or CSV. The CSV columns are: label, category, type, source, sensitive, required, validationType, validationPattern, validationMessage, active, sortOrder, options (pipe-separated), complianceTags (pipe-separated). Use the Export button in the Field Library panel.
- Field Library Import: accepts both JSON exports and CSV files. CSV imports only need a "label" column — all other columns are optional (type, validationType, sensitive, required, category, options, etc.). Column order doesn't matter; headers are matched by name. Duplicate labels (already existing in the library) are shown in a preview and skipped — no overwriting. Use the Import button in the Field Library panel. If asked to generate a CSV for import, use those column names.

SESSION METADATA
- Transaction Scope: categorizes a session by transaction type (ira_transfer, ira_contribution, ira_distribution, cash_purchase, storage_change, beneficiary_update, liquidation, buy_sell_direction, address_change). Used for filtering and reporting.
- Prefill: key-value data injected into a session at creation time (client name, email, account number, etc.) so the customer doesn't have to re-enter known info.
- Sensitive fields: fields with sensitive=true show masked input (like a password field). In a Staff Interview, sensitive fields can be "deferred to client" — staff skips them and the client enters them securely during signing.

INTEGRATIONS & FEATURES
- E-sign (email_otp): identity verification via one-time-password email + drawn or typed signature + RFC 3161 timestamp for legal standing.
- Google Drive: automatic PDF upload to a linked Drive folder when a session generates.
- HubSpot: contact upsert with extracted field data on session completion.
- Webhooks: HTTP callbacks fired when a session generates documents.
- Custom domains: white-label interview links at forms.yourcompany.com via CNAME.
- Customer portal: clients can log in to a portal and view their submitted sessions and signed PDFs.
- API keys: sk_live_… tokens for programmatic session creation via the Docuplete REST API.

BILLING
- Submissions: counted when a customer completes a session and generates documents. Counted against the account's monthly quota.
- Submission bank: purchased bundles of extra submissions (50/100/300/500/1000) that supplement plan quotas and roll over for 12 months.
- Plans: Starter ($49/mo, 100 submissions), Pro ($249/mo, 500 submissions), Enterprise ($3k/mo, unlimited). Features are gated by plan tier.
- Seats: each team member who can log in to the staff interface counts as a seat.`;

// ─── Internal tools ───────────────────────────────────────────────────────────

const INTERNAL_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_sessions",
    description: "Search for interview sessions on this account. Use to find sessions by customer name, email, package, status, or date range. Returns a list of matching sessions with key details.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:      { type: "string", description: "Search term (customer name, email, or package name). Leave empty to list recent sessions." },
        status:     { type: "string", enum: ["draft", "in_progress", "generated", "all"], description: "Filter by session status. Default: all." },
        package_id: { type: "number", description: "Filter by specific package ID." },
        date_from:  { type: "string", description: "ISO 8601 date string (e.g. 2025-01-01) — only return sessions created on or after this date." },
        date_to:    { type: "string", description: "ISO 8601 date string (e.g. 2025-03-31) — only return sessions created on or before this date." },
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
  {
    name: "search_library_fields",
    description: "Search or list the shared field library for this account. Returns field IDs, labels, types, validation types, and whether each field is sensitive or required. Use before creating a field to check if it already exists.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term to filter by label. Leave empty to list all." },
        type:  { type: "string", description: "Filter by field type (text, date, radio, checkbox, dropdown)." },
        limit: { type: "number", description: "Maximum results (1-100). Default: 50." },
      },
      required: [],
    },
  },
  {
    name: "create_library_field",
    description: "Create a new shared library field available to all packages on this account. Only creates the field definition — to add it to a specific package, the user still needs to do that in the package builder. Before creating, search to confirm it doesn't already exist.",
    input_schema: {
      type: "object" as const,
      properties: {
        label:          { type: "string", description: "Human-readable label shown in the interview (e.g. 'Social Security Number'). Required." },
        type:           { type: "string", enum: ["text", "date", "radio", "checkbox", "dropdown"], description: "Field input type. Default: text." },
        sensitive:      { type: "boolean", description: "If true, input is masked like a password (use for SSN, DOB, account numbers). Default: false." },
        required:       { type: "boolean", description: "Whether this field defaults to required in packages. Default: false." },
        validationType: { type: "string", description: "Built-in format validation: phone, ssn, email, date, zip, zip4, currency, number, percent, name, string, time. Leave empty for no validation." },
        options:        { type: "array", items: { type: "string" }, description: "For radio, checkbox, or dropdown — the list of choices." },
        category:       { type: "string", description: "Optional grouping label (e.g. 'Client Info', 'IRA Details')." },
      },
      required: ["label"],
    },
  },
  {
    name: "list_field_groups",
    description: "List the field groups on this account. Field groups are named collections of library fields that can be inserted into a package all at once. Returns group IDs, names, descriptions, and which fields they contain.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_field_group",
    description: "Create a new field group — a named collection of existing library fields that can be inserted into packages together. All field IDs must already exist in the library. Use search_library_fields to find valid field IDs first.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:        { type: "string", description: "Name of the group (e.g. 'IRA Beneficiary Block'). Required." },
        description: { type: "string", description: "Optional description of what this group is for." },
        fieldIds:    { type: "array", items: { type: "string" }, description: "Ordered list of library field IDs to include in the group." },
      },
      required: ["name"],
    },
  },
  {
    name: "create_customer_link",
    description: "Create a new interview session for a client and return the link. Use when staff asks to 'start an interview', 'create a session', 'generate a link', or 'send a form' for a specific client and package. The link is ready to share immediately.",
    input_schema: {
      type: "object" as const,
      properties: {
        package_name_or_id: { type: "string", description: "Package name (partial match OK) or numeric ID. Required." },
        first_name:         { type: "string", description: "Client's first name — pre-fills the form." },
        last_name:          { type: "string", description: "Client's last name — pre-fills the form." },
        email:              { type: "string", description: "Client's email address — pre-fills the form." },
        source:             { type: "string", enum: ["customer_link", "staff_interview", "send_for_signature"], description: "Session type. Default: customer_link." },
        force_scroll:       { type: "boolean", description: "If true, client must scroll through all document pages before signing. Default: false." },
      },
      required: ["package_name_or_id"],
    },
  },
  {
    name: "get_morning_briefing",
    description: "Summarise all pending (draft and in_progress) sessions on this account, grouped by package, oldest first. Use when staff asks 'what's pending?', 'what's on my plate?', 'give me a briefing', or 'morning summary'.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["draft", "in_progress", "both"], description: "Which statuses to include. Default: both." },
      },
      required: [],
    },
  },
  {
    name: "check_package_health",
    description: "Inspect one or all packages for common issues: no documents uploaded, no fields configured, active packages with no delivery method enabled. Use when staff asks 'is everything set up?', 'which packages have problems?', or 'do a health check'.",
    input_schema: {
      type: "object" as const,
      properties: {
        package_id: { type: "number", description: "Check a specific package by ID. Leave empty to check all packages on the account." },
      },
      required: [],
    },
  },
  {
    name: "search_portal_sessions",
    description: "Look up completed (generated) sessions for a specific client by name or email. Use when staff asks 'has [client] completed their forms?', 'show me [name]'s submissions', or 'find submitted sessions for [email]'.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Client name or email to search across submitted sessions. Required." },
        limit: { type: "number", description: "Maximum results (1–20). Default: 10." },
      },
      required: ["query"],
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
      const query    = typeof toolInput.query      === "string" ? toolInput.query.trim() : "";
      const status   = typeof toolInput.status     === "string" ? toolInput.status : "all";
      const pkgId    = typeof toolInput.package_id === "number" ? toolInput.package_id : null;
      const dateFrom = typeof toolInput.date_from  === "string" ? toolInput.date_from.trim() : "";
      const dateTo   = typeof toolInput.date_to    === "string" ? toolInput.date_to.trim() : "";
      const limit    = typeof toolInput.limit      === "number" ? Math.min(toolInput.limit, 50) : 20;

      const conditions: string[] = ["s.account_id = $1"];
      const params: unknown[] = [accountId];
      let idx = 2;

      if (status && status !== "all") { conditions.push(`s.status = $${idx++}`); params.push(status); }
      if (pkgId) { conditions.push(`s.package_id = $${idx++}`); params.push(pkgId); }
      if (dateFrom) { conditions.push(`s.created_at >= $${idx++}::date`); params.push(dateFrom); }
      if (dateTo)   { conditions.push(`s.created_at <  ($${idx++}::date + INTERVAL '1 day')`); params.push(dateTo); }
      if (query) {
        conditions.push(`(s.token ILIKE $${idx} OR p.name ILIKE $${idx} OR s.prefill::text ILIKE $${idx} OR s.signer_name ILIKE $${idx} OR s.signer_email ILIKE $${idx})`);
        params.push(`%${query}%`);
        idx++;
      }
      params.push(limit);

      const { rows } = await db.query(
        `SELECT s.token, s.status, s.created_at, p.name AS package_name, s.prefill, s.signer_name, s.signer_email
           FROM docuplete_interview_sessions s
           LEFT JOIN docuplete_packages p ON p.id = s.package_id
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
                s.signer_name, s.signer_email, s.signed_at
           FROM docuplete_interview_sessions s
           LEFT JOIN docuplete_packages p ON p.id = s.package_id
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
           FROM docuplete_packages
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
           FROM docuplete_packages
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
           FROM docuplete_interview_sessions
          WHERE account_id = $1 AND status = 'generated'
            AND created_at >= ${since} AND created_at < ${until}`,
        [accountId],
      );

      const { rows: byPkg } = await db.query(
        `SELECT p.name, COUNT(*) AS cnt
           FROM docuplete_interview_sessions s
           LEFT JOIN docuplete_packages p ON p.id = s.package_id
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
           FROM docuplete_interview_sessions
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

    if (toolName === "search_library_fields") {
      const query = typeof toolInput.query === "string" ? toolInput.query.trim() : "";
      const type  = typeof toolInput.type  === "string" ? toolInput.type.trim()  : "";
      const limit = typeof toolInput.limit === "number" ? Math.min(toolInput.limit, 100) : 50;

      const conditions: string[] = ["(account_id IS NULL OR account_id = $1)", "active = true"];
      const params: unknown[] = [accountId];
      let idx = 2;
      if (query) { conditions.push(`label ILIKE $${idx++}`); params.push(`%${query}%`); }
      if (type)  { conditions.push(`field_type = $${idx++}`);   params.push(type); }
      params.push(limit);

      const { rows } = await db.query(
        `SELECT id, label, field_type, validation_type, sensitive, required, category, options, account_id
           FROM docuplete_fields
          WHERE ${conditions.join(" AND ")}
          ORDER BY active DESC, label ASC
          LIMIT $${idx}`,
        params,
      );

      if (rows.length === 0) return "No library fields found matching those criteria.";
      const lines = rows.map((r) => {
        const scope = r.account_id ? "account" : "global";
        const flags = [r.sensitive ? "sensitive" : null, r.required ? "required" : null].filter(Boolean).join(", ");
        const opts = Array.isArray(r.options) && r.options.length ? ` options: [${(r.options as string[]).join(", ")}]` : "";
        return `• ${r.id} | ${r.label} (${r.field_type}${r.validation_type ? `/${r.validation_type}` : ""})${flags ? ` [${flags}]` : ""}${opts} [${scope}]`;
      });
      return `Found ${rows.length} library field(s):\n\n${lines.join("\n")}`;
    }

    if (toolName === "create_library_field") {
      const label = typeof toolInput.label === "string" ? toolInput.label.trim() : "";
      if (!label) return "label is required to create a library field.";

      const type           = typeof toolInput.type           === "string"  ? toolInput.type           : "text";
      const sensitive      = typeof toolInput.sensitive      === "boolean" ? toolInput.sensitive      : false;
      const required       = typeof toolInput.required       === "boolean" ? toolInput.required       : false;
      const validationType = typeof toolInput.validationType === "string"  ? toolInput.validationType.trim() : null;
      const category       = typeof toolInput.category       === "string"  ? toolInput.category.trim() : null;
      const options        = Array.isArray(toolInput.options)               ? toolInput.options        : null;

      // Check for duplicates
      const { rows: dupeRows } = await db.query(
        `SELECT id, label FROM docuplete_fields WHERE lower(label) = lower($1) AND (account_id IS NULL OR account_id = $2) LIMIT 1`,
        [label, accountId],
      );
      if (dupeRows[0]) return `A field with that label already exists: ID "${dupeRows[0].id}" — "${dupeRows[0].label}". No new field was created.`;

      // Generate an ID from the label
      let id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || "field";
      const { rows: idRows } = await db.query(`SELECT id FROM docuplete_fields WHERE id = $1 LIMIT 1`, [id]);
      if (idRows[0]) {
        for (let s = 2; s < 1000; s++) {
          const candidate = `${id}_${s}`;
          const { rows: cr } = await db.query(`SELECT id FROM docuplete_fields WHERE id = $1 LIMIT 1`, [candidate]);
          if (!cr[0]) { id = candidate; break; }
        }
      }

      const { rows } = await db.query(
        `INSERT INTO docuplete_fields (id, label, field_type, sensitive, required, validation_type, category, options, account_id, active, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, true, 100, NOW(), NOW())
         RETURNING id, label, field_type`,
        [id, label, type, sensitive, required, validationType, category, options ? JSON.stringify(options) : null, accountId],
      );

      const f = rows[0] as Record<string, unknown>;
      return `Created library field:\n• ID: ${f.id}\n• Label: ${f.label}\n• Type: ${f.field_type}\n\nIt is now available in the field library and can be added to packages via the package builder.`;
    }

    if (toolName === "list_field_groups") {
      const { rows } = await db.query(
        `SELECT id, name, description, field_ids, sort_order, created_at
           FROM docuplete_field_groups
          WHERE account_id = $1
          ORDER BY sort_order ASC, name ASC`,
        [accountId],
      );

      if (rows.length === 0) return "No field groups found on this account.";

      // Get library field labels for display
      const { rows: libRows } = await db.query(
        `SELECT id, label FROM docuplete_fields WHERE (account_id IS NULL OR account_id = $1)`,
        [accountId],
      );
      const labelMap = new Map(libRows.map((r) => [r.id as string, r.label as string]));

      const lines = rows.map((r) => {
        const ids = Array.isArray(r.field_ids) ? (r.field_ids as string[]) : [];
        const fieldLabels = ids.map((fid) => labelMap.get(fid) ?? fid).join(", ");
        return `• ID ${r.id}: ${r.name}${r.description ? ` — ${r.description}` : ""}\n  Fields (${ids.length}): ${fieldLabels || "(none)"}`;
      });
      return `Found ${rows.length} field group(s):\n\n${lines.join("\n\n")}`;
    }

    if (toolName === "create_field_group") {
      const name        = typeof toolInput.name        === "string" ? toolInput.name.trim()        : "";
      const description = typeof toolInput.description === "string" ? toolInput.description.trim() : null;
      const fieldIds    = Array.isArray(toolInput.fieldIds) ? (toolInput.fieldIds as unknown[]).filter((x) => typeof x === "string") as string[] : [];

      if (!name) return "name is required to create a field group.";

      // Validate fieldIds against the library
      const { rows: libRows } = await db.query(
        `SELECT id, label FROM docuplete_fields WHERE (account_id IS NULL OR account_id = $1) AND id = ANY($2::text[])`,
        [accountId, fieldIds],
      );
      const validIds = new Set(libRows.map((r) => r.id as string));
      const labelMap = new Map(libRows.map((r) => [r.id as string, r.label as string]));
      const invalidIds = fieldIds.filter((id) => !validIds.has(id));
      if (invalidIds.length) return `These field IDs were not found in the library and cannot be added: ${invalidIds.join(", ")}. Use search_library_fields to find valid IDs.`;

      const ordered = [...new Set(fieldIds)].filter((id) => validIds.has(id));

      const { rows } = await db.query(
        `INSERT INTO docuplete_field_groups (account_id, name, description, field_ids, sort_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, 100, NOW(), NOW())
         RETURNING id, name`,
        [accountId, name, description, JSON.stringify(ordered)],
      );

      const g = rows[0] as Record<string, unknown>;
      const fieldSummary = ordered.map((id) => `"${labelMap.get(id) ?? id}"`).join(", ");
      return `Created field group:\n• ID: ${g.id}\n• Name: ${g.name}\n• Fields (${ordered.length}): ${fieldSummary}\n\nStaff can now insert this group into any package from the package builder.`;
    }

    if (toolName === "create_customer_link") {
      const nameOrId = typeof toolInput.package_name_or_id === "string" ? toolInput.package_name_or_id.trim() : "";
      if (!nameOrId) return "package_name_or_id is required.";

      const firstName  = typeof toolInput.first_name === "string" ? toolInput.first_name.trim() : "";
      const lastName   = typeof toolInput.last_name  === "string" ? toolInput.last_name.trim()  : "";
      const email      = typeof toolInput.email      === "string" ? toolInput.email.trim()      : "";
      const source     = typeof toolInput.source     === "string" ? toolInput.source            : "customer_link";
      const forceScroll = toolInput.force_scroll === true;

      // Look up package by numeric ID or name
      const numId = Number(nameOrId);
      let pkgRow: Record<string, unknown> | null = null;
      if (!isNaN(numId) && numId > 0) {
        const { rows } = await db.query(
          `SELECT id, name, status, version FROM docuplete_packages WHERE id = $1 AND account_id = $2 LIMIT 1`,
          [numId, accountId],
        );
        pkgRow = (rows[0] as Record<string, unknown>) ?? null;
      } else {
        const { rows } = await db.query(
          `SELECT id, name, status, version FROM docuplete_packages WHERE name ILIKE $1 AND account_id = $2 ORDER BY status DESC LIMIT 1`,
          [`%${nameOrId}%`, accountId],
        );
        pkgRow = (rows[0] as Record<string, unknown>) ?? null;
      }
      if (!pkgRow) return `No package found matching "${nameOrId}" on this account. Use search_packages to find the right package name or ID.`;
      if (String(pkgRow.status) !== "active") return `Package "${pkgRow.name}" is currently in draft status. It must be active before sessions can be created. Activate it in the package builder first.`;

      const token = `df_${randomBytes(32).toString("base64url")}`;
      const prefill: Record<string, string> = {};
      if (firstName) prefill.firstName = firstName;
      if (lastName)  prefill.lastName  = lastName;
      if (email)     prefill.email     = email;

      await db.query(
        `INSERT INTO docuplete_interview_sessions
           (token, package_id, package_version, transaction_scope, deal_id, source, status, test_mode,
            prefill, answers, expires_at, account_id, locale, reminder_enabled, reminder_days, force_scroll_confirmation)
         VALUES ($1, $2, $3, NULL, NULL, $4, 'draft', false,
                 $5::jsonb, '{}'::jsonb, NOW() + INTERVAL '90 days', $6, 'en', false, 2, $7)`,
        [token, pkgRow.id, pkgRow.version ?? 1, source, JSON.stringify(prefill), accountId, forceScroll],
      );

      // Resolve interview origin (custom domain if active)
      const appOrigin = process.env.APP_ORIGIN
        ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://docuplete.com");
      let interviewOrigin = appOrigin;
      try {
        const { rows: domainRows } = await db.query<{ custom_domain: string | null; custom_domain_status: string }>(
          `SELECT custom_domain, custom_domain_status FROM accounts WHERE id = $1`,
          [accountId],
        );
        const dr = domainRows[0];
        if (dr?.custom_domain && dr.custom_domain_status === "active") {
          interviewOrigin = `https://${dr.custom_domain}`;
        }
      } catch { /* non-fatal */ }

      const interviewUrl = `${interviewOrigin}/docuplete/public/${token}`;
      const clientName = [firstName, lastName].filter(Boolean).join(" ") || "the client";
      return [
        `Session created for ${clientName} on "${pkgRow.name}".`,
        ``,
        `Interview link:`,
        interviewUrl,
        ``,
        `This link is active for 90 days. Share it with ${email || "the client"} and they can complete the form at their own pace.`,
        forceScroll ? `Mandatory scroll confirmation is enabled — they must scroll through every page before signing.` : "",
      ].filter(Boolean).join("\n");
    }

    if (toolName === "get_morning_briefing") {
      const statusFilter = typeof toolInput.status === "string" ? toolInput.status : "both";
      const statusClause = statusFilter === "draft"
        ? `s.status = 'draft'`
        : statusFilter === "in_progress"
        ? `s.status = 'in_progress'`
        : `s.status IN ('draft', 'in_progress')`;

      const { rows } = await db.query(
        `SELECT s.token, s.status, s.created_at, s.expires_at, s.prefill,
                s.signer_name, s.signer_email, p.name AS package_name
           FROM docuplete_interview_sessions s
           LEFT JOIN docuplete_packages p ON p.id = s.package_id
          WHERE s.account_id = $1 AND ${statusClause} AND s.test_mode = false
          ORDER BY p.name ASC, s.created_at ASC`,
        [accountId],
      );

      if (rows.length === 0) return "Nothing pending — the queue is clear.";

      // Group by package
      const byPackage = new Map<string, typeof rows>();
      for (const r of rows) {
        const pkg = (r.package_name as string) ?? "Unknown package";
        if (!byPackage.has(pkg)) byPackage.set(pkg, []);
        byPackage.get(pkg)!.push(r);
      }

      const sections: string[] = [`${rows.length} pending session${rows.length === 1 ? "" : "s"}:\n`];
      for (const [pkgName, sessions] of byPackage) {
        sections.push(`${pkgName} (${sessions.length}):`);
        for (const s of sessions) {
          const prefill = typeof s.prefill === "object" && s.prefill ? s.prefill as Record<string, unknown> : {};
          const name  = [prefill.firstName, prefill.lastName].filter(Boolean).join(" ") || s.signer_name || "—";
          const email = (prefill.email as string) || s.signer_email || "";
          const age   = Math.floor((Date.now() - new Date(s.created_at as string).getTime()) / 86400000);
          const ageStr = age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`;
          sections.push(`  • ${name}${email ? ` (${email})` : ""} — ${s.status} — started ${ageStr}`);
        }
      }
      return sections.join("\n");
    }

    if (toolName === "check_package_health") {
      const filterPkgId = typeof toolInput.package_id === "number" ? toolInput.package_id : null;

      const pkgCondition = filterPkgId ? "p.account_id = $1 AND p.id = $2" : "p.account_id = $1";
      const pkgParams: unknown[] = filterPkgId ? [accountId, filterPkgId] : [accountId];

      const { rows: pkgs } = await db.query(
        `SELECT p.id, p.name, p.status, p.auth_level,
                p.enable_interview, p.enable_customer_link, p.enable_embed,
                jsonb_array_length(COALESCE(p.fields, '[]'::jsonb)) AS field_count,
                (SELECT COUNT(*) FROM docuplete_package_documents d WHERE d.package_id = p.id) AS doc_count
           FROM docuplete_packages p
          WHERE ${pkgCondition}
          ORDER BY p.name ASC`,
        pkgParams,
      );

      if (pkgs.length === 0) return filterPkgId ? `Package ${filterPkgId} not found on this account.` : "No packages found on this account.";

      const issues: string[] = [];
      const healthy: string[] = [];

      for (const p of pkgs) {
        const flags: string[] = [];
        const fieldCount = Number(p.field_count ?? 0);
        const docCount   = Number(p.doc_count   ?? 0);
        const hasDelivery = p.enable_interview || p.enable_customer_link || p.enable_embed;

        if (fieldCount === 0)  flags.push("no fields configured");
        if (docCount === 0)    flags.push("no PDFs uploaded");
        if (!hasDelivery && p.status === "active") flags.push("active but no delivery method enabled (interview/customer link/embed are all off)");

        if (flags.length) {
          issues.push(`⚠ ${p.name} (ID ${p.id}, ${p.status}): ${flags.join("; ")}`);
        } else {
          healthy.push(`✓ ${p.name} (ID ${p.id}) — ${fieldCount} fields, ${docCount} doc(s)`);
        }
      }

      const parts: string[] = [];
      if (issues.length)  parts.push(`${issues.length} package${issues.length === 1 ? "" : "s"} with issues:\n${issues.join("\n")}`);
      if (healthy.length) parts.push(`${healthy.length} healthy package${healthy.length === 1 ? "" : "s"}:\n${healthy.join("\n")}`);
      return parts.join("\n\n");
    }

    if (toolName === "search_portal_sessions") {
      const query = typeof toolInput.query === "string" ? toolInput.query.trim() : "";
      if (!query) return "query is required — provide a client name or email.";
      const limit = typeof toolInput.limit === "number" ? Math.min(toolInput.limit, 20) : 10;

      const { rows } = await db.query(
        `SELECT s.token, s.status, s.created_at, s.signed_at,
                s.prefill, s.signer_name, s.signer_email,
                p.name AS package_name
           FROM docuplete_interview_sessions s
           LEFT JOIN docuplete_packages p ON p.id = s.package_id
          WHERE s.account_id = $1 AND s.status = 'generated'
            AND (
              s.signer_name ILIKE $2 OR s.signer_email ILIKE $2
              OR s.prefill::text ILIKE $2
            )
          ORDER BY s.created_at DESC
          LIMIT $3`,
        [accountId, `%${query}%`, limit],
      );

      if (rows.length === 0) return `No completed sessions found for "${query}". They may not have submitted yet, or the name/email may not match what was recorded.`;

      const lines = rows.map((r) => {
        const prefill = typeof r.prefill === "object" && r.prefill ? r.prefill as Record<string, unknown> : {};
        const name  = r.signer_name || [prefill.firstName, prefill.lastName].filter(Boolean).join(" ") || "—";
        const email = r.signer_email || (prefill.email as string) || "—";
        const date  = new Date(r.created_at as string).toLocaleDateString();
        const signed = r.signed_at ? ` | Signed: ${new Date(r.signed_at as string).toLocaleDateString()}` : "";
        return `• ${name} (${email}) — ${r.package_name ?? "?"} — submitted ${date}${signed}`;
      });

      return `Found ${rows.length} completed session${rows.length === 1 ? "" : "s"} for "${query}":\n\n${lines.join("\n")}`;
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
      "TOOL USE GUIDANCE: Use tools only for live data requests — when someone asks about specific sessions, packages, stats, library fields, team members, or asks you to create something. For conceptual questions ('how does X work?', 'what's the difference between Y and Z?'), how-to guidance, creative tasks (drafting labels, suggesting package structure, compliance advice), answer directly and conversationally from your knowledge without calling a tool. When you do fetch data, present it with context — don't just return raw rows. When you create something, confirm it clearly and surface the one thing the user needs next (the link, the ID, the next step).",
      "",
      "ADVISORY CAPABILITIES (no tool needed): You can suggest sensible field lists for any package type based on transaction category (IRA transfer, beneficiary update, etc.). You can draft clear, friendly form labels and question text. You can advise which fields should be marked sensitive based on field names and regulatory norms (SSN, DOB, account numbers, routing numbers). You can explain what a session status means and what the client still needs to do to complete it.",
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
// POST /api/v1/docuplete/public/sessions/:token/merlin

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
      `SELECT s.token, s.status, s.prefill, s.expires_at, s.customer_first_name,
              p.name AS package_name,
              p.fields AS package_fields, p.description AS package_description
         FROM docuplete_interview_sessions s
         LEFT JOIN docuplete_packages p ON p.id = s.package_id
        WHERE s.token = $1
          AND s.expires_at > NOW()
        LIMIT 1`,
      [token],
    );

    if (!rows[0]) {
      sseWrite(res, { type: "error", message: "Session not found or has expired." });
      res.end();
      return;
    }

    if (rows[0].status === "generated") {
      sseWrite(res, { type: "error", message: "This session is already complete." });
      res.end();
      return;
    }

    const session        = rows[0] as Record<string, unknown>;
    const prefill        = typeof session.prefill === "object" && session.prefill ? session.prefill as Record<string, unknown> : {};
    const fields         = Array.isArray(session.package_fields) ? session.package_fields as Array<Record<string, unknown>> : [];
    const currentAnswers = answers ?? {};
    const storedName     = typeof session.customer_first_name === "string" && session.customer_first_name.trim()
      ? session.customer_first_name.trim()
      : null;

    // Build field summary including conditional logic so Merlin can reason about visibility
    const interviewFields = fields.filter((f) => f.interviewMode !== "omitted" && f.interviewMode !== "readonly");
    const answeredIds     = new Set(Object.keys(currentAnswers).filter((k) => currentAnswers[k]?.trim()));
    const pendingFields   = interviewFields.filter((f) => !answeredIds.has(String(f.id)));
    const answeredFields  = interviewFields.filter((f) => answeredIds.has(String(f.id)));

    const fieldSummary = interviewFields.map((f) => {
      const val      = currentAnswers[String(f.id)];
      const answered = val ? `[answered: "${val}"]` : "[pending]";
      const required = f.interviewMode === "required" ? "required" : "optional";
      const display  = String((f.label as string | undefined) ?? f.name);

      let optionStr = "";
      if (Array.isArray(f.options) && f.options.length > 0) {
        optionStr = ` | options: ${(f.options as string[]).join(", ")}`;
      }

      // Include conditional logic so Merlin knows when to ask/skip this field
      let condStr = "";
      const cond = f.condition as Record<string, unknown> | null | undefined;
      if (cond?.fieldId) {
        const triggerField   = fields.find((tf) => String(tf.id) === String(cond.fieldId));
        const triggerDisplay = triggerField
          ? String((triggerField.label as string | undefined) ?? triggerField.name)
          : String(cond.fieldId);
        condStr = ` | CONDITIONAL: only shown when "${triggerDisplay}" ${cond.operator} "${cond.value ?? ""}"`;
      }

      return `  - ${display} (id: ${f.id}, type: ${f.type}, ${required}${optionStr}${condStr}) ${answered}`;
    }).join("\n");

    const prefillSummary = Object.entries(prefill)
      .filter(([, v]) => String(v ?? "").trim())
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");

    // Detect whether this is the very first turn of the conversation.
    // A "first turn" is when the customer has sent exactly one message and Merlin
    // has not replied yet (i.e. there are no assistant messages in the history).
    const isFirstTurn = messages.filter((m) => m.role === "assistant").length === 0;

    const systemPrompt = [
      MERLIN_IDENTITY,
      "",
      `You are guiding a customer through the "${String(session.package_name)}" form. Your role is to ask about one topic at a time, extract their answers, and call update_form_fields to record them. The form auto-fills as you go.`,
      "",
      storedName ? `KNOWN FACT: The customer's first name is ${storedName}. Use it naturally in your messages — not every single time, but enough that the conversation feels personal.` : "",
      "",
      `Context about this customer (pre-filled by their advisor):`,
      prefillSummary || "  (no pre-filled data)",
      "",
      `Form fields (${answeredFields.length} of ${interviewFields.length} answered):`,
      fieldSummary || "  (no fields)",
      "",
      `Pending fields: ${pendingFields.map((f) => String((f.label as string | undefined) ?? f.name)).join(", ") || "All fields answered — ready to review."}`,
      "",
      isFirstTurn ? "OPENING: This is the very first message of the session. Start by warmly introducing yourself: \"Hi, I'm Merlin! I'll be helping you fill out this form today. To get us started — what's your name?\" Do not ask about any form fields yet." : "",
      "INTERVIEW RULES:",
      "1. Ask about one field (or one natural group, like address components) at a time.",
      "2. NEVER echo a raw field label or field ID to the customer. Translate every field into a natural, plain-English question (e.g. ask \"What's your email address?\" not \"Email Address:\").",
      "3. Once you know the customer's first name, use it naturally in your messages — not every single time, but enough that the conversation feels personal.",
      "4. Vary your affirmations and transitions — rotate through phrases like \"Got it\", \"Perfect\", \"Thanks\", \"Great\", \"Sounds good\", \"Appreciate that\" so responses don't feel repetitive.",
      "5. When the customer answers, call update_form_fields immediately with the extracted value, then give a brief warm acknowledgment and move to the next pending field.",
      "6. Respect conditional logic — only ask conditional fields when the triggering condition is met based on already-answered fields.",
      "7. For radio/dropdown/checkbox fields, the value in update_form_fields must exactly match one of the listed options (case-sensitive).",
      "8. For date fields: use MM/DD/YYYY format in update_form_fields.",
      "9. For state fields: use 2-letter state code (e.g. KS, TX, CA) in update_form_fields.",
      "10. For ZIP fields: 5 digits.",
      "11. If a customer seems unsure, offer a gentle clarification without making them feel judged.",
      "12. Never reveal internal field names or IDs to the customer.",
      "13. When all required fields are answered, warmly let them know they're all set and can switch to the form to review and submit.",
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

      // Check whether any updated field is a "first name" field and persist the
      // value. We update even if a name was already stored so the customer can
      // correct their name mid-session and have Merlin use the new value.
      const firstNameFieldId = Object.keys(fieldUpdates).find((id) => {
        const field = fields.find((f) => String(f.id) === id);
        if (!field) return false;
        const label = String((field.label as string | undefined) ?? field.name ?? "").toLowerCase();
        return /\bfirst\s*name\b|\bgiven\s*name\b/.test(label);
      });

      if (firstNameFieldId) {
        // Normalize: strip control characters/newlines and clamp to 100 chars
        // to prevent malformed values from contaminating the system prompt.
        const rawName     = fieldUpdates[firstNameFieldId];
        const cleanedName = rawName.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, 100);
        if (cleanedName && cleanedName !== storedName) {
          await db.query(
            `UPDATE docuplete_interview_sessions SET customer_first_name = $1 WHERE token = $2`,
            [cleanedName, token],
          );
        }
      }
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
