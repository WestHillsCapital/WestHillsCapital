import type { DocupleteClient } from "../client.js";
import type { Package } from "../types.js";

interface ListPackagesResponse {
  packages: Package[];
}

interface GetPackageResponse {
  package: Package;
}

export class PackagesResource {
  constructor(private readonly client: DocupleteClient) {}

  async list(): Promise<Package[]> {
    const res = await this.client.get<ListPackagesResponse>("/product/docufill/packages");
    return res.packages;
  }

  async get(id: number): Promise<Package> {
    const res = await this.client.get<GetPackageResponse>(`/product/docufill/packages/${id}`);
    return res.package;
  }
}
