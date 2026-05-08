import type { DocupleteClientOptions, ApiErrorResponse } from "./types.js";

export class DocupleteError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: string[];

  constructor(message: string, status: number, code = "api_error", issues?: string[]) {
    super(message);
    this.name = "DocupleteError";
    this.status = status;
    this.code = code;
    this.issues = issues;
    Object.setPrototypeOf(this, DocupleteError.prototype);
  }
}

const DEFAULT_BASE_URL = "https://api.docuplete.com";
const DEFAULT_TIMEOUT_MS = 30_000;

export class DocupleteClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: DocupleteClientOptions) {
    if (!options.apiKey) {
      throw new Error("Docuplete SDK: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": `@docuplete/sdk/0.1.0`,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new DocupleteError(
        err instanceof Error && err.name === "AbortError"
          ? `Request timed out after ${this.timeoutMs}ms`
          : `Network error: ${err instanceof Error ? err.message : String(err)}`,
        0,
        "network_error",
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      let code = "api_error";
      let issues: string[] | undefined;
      try {
        const errBody = (await res.json()) as ApiErrorResponse;
        if (errBody.error) message = errBody.error;
        if (errBody.code) code = errBody.code;
        if (errBody.issues) issues = errBody.issues;
      } catch {
        // ignore parse errors; use default message
      }
      throw new DocupleteError(message, res.status, code, issues);
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    let url = path;
    if (params) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      if (qs) url += `?${qs}`;
    }
    return this.request<T>("GET", url);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
