export class SessionsResource {
    constructor(client) {
        this.client = client;
    }
    /** Create a new interview session. Returns the session, bearer token, and ready-to-use interview URL. */
    async create(params) {
        const body = { packageId: params.packageId };
        if (params.prefill)
            body.prefill = params.prefill;
        if (params.recipientEmail)
            body.recipientEmail = params.recipientEmail;
        if (params.transactionScope)
            body.transactionScope = params.transactionScope;
        if (params.source)
            body.source = params.source;
        return this.client.post("/product/docufill/sessions", body);
    }
    /** Fetch the current state of a session by its token. Use this to poll for completion. */
    async get(token) {
        const res = await this.client.get(`/product/docufill/sessions/${token}`);
        return res.session;
    }
    /** List sessions for your account with optional filters. */
    async list(params = {}) {
        return this.client.get("/product/docufill/sessions", {
            packageId: params.packageId,
            status: params.status,
            limit: params.limit,
            offset: params.offset,
        });
    }
    /**
     * Save interview answers for a session in progress.
     * Useful when you want to programmatically fill answers instead of
     * sending the recipient to the interview URL.
     */
    async updateAnswers(token, answers) {
        const res = await this.client.patch(`/product/docufill/sessions/${token}`, { answers });
        return res.session;
    }
    /**
     * Generate the final PDF packet for a completed session.
     * Returns the packet data, a download URL, and any integration warnings
     * (e.g. if Drive or HubSpot sync failed non-fatally).
     */
    async generate(token) {
        return this.client.post(`/product/docufill/sessions/${token}/generate`, {});
    }
    /**
     * Send (or re-send) the interview link email to a recipient.
     * The email is sent from your organisation's configured address and includes
     * the unique interview URL for this session.
     */
    async sendLink(token, params) {
        return this.client.post(`/product/docufill/sessions/${token}/send-link`, {
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName,
            customMessage: params.customMessage,
        });
    }
}
//# sourceMappingURL=sessions.js.map