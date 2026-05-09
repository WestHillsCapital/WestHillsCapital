import { DocupleteClient } from "./client.js";
import { PackagesResource } from "./resources/packages.js";
import { SessionsResource } from "./resources/sessions.js";
import { AccountResource } from "./resources/account.js";
import { SandboxResource } from "./resources/sandbox.js";

export type { DocupleteClientOptions, SupportedLocale } from "./types.js";
export type {
  Package,
  Session,
  SessionListItem,
  SessionStatus,
  Account,
  CreateSessionParams,
  CreateSessionResult,
  ListSessionsParams,
  ListSessionsResult,
  GenerateSessionResult,
  GenerateSessionPending,
  GenerateSessionReady,
  GenerateStatusResult,
  SandboxStartParams,
  SandboxStartResult,
  WebhookDelivery,
  // Bulk creation
  BulkCreateSessionItem,
  BulkCreateSessionResult,
  BulkCreateSessionResultItem,
  // Multi-party signing
  SessionSigner,
  SessionSignerStatus,
  SessionSignersResult,
  // Audit log
  AuditLogEntry,
  AuditLogResult,
  // Custom domain
  CustomDomainStatus,
} from "./types.js";
export { DocupleteError } from "./client.js";
export type { SendLinkParams, VoidSessionParams } from "./resources/sessions.js";
export {
  verifyWebhookSignature,
  constructWebhookEvent,
  type WebhookPayload,
  type WebhookEventType,
  type SessionCreatedPayload,
  type SessionViewedPayload,
  type SessionStartedPayload,
  type SessionSubmittedPayload,
  type InterviewSubmittedPayload,
  type PdfGeneratedPayload,
  type SessionVoidedPayload,
  type SessionExpiredPayload,
  type SignerCompletedPayload,
} from "./webhooks.js";

/**
 * The Docuplete API client.
 *
 * @example
 * ```ts
 * import { Docuplete } from "@docuplete/sdk";
 *
 * const client = new Docuplete({ apiKey: process.env.DOCUPLETE_API_KEY! });
 *
 * // Create a single session
 * const { sessionToken, interviewUrl } = await client.sessions.create({
 *   packageId: 42,
 *   prefill: { firstName: "Jane", email: "jane@example.com" },
 *   reminders: { enabled: true, intervalDays: 2 },
 * });
 *
 * // Bulk-create 50 sessions at once
 * const { results } = await client.sessions.bulkCreate({
 *   sessions: contacts.map(c => ({
 *     packageId: 42,
 *     prefill: { email: c.email, firstName: c.name },
 *   })),
 * });
 *
 * // Retrieve the audit trail for a session
 * const { entries } = await client.sessions.auditLog(sessionToken);
 *
 * // Handle webhooks
 * const payload = await constructWebhookEvent(rawBody, sig, secret);
 * switch (payload.event) {
 *   case "session.created":   handleCreated(payload);   break;
 *   case "session.submitted": handleSubmitted(payload); break;
 *   case "pdf.generated":     handleGenerated(payload); break;
 *   case "session.voided":    handleVoided(payload);    break;
 * }
 * ```
 */
export class Docuplete {
  readonly packages: PackagesResource;
  readonly sessions: SessionsResource;
  readonly account:  AccountResource;
  readonly sandbox:  SandboxResource;

  private readonly _client: DocupleteClient;

  constructor(options: { apiKey: string; baseUrl?: string; timeout?: number }) {
    this._client  = new DocupleteClient(options);
    this.packages = new PackagesResource(this._client);
    this.sessions = new SessionsResource(this._client);
    this.account  = new AccountResource(this._client);
    this.sandbox  = new SandboxResource(this._client);
  }
}
