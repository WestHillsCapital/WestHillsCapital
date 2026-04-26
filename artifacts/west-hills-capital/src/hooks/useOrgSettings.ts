import { useEffect, useState } from "react";
import { useInternalAuth } from "./useInternalAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type OrgSettings = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
};

let cachedOrg: OrgSettings | null = null;
const listeners = new Set<(org: OrgSettings) => void>();

export function useOrgSettings(): OrgSettings | null {
  const { getAuthHeaders } = useInternalAuth();
  const [org, setOrg] = useState<OrgSettings | null>(cachedOrg);

  useEffect(() => {
    if (cachedOrg) { setOrg(cachedOrg); return; }
    const listener = (data: OrgSettings) => setOrg(data);
    listeners.add(listener);
    fetch(`${API_BASE}/api/internal/settings/org`, {
      headers: { ...getAuthHeaders() },
    })
      .then((r) => r.json())
      .then((data: { org?: OrgSettings }) => {
        if (data.org) {
          cachedOrg = data.org;
          listeners.forEach((l) => l(data.org!));
        }
      })
      .catch(() => undefined);
    return () => { listeners.delete(listener); };
  }, []);

  return org;
}
