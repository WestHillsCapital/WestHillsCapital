import { useEffect, useState } from "react";
import { useProductAuth } from "./useProductAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export type ProductOrgSettings = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  timezone:    string;
  date_format: string;
  // Package channel defaults — inherited by newly created packages
  pkg_default_interview:     boolean;
  pkg_default_csv:           boolean;
  pkg_default_customer_link: boolean;
  pkg_default_notify_staff:  boolean;
  pkg_default_notify_client: boolean;
  pkg_default_esign:         boolean;
};

let cachedProductOrg: ProductOrgSettings | null = null;
const productOrgListeners = new Set<(org: ProductOrgSettings | null) => void>();

export function getCachedProductOrg(): ProductOrgSettings | null {
  return cachedProductOrg;
}

export function invalidateProductOrgCache(): void {
  cachedProductOrg = null;
  productOrgListeners.forEach((l) => l(null));
}

export function updateProductOrgCache(org: ProductOrgSettings): void {
  cachedProductOrg = org;
  productOrgListeners.forEach((l) => l(org));
}

export function useProductOrgSettings(): ProductOrgSettings | null {
  const { getAuthHeaders, isSignedIn, token } = useProductAuth();
  const [org, setOrg] = useState<ProductOrgSettings | null>(cachedProductOrg);

  useEffect(() => {
    // Wait until signed in AND token is available to avoid a no-auth fetch
    if (!isSignedIn || !token) return;
    if (cachedProductOrg) { setOrg(cachedProductOrg); return; }
    const listener = (data: ProductOrgSettings | null) => setOrg(data);
    productOrgListeners.add(listener);
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/product/settings/org`, {
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
    // Re-run when token changes — getAuthHeaders is memoized on token, so
    // including it as a dep would cause spurious re-runs. Instead depend on
    // token directly: the function reference is stable between runs with the
    // same token value.
  }, [isSignedIn, token]);

  return org;
}
