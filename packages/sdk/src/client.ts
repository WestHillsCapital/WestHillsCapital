import type { DocupleteClientOptions, ApiErrorResponse } from "./types.js";

export class DocupleteError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "api_error") {
    super(message);
    this.name = "DocupleteError";
    this.status = status;
    this.code = code;
  }
}

export class DocupleteClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: DocupleteClientOptions) {
    if (!options.apiKey) {
      throw new Error("Docuplete SDK: apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://app.docuplete.com").replace(/\/$/, "");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "@docuplete/sdk/0.1.0",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const errBody = (await res.json()) as ApiErrorResponse;
        if (errBody.error) message = errBody.error;
      } catch {
        // ignore parse errors; use default message
      }
      throw new DocupleteError(message, res.status);
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
}
