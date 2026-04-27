import { DocupleteClient } from "./client.js";
import { PackagesResource } from "./resources/packages.js";
import { SessionsResource } from "./resources/sessions.js";
import { AccountResource } from "./resources/account.js";

export type { DocupleteClientOptions } from "./types.js";
export type {
  Package,
  Session,
  SessionStatus,
  Account,
  CreateSessionParams,
  ListSessionsParams,
} from "./types.js";
export { DocupleteError } from "./client.js";

export class Docuplete {
  readonly packages: PackagesResource;
  readonly sessions: SessionsResource;
  readonly account: AccountResource;

  private readonly _client: DocupleteClient;

  constructor(options: { apiKey: string; baseUrl?: string }) {
    this._client  = new DocupleteClient(options);
    this.packages = new PackagesResource(this._client);
    this.sessions = new SessionsResource(this._client);
    this.account  = new AccountResource(this._client);
  }
}
