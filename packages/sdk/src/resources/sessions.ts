import type { DocupleteClient } from "../client.js";
import type {
  Session,
  SessionListItem,
  CreateSessionParams,
  CreateSessionResult,
  ListSessionsParams,
  ListSessionsResult,
  GenerateSessionResult,
  GenerateStatusResult,
  BulkCreateSessionItem,
  BulkCreateSessionResult,
  AuditLogResult,
  SessionSignersResult,
} from "../types.js";

interface GetSessionResponse {
  session: Session;
}

export interface SendLinkParams {
  /** Required. The recipient's email address. */
  recipientEmail: string;
  /** Optional. The recipient's display name used in the email greeting. */
  recipientName?: string;
  /** Optional. A custom message appended to the standard email body. */
  customMessage?: string;
}

export interface VoidSessionParams {
  /** Optional reason for voiding, stored in the audit log. */
  reason?: string;
  /** When `true`, notifies the signer by email that the session was voided. Default: false. */
  notifySigner?: boolean;
}

export class SessionsResource {
  constructor(private readonly client: DocupleteClient) {}

  /**
   * List sessions for your account with optional filters.
   * Returns sessions in descending `created_at` order.
   *
   * @example
   * ```ts
   * // List all submitted sessions for a specific package
   * const { sessions, total } = await client.sessions.list({
   *   packageId: 42,
   *   status: "generated",
   *   limit: 50,
   * });
   *
   * // Incremental sync — only sessions updated since last poll
   * const { sessions } = await client.sessions.list({
   *   updatedAfter: "2024-01-15T00:00:00Z",
   * });
   * ```
   */
  async list(params: ListSessionsParams = {}): Promise<ListSessionsResult> {
    const query: Record<string, string | number | undefined> = {
      packageId:    params.packageId,
      status:       params.status,
      limit:        params.limit,
      offset:       params.offset,
      updatedAfter: params.updatedAfter,
      search:       params.search,
    };
    return this.client.get<ListSessionsResult>("/sessions", query);
  }

  /**
   * Create a new interview session via the headless API.
   *
   * Returns a `sessionToken` and a ready-to-use `interviewUrl` your client
   * can be sent to or redirected at.
   *
   * Prefill values should use field **source keys** as keys
   * (e.g. `{ firstName: "Jane", email: "jane@example.com" }`).
   *
   * Requires a `dp_live_…` API key.
   *
   * @example
   * ```ts
   * const { sessionToken, interviewUrl } = await client.sessions.create({
   *   packageId: 42,
   *   prefill: { firstName: "Jane", email: "jane@acme.com" },
   *   reminders: { enabled: true, intervalDays: 2 },
   * });
   * ```
   */
  async create(params: CreateSessionParams): Promise<CreateSessionResult> {
    const body: Record<string, unknown> = { packageId: params.packageId };
    if (params.prefill !== undefined)        body.prefill        = params.prefill;
    if (params.linkExpiryDays !== undefined) body.linkExpiryDays = params.linkExpiryDays;
    if (params.locale !== undefined)         body.locale         = params.locale;
    if (params.reminders !== undefined)      body.reminders      = params.reminders;
    if (params.signers !== undefined)        body.signers        = params.signers;

    return this.client.post<CreateSessionResult>("/sessions", body);
  }

  /**
   * Create up to 100 sessions in a single request.
   *
   * Each item in `sessions` accepts the same parameters as `create()`.
   * The batch processes all items — per-item failures do not abort the batch.
   * Check each result's `ok` field for success or failure.
   *
   * Returns HTTP 207 Multi-Status regardless of individual outcomes.
   *
   * @example
   * ```ts
   * const { results } = await client.sessions.bulkCreate({
   *   sessions: [
   *     { packageId: 42, prefill: { email: "alice@acme.com" } },
   *     { packageId: 42, prefill: { email: "bob@acme.com" } },
   *   ],
   * });
   * for (const r of results) {
   *   if (r.ok) console.log("Created:", r.sessionToken);
   *   else console.error("Failed item", r.index, ":", r.error);
   * }
   * ```
   */
  async bulkCreate(params: { sessions: BulkCreateSessionItem[] }): Promise<BulkCreateSessionResult> {
    return this.client.post<BulkCreateSessionResult>("/sessions/bulk", params);
  }

