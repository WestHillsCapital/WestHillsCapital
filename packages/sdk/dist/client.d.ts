import type { DocupleteClientOptions } from "./types.js";
export declare class DocupleteError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(message: string, status: number, code?: string);
}
export declare class DocupleteClient {
    private readonly apiKey;
    private readonly baseUrl;
    constructor(options: DocupleteClientOptions);
    request<T>(method: string, path: string, body?: unknown): Promise<T>;
    get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    patch<T>(path: string, body: unknown): Promise<T>;
}
//# sourceMappingURL=client.d.ts.map