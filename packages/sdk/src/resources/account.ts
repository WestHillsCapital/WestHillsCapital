import type { DocupleteClient } from "../client.js";
import type { Account } from "../types.js";

interface GetMeResponse {
  account_id: number;
  account_name: string;
  slug: string;
  email: string;
  role: string;
}

export class AccountResource {
  constructor(private readonly client: DocupleteClient) {}

  async get(): Promise<Account> {
    const res = await this.client.get<GetMeResponse>("/product/auth/me");
    return {
      account_id:   res.account_id,
      account_name: res.account_name,
      slug:         res.slug,
      email:        res.email,
      role:         res.role,
    };
  }
}
