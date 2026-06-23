import { useInternalAuth } from "./useInternalAuth";

export interface ProductAccount {
  accountId:   number;
  accountName: string;
  slug:        string;
  email:       string;
  role:        string;
  orgLogoUrl:  string | null;
}

export function useProductAuth() {
  const { user, isLoading, getAuthHeaders, signOut } = useInternalAuth();
  const token      = user?.sessionToken ?? null;
  const isSignedIn = !!user;
  const isLoaded   = !isLoading;

  return {
    isSignedIn,
    isLoaded,
    user:           null,
    token,
    account:        null,
    accountLoading: false,
    needsOnboard:   false,
    needs2FA:       false,
    authError:      null,
    setNeedsOnboard: () => {},
    getAuthHeaders,
    refreshAccount:  async () => {},
    verify2FA:       async () => ({ success: false as const }),
    signOut,
  };
}
