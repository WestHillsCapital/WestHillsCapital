import type { DocupleteClient } from "../client.js";
import type {
  Session,
  SessionListItem,
  CreateSessionParams,
  CreateSessionResult,
  ListSessionsParams,
  GenerateSessionResult,
} from "../types.js";

interface GetSessionResponse {
  session: Session;
}

interface ListSessionsResponse {
  sessions: SessionListItem[];
  total: number;
}

export interface SendLinkParams {
  recipientEmail: string;
  recipientName?: string;
  customMessage?: string;
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
   */
  async create(params: CreateSessionParams): Promise<CreateSessionResult> {
    const body: Record<string, unknown> = { packageId: params.packageId };
    if (params.prefill !== undefined)         body.prefill         = params.prefill;
    if (params.linkExpiryDays !== undefined)  body.linkExpiryDays  = params.linkExpiryDays;
    if (params.locale !== undefined)          body.locale          = params.locale;

    return this.client.post<CreateSessionResult>("/sessions", body);
  }

  /**
   * Fetch the current state of a session by its token.
   * Use this to poll for completion (`status === "generated"`) or
   * to retrieve submitted answers.
   */
  async get(token: string): Promise<Session> {
    const res = await this.client.get<GetSessionResponse>(
      `/product/docufill/sessions/${token}`,
    );
    return res.session;
  }

  /**
   * List sessions for your account with optional filters.
   * Returns sessions in descending creation order.
   */
  async list(
    params: ListSessionsParams = {},
  ): Promise<{ sessions: SessionListItem[]; total: number }> {
    return this.client.get<ListSessionsResponse>("/product/docufill/sessions", {
      packageId: params.packageId,
      status:    params.status,
      limit:     params.limit,
      offset:    params.offset,
    });
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
      `/product/docufill/sessions/${token}`,
      { answers },
    );
    return res.session;
  }

  /**
   * Trigger final PDF packet generation for a completed session.
   * Fires any enabled integrations (Google Drive, HubSpot, webhooks).
   * Call this after `updateAnswers` when filling the session programmatically.
   *
   * Returns the packet data, a download URL, and any non-fatal integration warnings.
   */
  async generate(token: string): Promise<GenerateSessionResult> {
    return this.client.post<GenerateSessionResult>(
      `/product/docufill/sessions/${token}/generate`,
      {},
    );
  }

  /**
   * Send (or re-send) the interview link email to a recipient.
   * The email is sent from your organisation's configured address
   * and includes the unique interview URL for this session.
   */
  async sendLink(token: string, params: SendLinkParams): Promise<{ success: boolean }> {
    return this.client.post(`/product/docufill/sessions/${token}/send-link`, {
      recipientEmail: params.recipientEmail,
      recipientName:  params.recipientName,
      customMessage:  params.customMessage,
    });
  }

  /**
   * Void a session, immediately invalidating its interview link.
   * Voided sessions cannot be submitted. This cannot be undone.
   */
  async void(token: string): Promise<{ success: boolean }> {
    return this.client.post(`/product/docufill/sessions/${token}/void`, {});
  }
}
