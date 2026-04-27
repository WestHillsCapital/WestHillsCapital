import type { DocupleteClient } from "../client.js";
import type { Account } from "../types.js";

interface GetMeResponse {
  accountId: number;
  accountName: string;
  slug: string;
  email: string | null;
  role: string;
}

export class AccountResource {
  constructor(private readonly client: DocupleteClient) {}

  async get(): Promise<Account> {
    const res = await this.client.get<GetMeResponse>("/product/auth/me");
    return {
      accountId:   res.accountId,
      accountName: res.accountName,
      slug:        res.slug,
      email:       res.email,
      role:        res.role,
    };
  }
}
