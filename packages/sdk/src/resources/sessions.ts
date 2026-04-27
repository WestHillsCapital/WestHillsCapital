import type { DocupleteClient } from "../client.js";
import type { Session, CreateSessionParams, ListSessionsParams } from "../types.js";

interface CreateSessionResponse {
  session: Session;
  token: string;
  interviewUrl: string;
}

interface GetSessionResponse {
  session: Session;
}

interface ListSessionsResponse {
  sessions: Session[];
  total: number;
}

export class SessionsResource {
  constructor(private readonly client: DocupleteClient) {}

  async create(params: CreateSessionParams): Promise<CreateSessionResponse> {
    const body: Record<string, unknown> = { packageId: params.packageId };
    if (params.prefill)         body.prefill = params.prefill;
    if (params.recipientEmail)  body.recipientEmail = params.recipientEmail;
    if (params.transactionScope) body.transactionScope = params.transactionScope;
    if (params.source)          body.source = params.source;

    return this.client.post<CreateSessionResponse>("/product/docufill/sessions", body);
  }

  async get(token: string): Promise<Session> {
    const res = await this.client.get<GetSessionResponse>(`/product/docufill/sessions/${token}`);
    return res.session;
  }

  async list(params: ListSessionsParams = {}): Promise<Session[]> {
    const res = await this.client.get<ListSessionsResponse>("/product/docufill/sessions", {
      packageId: params.packageId,
      status:    params.status,
      limit:     params.limit,
      offset:    params.offset,
    });
    return res.sessions;
  }
}
