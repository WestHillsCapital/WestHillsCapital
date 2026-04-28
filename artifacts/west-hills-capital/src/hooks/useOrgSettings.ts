import { useEffect, useState } from "react";
import { useInternalAuth } from "./useInternalAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export type OrgSettings = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  timezone:    string;
  date_format: string;
};

let cachedOrg: OrgSettings | null = null;
const listeners = new Set<(org: OrgSettings | null) => void>();

export function getCachedOrg(): OrgSettings | null {
  return cachedOrg;
}

export function invalidateOrgCache(): void {
  cachedOrg = null;
  listeners.forEach((l) => l(null));
}

export function updateOrgCache(org: OrgSettings): void {
  cachedOrg = org;
  listeners.forEach((l) => l(org));
}

export function useOrgSettings(): OrgSettings | null {
  const { getAuthHeaders } = useInternalAuth();
  const [org, setOrg] = useState<OrgSettings | null>(cachedOrg);

  useEffect(() => {
    if (cachedOrg) { setOrg(cachedOrg); return; }
    const listener = (data: OrgSettings | null) => setOrg(data);
    listeners.add(listener);
    let cancelled = false;
    fetch(`${API_BASE}/api/internal/settings/org`, {
      headers: { ...getAuthHeaders() },
    })
      .then((r) => r.json())
      .then((data: { org?: OrgSettings }) => {
        if (!cancelled && data.org) {
          cachedOrg = data.org;
          listeners.forEach((l) => l(data.org!));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  return org;
}
