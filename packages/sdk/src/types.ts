import type { components } from "./openapi.js";

export type SessionStatus = "draft" | "in_progress" | "generated";

export type Session = components["schemas"]["DocuFillSession"] & {
  id: number;
  token: string;
  package_id: number;
  package_name: string;
  status: SessionStatus;
  answers: Record<string, unknown>;
  prefill: Record<string, unknown>;
  fields: unknown[];
  documents: unknown[];
  mappings: unknown[];
  custodian_name: string | null;
  depository_name: string | null;
  org_name: string | null;
  org_logo_url: string | null;
  org_brand_color: string | null;
  transaction_scope: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export interface SessionListItem {
  id: number;
  token: string;
  package_id: number;
  package_name: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface Package {
  id: number;
  account_id: number;
  name: string;
  active: boolean;
  description: string | null;
  transaction_scope: string | null;
  custodian_id: number | null;
  custodian_name: string | null;
  depository_id: number | null;
  depository_name: string | null;
  webhook_url: string | null;
  recipient_email: string | null;
  fields: unknown[];
  documents: unknown[];
  created_at: string;
  updated_at: string;
}

export interface Account {
  accountId: number;
  accountName: string;
  slug: string;
  email: string | null;
  role: string;
}

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