  /**
   * Fetch the current state of a session by its token.
   * Sensitive fields are redacted in the response.
   */
  async get(token: string): Promise<Session> {
    const res = await this.client.get<GetSessionResponse>(`/sessions/${token}`);
    return res.session;
  }

  /**
   * Retrieve the full chronological audit trail for a session.
   *
   * Each entry records a discrete event — session created, link sent, first
   * viewed, first answered, submitted, PDF generated, downloaded, voided, etc.
   * — including actor type, IP address, and structured metadata.
   *
   * Entries are returned oldest-first and are immutable once written.
   *
   * @example
   * ```ts
   * const { entries } = await client.sessions.auditLog(token);
   * for (const e of entries) {
   *   console.log(e.event, e.createdAt, e.actorType, e.actorIp);
   * }
   * ```
   */
  async auditLog(token: string, params?: { limit?: number }): Promise<AuditLogResult> {
    return this.client.get<AuditLogResult>(
      `/sessions/${token}/audit-log`,
      params?.limit !== undefined ? { limit: params.limit } : undefined,
    );
  }

  /**
   * Returns the ordered list of signers for a multi-party signing session.
   *
   * For sessions created with a `signers` array, this shows each signer's
   * current status and their unique interview token.
   */
  async signers(token: string): Promise<SessionSignersResult> {
    return this.client.get<SessionSignersResult>(`/sessions/${token}/signers`);
  }

  /**
   * Save interview answers for a session programmatically.
   * Useful when you want to fill the form on behalf of the client.
   */
  async updateAnswers(
    token: string,
    answers: Record<string, unknown>,
  ): Promise<Session> {
    const res = await this.client.patch<GetSessionResponse>(
      `/product/docuplete/sessions/${token}`,
      { answers },
    );
    return res.session;
  }

  /**
   * Trigger final PDF packet generation for a completed session.
   * Fires any enabled integrations (Google Drive, HubSpot, webhooks).
   *
   * When BullMQ is available the job is enqueued and `status === "pending"` is returned.
   * Poll `getGenerateStatus(token, jobId)` until `status === "ready"`.
   */
  async generate(token: string): Promise<GenerateSessionResult> {
    return this.client.post<GenerateSessionResult>(
      `/product/docuplete/sessions/${token}/generate`,
      {},
    );
  }

  /**
   * Poll the status of a background PDF generation job.
   *
   * @example
   * ```ts
   * const result = await client.sessions.generate(token);
   * if (result.status === "generated") {
   *   console.log("Ready:", result.downloadUrl);
   * } else {
   *   let ready = false;
   *   while (!ready) {
   *     await new Promise(r => setTimeout(r, 2000));
   *     const s = await client.sessions.getGenerateStatus(token, result.jobId);
   *     if (s.status === "ready") { console.log(s.downloadUrl); ready = true; }
   *     if (s.status === "failed") throw new Error(s.error ?? "Generation failed");
   *   }
   * }
   * ```
   */
  async getGenerateStatus(token: string, jobId?: string): Promise<GenerateStatusResult> {
    return this.client.get<GenerateStatusResult>(
      `/product/docuplete/sessions/${token}/generate-status`,
      jobId ? { jobId } : undefined,
    );
  }

  /**
   * Send (or re-send) the interview link email to a recipient.
   */
  async sendLink(token: string, params: SendLinkParams): Promise<{ ok: boolean; sentTo: string }> {
    return this.client.post<{ ok: boolean; sentTo: string }>(
      `/product/docuplete/sessions/${token}/send-link`,
      {
        recipientEmail: params.recipientEmail,
        recipientName:  params.recipientName,
        customMessage:  params.customMessage,
      },
    );
  }

  /**
   * Void a session, immediately invalidating its interview link.
   * Voided sessions cannot be submitted. This cannot be undone.
   */
  async void(
    token: string,
    params?: VoidSessionParams,
  ): Promise<{ ok: boolean; token: string; voidedAt: string }> {
    return this.client.post<{ ok: boolean; token: string; voidedAt: string }>(
      `/product/docuplete/sessions/${token}/void`,
      { reason: params?.reason, notifySigner: params?.notifySigner ?? false },
    );
  }
}
