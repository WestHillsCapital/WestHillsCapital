import type { DocupleteClient } from "../client.js";
import type {
  Session,
  SessionListItem,
  CreateSessionParams,
  ListSessionsParams,
  GenerateSessionResult,
} from "../types.js";

export interface CreateSessionResult {
  session: Session;
  token: string;
  interviewUrl: string;
}

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

  /** Create a new interview session. Returns the session, bearer token, and ready-to-use interview URL. */
  async create(params: CreateSessionParams): Promise<CreateSessionResult> {
    const body: Record<string, unknown> = { packageId: params.packageId };
    if (params.prefill)          body.prefill          = params.prefill;
    if (params.recipientEmail)   body.recipientEmail   = params.recipientEmail;
    if (params.transactionScope) body.transactionScope = params.transactionScope;
    if (params.source)           body.source           = params.source;

    return this.client.post<CreateSessionResult>("/product/docufill/sessions", body);
  }

  /** Fetch the current state of a session by its token. Use this to poll for completion. */
  async get(token: string): Promise<Session> {
    const res = await this.client.get<GetSessionResponse>(`/product/docufill/sessions/${token}`);
    return res.session;
  }

  /** List sessions for your account with optional filters. */
  async list(params: ListSessionsParams = {}): Promise<{ sessions: SessionListItem[]; total: number }> {
    return this.client.get<ListSessionsResponse>("/product/docufill/sessions", {
      packageId: params.packageId,
      status:    params.status,
      limit:     params.limit,
      offset:    params.offset,
    });
  }

  /**
   * Save interview answers for a session in progress.
   * Useful when you want to programmatically fill answers instead of
   * sending the recipient to the interview URL.
   */
  async updateAnswers(token: string, answers: Record<string, unknown>): Promise<Session> {
    const res = await this.client.patch<GetSessionResponse>(
      `/product/docufill/sessions/${token}`,
      { answers },
    );
    return res.session;
  }

  /**
   * Generate the final PDF packet for a completed session.
   * Returns the packet data, a download URL, and any integration warnings
   * (e.g. if Drive or HubSpot sync failed non-fatally).
   */
  async generate(token: string): Promise<GenerateSessionResult> {
    return this.client.post<GenerateSessionResult>(
      `/product/docufill/sessions/${token}/generate`,
      {},
    );
  }

  /**
   * Send (or re-send) the interview link email to a recipient.
   * The email is sent from your organisation's configured address and includes
   * the unique interview URL for this session.
   */
  async sendLink(token: string, params: SendLinkParams): Promise<{ success: boolean }> {
    return this.client.post(`/product/docufill/sessions/${token}/send-link`, {
      recipientEmail: params.recipientEmail,
      recipientName:  params.recipientName,
      customMessage:  params.customMessage,
    });
  }
}
