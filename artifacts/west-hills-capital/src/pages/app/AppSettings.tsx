import { useEffect, useRef, useState } from "react";
import { useProductAuth } from "@/hooks/useProductAuth";
import { useProductRole } from "@/hooks/useProductRole";
import { updateProductOrgCache, type ProductOrgSettings } from "@/hooks/useProductOrgSettings";
import { BrandColorSection } from "@/components/settings/BrandColorSection";
import { API_BASE, SETTINGS_BASE, getTextForBg } from "./settings/settingsUtils";
import { SubmissionBankSection }      from "./settings/SubmissionBankSection";
import { BillingSection }             from "./settings/BillingSection";
import { CustomDomainSection }        from "./settings/CustomDomainSection";
import { TeamSection }                from "./settings/TeamSection";
import { DeveloperSection }           from "./settings/DeveloperSection";
import { IntegrationsSection }        from "./settings/IntegrationsSection";
import { NotificationsSection }       from "./settings/NotificationsSection";
import { AuditLogSection }            from "./settings/AuditLogSection";
import { ApiKeysSection }             from "./settings/ApiKeysSection";
import { InterviewDefaultsSection }   from "./settings/InterviewDefaultsSection";
import { EmailCustomizationSection }  from "./settings/EmailCustomizationSection";
import { TimezoneLocaleSection }      from "./settings/TimezoneLocaleSection";
import { FeedbackSection }            from "./settings/FeedbackSection";
import { DataPrivacySection }         from "./settings/DataPrivacySection";
import { SecuritySection }            from "./settings/SecuritySection";
import { ProfileSection }             from "./settings/ProfileSection";
import { SourceKeyMappingSection }    from "./settings/SourceKeyMappingSection";

// ── Settings page navigation ──────────────────────────────────────────────────
// Add entries here whenever a new section is added. Items with adminOnly=true
// are only shown to admins. Items whose DOM element doesn't exist yet (e.g. a
// section from an in-progress task) are filtered out automatically.
const ALL_SETTINGS_NAV: Array<{ id: string; label: string; adminOnly?: boolean; group?: string }> = [
  // Account — personal to the logged-in user
  { id: "profile-section",            label: "Profile",        group: "Account" },
  { id: "security-section",           label: "Security" },
  { id: "notifications-section",      label: "Notifications" },
  { id: "timezone-locale-section",    label: "Timezone" },
  // Workspace — organisation-wide settings
  { id: "organization-section",       label: "Organization",   group: "Workspace" },
  { id: "billing-section",            label: "Billing" },
  { id: "custom-domain-section",      label: "Custom domain",  adminOnly: true },
  { id: "team-section",               label: "Team" },
  // Docuplete — how the interview product behaves
  { id: "interview-defaults-section", label: "Interview",      group: "Docuplete" },
  { id: "email-section",              label: "Email" },
  // Connect — external tools and developer APIs
  { id: "integrations-section",       label: "Integrations",   group: "Connect" },
  { id: "developer-section",          label: "Developer" },
  { id: "source-key-section",         label: "Source Keys" },
  // Admin — governance and data controls
  { id: "data-privacy-section",       label: "Data & Privacy", group: "Admin" },
  { id: "audit-log-section",          label: "Audit log",      adminOnly: true },
  // Help — contact and feedback
  { id: "feedback-section",           label: "Send a message", group: "Help" },
];

