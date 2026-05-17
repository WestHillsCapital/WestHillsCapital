import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScimToken {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export default function ScimSettings() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newToken, setNewToken] = useState<{ token: string; id: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [revoking, setRevoking] = useState<number | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<number | null>(null);

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function load() {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/v1/product/settings/scim-tokens", { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { tokens: ScimToken[] } = await res.json();
      setTokens(data.tokens ?? []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    load();
    return () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); };
  }, [isLoaded, isSignedIn]);

  async function createToken() {
    const name = newName.trim();
    if (!name) { setCreateError("Token name is required"); return; }
    setCreating(true);
    setCreateError("");
    setNewToken(null);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/v1/product/settings/scim-tokens", {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? `HTTP ${res.status}`); return; }
      setNewToken({ token: data.token, id: data.id });
      setNewName("");
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(id: number) {
    setRevoking(id);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/v1/product/settings/scim-tokens/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setTokens((t) => t.filter((tk) => tk.id !== id));
      setRevokeConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setRevoking(null);
    }
  }

  async function copyToken(raw: string) {
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2500);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center">
        <p className="text-white/40 text-sm">Sign in to manage SCIM settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Enterprise</div>
          <h1 className="text-2xl font-semibold text-white">SCIM Provisioning</h1>
          <p className="text-sm text-white/50 mt-2">
            Generate bearer tokens for your Identity Provider to authenticate SCIM 2.0 requests.
            The SCIM base URL is{" "}
            <code className="text-white/70 font-mono">https://api.docuplete.com/api/scim/v2</code>.
          </p>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {fetchError}
          </div>
        )}

        {newToken && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="text-sm font-semibold text-emerald-300 mb-2">
              Token created — copy it now. It will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-black/30 text-emerald-200 rounded-lg px-3 py-2 break-all">
                {newToken.token}
              </code>
              <Button
                onClick={() => copyToken(newToken.token)}
                variant="outline"
                size="sm"
                className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="mt-3 text-xs text-white/30 hover:text-white/60"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Generate new token</h2>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="scim-name" className="sr-only">Token name</Label>
              <Input
                id="scim-name"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createToken(); } }}
                placeholder="e.g. Okta Production"
                className="bg-white/5 border-white/15 text-white placeholder:text-white/25"
              />
            </div>
            <Button
              onClick={createToken}
              disabled={creating}
              className="bg-[#1B4FD8] hover:bg-[#1a46c0] text-white shrink-0"
            >
              {creating ? "Generating…" : "Generate token"}
            </Button>
          </div>
          {createError && <p className="text-xs text-red-400 mt-2">{createError}</p>}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Active tokens</h2>
          {tokens.length === 0 ? (
            <p className="text-sm text-white/30 italic">No tokens yet.</p>
          ) : (
            <ul className="space-y-3">
              {tokens.map((tk) => (
                <li
                  key={tk.id}
                  className="flex items-start justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{tk.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      <code className="font-mono text-white/50">{tk.prefix}…</code>
                      {" · "}Created {formatDate(tk.created_at)}
                      {tk.last_used_at && ` · Last used ${formatDate(tk.last_used_at)}`}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {revokeConfirm === tk.id ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-amber-300">Revoke?</span>
                        <button
                          onClick={() => revokeToken(tk.id)}
                          disabled={revoking === tk.id}
                          className="text-xs text-red-400 hover:text-red-300 font-medium"
                        >
                          {revoking === tk.id ? "Revoking…" : "Yes, revoke"}
                        </button>
                        <button
                          onClick={() => setRevokeConfirm(null)}
                          className="text-xs text-white/30 hover:text-white/60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevokeConfirm(tk.id)}
                        className="text-xs text-white/30 hover:text-red-400 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
