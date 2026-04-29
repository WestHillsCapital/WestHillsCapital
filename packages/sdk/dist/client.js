export class DocupleteError extends Error {
    constructor(message, status, code = "api_error") {
        super(message);
        this.name = "DocupleteError";
        this.status = status;
        this.code = code;
    }
}
export class DocupleteClient {
    constructor(options) {
        if (!options.apiKey) {
            throw new Error("Docuplete SDK: apiKey is required");
        }
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl ?? "https://app.docuplete.com").replace(/\/$/, "");
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}/api/v1${path}`;
        const headers = {
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
                const errBody = (await res.json());
                if (errBody.error)
                    message = errBody.error;
            }
            catch {
                // ignore parse errors; use default message
            }
            throw new DocupleteError(message, res.status);
        }
        return res.json();
    }
    async get(path, params) {
        let url = path;
        if (params) {
            const qs = Object.entries(params)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                .join("&");
            if (qs)
                url += `?${qs}`;
        }
        return this.request("GET", url);
    }
    async post(path, body) {
        return this.request("POST", path, body);
    }
    async patch(path, body) {
        return this.request("PATCH", path, body);
    }
}
//# sourceMappingURL=client.js.map