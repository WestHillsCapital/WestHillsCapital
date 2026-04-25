import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export interface ProductAccount {
  accountId:   number;
  accountName: string;
  slug:        string;
  email:       string;
  role:        string;
}

export function useProductAuth() {
  const { getToken, isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const [token, setToken]     = useState<string | null>(null);
  const [account, setAccount] = useState<ProductAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [needsOnboard, setNeedsOnboard] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setToken(null);
      setAccount(null);
      setAccountLoading(false);
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
    fetch(`${API_BASE}/api/product/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.status === 404) {
          setNeedsOnboard(true);
          setAccount(null);
        } else if (res.ok) {
          const data = await res.json();
          setAccount(data as ProductAccount);
          setNeedsOnboard(false);
        }
      })
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, [isSignedIn, token]);

  const refreshAccount = useCallback(async (newToken?: string) => {
    const t = newToken ?? token;
    if (!t) return;
    const res = await fetch(`${API_BASE}/api/product/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data = await res.json();
      setAccount(data as ProductAccount);
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
    setNeedsOnboard,
    getAuthHeaders,
    refreshAccount,
    signOut,
  };
}
