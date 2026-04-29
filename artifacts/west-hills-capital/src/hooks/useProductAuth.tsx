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
  const [needs2FA, setNeeds2FA]             = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setToken(null);
      setAccount(null);
      setAccountLoading(false);
      setAuthError(null);
      setNeeds2FA(false);
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
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({})) as { code?: string; error?: string };

        if (res.status === 403 && body.code === "TOTP_REQUIRED") {
          setNeeds2FA(true);
          setAccount(null);
        } else if (res.status === 404 || res.status === 401) {
          if (res.status === 404 || body.code === "ACCOUNT_NOT_FOUND") {
            setNeedsOnboard(true);
            setAccount(null);
          } else {
            setAuthError("Session could not be verified. Please sign out and sign back in.");
            setAccount(null);
          }
        } else if (res.ok) {
          const data = body as unknown as ProductAccount;
          if (data.orgLogoUrl) data.orgLogoUrl = `${API_BASE}${data.orgLogoUrl}`;
          setAccount(data);
          setNeedsOnboard(false);
          setNeeds2FA(false);
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
      credentials: "include",
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) {
      const data = await res.json() as ProductAccount;
      if (data.orgLogoUrl) data.orgLogoUrl = `${API_BASE}${data.orgLogoUrl}`;
      setAccount(data);
      setNeedsOnboard(false);
      setNeeds2FA(false);
    }
  }, [token]);

  const verify2FA = useCallback(async (code: string, trustDevice?: boolean): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: "Not authenticated." };
    try {
      const res = await fetch(`${API_BASE}/api/v1/product/auth/verify-2fa`, {
        method: "POST",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, trustDevice: trustDevice ?? false }),
      });
      const data = await res.json() as { success?: boolean; error?: string; code?: string };
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error ?? "Verification failed." };
    } catch {
      return { success: false, error: "Unable to reach the server." };
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
    needs2FA,
    authError,
    setNeedsOnboard,
    getAuthHeaders,
    refreshAccount,
    verify2FA,
    signOut,
  };
}
