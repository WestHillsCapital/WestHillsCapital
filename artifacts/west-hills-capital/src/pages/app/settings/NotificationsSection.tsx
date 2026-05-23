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

export function NotificationsSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();
  const [prefs, setPrefs] = useState<Map<string, NotifPref>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/notifications`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { prefs?: NotifPref[]; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load notification preferences"); return; }
        setPrefs(new Map((data.prefs ?? []).map(p => [p.event_key, p])));
      })
      .catch(() => setLoadError("Failed to load notification preferences"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
      if (savedTimerRef.current)  clearTimeout(savedTimerRef.current);
    };
  }, []);

  function getPref(key: string): NotifPref {
    return prefs.get(key) ?? { event_key: key, email_enabled: true, in_app_enabled: true };
  }

  function handleToggle(key: string, field: "email_enabled" | "in_app_enabled", value: boolean) {
    const updated = new Map(prefs);
    const current = getPref(key);
    updated.set(key, { ...current, [field]: value });
    setPrefs(updated);

    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(() => {
      const allKeys = NOTIFICATION_CATEGORIES.flatMap(c => c.events.map(e => e.key));
      const fullPrefs = allKeys.map(k => updated.get(k) ?? { event_key: k, email_enabled: true, in_app_enabled: true });
      setSaveError(null);
      fetch(`${SETTINGS_BASE}/notifications`, {
        method: "PUT",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ prefs: fullPrefs }),
      }).then(async (r) => {
        if (!r.ok) {
          const data = await r.json() as { error?: string };
          setSaveError(data.error ?? "Failed to save preferences");
          return;
        }
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
      }).catch(() => setSaveError("Failed to save preferences"));
    }, 150);
  }

  return (
    <>
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Choose which events send you email alerts or appear as in-app notifications. These preferences are personal — each team member controls their own.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="px-6 py-8 text-center text-sm text-red-500">{loadError}</div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="flex items-center px-6 py-2 border-b border-gray-100 bg-gray-50/80">
            <div className="flex-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Event</div>
            <div className="w-20 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Email</div>
            <div className="w-20 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">In-app</div>
          </div>

          {NOTIFICATION_CATEGORIES.map((category) => (
            <div key={category.label}>
              <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-100">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{category.label}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {category.events.map((event) => {
                  const pref = getPref(event.key);
                  return (
                    <div key={event.key} className="flex items-center px-6 py-3.5">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-medium text-gray-800">{event.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{event.description}</p>
                      </div>
                      <div className="w-20 flex justify-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pref.email_enabled}
                          onClick={() => handleToggle(event.key, "email_enabled", !pref.email_enabled)}
                          className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                          style={{ backgroundColor: pref.email_enabled ? bc : "#E2E8F0" }}
                        >
                          <span
                            className={[
                              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                              pref.email_enabled ? "translate-x-4" : "translate-x-0",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                      <div className="w-20 flex justify-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pref.in_app_enabled}
                          onClick={() => handleToggle(event.key, "in_app_enabled", !pref.in_app_enabled)}
                          className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                          style={{ backgroundColor: pref.in_app_enabled ? bc : "#E2E8F0" }}
                        >
                          <span
                            className={[
                              "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                              pref.in_app_enabled ? "translate-x-4" : "translate-x-0",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {saveError && (
            <div className="px-6 py-3 border-t border-gray-100 bg-red-50">
              <p className="text-xs text-red-600">{saveError}</p>
            </div>
          )}
        </div>
      )}
    </section>
    {saved && (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-[#0E1D4A] px-4 py-2.5 text-sm font-medium text-white shadow-lg pointer-events-none">
        <svg className="w-3.5 h-3.5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Preferences updated
      </div>
    )}
    </>
  );
}

// ── Audit Log Section ─────────────────────────────────────────────────────────

