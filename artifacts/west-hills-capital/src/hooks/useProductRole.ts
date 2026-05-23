import { useState, useEffect } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const TEAM_URL = `${API_BASE}/api/v1/product/settings/team`;

export interface ProductRoleResult {
  isAdmin: boolean;
  role: string | null;
  isLoading: boolean;
}

export function useProductRole(getAuthHeaders: () => HeadersInit): ProductRoleResult {
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const headers = getAuthHeaders() as Record<string, string>;
    if (!headers["Authorization"]) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(TEAM_URL, { headers })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { is_admin?: boolean; members?: { role: string; is_current_user?: boolean }[] };
        if (cancelled) return;
        setIsAdmin(data.is_admin ?? false);
        const me = data.members?.find((m) => m.is_current_user);
        setRole(me?.role ?? null);
      })
      .catch(() => { /* default to non-admin on error */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [getAuthHeaders]);

  return { isAdmin, role, isLoading };
}
