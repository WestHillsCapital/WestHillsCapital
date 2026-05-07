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

export type SupportedLocale = "en" | "es" | "fr" | "de" | "pt" | "zh" | "ja" | "ko" | "ar";

export interface CreateSessionParams {
  /** ID of the active package to use for this session. */
  packageId: number;
  /**
   * Optional map of field source key → string value to pre-populate before
   * the client sees the interview. Source keys are the short identifiers
   * shown in the field editor (e.g. `firstName`, `email`, `ssn`).
   */
  prefill?: Record<string, string>;
  /**
   * Days until the interview link expires (1–3650).
   * Pass `null` for a link that never expires.
   * Omit to use your organisation's default setting.
   */
  linkExpiryDays?: number | null;
  /**
   * Interview language locale.
   * Omit to use your organisation's default locale.
   */
  locale?: SupportedLocale;
}

export interface CreateSessionResult {
  /** Unique session token — use this to poll status or void the session. */
  sessionToken: string;
  /** Ready-to-use interview URL — send or redirect your client here. */
  interviewUrl: string;
  /**
   * ISO-8601 expiry timestamp, or `null` if the link never expires.
   */
  expiresAt: string | null;
}

export interface GenerateSessionResult {
  packet: Record<string, unknown>;
  downloadUrl: string;
  drive: { fileId: string; url: string } | null;
  warnings: string[];
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
