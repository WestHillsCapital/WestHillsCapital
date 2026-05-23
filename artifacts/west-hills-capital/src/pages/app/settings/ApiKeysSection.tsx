import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { formatOrgDate } from "@/lib/orgDateFormat";
import { getCachedProductOrg } from "@/hooks/useProductOrgSettings";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  API_BASE, SETTINGS_BASE, AUTH_BASE,
  useBrandColor, formatDate, formatRelative, getTextForBg,
  CopyBadge, CopySnippet, StyledSelect,
  roleBadge, planBadge, statusBadge, UsageBar,
  type ApiKey, type NewKeyResult, type TeamMember,
  type BillingInfo, type BillingLineItem, type BankEntry, type PackTier,
  ROLE_OPTIONS, PLAN_LABELS,
  type IntegrationsStatus,
  type AuditLogEntry, ACTION_LABELS, ACTION_FILTER_OPTIONS,
  actionBadgeColor, formatTimestamp,
  NOTIFICATION_CATEGORIES, type NotifPref,
  RETENTION_OPTIONS, DATE_FORMAT_OPTIONS, ALL_TIMEZONES,
  type FeedbackType, FEEDBACK_FIELDS,
  type UserProfile, type TwoFAStatus, type TrustedDevice,
  type ActiveSession, type LoginEntry,
  type PendingRename, RenameConfirmModal, UsageBadge,
  type SkField, type SkGroup, type SkMappings, type SkPkg,
} from "./settingsUtils";

export function ApiKeysSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  function loadKeys() {
    setIsLoadingKeys(true);
    setKeysError(null);
    setRenameError(null);
    fetch(`${AUTH_BASE}/api-keys`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { keys?: ApiKey[]; error?: string };
        if (!r.ok) { setKeysError(data.error ?? "Failed to load API keys"); return; }
        if (data.keys) setKeys(data.keys);
        else setKeysError("Failed to load API keys");
      })
      .catch(() => setKeysError("Failed to load API keys"))
      .finally(() => setIsLoadingKeys(false));
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) { setCreateError("Key name is required."); return; }
    setCreateError(null);
    setIsCreating(true);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json() as { id?: number; name?: string; key?: string; keyPrefix?: string; createdAt?: string; error?: string };
      if (!res.ok) { setCreateError(data.error ?? "Failed to create API key."); return; }
      if (!data.id || !data.name || !data.key || !data.keyPrefix || !data.createdAt) {
        setCreateError("Unexpected response from server. Please try again.");
        return;
      }
      setNewKey({ id: data.id, name: data.name, key: data.key, keyPrefix: data.keyPrefix, createdAt: data.createdAt });
      setNewKeyName("");
      loadKeys();
    } catch {
      setCreateError("Failed to create API key.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(id: number) {
    setRevokingId(id);
    setConfirmRevokeId(null);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) {
        setKeysError(data.error ?? "Failed to revoke key.");
      } else {
        loadKeys();
      }
    } catch {
      setKeysError("Failed to revoke key.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function startRename(key: ApiKey) {
    setRenamingId(key.id);
    setRenameValue(key.name);
    setRenameError(null);
    setConfirmRevokeId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
    setRenameError(null);
  }

  async function handleRename(id: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenameError("Name is required."); return; }
    if (trimmed.length > 100) { setRenameError("Name must be 100 characters or fewer."); return; }
    setRenameError(null);
    setIsSavingRename(true);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys/${id}`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json() as { success?: boolean; id?: number; name?: string; error?: string };
      if (!res.ok) { setRenameError(data.error ?? "Failed to rename key."); return; }
      setRenamingId(null);
      setRenameValue("");
      loadKeys();
    } catch {
      setRenameError("Failed to rename key.");
    } finally {
      setIsSavingRename(false);
    }
  }

  function formatDate(iso: string) {
    return formatOrgDate(iso, getCachedProductOrg());
  }

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">API Keys</h2>
        <p className="text-xs text-gray-500 mt-0.5">Create and manage API keys for programmatic access.</p>
      </div>

      {/* New key modal — shown once after creation */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-900">API key created — <span className="text-gray-500 font-normal">{newKey.name}</span></p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800 font-medium leading-relaxed">For security, we will never show you this secret key again. Copy and store it safely now.</p>
              </div>
            </div>
            {/* Key display */}
            <div className="px-6 py-5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">Your secret key</p>
              <div className="flex items-stretch gap-2">
                <code className="flex-1 min-w-0 rounded-lg bg-gray-950 border border-gray-800 px-3 py-2.5 text-xs font-mono text-green-400 break-all select-all leading-relaxed">
                  {newKey.key}
                </code>
                <button
                  type="button"
                  onClick={() => { void handleCopy(); }}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-all ${copied ? "border border-green-200 bg-green-50 text-green-700" : "text-white"}`}
                  style={copied ? {} : { backgroundColor: bc }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => { setNewKey(null); setCopied(false); }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                I've saved it — close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create new key form */}
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Create new key</p>
        {createError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{createError}</div>
        )}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder="Key name (e.g. Production server)"
            maxLength={100}
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
          <button
            type="button"
            disabled={isCreating || !newKeyName.trim()}
            onClick={() => { void handleCreate(); }}
            className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all brand-btn-hover disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: bc }}
          >
            {isCreating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      {/* Key list */}
      <div className="px-6 py-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Active keys</p>

        {keysError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{keysError}</div>
        )}

        {isLoadingKeys ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : activeKeys.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No active API keys. Create one above.</p>
        ) : (
          <div className="divide-y divide-gray-100 -mx-6">
            {activeKeys.map((key) => (
              <div key={key.id} className="px-6 py-3">
                {renamingId === key.id ? (
                  /* ── Inline rename mode ── */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(key.id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        maxLength={100}
                        autoFocus
                        className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                      />
                      <button
                        type="button"
                        disabled={isSavingRename}
                        onClick={() => { void handleRename(key.id); }}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors brand-btn-hover"
                        style={{ backgroundColor: bc }}
                      >
                        {isSavingRename ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {renameError && (
                      <p className="text-xs text-red-600">{renameError}</p>
                    )}
                  </div>
                ) : (
                  /* ── Normal display mode ── */
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{key.name}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700 cursor-default">Full Access</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">Grants full API access: read live pricing data, submit interview sessions, and manage Docuplete packages programmatically.</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-1">
                        <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">{key.keyPrefix}…</code>
                        <span className="text-gray-300 select-none">|</span>
                        <span>Created {formatDate(key.createdAt)}</span>
                        <span className="text-gray-300 select-none">|</span>
                        <span>Last used: {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "Never"}</span>
                      </p>
                    </div>
                    {confirmRevokeId === key.id ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-600">Revoke this key?</span>
                        <button
                          type="button"
                          disabled={revokingId === key.id}
                          onClick={() => { void handleRevoke(key.id); }}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                        >
                          {revokingId === key.id ? "Revoking…" : "Yes, revoke"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(null)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => startRename(key)}
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(key.id)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoked keys */}
      {!isLoadingKeys && revokedKeys.length > 0 && (
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-gray-500 mb-3">Revoked keys</p>
          <div className="divide-y divide-gray-100 -mx-6">
            {revokedKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between gap-4 px-6 py-3 opacity-60">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{key.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center flex-wrap gap-1">
                    <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-gray-500">{key.keyPrefix}…</code>
                    <span className="text-gray-300 select-none">|</span>
                    <span>Created {formatDate(key.createdAt)}</span>
                    {key.revokedAt && <><span className="text-gray-300 select-none">|</span><span>Revoked {formatDate(key.revokedAt)}</span></>}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                  Revoked
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
