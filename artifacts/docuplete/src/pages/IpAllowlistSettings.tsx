import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function IpAllowlistSettings() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [ranges, setRanges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [newEntry, setNewEntry] = useState("");
  const [entryError, setEntryError] = useState("");

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch("/api/v1/product/settings/security/ip-allowlist", { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { allowed_ip_ranges: string[] } = await res.json();
        setRanges(data.allowed_ip_ranges ?? []);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, [isLoaded, isSignedIn]);

  function addEntry() {
    const trimmed = newEntry.trim();
    if (!trimmed) return;
    const cidrRe = /^(\d{1,3}\.){3}\d{1,3}(\/(\d|[1-2]\d|3[0-2]))?$/;
    if (!cidrRe.test(trimmed)) {
      setEntryError("Invalid format. Use 1.2.3.4 or 1.2.3.0/24");
      return;
    }
    if (ranges.includes(trimmed)) {
      setEntryError("Already in list");
      return;
    }
    setEntryError("");
    setRanges((r) => [...r, trimmed]);
    setNewEntry("");
  }

  function removeEntry(entry: string) {
    setRanges((r) => r.filter((x) => x !== entry));
  }

  async function save() {
    setSaveState("saving");
    setSaveError("");
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/v1/product/settings/security/ip-allowlist", {
        method: "PUT",
        headers,
        body: JSON.stringify({ allowed_ip_ranges: ranges }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? `HTTP ${res.status}`;
        if (data.your_ip) {
          setSaveError(`${msg} — your current IP: ${data.your_ip}`);
        } else {
          setSaveError(msg);
        }
        setSaveState("error");
        return;
      }
      setRanges(data.allowed_ip_ranges ?? ranges);
      setSaveState("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaveState("idle"), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
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
        <p className="text-white/40 text-sm">Sign in to manage IP allowlist settings.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-8">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Enterprise</div>
          <h1 className="text-2xl font-semibold text-white">IP Allowlist</h1>
          <p className="text-sm text-white/50 mt-2">
            Restrict API access to specific IP addresses or CIDR ranges. Requests from addresses
            outside the list are rejected with <code className="text-white/70">403 Forbidden</code>.
            Dashboard access is unaffected. Leave the list empty to allow all IPs.
          </p>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {fetchError}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-white mb-1">Allowed IP ranges</h2>
            <p className="text-xs text-white/40 mb-4">
              IPv4 addresses or CIDR notation (e.g. <code className="text-white/60">203.0.113.42</code> or{" "}
              <code className="text-white/60">203.0.113.0/24</code>). Maximum 50 entries.
            </p>

            {ranges.length === 0 ? (
              <p className="text-sm text-white/30 italic">
                No restrictions — all IPs are currently allowed.
              </p>
            ) : (
              <ul className="space-y-2 mb-4">
                {ranges.map((r) => (
                  <li
                    key={r}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2"
                  >
                    <code className="text-sm text-white/80 font-mono">{r}</code>
                    <button
                      onClick={() => removeEntry(r)}
                      className="text-xs text-white/30 hover:text-red-400 transition-colors ml-4"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2 mt-4">
              <Input
                value={newEntry}
                onChange={(e) => { setNewEntry(e.target.value); setEntryError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
                placeholder="1.2.3.4 or 1.2.3.0/24"
                className="flex-1 bg-white/5 border-white/15 text-white placeholder:text-white/25 font-mono text-sm"
              />
              <Button onClick={addEntry} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Add
              </Button>
            </div>
            {entryError && (
              <p className="text-xs text-red-400 mt-1">{entryError}</p>
            )}
          </div>

          {ranges.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <strong>Important:</strong> Your current IP must be in the allowlist or you will lock
              yourself out. The API enforces this automatically before saving.
            </div>
          )}

          <div className="flex items-center gap-4 pt-2">
            <Button
              onClick={save}
              disabled={saveState === "saving"}
              className="bg-[#1B4FD8] hover:bg-[#1a46c0] text-white"
            >
              {saveState === "saving" ? "Saving…" : "Save allowlist"}
            </Button>
            {saveState === "saved" && (
              <span className="text-sm text-emerald-400">Saved.</span>
            )}
            {(saveState === "error") && saveError && (
              <span className="text-sm text-red-400">{saveError}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
