import type { components } from "./openapi.js";

export type SessionStatus = "draft" | "in_progress" | "generated";

export type Package = Required<components["schemas"]["DocuFillPackage"]> & {
  fields: unknown[];
  documents: unknown[];
};

export type SessionListItem = components["schemas"]["DocuFillSessionListItem"] & {
  status: SessionStatus;
};

export type Session = components["schemas"]["DocuFillSession"] & {
  id: number;
  token: string;
  package_id: number;
  package_name: string;
  status: SessionStatus;
  answers: Record<string, unknown>;
  prefill: Record<string, unknown>;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type Account = components["schemas"]["AccountInfo"];

export interface CreateSessionParams {
  packageId: number;
  prefill?: Record<string, unknown>;
  recipientEmail?: string;
  transactionScope?: string;
  source?: string;
}

export interface ListSessionsParams {
  packageId?: number;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

export interface DocupleteClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface ApiErrorResponse {
  error: string;
}
