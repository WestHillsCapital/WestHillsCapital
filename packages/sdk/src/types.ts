import type { components } from "./openapi.js";

export type SessionStatus = "draft" | "pending" | "in_progress" | "submitted" | "signed" | "generated" | "voided" | "expired";

export type Package = Required<components["schemas"]["DocuFillPackage"]> & {
  fields: unknown[];
  documents: unknown[];
};

export type SessionListItem = Omit<components["schemas"]["DocuFillSessionListItem"], "status"> & {
  id: number;
  token: string;
  packageId: number;
  packageName: string;
  status: SessionStatus;
  source: string;
  prefill: Record<string, unknown>;
  locale: string;
  testMode: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  submittedAt: string | null;
  voidedAt: string | null;
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

// ── Session creation ──────────────────────────────────────────────────────────

/** A signer in a multi-party sequential signing workflow. */
export interface SessionSigner {
  /** Signer's email address — they receive an interview link. */
  email: string;
  /** Display name used in email greetings. */
  name?: string;
  /** 0-based signing order. Signers proceed in ascending order. Default: 0. */
  order?: number;
}

export interface CreateSessionParams {
  /** ID of the active package to use for this session. */
  packageId: number;
  /**
   * Optional map of field source key → string value to pre-populate before
   * the client sees the interview.
   */
  prefill?: Record<string, string>;
  /**
   * Days until the interview link expires (1–3650).
   * Pass `null` for a link that never expires.
   * Omit to use your organisation's default setting.
   */
  linkExpiryDays?: number | null;
  /** Interview language locale. Omit to use your organisation's default locale. */
  locale?: SupportedLocale;
  /**
   * Automatic reminder email configuration.
   * Omit to use your organisation's default setting.
   */
  reminders?: {
    /** Whether to send reminder emails when the session link goes unopened. */
    enabled: boolean;
    /** Days between reminder emails (1–30). */
    intervalDays: number;
  };
  /**
   * Multi-party signing — list of signers who must each complete the interview
   * in order. When provided, the session routes through each signer sequentially.
   * Maximum 10 signers.
   */
  signers?: SessionSigner[];
}

export interface CreateSessionResult {
  /** Unique session token (`df_...`). Use this to poll status or void the session. */
  sessionToken: string;
  /** Ready-to-use interview URL. Send or redirect your client here. */
  interviewUrl: string;
  /** ISO-8601 expiry timestamp, or `null` if the link never expires. */
  expiresAt: string | null;
}

// ── Bulk session creation ─────────────────────────────────────────────────────

export interface BulkCreateSessionItem extends CreateSessionParams {}

export interface BulkCreateSessionResultItem {
  /** 0-based index of this item in the original request. */
  index: number;
  ok: boolean;
  /** Present when `ok === true`. */
  sessionToken?: string;
  /** Present when `ok === true`. */
  interviewUrl?: string;
  /** Present when `ok === true`. */
  expiresAt?: string | null;
  /** Present when `ok === false`. */
  error?: string;
}

export interface BulkCreateSessionResult {
  results: BulkCreateSessionResultItem[];
  total: number;
  succeeded: number;
  failed: number;
}

// ── Session list ──────────────────────────────────────────────────────────────

export interface ListSessionsParams {
  packageId?: number;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
  /** ISO-8601 timestamp. Returns only sessions updated after this time. */
  updatedAfter?: string;
  /** Full-text search across prefill values. */
  search?: string;
}

export interface ListSessionsResult {
  sessions: SessionListItem[];
  total: number;
  limit: number;
  offset: number;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  /** Unique entry ID. */
  id: number;
  /**
   * Event type. One of:
   * `session.created` | `session.viewed` | `session.started` |
   * `session.submitted` | `session.generated` | `session.voided` |
   * `session.expired` | `link.sent` | `pdf.downloaded` | `signer.completed`
   */
  event: string;
  /** Who performed the action: `api` | `signer` | `staff` | `system`. */
  actorType: string;
  /** Email of the actor, if known. */
  actorEmail: string | null;
  /** IP address of the actor, if known. */
  actorIp: string | null;
  /** Arbitrary structured metadata for this event. */
  metadata: Record<string, unknown>;
  /** ISO-8601 timestamp of when the event occurred. */
  createdAt: string;
}

export interface AuditLogResult {
  token: string;
  entries: AuditLogEntry[];
  total: number;
}

// ── Multi-party signing ───────────────────────────────────────────────────────

export interface SessionSignerStatus {
  id: number;
  order: number;
  email: string;
  name: string | null;
  /** `pending` | `awaiting` | `notified` | `signed` | `declined` */
  status: string;
  /** Signer's unique interview token. */
  signerToken: string;
  notifiedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  declinedReason: string | null;
  createdAt: string;
}

export interface SessionSignersResult {
  token: string;
  signers: SessionSignerStatus[];
  allSigned: boolean;
}

// ── Custom domain ─────────────────────────────────────────────────────────────

export interface CustomDomainStatus {
  domain: string | null;
  /** `not_configured` | `pending_verification` | `active` | `verification_failed` */
  status: string;
  verifiedAt: string | null;
  cnameTarget: string;
  instructions: string | null;
}

// ── PDF generation ────────────────────────────────────────────────────────────

export interface GenerateSessionPending {
  status: "pending";
  jobId: string;
}

export interface GenerateSessionReady {
  status: "generated";
  packet: { token: string; status: string; byteSize: number };
  downloadUrl: string;
}

export type GenerateSessionResult = GenerateSessionPending | GenerateSessionReady;

export interface GenerateStatusResult {
  status: "pending" | "processing" | "ready" | "failed";
  downloadUrl?: string;
  error?: string;
}

// ── Sandbox ───────────────────────────────────────────────────────────────────

export interface SandboxStartResult {
  sessionToken: string;
  interviewUrl: string;
  prefill: Record<string, string>;
  expiresAt: string;
}

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

// ── Webhook delivery ──────────────────────────────────────────────────────────

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

// ── Client options ────────────────────────────────────────────────────────────

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
