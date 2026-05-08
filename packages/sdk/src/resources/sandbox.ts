import type { DocupleteClient } from "../client.js";
import type { SandboxStartParams, SandboxStartResult } from "../types.js";

export class SandboxResource {
  constructor(private readonly client: DocupleteClient) {}

  /**
   * Start a public sandbox interview session backed by a demo package.
   *
   * No API key is required — the sandbox endpoint is publicly accessible.
   * The session token is prefixed with `df_sbx_` and the interview URL includes
   * `?sandbox=1`. Sandbox sessions expire after 7 days.
   *
   * Optionally supply prefill values as query parameters. All fields are optional.
   *
   * @example
   * ```ts
   * const { interviewUrl } = await client.sandbox.start({
   *   firstName: "Jane",
   *   email:     "jane@example.com",
   * });
   * // Open interviewUrl in a browser to try the demo interview
   * ```
   */
  async start(params?: SandboxStartParams): Promise<SandboxStartResult> {
    const query: Record<string, string | undefined> = {};
    if (params) {
      if (params.firstName)    query.firstName    = params.firstName;
      if (params.lastName)     query.lastName     = params.lastName;
      if (params.email)        query.email        = params.email;
      if (params.dateOfBirth)  query.dateOfBirth  = params.dateOfBirth;
      if (params.addressLine1) query.addressLine1 = params.addressLine1;
      if (params.city)         query.city         = params.city;
      if (params.state)        query.state        = params.state;
      if (params.zip)          query.zip          = params.zip;
    }
    return this.client.get<SandboxStartResult>("/sandbox/start", query);
  }
}
