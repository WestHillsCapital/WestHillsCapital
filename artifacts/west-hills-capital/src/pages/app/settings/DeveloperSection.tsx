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

export function DeveloperSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  const bc = useBrandColor();
  const [zapier, setZapier] = useState<{ api_key_count: number; first_key_prefix: string | null } | null>(null);

  useEffect(() => {
    fetch(`${SETTINGS_BASE}/integrations`, { headers: getAuthHeaders() })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json() as { integrations?: IntegrationsStatus };
        if (data.integrations) {
          setZapier({
            api_key_count:   data.integrations.zapier.api_key_count,
            first_key_prefix: data.integrations.zapier.first_key_prefix,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Developer</h2>
        <p className="text-xs text-gray-500 mt-0.5">API keys, SDK, and automation tools for building on Docuplete.</p>
      </div>
      <div className="px-6 py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* ── SDK & API card ────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bc }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">SDK &amp; API</p>
                <p className="text-[10px] text-gray-400">Node.js · TypeScript</p>
              </div>
            </div>
            <CopySnippet command="npm install @docuplete/sdk" />
            <p className="text-xs text-gray-500 leading-relaxed">
              Create sessions, fill answers, generate PDF packets, and verify webhook signatures — all from your own code.
            </p>
            <div className="flex items-center gap-2 mt-auto pt-1">
              <a
                href="https://github.com/WestHillsCapital/WestHillsCapital/tree/main/packages/sdk#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Docs ↗
              </a>
              <button
                type="button"
                onClick={() => document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors brand-btn-hover"
                style={{ backgroundColor: bc }}
              >
                Get API key
              </button>
            </div>
          </div>

          {/* ── Zapier card ───────────────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FF4A00] flex items-center justify-center shrink-0 text-white font-bold text-sm">Z</div>
              <div>
                <p className="text-sm font-medium text-gray-900">Zapier</p>
                <p className="text-[10px] text-gray-400">Automate with 5,000+ apps</p>
              </div>
              {(zapier?.api_key_count ?? 0) > 0
                ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
              }
            </div>
            {(zapier?.api_key_count ?? 0) > 0 && zapier?.first_key_prefix ? (
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-1">API key in use</p>
                <code className="text-xs font-mono text-gray-700">{zapier.first_key_prefix}…</code>
                {zapier.api_key_count > 1 && (
                  <span className="ml-2 text-[10px] text-gray-400">+{zapier.api_key_count - 1} more</span>
                )}
              </div>
            ) : null}
            <p className="text-xs text-gray-500 leading-relaxed">
              {(zapier?.api_key_count ?? 0) === 0
                ? "Create an API key below to connect with Zapier. Use it as your authentication credential in any Zapier Docuplete action."
                : "Use your API key as the authentication credential in any Zapier Docuplete action or trigger."}
            </p>
            <div className="flex items-center gap-2 mt-auto pt-1">
              <a
                href="https://zapier.com/apps/docuplete/integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View on Zapier ↗
              </a>
              <button
                type="button"
                onClick={() => document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors brand-btn-hover"
                style={{ backgroundColor: bc }}
              >
                {(zapier?.api_key_count ?? 0) === 0 ? "Create API key" : "Manage keys"}
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

