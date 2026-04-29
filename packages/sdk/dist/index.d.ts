import { PackagesResource } from "./resources/packages.js";
import { SessionsResource } from "./resources/sessions.js";
import { AccountResource } from "./resources/account.js";
export type { DocupleteClientOptions } from "./types.js";
export type { Package, Session, SessionListItem, SessionStatus, Account, CreateSessionParams, ListSessionsParams, GenerateSessionResult, } from "./types.js";
export { DocupleteError } from "./client.js";
export type { CreateSessionResult, SendLinkParams } from "./resources/sessions.js";
export { verifyWebhookSignature, constructWebhookEvent, type WebhookPayload, } from "./webhooks.js";
export declare class Docuplete {
    readonly packages: PackagesResource;
    readonly sessions: SessionsResource;
    readonly account: AccountResource;
    private readonly _client;
    constructor(options: {
        apiKey: string;
        baseUrl?: string;
    });
}
//# sourceMappingURL=index.d.ts.map