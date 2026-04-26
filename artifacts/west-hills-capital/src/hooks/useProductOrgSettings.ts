import { useEffect, useState } from "react";
import { useProductAuth } from "./useProductAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export type ProductOrgSettings = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
};

let cachedProductOrg: ProductOrgSettings | null = null;
const productOrgListeners = new Set<(org: ProductOrgSettings | null) => void>();

export function invalidateProductOrgCache(): void {
  cachedProductOrg = null;
  productOrgListeners.forEach((l) => l(null));
}

export function updateProductOrgCache(org: ProductOrgSettings): void {
  cachedProductOrg = org;
  productOrgListeners.forEach((l) => l(org));
}

export function useProductOrgSettings(): ProductOrgSettings | null {
  const { getAuthHeaders, isSignedIn } = useProductAuth();
  const [org, setOrg] = useState<ProductOrgSettings | null>(cachedProductOrg);

  useEffect(() => {
    if (!isSignedIn) return;
    if (cachedProductOrg) { setOrg(cachedProductOrg); return; }
    const listener = (data: ProductOrgSettings | null) => setOrg(data);
    productOrgListeners.add(listener);
    let cancelled = false;
    fetch(`${API_BASE}/api/product/settings/org`, {
      headers: { ...getAuthHeaders() },
    })
      .then((r) => r.json())
      .then((data: { org?: ProductOrgSettings }) => {
        if (!cancelled && data.org) {
          cachedProductOrg = data.org;
          productOrgListeners.forEach((l) => l(data.org!));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      productOrgListeners.delete(listener);
    };
  }, [isSignedIn]);

  return org;
}
