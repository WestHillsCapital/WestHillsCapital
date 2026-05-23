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
  type EmailSettings,
} from "./settingsUtils";

export function EmailCustomizationSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const [senderName, setSenderName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [footer, setFooter] = useState("");
  const [senderEmail, setSenderEmail] = useState("noreply@westhillscapital.com");
  const [baseSenderName, setBaseSenderName] = useState("");
  const [baseReplyTo, setBaseReplyTo] = useState("");
  const [baseFooter, setBaseFooter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = senderName !== baseSenderName || replyTo !== baseReplyTo || footer !== baseFooter;

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/email`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { email?: EmailSettings; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load email settings"); return; }
        if (data.email) {
          const sn = data.email.senderName ?? "";
          const rt = data.email.replyTo ?? "";
          const ft = data.email.footer ?? "";
          setSenderName(sn); setBaseSenderName(sn);
          setReplyTo(rt);    setBaseReplyTo(rt);
          setFooter(ft);     setBaseFooter(ft);
          if (data.email.senderEmail) setSenderEmail(data.email.senderEmail);
        }
      })
      .catch(() => setLoadError("Failed to load email settings"))
      .finally(() => setIsLoading(false));
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/email`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({
          senderName: senderName.trim() || null,
          replyTo:    replyTo.trim()    || null,
          footer:     footer.trim()     || null,
        }),
      });
      const data = await res.json() as { email?: EmailSettings; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Failed to save email settings"); return; }
      if (data.email) {
        const sn = data.email.senderName ?? "";
        const rt = data.email.replyTo ?? "";
        const ft = data.email.footer ?? "";
        setSenderName(sn); setBaseSenderName(sn);
        setReplyTo(rt);    setBaseReplyTo(rt);
        setFooter(ft);     setBaseFooter(ft);
      }
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch { setSaveError("Failed to save email settings."); }
    finally { setIsSaving(false); }
  }

  const previewFrom   = senderName.trim() || "Docuplete";
  const previewReplyTo = replyTo.trim() || null;
  const previewFooter  = footer.trim() || null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Email</h2>
        <p className="text-xs text-gray-500 mt-0.5">Customize how outbound emails appear to recipients.</p>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className={`px-6 py-5 space-y-5 ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}>
            {/* Sender display name */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Sender display name</label>
              <p className="text-xs text-gray-500 mb-2">Shown in the "From" field of all outbound emails. Leave blank to use the default.</p>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value.slice(0, 100))}
                placeholder="e.g. Acme Legal Team"
                maxLength={100}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
              />
              <p className={`text-right text-[10px] mt-1 transition-colors ${senderName.length >= 100 ? "text-red-500 font-medium" : "text-gray-400"}`}>{senderName.length}/100</p>
            </div>

            {/* Reply-to address */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Reply-to address</label>
              <p className="text-xs text-gray-500 mb-2">Where replies from clients are directed. Leave blank to use the default sender address.</p>
              <input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="e.g. team@acmelegal.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
              />
            </div>

            {/* Email footer */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Email footer</label>
              <p className="text-xs text-gray-500 mb-2">Plain-text message appended to all outbound emails. Max 500 characters.</p>
              <textarea
                rows={4}
                value={footer}
                onChange={(e) => setFooter(e.target.value.slice(0, 500))}
                placeholder="e.g. Questions? Reach us at support@acmelegal.com · 123 Main St, City, State"
                maxLength={500}
                className="w-full min-h-[100px] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-900/20 resize-none"
              />
              <p className={`text-right text-[10px] mt-1 transition-colors ${footer.length >= 500 ? "text-red-500 font-medium" : "text-gray-400"}`}>{footer.length}/500</p>
            </div>

            {/* Custom sender domain note */}
            <div className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
              <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path d="M12 16v-4M12 8h.01" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-xs text-gray-500">
                Emails are sent via Docuplete&apos;s sending domain. Custom sender domains (e.g.{" "}
                <code className="font-mono text-gray-600">@yourdomain.com</code>) are available on the{" "}
                <span className="font-semibold text-amber-700">Enterprise</span> plan.
              </p>
            </div>
          </div>

          {/* Preview */}
          <div className="px-6 py-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden text-xs font-mono">
              <div className="bg-gray-50 px-4 py-3 space-y-1.5 border-b border-gray-200 font-sans">
                <div className="flex gap-2">
                  <span className="text-[#0E1D4A] font-semibold w-16 shrink-0 text-right">From</span>
                  <span className="text-gray-600">{previewFrom} &lt;{senderEmail}&gt;</span>
                </div>
                {previewReplyTo && (
                  <div className="flex gap-2">
                    <span className="text-[#0E1D4A] font-semibold w-16 shrink-0 text-right">Reply-To</span>
                    <span className="text-gray-600">{previewReplyTo}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="text-[#0E1D4A] font-semibold w-16 shrink-0 text-right">Subject</span>
                  <span className="text-gray-500 italic">Your document interview is ready</span>
                </div>
              </div>
              <div className="bg-white px-4 py-4 space-y-2">
                <div className="h-2 w-36 bg-gray-200 rounded" />
                <div className="h-2 w-full bg-gray-100 rounded" />
                <div className="h-2 w-5/6 bg-gray-100 rounded" />
                <div className="h-2 w-3/4 bg-gray-100 rounded" />
              </div>
              {previewFooter ? (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 font-sans">
                  <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap">{previewFooter}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 font-sans">
                  <p className="text-[11px] text-gray-400 italic">No footer set — add one above to see it here.</p>
                </div>
              )}
            </div>
          </div>

          {/* Save row */}
          {isAdmin && (
            <div className="px-6 py-4 flex items-center justify-between gap-4 bg-gray-50">
              <div className="flex-1">
                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                {saved && !saveError && <p className="text-xs text-green-600">✓ Email settings saved</p>}
              </div>
              <button
                type="button"
                disabled={isSaving || !isDirty}
                onClick={() => { void handleSave(); }}
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-all brand-btn-hover disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: bc }}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
