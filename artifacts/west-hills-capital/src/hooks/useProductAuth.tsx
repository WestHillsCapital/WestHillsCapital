import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface ProductAccount {
  accountId:   number;
  accountName: string;
  slug:        string;
  email:       string;
  role:        string;
  orgLogoUrl:  string | null;
}

export function useProductAuth() {
  const { getToken, isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const [token, setToken]         = useState<string | null>(null);
  const [account, setAccount]     = useState<ProductAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [needsOnboard, setNeedsOnboard]     = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setToken(null);
      setAccount(null);
      setAccountLoading(false);
      setAuthError(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const t = await getToken();
      if (!cancelled) setToken(t);
    };
    refresh();
    const interval = setInterval(refresh, 50_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !token) return;
    setAccountLoading(true);
    fetch(`${API_BASE}/api/v1/product/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        // 404 or 401 with ACCOUNT_NOT_FOUND → show the onboarding form
        if (res.status === 404 || res.status === 401) {
          const body = await res.json().catch(() => ({})) as { code?: string };
          if (res.status === 404 || body.code === "ACCOUNT_NOT_FOUND") {
            setNeedsOnboard(true);
            setAccount(null);
          } else {
            // True auth failure (invalid/expired session) — surface an error
            setAuthError("Session could not be verified. Please sign out and sign back in.");
            setAccount(null);
          }
        } else if (res.ok) {
          const data = await res.json() as ProductAccount;
          if (data.orgLogoUrl) data.orgLogoUrl = `${API_BASE}${data.orgLogoUrl}`;
          setAccount(data);
          setNeedsOnboard(false);
          setAuthError(null);
        }
      })
      .catch(() => {
        setAuthError("Unable to reach the server. Please check your connection.");
      })
      .finally(() => setAccountLoading(false));
  }, [isSignedIn, token]);

  const refreshAccount = useCallback(async (newToken?: string) => {
    const t = newToken ?? token;
    if (!t) return;
    const res = await fetch(`${API_BASE}/api/v1/product/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data = await res.json() as ProductAccount;
      if (data.orgLogoUrl) data.orgLogoUrl = `${API_BASE}${data.orgLogoUrl}`;
      setAccount(data);
      setNeedsOnboard(false);
    }
  }, [token]);

  const getAuthHeaders = useCallback((): HeadersInit => {
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [token]);

  return {
    isSignedIn,
    isLoaded,
    user,
    token,
    account,
    accountLoading,
    needsOnboard,
    authError,
    setNeedsOnboard,
    getAuthHeaders,
    refreshAccount,
    signOut,
  };
}
