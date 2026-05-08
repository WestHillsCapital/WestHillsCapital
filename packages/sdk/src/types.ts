import type { components } from "./openapi.js";

export type SessionStatus = "draft" | "in_progress" | "generated" | "voided";

export type Package = Required<components["schemas"]["DocuFillPackage"]> & {
  fields: unknown[];
  documents: unknown[];
};

export type SessionListItem = Omit<components["schemas"]["DocuFillSessionListItem"], "status"> & {
  status: SessionStatus;
};

export type Session = Omit<components["schemas"]["DocuFillSession"], "status"> & {
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

/**
 * Result when PDF generation is dispatched to the background queue (HTTP 202).
 * Poll `sessions.getGenerateStatus(token, jobId)` until `status === "ready"`.
 */
export interface GenerateSessionPending {
  status: "pending";
  jobId: string;
}

/**
 * Result when PDF generation completes synchronously (Redis unavailable fallback, HTTP 200).
 */
export interface GenerateSessionReady {
  status: "generated";
  packet: { token: string; status: string; byteSize: number };
  downloadUrl: string;
}

/**
 * Discriminated union returned by `sessions.generate()`.
 *
 * - `status === "pending"` → background job enqueued. Use `jobId` with
 *   `sessions.getGenerateStatus()` to poll for completion.
 * - `status === "generated"` → PDF generated synchronously. Use `downloadUrl`
 *   to retrieve the file immediately.
 */
export type GenerateSessionResult = GenerateSessionPending | GenerateSessionReady;

/** Response from `sessions.getGenerateStatus()`. */
export interface GenerateStatusResult {
  /** `ready` = download available; `pending`/`processing` = still running; `failed` = error */
  status: "pending" | "processing" | "ready" | "failed";
  /** Relative URL to the generated PDF. Only present when `status === "ready"`. */
  downloadUrl?: string;
  /** Error description. Only present when `status === "failed"`. */
  error?: string;
}

export interface ListSessionsParams {
  packageId?: number;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
  /** ISO-8601 timestamp. When provided, returns only sessions updated after this time. */
  updatedAfter?: string;
}

/** Sandbox session response from `sandbox.start()`. */
export interface SandboxStartResult {
  /** Sandbox session token (`df_sbx_...`). */
  sessionToken: string;
  /** Interview URL with `?sandbox=1` appended — open in a browser to try the demo flow. */
  interviewUrl: string;
  /** Prefill values provided as query parameters. */
  prefill: Record<string, string>;
  /** ISO-8601 expiry timestamp (7 days from creation). */
  expiresAt: string;
}

/** Optional prefill values for `sandbox.start()`. */
export interface SandboxStartParams {
  firstName?: string;
  lastName?: string;
  email?: string;
  dateOfBirth?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** A single webhook delivery attempt record. */
export interface WebhookDelivery {
  id: number;
  event_type: string;
  attempt_number: number;
  http_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  created_at: string;
  has_payload: boolean;
}

export interface DocupleteClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 30 000 (30 s). */
  timeout?: number;
}

export interface ApiErrorResponse {
  error: string;
  code?: string;
  issues?: string[];
}