export default function AppSettings() {
  const { getAuthHeaders } = useProductAuth();
  const { isAdmin, role } = useProductRole(getAuthHeaders);

  const [org, setOrg] = useState<ProductOrgSettings | null>(null);
  const [name, setName] = useState("");
  const [brandColor, setBrandColor] = useState("#C49A38");
  const [displayLogoUrl, setDisplayLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameFieldError, setNameFieldError] = useState<string | null>(null);
  const [logoSaved, setLogoSaved] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [displayFormLogoUrl, setDisplayFormLogoUrl] = useState<string | null>(null);
  const [isUploadingFormLogo, setIsUploadingFormLogo] = useState(false);
  const [isDraggingFormLogo, setIsDraggingFormLogo] = useState(false);
  const [formLogoSaved, setFormLogoSaved] = useState(false);
  const formLogoInputRef = useRef<HTMLInputElement>(null);
  const [logoOnWhite, setLogoOnWhite] = useState(true);
  const formLogoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameEdited = useRef(false);
  const nameSaveSeq = useRef(0);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorEdited = useRef(false);
  const colorSaveSeq = useRef(0);
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Section quick-nav: track which section is visible and which nav items exist
  const [activeSection, setActiveSection] = useState<string>("profile-section");
  const [presentSections, setPresentSections] = useState<Set<string>>(new Set());

  // After the org finishes loading, find which section elements exist in the DOM.
  // Must depend on isLoading: during loading the component returns early (spinner),
  // so sections are not in the DOM yet and all getElementById calls return null.
  useEffect(() => {
    if (isLoading) return;
    const present = new Set<string>();
    for (const item of ALL_SETTINGS_NAV) {
      if (document.getElementById(item.id)) present.add(item.id);
    }
    setPresentSections(present);
  }, [isLoading]);

  // Highlight the nav item for the section nearest the top of the viewport
  useEffect(() => {
    const ids = ALL_SETTINGS_NAV
      .filter(item => !(item.adminOnly && !isAdmin))
      .map(item => item.id);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
          // Scroll the active nav pill into view
          const btn = navRef.current?.querySelector<HTMLButtonElement>(`[data-nav="${visible[0].target.id}"]`);
          btn?.scrollIntoView({ block: "nearest", inline: "center" });
        }
      },
      { rootMargin: "-10% 0px -75% 0px", threshold: 0 },
    );

    const timer = setTimeout(() => {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 200);

    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [isAdmin, presentSections]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    // App header is h-14 (56px) and is NOT sticky — it scrolls away.
    // After the smooth scroll completes the header is gone, so we only need
    // a small breathing-room gap at the top of the viewport.
    const OFFSET = 72; // 56px header + 16px gap
    const top = el.getBoundingClientRect().top + window.scrollY - OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveSection(id);
  }

  function flashFieldSaved(field: "name" | "logo" | "form-logo" | "color") {
    if (field === "name") {
      setNameSaved(true);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      nameSavedTimer.current = setTimeout(() => setNameSaved(false), 3000);
    } else if (field === "logo") {
      setLogoSaved(true);
      if (logoSavedTimer.current) clearTimeout(logoSavedTimer.current);
      logoSavedTimer.current = setTimeout(() => setLogoSaved(false), 3000);
    } else if (field === "form-logo") {
      setFormLogoSaved(true);
      if (formLogoSavedTimer.current) clearTimeout(formLogoSavedTimer.current);
      formLogoSavedTimer.current = setTimeout(() => setFormLogoSaved(false), 3000);
    } else {
      setColorSaved(true);
      if (colorSavedTimer.current) clearTimeout(colorSavedTimer.current);
      colorSavedTimer.current = setTimeout(() => setColorSaved(false), 3000);
    }
  }

  function applyOrg(data: ProductOrgSettings) {
    setOrg(data);
    setName(data.name);
    setBrandColor(data.brand_color);
    setLogoOnWhite(data.logo_on_white !== false);
    // Append a timestamp so the browser re-fetches the logo after every upload
    // rather than serving the stale cached version (same URL, new content).
    setDisplayLogoUrl(data.logo_url ? `${API_BASE}${data.logo_url}?t=${Date.now()}` : null);
    setDisplayFormLogoUrl(data.form_logo_url ? `${API_BASE}${data.form_logo_url}?t=${Date.now()}` : null);
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

    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      if (logoSavedTimer.current) clearTimeout(logoSavedTimer.current);
      if (colorSavedTimer.current) clearTimeout(colorSavedTimer.current);
    };
  }, []);

  // Auto-save name with 700ms debounce — only fires when user has edited the field
  useEffect(() => {
    if (!nameEdited.current || !org) return;
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(async () => {
      nameDebounceRef.current = null;
      const trimmed = name.trim();
      if (!trimmed) {
        setNameFieldError("Organization name cannot be empty.");
        return;
      }
      setNameFieldError(null);
      const seq = ++nameSaveSeq.current;
      try {
        const res = await fetch(`${SETTINGS_BASE}/org`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ name: trimmed }),
        });
        const data = await res.json() as { org?: ProductOrgSettings; error?: string };
        if (seq !== nameSaveSeq.current) return; // stale response — a newer request is in flight
        if (!res.ok) { setNameFieldError(data.error ?? "Failed to save name"); return; }
        if (data.org) {
          nameEdited.current = false; // prevent the applyOrg name-state change from re-triggering
          applyOrg(data.org);
        }
        flashFieldSaved("name");
      } catch { if (seq === nameSaveSeq.current) setNameFieldError("Failed to save name. Please try again."); }
    }, 700);
    return () => {
      if (nameDebounceRef.current) { clearTimeout(nameDebounceRef.current); nameDebounceRef.current = null; }
    };
  }, [name]);

  // Auto-save brand color with 700ms debounce — only fires when user has changed the color
  // (colorEdited is set in the onChange wrapper; cleared immediately in handleAutoSaveColor
  //  so extracted-swatch clicks don't double-save via this path)
  useEffect(() => {
    if (!colorEdited.current || !org) return;
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(async () => {
      colorDebounceRef.current = null;
      if (!/^#[0-9a-fA-F]{6}$/.test(brandColor)) return; // wait for a complete hex value
      const seq = ++colorSaveSeq.current;
      try {
        const res = await fetch(`${SETTINGS_BASE}/org`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ brandColor }),
        });
        const data = await res.json() as { org?: ProductOrgSettings; error?: string };
        if (seq !== colorSaveSeq.current) return;
        if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
        if (data.org) applyOrg(data.org);
        flashFieldSaved("color");
      } catch { if (seq === colorSaveSeq.current) setErrorMsg("Failed to save brand color."); }
    }, 700);
    return () => {
      if (colorDebounceRef.current) { clearTimeout(colorDebounceRef.current); colorDebounceRef.current = null; }
    };
  }, [brandColor]);

  async function uploadLogoFile(file: File) {
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
      flashFieldSaved("logo");
    } catch {
      setErrorMsg("Logo upload failed. Please try again.");
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  }

  function handleLogoDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingLogo(true);
  }

  function handleLogoDragLeave() {
    setIsDraggingLogo(false);
  }

  async function handleLogoDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingLogo(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
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
      flashFieldSaved("logo");
    } catch {
      setErrorMsg("Failed to remove logo.");
    }
  }

  async function uploadFormLogoFile(file: File) {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setErrorMsg("Please upload a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Form logo must be under 5 MB.");
      return;
    }
    setErrorMsg(null);
    setIsUploadingFormLogo(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org/form-logo`, {
        method: "POST",
        headers: { "Content-Type": file.type, ...getAuthHeaders() },
        body: file,
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Form logo upload failed."); return; }
      if (data.org?.form_logo_url) {
        setDisplayFormLogoUrl(`${API_BASE}${data.org.form_logo_url}?t=${Date.now()}`);
      }
      flashFieldSaved("form-logo");
    } catch {
      setErrorMsg("Form logo upload failed. Please try again.");
    } finally {
      setIsUploadingFormLogo(false);
      if (formLogoInputRef.current) formLogoInputRef.current.value = "";
    }
  }

  async function handleRemoveFormLogo() {
    setErrorMsg(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ clearFormLogo: true }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to remove form logo"); return; }
      if (data.org) applyOrg(data.org);
      flashFieldSaved("form-logo");
    } catch {
      setErrorMsg("Failed to remove form logo.");
    }
  }

  async function handleLogoOnWhiteToggle(value: boolean) {
    setLogoOnWhite(value);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ logoOnWhite: value }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save logo background setting"); return; }
      if (data.org) applyOrg(data.org);
    } catch {
      setErrorMsg("Failed to save logo background setting.");
    }
  }

  async function handleAutoSaveColor(newColor: string) {
    if (!org) return;
    // Clear the flag immediately so the debounced color effect skips this save
    // (extracted-swatch clicks call both onChange + onAutoSave; without this guard
    //  the debounce would fire a redundant second PATCH 700ms later)
    colorEdited.current = false;
    if (colorDebounceRef.current) { clearTimeout(colorDebounceRef.current); colorDebounceRef.current = null; }
    const seq = ++colorSaveSeq.current;
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ brandColor: newColor }),
      });
      const data = await res.json() as { org?: ProductOrgSettings; error?: string };
      if (seq !== colorSaveSeq.current) return;
      if (!res.ok) { setErrorMsg(data.error ?? "Failed to save color"); return; }
      if (data.org) applyOrg(data.org);
      flashFieldSaved("color");
    } catch {
      if (seq === colorSaveSeq.current) setErrorMsg("Failed to save brand color.");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const roleLabel = role === "readonly" ? "Read-only" : role === "member" ? "Member" : role ?? "Member";

  const visibleNavItems = ALL_SETTINGS_NAV.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    return presentSections.has(item.id);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="lg:flex lg:gap-10 lg:items-start">

        {/* ── Left sidebar nav — desktop only ────────────────────────── */}
        <aside className="hidden lg:block w-44 shrink-0 sticky top-[72px] self-start">
          <div className="mb-5">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">Account &amp; workspace</p>
          </div>
          <nav ref={navRef} className="space-y-0.5">
            {(() => {
              let lastGroup: string | undefined;
              return visibleNavItems.map(item => {
                const showHeader = item.group && item.group !== lastGroup;
                if (showHeader) lastGroup = item.group;
                return (
                  <div key={item.id}>
                    {showHeader && (
                      <p
                        className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider first:pt-1"
                        style={{ color: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
                      >
                        {item.group}
                      </p>
                    )}
                    <button
                      data-nav={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={[
                        "w-full text-left rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        activeSection === item.id
                          ? ""
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                      ].join(" ")}
                      style={activeSection === item.id ? {
                        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38",
                        color: "white",
                      } : undefined}
                    >
                      {item.label}
                    </button>
                  </div>
                );
              });
            })()}
          </nav>

        </aside>

        {/* ── Main content column ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-8">

          {/* Page header — shown on mobile; desktop header lives in the sidebar */}
          <div className="lg:hidden">
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your organization's branding and preferences.</p>
          </div>

          {/* Mobile horizontal pill nav — hidden on desktop */}
          {visibleNavItems.length > 1 && (
            <div className="lg:hidden sticky top-0 z-20 -mx-4 px-4 bg-white/95 backdrop-blur-sm border-b border-gray-100 py-2">
              <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {visibleNavItems.map(item => (
                  <button
                    key={item.id}
                    data-nav={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={[
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                      activeSection === item.id
                        ? ""
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                    ].join(" ")}
                    style={activeSection === item.id ? {
                      backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38",
                      color: "white",
                    } : undefined}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Read-only banner for non-admins */}
          {!isAdmin && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-sky-900">You have {roleLabel} access</p>
                <p className="text-xs text-sky-700 mt-0.5">
                  You can view these settings but cannot make changes. Contact your admin to update the organization's branding or configuration.
                </p>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
          )}

      {/* Profile section — per-user settings, visible to all roles */}
      <div id="profile-section">
        <ProfileSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Security section — per-user 2FA, sessions, and login history */}
      <div id="security-section">
        <SecuritySection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Notifications section — per-user email prefs */}
      <div id="notifications-section">
        <NotificationsSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Timezone & Locale section */}
      <div id="timezone-locale-section">
        <TimezoneLocaleSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Org branding setup prompt — shown until logo or custom color is set */}
      {org && !org.logo_url && org.brand_color === "#C49A38" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-900">Set up your brand</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Upload your logo and choose a brand color below so every client interview link is white-labeled with your identity.
            </p>
          </div>
        </div>
      )}

      {/* Organization section */}
      <section id="organization-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Organization</h2>
          <p className="text-xs text-gray-500 mt-0.5">This name and logo appear on customer-facing forms.</p>
        </div>

        {/* Name */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900" htmlFor="org-name">Organization name</label>
            <p className="text-xs text-gray-400 mt-0.5">Shown on customer forms and emails</p>
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <input
              id="org-name"
              type="text"
              value={name}
              readOnly={!isAdmin}
              onChange={(e) => { if (isAdmin) { nameEdited.current = true; setName(e.target.value); } }}
              placeholder="Your organization name"
              className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 w-full${!isAdmin ? " opacity-60 cursor-not-allowed" : ""}`}
            />
            {nameFieldError ? (
              <span className="text-[11px] text-red-600">{nameFieldError}</span>
            ) : nameSaved ? (
              <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
            ) : null}
          </div>
        </div>

        {/* Logo */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900">Logo</label>
            <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, or WebP — max 5 MB</p>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={handleLogoChange}
            />
            {/* Drop / click zone */}
            <div
              role={isAdmin ? "button" : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              aria-label={isAdmin ? (displayLogoUrl ? "Click or drop to replace logo" : "Click or drop to upload logo") : undefined}
              onClick={() => isAdmin && !isUploadingLogo && logoInputRef.current?.click()}
              onKeyDown={(e) => { if (isAdmin && (e.key === "Enter" || e.key === " ") && !isUploadingLogo) logoInputRef.current?.click(); }}
              onDragOver={isAdmin ? handleLogoDragOver : undefined}
              onDragLeave={isAdmin ? handleLogoDragLeave : undefined}
              onDrop={isAdmin ? (e) => { void handleLogoDrop(e); } : undefined}
              className={[
                "relative flex items-center justify-center rounded-xl border-2 transition-colors overflow-hidden",
                isAdmin ? "cursor-pointer select-none" : "cursor-default opacity-60",
                "bg-white",
                isDraggingLogo
                  ? "border-gray-900 bg-gray-50"
                  : displayLogoUrl
                    ? "border-gray-200 hover:border-gray-300"
                    : "border-dashed border-gray-200 hover:border-gray-400",
              ].join(" ")}
              style={{ minHeight: "80px", minWidth: "160px" }}
            >
              {isUploadingLogo ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-gray-500">Uploading…</span>
                </div>
              ) : displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt="Logo"
                  className="object-contain p-3"
                  style={{ maxHeight: "80px", maxWidth: "220px" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center pointer-events-none">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-xs font-medium text-gray-500">Click or drag to upload</span>
                  <span className="text-[10px] text-gray-400">PNG, JPG, WebP · max 5 MB</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isAdmin ? (
                <>
                  {displayLogoUrl && (
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                      Replace
                    </button>
                  )}
                  {displayLogoUrl && (
                    <button
                      type="button"
                      onClick={() => { void handleRemoveLogo(); }}
                      className="text-xs rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Contact your admin to change the logo.</p>
              )}
              {logoSaved && (
                <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
              )}
            </div>
          </div>
        </div>

        {/* Form logo */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900">Form logo</label>
            <p className="text-xs text-gray-400 mt-0.5">Shown in customer-facing forms. Falls back to your main logo if not set.</p>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <input
              ref={formLogoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFormLogoFile(f); }}
            />
            <div
              role={isAdmin ? "button" : undefined}
              tabIndex={isAdmin ? 0 : undefined}
              aria-label={isAdmin ? (displayFormLogoUrl ? "Click or drop to replace form logo" : "Click or drop to upload form logo") : undefined}
              onClick={() => isAdmin && !isUploadingFormLogo && formLogoInputRef.current?.click()}
              onKeyDown={(e) => { if (isAdmin && (e.key === "Enter" || e.key === " ") && !isUploadingFormLogo) formLogoInputRef.current?.click(); }}
              onDragOver={(e) => { if (!isAdmin) return; e.preventDefault(); setIsDraggingFormLogo(true); }}
              onDragLeave={() => setIsDraggingFormLogo(false)}
              onDrop={(e) => { if (!isAdmin) return; e.preventDefault(); setIsDraggingFormLogo(false); const f = e.dataTransfer.files?.[0]; if (f) void uploadFormLogoFile(f); }}
              className={[
                "relative flex items-center justify-center rounded-xl border-2 transition-colors overflow-hidden",
                isAdmin ? "cursor-pointer select-none" : "cursor-default opacity-60",
                "bg-white",
                isDraggingFormLogo
                  ? "border-gray-900 bg-gray-50"
                  : displayFormLogoUrl
                    ? "border-gray-200 hover:border-gray-300"
                    : "border-dashed border-gray-200 hover:border-gray-400",
              ].join(" ")}
              style={{ minHeight: "80px", minWidth: "160px" }}
            >
              {isUploadingFormLogo ? (
                <div className="flex items-center gap-2 px-4 py-4">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-gray-500">Uploading…</span>
                </div>
              ) : displayFormLogoUrl ? (
                <img
                  src={displayFormLogoUrl}
                  alt="Form logo"
                  className="object-contain p-3"
                  style={{ maxHeight: "80px", maxWidth: "220px" }}
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-4 py-4 text-center pointer-events-none">
                  <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-xs font-medium text-gray-500">Click or drag to upload</span>
                  <span className="text-[10px] text-gray-400">PNG, JPG, WebP · max 5 MB</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isAdmin ? (
                <>
                  {displayFormLogoUrl && (
                    <button
                      type="button"
                      disabled={isUploadingFormLogo}
                      onClick={() => formLogoInputRef.current?.click()}
                      className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                    >
                      Replace
                    </button>
                  )}
                  {displayFormLogoUrl && (
                    <button
                      type="button"
                      onClick={() => { void handleRemoveFormLogo(); }}
                      className="text-xs rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400 italic">Contact your admin to change the form logo.</p>
              )}
              {formLogoSaved && (
                <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
              )}
            </div>
          </div>
        </div>

        {/* Logo background toggle */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4 border-t border-gray-100">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900">Logo background</label>
            <p className="text-xs text-gray-400 mt-0.5">Show logo on a white background in forms</p>
          </div>
          <div className="flex-1 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={logoOnWhite}
              disabled={!isAdmin}
              onClick={() => { if (isAdmin) void handleLogoOnWhiteToggle(!logoOnWhite); }}
              className={[
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#0E1D4A]/30 disabled:opacity-50",
                isAdmin ? "" : "cursor-not-allowed",
              ].join(" ")}
              style={logoOnWhite
                ? { backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38", borderColor: "transparent" }
                : { backgroundColor: "transparent", borderColor: "#0E1D4A" }
              }
            >
              <span
                aria-hidden="true"
                className={[
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full shadow ring-0 transition-all duration-200 ease-in-out",
                  logoOnWhite ? "translate-x-4" : "translate-x-0",
                ].join(" ")}
                style={{ backgroundColor: logoOnWhite ? "#ffffff" : "#0E1D4A" }}
              />
            </button>
            <span className="text-sm text-gray-700">{logoOnWhite ? "White background" : "Brand color background"}</span>
          </div>
        </div>

        {/* Brand color */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-44 shrink-0 pt-0.5">
            <label className="text-sm font-medium text-gray-900" htmlFor="brand-color">Brand color</label>
            <p className="text-xs text-gray-400 mt-0.5">Used in buttons and highlights</p>
            {colorSaved && (
              <span className="text-[11px] text-green-600 font-medium mt-1 block">✓ Saved</span>
            )}
          </div>
          <div className={`flex-1 ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}>
            <BrandColorSection
              brandColor={brandColor}
              onChange={(c) => { colorEdited.current = true; setBrandColor(c); }}
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
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customer form preview</h2>
            <p className="text-xs text-gray-500 mt-0.5">How your branding appears to customers on document collection forms.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 shrink-0">Preview</span>
        </div>
        {/* Simulated browser chrome */}
        <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b border-gray-200">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          </div>
          <div className="flex-1 bg-white rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 font-mono truncate">
            docuplete.com/collect/…
          </div>
        </div>
        {/* Mocked interview page */}
        <div className="bg-[#F8F6F0] px-6 py-6">
          <div className="max-w-sm mx-auto overflow-hidden rounded-xl shadow-sm border border-[#DDD5C4]">
            {/* Form header — matches the actual customer interview header exactly */}
            <header className="bg-white border-b border-[#DDD5C4] px-4 py-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const previewLogoUrl = displayFormLogoUrl || displayLogoUrl;
                  const bc = /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38";
                  const bgColor = previewLogoUrl && logoOnWhite ? "#ffffff" : bc;
                  const textColor = getTextForBg(bgColor);
                  return (
                    <div
                      className="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: bgColor }}
                    >
                      {previewLogoUrl ? (
                        <img src={previewLogoUrl} alt={name || "Logo"} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-xs font-bold" style={{ color: textColor }}>{(name || "?").charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  );
                })()}
                <div>
                  <div className="text-sm font-semibold text-[#0F1C3F]">{name || "Your company name"}</div>
                  <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
                </div>
              </div>
            </header>
            {/* Form body */}
            <div className="bg-[#F8F6F0] px-4 py-6 space-y-5">
              {/* Package title */}
              <div>
                <h2 className="text-lg font-semibold text-[#0F1C3F]">Client Intake Form</h2>
                <p className="text-xs text-[#6B7A99] mt-1">Please complete the form below. Your answers are saved automatically as you type.</p>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#EFE8D8] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full w-1/3"
                  style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
                />
              </div>
              {/* Sample field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#0F1C3F]">Full name <span className="text-red-500">*</span></label>
                <div className="rounded-lg border border-[#DDD5C4] bg-white px-3 py-2 text-sm text-[#6B7A99] italic">
                  Jane Smith
                </div>
              </div>
              {/* Branded submit button */}
              <button
                type="button"
                className="w-full rounded-lg py-2.5 text-sm font-semibold text-white pointer-events-none"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#C49A38" }}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Billing section */}
      <div id="billing-section">
        <BillingSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Submission bank section */}
      <div id="submission-bank-section">
        <SubmissionBankSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Custom domain section */}
      <div id="custom-domain-section">
        <CustomDomainSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Team section */}
      <div id="team-section">
        <TeamSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Interview defaults section — admin writes, all can view */}
      <div id="interview-defaults-section">
        <InterviewDefaultsSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Email customization section — admin writes, all can view */}
      <div id="email-section">
        <EmailCustomizationSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Integrations section */}
      <div id="integrations-section">
        <IntegrationsSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Developer section — SDK, Zapier, API Keys */}
      <div id="developer-section" className="flex flex-col gap-6">
        <DeveloperSection getAuthHeaders={getAuthHeaders} />
        <div id="api-keys-section">
          <ApiKeysSection getAuthHeaders={getAuthHeaders} />
        </div>
      </div>

      {/* Source Key Mapping section */}
      <div id="source-key-section">
        <SourceKeyMappingSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
      </div>

      {/* Data & Privacy section */}
      <div id="data-privacy-section">
        <DataPrivacySection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} orgName={name} />
      </div>

          {/* Audit log section — admin only */}
          {isAdmin && (
            <div id="audit-log-section">
              <AuditLogSection getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
            </div>
          )}

      {/* Feedback section */}
      <div id="feedback-section">
        <FeedbackSection getAuthHeaders={getAuthHeaders} />
      </div>

        </div>{/* end content column */}
      </div>{/* end lg:flex container */}
    </div>
  );
}
