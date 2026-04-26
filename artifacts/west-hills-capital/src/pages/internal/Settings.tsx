import { useEffect, useRef, useState } from "react";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { updateOrgCache, type OrgSettings } from "@/hooks/useOrgSettings";
import { BrandColorSection } from "@/components/settings/BrandColorSection";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/internal/settings`;


export default function Settings() {
  const { getAuthHeaders } = useInternalAuth();

  const [org, setOrg] = useState<OrgSettings | null>(null);
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

  function applyOrg(data: OrgSettings) {
    setOrg(data);
    setName(data.name);
    setBrandColor(data.brand_color);
    setDisplayLogoUrl(data.logo_url ? `${API_BASE}${data.logo_url}` : null);
    updateOrgCache(data);
  }

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/org`, { headers: { ...getAuthHeaders() } })
      .then((r) => r.json())
      .then((data: { org?: OrgSettings; error?: string }) => {
        if (data.org) {
          applyOrg(data.org);
        } else {
          setErrorMsg(data.error ?? "Failed to load settings");
        }
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
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Logo upload failed. Please try again.");
        return;
      }
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
      const data = await res.json() as { org?: OrgSettings; error?: string };
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
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to save settings");
        return;
      }
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
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
      if (data.org) applyOrg(data.org);
      flashStatus("Brand color saved.");
    } catch {
      setErrorMsg("Failed to save brand color.");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F6F0]">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F1C3F]">Settings</h1>
            <p className="text-sm text-[#6B7A99] mt-0.5">Manage your organization's branding and preferences.</p>
          </div>
          <div className="flex items-center gap-2">
            {statusMsg && <span className="text-xs text-green-700 font-medium">{statusMsg}</span>}
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
              className="shrink-0 text-sm font-medium bg-[#0F1C3F] text-white hover:bg-[#182B5F] disabled:opacity-60 rounded-lg px-4 py-2 transition-colors"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
        )}

        {/* Organization section */}
        <section className="bg-white rounded-xl border border-[#DDD5C4] divide-y divide-[#EFE8D8]">
          <div className="px-6 py-4">
            <h2 className="text-base font-semibold text-[#0F1C3F]">Organization</h2>
            <p className="text-xs text-[#6B7A99] mt-0.5">This name and logo will appear on customer-facing forms.</p>
          </div>

          {/* Organization name */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-44 shrink-0">
              <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="org-name">Company name</label>
              <p className="text-xs text-[#8A9BB8] mt-0.5">Shown in form headers</p>
            </div>
            <input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your company name"
              className="flex-1 rounded-lg border border-[#DDD5C4] bg-[#FAFAF8] px-3 py-2 text-sm text-[#0F1C3F] placeholder:text-[#B0A898] focus:outline-none focus:ring-2 focus:ring-[#0F1C3F]/20 focus:border-[#0F1C3F]"
            />
          </div>

          {/* Logo */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0">
              <label className="text-sm font-medium text-[#0F1C3F]">Logo</label>
              <p className="text-xs text-[#8A9BB8] mt-0.5">PNG, JPG, or WebP under 5 MB — saved immediately on upload</p>
            </div>
            <div className="flex-1 flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] flex items-center justify-center shrink-0 overflow-hidden">
                {displayLogoUrl ? (
                  <img src={displayLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <svg className="w-8 h-8 text-[#C4B89A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                  className="text-sm rounded-lg border border-[#DDD5C4] bg-white px-3 py-1.5 text-[#0F1C3F] hover:bg-[#F8F6F0] disabled:opacity-60 transition-colors"
                >
                  {isUploadingLogo ? "Uploading…" : displayLogoUrl ? "Replace logo" : "Upload logo"}
                </button>
                {displayLogoUrl && (
                  <button
                    type="button"
                    onClick={() => { void handleRemoveLogo(); }}
                    className="text-xs text-[#8A9BB8] hover:text-red-500 transition-colors text-left"
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
              <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="brand-color">Accent color</label>
              <p className="text-xs text-[#8A9BB8] mt-0.5">Used in buttons and highlights</p>
            </div>
            <div className="flex-1">
              <BrandColorSection
                brandColor={brandColor}
                onChange={setBrandColor}
                onAutoSave={handleAutoSaveColor}
                extractEndpoint={`${SETTINGS_BASE}/extract-brand-colors`}
                getAuthHeaders={getAuthHeaders}
                colorScheme="internal"
              />
            </div>
          </div>
        </section>

        {/* Preview */}
        <section className="bg-white rounded-xl border border-[#DDD5C4] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#EFE8D8]">
            <h2 className="text-base font-semibold text-[#0F1C3F]">Customer form preview</h2>
            <p className="text-xs text-[#6B7A99] mt-0.5">This is how your branding appears in the header of customer-facing forms.</p>
          </div>
          <div className="bg-white border-b border-[#DDD5C4] px-4 py-4">
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
                <div className="text-sm font-semibold text-[#0F1C3F]">{name || "Your company name"}</div>
                <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 bg-[#F8F6F0]">
            <div className="h-2 w-32 rounded bg-[#DDD5C4]" />
          </div>
        </section>
      </div>
    </div>
  );
}
