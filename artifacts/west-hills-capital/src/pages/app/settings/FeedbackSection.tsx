import { useUser } from "@clerk/react";
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

export function FeedbackSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(ct?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (ct) h.set("Content-Type", ct);
    return h;
  }

  const { user } = useUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [fields, setFields]             = useState<Record<string, string>>({});
  const [sendCopy, setSendCopy]         = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  const fieldDefs = FEEDBACK_FIELDS[feedbackType];

  function handleTypeChange(t: FeedbackType) {
    setFeedbackType(t);
    setFields({});
    setSubmitMsg(null);
  }

  function setField(key: string, val: string) {
    setFields(prev => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const missing = fieldDefs.filter(f => f.required && !fields[f.key]?.trim());
    if (missing.length) {
      setSubmitMsg({ ok: false, text: `Please fill in: ${missing.map(f => f.label).join(", ")}.` });
      return;
    }
    setIsSubmitting(true);
    setSubmitMsg(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/feedback`, {
        method:  "POST",
        headers: authHeaders("application/json"),
        body:    JSON.stringify({ type: feedbackType, fields, sendCopy }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setSubmitMsg({ ok: true, text: "Message sent! We'll be in touch if we have questions." });
      setFields({});
    } catch (err: unknown) {
      setSubmitMsg({ ok: false, text: err instanceof Error ? err.message : "Failed to send. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const typeLabels: Record<FeedbackType, string> = {
    bug:     "Bug report",
    idea:    "Feature idea",
    message: "General message",
  };
  const typeDescriptions: Record<FeedbackType, string> = {
    bug:     "Something isn't working the way it should.",
    idea:    "A feature or improvement you'd like to see.",
    message: "Anything else on your mind.",
  };

  const canSend = fieldDefs.filter(f => f.required).every(f => !!fields[f.key]?.trim());

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Send a message</h2>
        <p className="text-xs text-gray-500 mt-0.5">Report a bug, share a feature idea, or send us a general message.</p>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="px-6 py-5 space-y-5">
        {submitMsg?.ok ? (
          /* ── Success panel ─────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <span className="text-4xl leading-none select-none">✨</span>
            <p className="text-base font-semibold text-gray-900">
              {feedbackType === "idea" ? "Idea captured." : "Message sent!"}
            </p>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              {feedbackType === "idea"
                ? "Thank you for helping us build Docuplete!"
                : "We'll be in touch if we have any questions."}
            </p>
            <button
              type="button"
              onClick={() => { setSubmitMsg(null); }}
              className="mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Send another message
            </button>
          </div>
        ) : (
          <>
            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">What kind of message is this?</label>
              <div className="grid grid-cols-3 gap-2">
                {(["bug", "idea", "message"] as FeedbackType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={[
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                      feedbackType === t
                        ? "border-[#0E1D4A] bg-[#0E1D4A]/5"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium text-gray-900">{typeLabels[t]}</span>
                    <span className="text-[11px] text-gray-500 leading-tight">{typeDescriptions[t]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic fields — frozen during submission */}
            <fieldset disabled={isSubmitting} className="space-y-4 disabled:opacity-60 transition-opacity">
              {fieldDefs.map(f => (
                <div key={f.key} className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {f.label}
                    {!f.required && <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      rows={4}
                      placeholder={f.placeholder}
                      value={fields[f.key] ?? ""}
                      onChange={e => setField(f.key, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 resize-y"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={f.placeholder}
                      value={fields[f.key] ?? ""}
                      onChange={e => setField(f.key, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                  )}
                </div>
              ))}
            </fieldset>

            {/* Send me a copy */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendCopy}
                onChange={e => setSendCopy(e.target.checked)}
                className="sr-only"
              />
              <span className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                sendCopy ? "bg-[#0E1D4A] border-[#0E1D4A]" : "bg-transparent border-[#0E1D4A]"
              }`}>
                {sendCopy && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="text-sm text-gray-700">
                Send me a copy
                {userEmail && <span className="ml-1 text-gray-400 text-xs">({userEmail})</span>}
              </span>
            </label>

            {/* Error */}
            {submitMsg && !submitMsg.ok && (
              <p className="text-sm font-medium text-red-600">{submitMsg.text}</p>
            )}

            {/* Submit */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !canSend}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting && (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {isSubmitting ? "Sending…" : "Send message"}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

