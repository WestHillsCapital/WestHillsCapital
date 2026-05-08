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
  GenerateSessionResult,
  GenerateSessionPending,
  GenerateSessionReady,
  GenerateStatusResult,
  SandboxStartParams,
  SandboxStartResult,
  WebhookDelivery,
} from "./types.js";
export { DocupleteError } from "./client.js";
export type { SendLinkParams, VoidSessionParams } from "./resources/sessions.js";
export {
  verifyWebhookSignature,
  constructWebhookEvent,
  type WebhookPayload,
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
 * const { sessionToken, interviewUrl } = await client.sessions.create({
 *   packageId: 42,
 *   prefill: { firstName: "Jane", email: "jane@example.com" },
 * });
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
