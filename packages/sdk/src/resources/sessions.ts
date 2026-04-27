import type { DocupleteClient } from "../client.js";
import type { Session, SessionListItem, CreateSessionParams, ListSessionsParams } from "../types.js";

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

export class SessionsResource {
  constructor(private readonly client: DocupleteClient) {}

  async create(params: CreateSessionParams): Promise<CreateSessionResult> {
    const body: Record<string, unknown> = { packageId: params.packageId };
    if (params.prefill)          body.prefill = params.prefill;
    if (params.recipientEmail)   body.recipientEmail = params.recipientEmail;
    if (params.transactionScope) body.transactionScope = params.transactionScope;
    if (params.source)           body.source = params.source;

    return this.client.post<CreateSessionResult>("/product/docufill/sessions", body);
  }

  async get(token: string): Promise<Session> {
    const res = await this.client.get<GetSessionResponse>(`/product/docufill/sessions/${token}`);
    return res.session;
  }

  async list(params: ListSessionsParams = {}): Promise<{ sessions: SessionListItem[]; total: number }> {
    return this.client.get<ListSessionsResponse>("/product/docufill/sessions", {
      packageId: params.packageId,
      status:    params.status,
      limit:     params.limit,
      offset:    params.offset,
    });
  }
}
