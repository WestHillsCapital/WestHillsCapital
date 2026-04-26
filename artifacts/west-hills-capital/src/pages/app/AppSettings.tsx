import { useEffect, useRef, useState } from "react";
import { useProductAuth } from "@/hooks/useProductAuth";
import { updateProductOrgCache, type ProductOrgSettings } from "@/hooks/useProductOrgSettings";
import { BrandColorSection } from "@/components/settings/BrandColorSection";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/product/settings`;
const AUTH_BASE = `${API_BASE}/api/product/auth`;

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  active: boolean;
}

interface NewKeyResult {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

function ApiKeysSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
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

  function loadKeys() {
    setIsLoadingKeys(true);
    setKeysError(null);
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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  const activeKeys = keys.filter((k) => k.active);
  const revokedKeys = keys.filter((k) => !k.active);

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">API Keys</h2>
        <p className="text-xs text-gray-500 mt-0.5">Create and manage API keys for programmatic access.</p>
      </div>

      {/* New key banner — shown once after creation */}
      {newKey && (
        <div className="px-6 py-4 bg-green-50 border-b border-green-100">
          <p className="text-sm font-medium text-green-800 mb-1">API key created — copy it now</p>
          <p className="text-xs text-green-700 mb-3">This is the only time the full key will be shown. Store it securely.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border border-green-200 px-3 py-2 text-xs font-mono text-gray-800 break-all select-all">
              {newKey.key}
            </code>
            <button
              type="button"
              onClick={() => { void handleCopy(); }}
              className="shrink-0 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs font-medium text-green-800 hover:bg-green-50 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => { setNewKey(null); setCopied(false); }}
            className="mt-3 text-xs text-green-700 underline underline-offset-2"
          >
            I've saved the key, dismiss this
          </button>
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
            disabled={isCreating}
            onClick={() => { void handleCreate(); }}
            className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
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
              <div key={key.id} className="flex items-center justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{key.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    <code className="font-mono">{key.keyPrefix}…</code>
                    {" · "}
                    Created {formatDate(key.createdAt)}
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
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(key.id)}
                    className="shrink-0 text-xs text-gray-400 hover:text-red-600 transition-colors"
                  >
                    Revoke
                  </button>
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    <code className="font-mono">{key.keyPrefix}…</code>
                    {" · "}
                    Created {formatDate(key.createdAt)}
                    {key.revokedAt ? ` · Revoked ${formatDate(key.revokedAt)}` : ""}
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

export default function AppSettings() {
  const { getAuthHeaders } = useProductAuth();

  const [org, setOrg] = useState<ProductOrgSettings | null>(null);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#C49A38");
  const [displayLogoUrl, setDisplayLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashStatus(msg: string) {
    setStatusMsg(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusMsg(""), 3000);
  }

  function applyOrg(data: ProductOrgSettings) {
    setOrg(data);
    setName(data.name);
    setBrandColor(data.brand_color);
    setDisplayLogoUrl(data.logo_url ? `${API_BASE}${data.logo_url}` : null);
    updateProductOrgCache(data);
  }

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/org`, { headers: { ...getAuthHeaders() } })
      .then((r) => r.json())
      .then((data: { org?: ProductOrgSettings; error?: string }) => {
        if (data.org) applyOrg(data.org);
        else setErrorMsg(data.error ?? "Failed to load settings");
      })
      .catch(() => setErrorMsg("Failed to load settings"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setErrorMsg("Please upload a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Logo must be under 5 MB.");
      return;
    }
    setErrorMsg(null);
    setIsUploadingLogo(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org/logo`, {
        method: "POST",
        headers: { "Content-Type": file.type, ...getAuthHeaders() },
        body: file,
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Logo upload failed."); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Logo saved.");
    } catch {
      setErrorMsg("Logo upload failed. Please try again.");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    setErrorMsg(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ clearLogo: true }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to remove logo"); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Logo removed.");
    } catch {
      setErrorMsg("Failed to remove logo.");
    }
  }

  async function handleSave() {
    if (!org) return;
    if (!name.trim()) { setErrorMsg("Organization name is required."); return; }
    setErrorMsg(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: name.trim(), brandColor }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save settings"); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Settings saved.");
    } catch {
      setErrorMsg("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAutoSaveColor(newColor: string) {
    if (!org) return;
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ brandColor: newColor }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Brand color saved.");
    } catch {
      setErrorMsg("Failed to save brand color.");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your organization's branding.</p>
        </div>
        <div className="flex items-center gap-3">
          {statusMsg && <span className="text-xs text-green-700 font-medium">{statusMsg}</span>}
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={isSaving}
            className="text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 rounded-lg px-4 py-2 transition-colors"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      )}

      {/* Organization section */}
      <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Organization</h2>
          <p className="text-xs text-gray-500 mt-0.5">This name and logo appear on customer-facing forms.</p>
        </div>

        {/* Name */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-44 shrink-0">
            <label className="text-sm font-medium text-gray-900" htmlFor="org-name">Company name</label>
            <p className="text-xs text-gray-400 mt-0.5">Shown in form headers</p>
          </div>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your company name"
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
        </div>

        {/* Logo */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0">
            <label className="text-sm font-medium text-gray-900">Logo</label>
            <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, or WebP — max 5 MB. Saved immediately on upload.</p>
          </div>
          <div className="flex-1 flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
              {displayLogoUrl ? (
                <img src={displayLogoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleLogoChange}
              />
              <button
                type="button"
                disabled={isUploadingLogo}
                onClick={() => logoInputRef.current?.click()}
                className="text-sm rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-900 hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                {isUploadingLogo ? "Uploading…" : displayLogoUrl ? "Replace logo" : "Upload logo"}
              </button>
              {displayLogoUrl && (
                <button
                  type="button"
                  onClick={() => { void handleRemoveLogo(); }}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors text-left"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Brand color */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0">
            <label className="text-sm font-medium text-gray-900" htmlFor="brand-color">Accent color</label>
            <p className="text-xs text-gray-400 mt-0.5">Used in buttons and highlights</p>
          </div>
          <div className="flex-1">
            <BrandColorSection
              brandColor={brandColor}
              onChange={setBrandColor}
              onAutoSave={handleAutoSaveColor}
              extractEndpoint={`${SETTINGS_BASE}/extract-brand-colors`}
              getAuthHeaders={getAuthHeaders}
              colorScheme="product"
            />
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Customer form preview</h2>
          <p className="text-xs text-gray-500 mt-0.5">How your branding appears in the header of customer-facing forms.</p>
        </div>
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
            >
              {displayLogoUrl ? (
                <img src={displayLogoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-white text-xs font-bold">{(name || "?").charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{name || "Your company name"}</div>
              <div className="text-[11px] text-gray-500">Secure document collection</div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 bg-gray-50">
          <div className="h-2 w-32 rounded bg-gray-200" />
        </div>
      </section>

      {/* API Keys section */}
      <ApiKeysSection getAuthHeaders={getAuthHeaders} />
    </div>
  );
}
