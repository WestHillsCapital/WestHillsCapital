import { DocupleteClient } from "./client.js";
import { PackagesResource } from "./resources/packages.js";
import { SessionsResource } from "./resources/sessions.js";
import { AccountResource } from "./resources/account.js";
export { DocupleteError } from "./client.js";
export { verifyWebhookSignature, constructWebhookEvent, } from "./webhooks.js";
export class Docuplete {
    constructor(options) {
        this._client = new DocupleteClient(options);
        this.packages = new PackagesResource(this._client);
        this.sessions = new SessionsResource(this._client);
        this.account = new AccountResource(this._client);
    }
}
//# sourceMappingURL=index.js.map