import type { DocupleteClient } from "../client.js";
import type { Session, SessionListItem, CreateSessionParams, ListSessionsParams, GenerateSessionResult } from "../types.js";
export interface CreateSessionResult {
    session: Session;
    token: string;
    interviewUrl: string;
}
export interface SendLinkParams {
    recipientEmail: string;
    recipientName?: string;
    customMessage?: string;
}
export declare class SessionsResource {
    private readonly client;
    constructor(client: DocupleteClient);
    /** Create a new interview session. Returns the session, bearer token, and ready-to-use interview URL. */
    create(params: CreateSessionParams): Promise<CreateSessionResult>;
    /** Fetch the current state of a session by its token. Use this to poll for completion. */
    get(token: string): Promise<Session>;
    /** List sessions for your account with optional filters. */
    list(params?: ListSessionsParams): Promise<{
        sessions: SessionListItem[];
        total: number;
    }>;
    /**
     * Save interview answers for a session in progress.
     * Useful when you want to programmatically fill answers instead of
     * sending the recipient to the interview URL.
     */
    updateAnswers(token: string, answers: Record<string, unknown>): Promise<Session>;
    /**
     * Generate the final PDF packet for a completed session.
     * Returns the packet data, a download URL, and any integration warnings
     * (e.g. if Drive or HubSpot sync failed non-fatally).
     */
    generate(token: string): Promise<GenerateSessionResult>;
    /**
     * Send (or re-send) the interview link email to a recipient.
     * The email is sent from your organisation's configured address and includes
     * the unique interview URL for this session.
     */
    sendLink(token: string, params: SendLinkParams): Promise<{
        success: boolean;
    }>;
}
//# sourceMappingURL=sessions.d.ts.map