import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const STORAGE_KEY = "whc_internal_session";

export interface InternalUser {
  email:     string;
  name:      string;
  picture:   string | null;
  expiresAt: number;   // ms timestamp — when the Google token expires (~1 hr)
}

interface InternalAuthContextValue {
  user:      InternalUser | null;
  isLoading: boolean;
  error:     string | null;
  signIn:    (credential: string) => Promise<void>;
  signOut:   () => void;
}

const InternalAuthContext = createContext<InternalAuthContextValue | null>(null);

export function InternalAuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<InternalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // On mount, restore session from localStorage if it hasn't expired
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session: InternalUser = JSON.parse(raw);
        // Keep session if it expires more than 5 minutes from now
        if (session.expiresAt > Date.now() + 5 * 60 * 1000) {
          setUser(session);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async (credential: string) => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Sign-in failed");
      }
      const session: InternalUser = {
        email:     data.email,
        name:      data.name,
        picture:   data.picture,
        expiresAt: data.expiresAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setUser(session);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(msg);
      throw err;
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setError(null);
  }, []);

  return (
    <InternalAuthContext.Provider value={{ user, isLoading, error, signIn, signOut }}>
      {children}
    </InternalAuthContext.Provider>
  );
}

export function useInternalAuth(): InternalAuthContextValue {
  const ctx = useContext(InternalAuthContext);
  if (!ctx) throw new Error("useInternalAuth must be used inside InternalAuthProvider");
  return ctx;
}
