import type { DocupleteClient } from "../client.js";
import type {
  Session,
  SessionListItem,
  CreateSessionParams,
  CreateSessionResult,
  ListSessionsParams,
  GenerateSessionResult,
  GenerateStatusResult,
} from "../types.js";

interface GetSessionResponse {
  session: Session;
}

interface ListSessionsResponse {
  sessions: SessionListItem[];
  total: number;
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
   * Create a new interview session via the headless API.
   *
   * Returns a `sessionToken` and a ready-to-use `interviewUrl` your client
   * can be sent to or redirected at.
   *
   * Prefill values should use field **source keys** as keys
   * (e.g. `{ firstName: "Jane", email: "jane@example.com" }`).
   *
   * Requires a `dp_live_…` API key.
   */
  async create(params: CreateSessionParams): Promise<CreateSessionResult> {
    const body: Record<string, unknown> = { packageId: params.packageId };
    if (params.prefill !== undefined)        body.prefill        = params.prefill;
    if (params.linkExpiryDays !== undefined) body.linkExpiryDays = params.linkExpiryDays;
    if (params.locale !== undefined)         body.locale         = params.locale;

    return this.client.post<CreateSessionResult>("/sessions", body);
  }

  /**
   * Fetch the current state of a session by its token.
   * Use this to poll for completion (`status === "generated"`) or
   * to retrieve submitted answers.
   */
  async get(token: string): Promise<Session> {
    const res = await this.client.get<GetSessionResponse>(
      `/product/docuplete/sessions/${token}`,
    );
    return res.session;
  }

  /**
   * List sessions for your account with optional filters.
   * Returns sessions in descending `updated_at` order.
   *
   * @param params.updatedAfter  ISO-8601 timestamp — only return sessions updated after this time.
   *                             Useful for incremental sync with a cursor pattern.
   */
  async list(
    params: ListSessionsParams = {},
  ): Promise<{ sessions: SessionListItem[]; total: number }> {
    const query: Record<string, string | number | undefined> = {
      packageId:    params.packageId,
      status:       params.status,
      limit:        params.limit,
      offset:       params.offset,
      updatedAfter: params.updatedAfter,
    };
    return this.client.get<ListSessionsResponse>("/product/docuplete/sessions", query);
  }

  /**
   * Save interview answers for a session programmatically.
   * Useful when you want to fill the form on behalf of the client rather than
   * sending them to the interview URL.
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
   * Call this after `updateAnswers` when filling the session programmatically.
   *
   * When BullMQ is available the job is enqueued and `status === "pending"` is returned.
   * Poll `getGenerateStatus(token, jobId)` until `status === "ready"`.
   *
   * When the queue is unavailable (degraded mode) generation is synchronous and
   * `status === "generated"` is returned with an immediate `downloadUrl`.
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
   * @param token  The session token.
   * @param jobId  The `jobId` returned by `generate()` when `status === "pending"`.
   *               Omit to check session status without a job reference.
   *
   * @example
   * ```ts
   * const result = await client.sessions.generate(token);
   * if (result.status === "generated") {
   *   console.log("Ready immediately:", result.downloadUrl);
   * } else {
   *   // Poll every 2 s
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
   * The email is sent from your organisation's configured address
   * and includes the unique interview URL for this session.
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
   *
   * Only `generated` sessions can be voided.
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
