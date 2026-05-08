import type { DocupleteClient } from "../client.js";
import type { Package, WebhookDelivery } from "../types.js";

interface ListPackagesResponse {
  packages: Package[];
}

interface GetPackageResponse {
  package: Package;
}

interface WebhookDeliveriesResponse {
  deliveries: WebhookDelivery[];
  total: number;
  limit: number;
  offset: number;
}

export class PackagesResource {
  constructor(private readonly client: DocupleteClient) {}

  /**
   * Returns all packages for your account ordered by most-recently updated.
   */
  async list(): Promise<Package[]> {
    const res = await this.client.get<ListPackagesResponse>("/product/docufill/packages");
    return res.packages;
  }

  /**
   * Returns a single package by its numeric ID.
   */
  async get(id: number): Promise<Package> {
    const res = await this.client.get<GetPackageResponse>(`/product/docufill/packages/${id}`);
    return res.package;
  }

  /**
   * Returns the webhook delivery log for a package.
   *
   * Deliveries are returned in descending creation order (most recent first).
   * Use `limit` and `offset` for pagination (max 200 per page).
   *
   * Requires a `dp_live_…` API key.
   *
   * @param packageId  Numeric package ID.
   * @param params.limit   Page size (1–200). Default: 50.
   * @param params.offset  Pagination offset. Default: 0.
   */
  async webhookDeliveries(
    packageId: number,
    params?: { limit?: number; offset?: number },
  ): Promise<WebhookDeliveriesResponse> {
    return this.client.get<WebhookDeliveriesResponse>(
      `/packages/${packageId}/webhook-deliveries`,
      { limit: params?.limit, offset: params?.offset },
    );
  }
}
