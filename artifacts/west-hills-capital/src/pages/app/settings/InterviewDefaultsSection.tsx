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
  type InterviewDefaults,
  LOCALE_OPTIONS,
  EXPIRY_PRESETS,
  expiryToPreset,
} from "./settingsUtils";

export function InterviewDefaultsSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const [linkExpiryDays, setLinkExpiryDays] = useState<number | null>(null);
  const [expiryPreset, setExpiryPreset] = useState<string>("never");
  const [customExpiry, setCustomExpiry] = useState<string>("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(2);
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Package channel defaults state
  const [pkgDefaultInterview,    setPkgDefaultInterview]    = useState(true);
  const [pkgDefaultCsv,          setPkgDefaultCsv]          = useState(true);
  const [pkgDefaultCustomerLink, setPkgDefaultCustomerLink] = useState(true);
  const [pkgDefaultNotifyStaff,  setPkgDefaultNotifyStaff]  = useState(true);
  const [pkgDefaultNotifyClient, setPkgDefaultNotifyClient] = useState(false);
  const [pkgDefaultEsign,        setPkgDefaultEsign]        = useState(false);
  const [pkgDefaultsSaving, setPkgDefaultsSaving] = useState(false);
  const [pkgDefaultsSaved,  setPkgDefaultsSaved]  = useState(false);
  const [pkgDefaultsError,  setPkgDefaultsError]  = useState<string | null>(null);
  const pkgSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const interviewDefaultsFetch = fetch(`${SETTINGS_BASE}/interview-defaults`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { interviewDefaults?: InterviewDefaults; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load interview defaults"); return; }
        if (data.interviewDefaults) {
          const d = data.interviewDefaults;
          setLinkExpiryDays(d.linkExpiryDays);
          setExpiryPreset(expiryToPreset(d.linkExpiryDays));
          setCustomExpiry(d.linkExpiryDays !== null && ![7, 14, 30, 90].includes(d.linkExpiryDays) ? String(d.linkExpiryDays) : "");
          setReminderEnabled(d.reminderEnabled);
          setReminderDays(d.reminderDays);
          setDefaultLocale(d.defaultLocale);
        }
      });
    const orgFetch = fetch(`${SETTINGS_BASE}/org`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json() as { org?: { pkg_default_interview?: boolean; pkg_default_csv?: boolean; pkg_default_customer_link?: boolean; pkg_default_notify_staff?: boolean; pkg_default_notify_client?: boolean; pkg_default_esign?: boolean } };
        if (data.org) {
          setPkgDefaultInterview(data.org.pkg_default_interview !== false);
          setPkgDefaultCsv(data.org.pkg_default_csv !== false);
          setPkgDefaultCustomerLink(data.org.pkg_default_customer_link !== false);
          setPkgDefaultNotifyStaff(data.org.pkg_default_notify_staff !== false);
          setPkgDefaultNotifyClient(data.org.pkg_default_notify_client === true);
          setPkgDefaultEsign(data.org.pkg_default_esign === true);
        }
      });
    Promise.all([interviewDefaultsFetch, orgFetch])
      .catch(() => setLoadError("Failed to load settings"))
      .finally(() => setIsLoading(false));
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (pkgSavedTimerRef.current) clearTimeout(pkgSavedTimerRef.current);
    };
  }, []);

  function handleExpiryPresetChange(preset: string) {
    setExpiryPreset(preset);
    if (preset === "never") { setLinkExpiryDays(null); setCustomExpiry(""); }
    else if (preset === "custom") { /* keep current custom */ }
    else { setLinkExpiryDays(Number(preset)); setCustomExpiry(""); }
  }

  function handleCustomExpiryChange(val: string) {
    setCustomExpiry(val);
    const n = parseInt(val, 10);
    if (Number.isInteger(n) && n >= 1 && n <= 3650) setLinkExpiryDays(n);
  }

  function effectiveLinkExpiryDays(): number | null {
    if (expiryPreset === "never") return null;
    if (expiryPreset === "custom") {
      const n = parseInt(customExpiry, 10);
      return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : null;
    }
    return linkExpiryDays;
  }

  async function handleSave() {
    setSaveError(null);

    // Validate custom expiry before sending — an invalid/empty value would
    // silently become null (= "never expires") which is not the user's intent.
    if (expiryPreset === "custom") {
      const n = parseInt(customExpiry, 10);
      if (!Number.isInteger(n) || n < 1 || n > 3650) {
        setSaveError("Please enter a valid expiry between 1 and 3650 days.");
        return;
      }
    }

    setIsSaving(true);
    const payload: Record<string, unknown> = {
      linkExpiryDays: effectiveLinkExpiryDays(),
      reminderEnabled,
      reminderDays,
      defaultLocale,
    };
    try {
      const res = await fetch(`${SETTINGS_BASE}/interview-defaults`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { interviewDefaults?: InterviewDefaults; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Failed to save settings"); return; }
      if (data.interviewDefaults) {
        setLinkExpiryDays(data.interviewDefaults.linkExpiryDays);
        setExpiryPreset(expiryToPreset(data.interviewDefaults.linkExpiryDays));
        setReminderEnabled(data.interviewDefaults.reminderEnabled);
        setReminderDays(data.interviewDefaults.reminderDays);
        setDefaultLocale(data.interviewDefaults.defaultLocale);
      }
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePkgDefaultsSave() {
    setPkgDefaultsError(null);
    setPkgDefaultsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          pkgDefaultInterview:    pkgDefaultInterview,
          pkgDefaultCsv:          pkgDefaultCsv,
          pkgDefaultCustomerLink: pkgDefaultCustomerLink,
          pkgDefaultNotifyStaff:  pkgDefaultNotifyStaff,
          pkgDefaultNotifyClient: pkgDefaultNotifyClient,
          pkgDefaultEsign:        pkgDefaultEsign,
        }),
      });
      const data = await res.json() as { org?: { pkg_default_interview?: boolean; pkg_default_csv?: boolean; pkg_default_customer_link?: boolean; pkg_default_notify_staff?: boolean; pkg_default_notify_client?: boolean; pkg_default_esign?: boolean }; error?: string };
      if (!res.ok) { setPkgDefaultsError(data.error ?? "Failed to save defaults"); return; }
      if (data.org) {
        setPkgDefaultInterview(data.org.pkg_default_interview !== false);
        setPkgDefaultCsv(data.org.pkg_default_csv !== false);
        setPkgDefaultCustomerLink(data.org.pkg_default_customer_link !== false);
        setPkgDefaultNotifyStaff(data.org.pkg_default_notify_staff !== false);
        setPkgDefaultNotifyClient(data.org.pkg_default_notify_client === true);
        setPkgDefaultEsign(data.org.pkg_default_esign === true);
      }
      setPkgDefaultsSaved(true);
      if (pkgSavedTimerRef.current) clearTimeout(pkgSavedTimerRef.current);
      pkgSavedTimerRef.current = setTimeout(() => setPkgDefaultsSaved(false), 3000);
    } catch {
      setPkgDefaultsError("Failed to save defaults");
    } finally {
      setPkgDefaultsSaving(false);
    }
  }

  const expiryLabel = expiryPreset === "never"
    ? "Never expires"
    : expiryPreset === "custom"
    ? customExpiry ? `${customExpiry} days` : "—"
    : `${expiryPreset} days`;

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {/* Header */}
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Interview defaults</h2>
        <p className="text-xs text-gray-500 mt-0.5">Org-wide defaults applied to all new interview sessions. Individual interviews can still override these.</p>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {saveError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{saveError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Link expiry */}
          <div className="px-6 py-5">
            <label className="text-sm font-medium text-gray-800 block mb-1">Default link expiry</label>
            <p className="text-xs text-gray-500 mb-3">How long interview links stay active after creation.</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative inline-flex">
                <select
                  value={expiryPreset}
                  onChange={(e) => handleExpiryPresetChange(e.target.value)}
                  disabled={!isAdmin}
                  className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-9 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
                >
                  {EXPIRY_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
              {expiryPreset === "custom" && (
                <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={customExpiry}
                    onChange={(e) => handleCustomExpiryChange(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="—"
                    className="w-16 border-0 bg-transparent px-2.5 py-1.5 text-sm text-center text-gray-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60"
                  />
                  <span className="px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 border-l border-gray-200 whitespace-nowrap shrink-0">days</span>
                </div>
              )}
            </div>
          </div>

          {/* Reminder emails */}
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-800 block mb-1">Reminder emails</label>
                <p className="text-xs text-gray-500">
                  Automatically remind recipients who haven&apos;t completed their interview.
                  {!reminderEnabled && <span className="italic"> Currently disabled.</span>}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminderEnabled}
                  onClick={() => setReminderEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${reminderEnabled ? "border-transparent" : "border-[#0E1D4A]"}`}
                  style={{ backgroundColor: reminderEnabled ? bc : "transparent" }}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${reminderEnabled ? "bg-white shadow-sm translate-x-4" : "bg-[#0E1D4A] translate-x-0"}`} />
                </button>
              )}
              {!isAdmin && (
                <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 opacity-60 ${reminderEnabled ? "border-transparent" : "border-[#0E1D4A]"}`} style={{ backgroundColor: reminderEnabled ? bc : "transparent" }}>
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${reminderEnabled ? "bg-white shadow-sm translate-x-4" : "bg-[#0E1D4A] translate-x-0"}`} />
                </div>
              )}
            </div>
            {reminderEnabled && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <label className="text-xs text-gray-600 shrink-0">Send reminder after</label>
                <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white">
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={reminderDays}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isInteger(n) && n >= 1 && n <= 90) setReminderDays(n);
                    }}
                    disabled={!isAdmin}
                    className="w-12 border-0 bg-transparent px-2.5 py-1.5 text-sm text-center text-gray-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60"
                  />
                  <span className="px-2.5 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 border-l border-gray-200 whitespace-nowrap shrink-0">days</span>
                </div>
                <span className="text-xs text-gray-500">of inactivity</span>
              </div>
            )}
          </div>

          {/* Default locale */}
          <div className="px-6 py-5">
            <label className="text-sm font-medium text-gray-800 block mb-1">Default language</label>
            <p className="text-xs text-gray-500 mb-3">Language used for interview UI copy shown to recipients.</p>
            <div className="relative inline-flex">
              <select
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
                disabled={!isAdmin}
                className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-9 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60"
              >
                {LOCALE_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div className="px-6 py-5 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Current defaults</p>
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden text-xs divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">Link expiry</span>
                <span className="font-medium text-gray-800">{expiryLabel}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">Reminders</span>
                <span className="font-medium text-gray-800">
                  {reminderEnabled ? `After ${reminderDays} day${reminderDays !== 1 ? "s" : ""}` : "Disabled"}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-gray-500">Language</span>
                <span className="font-medium text-gray-800">
                  {LOCALE_OPTIONS.find((l) => l.value === defaultLocale)?.label ?? defaultLocale}
                </span>
              </div>
            </div>
          </div>

          {/* Save */}
          {isAdmin && (
            <div className="px-6 py-4 flex items-center justify-between">
              <div>
                {saved && <span className="text-xs text-green-700 font-medium">Saved</span>}
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => { void handleSave(); }}
                className="rounded-lg border px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                style={{ borderColor: bc, color: bc, backgroundColor: "transparent" }}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}

          {/* Package channel defaults */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Package channel defaults</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose which output channels are enabled when a new package is created. Each package can still override these individually.
              </p>
            </div>
            {pkgDefaultsError && (
              <p className="text-xs text-red-600">{pkgDefaultsError}</p>
            )}
            {(
              [
                { label: "Staff Interview",       desc: "Staff can launch guided interviews from the dashboard", value: pkgDefaultInterview,    set: setPkgDefaultInterview },
                { label: "Batch CSV",             desc: "Staff can fill many packets at once by uploading a CSV", value: pkgDefaultCsv,          set: setPkgDefaultCsv },
                { label: "Customer Link",         desc: "Send a branded link so customers can self-fill on their own device", value: pkgDefaultCustomerLink, set: setPkgDefaultCustomerLink },
                { label: "E-sign — Email Verify", desc: "Require customers to verify their email before submitting.", value: pkgDefaultEsign,        set: setPkgDefaultEsign },
                { label: "Staff Notification",    desc: "Email all staff when a client submits.", value: pkgDefaultNotifyStaff,   set: setPkgDefaultNotifyStaff },
                { label: "Client Confirmation",   desc: "Send the client a branded receipt after they submit.", value: pkgDefaultNotifyClient, set: setPkgDefaultNotifyClient },
              ] as Array<{ label: string; desc: string; value: boolean; set: (v: boolean) => void }>
            ).map(({ label, desc, value, set }) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                {isAdmin ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value}
                    onClick={() => set(!value)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${value ? "border-transparent" : "border-[#0E1D4A]"}`}
                    style={{ backgroundColor: value ? bc : "transparent" }}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${value ? "bg-white shadow-sm translate-x-4" : "bg-[#0E1D4A] translate-x-0"}`} />
                  </button>
                ) : (
                  <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 opacity-60 ${value ? "border-transparent" : "border-[#0E1D4A]"}`} style={{ backgroundColor: value ? bc : "transparent" }}>
                    <span className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${value ? "bg-white shadow-sm translate-x-4" : "bg-[#0E1D4A] translate-x-0"}`} />
                  </div>
                )}
              </div>
            ))}
            {isAdmin && (
              <div className="flex items-center justify-between pt-1">
                <div>
                  {pkgDefaultsSaved && <span className="text-xs text-green-700 font-medium">Saved</span>}
                </div>
                <button
                  type="button"
                  disabled={pkgDefaultsSaving}
                  onClick={() => { void handlePkgDefaultsSave(); }}
                  className="rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors brand-btn-hover"
                  style={{ backgroundColor: bc }}
                >
                  {pkgDefaultsSaving ? "Saving…" : "Save defaults"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
