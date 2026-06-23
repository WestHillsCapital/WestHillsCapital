import { formatOrgDate } from "@/lib/orgDateFormat";
import { getCachedProductOrg, updateProductOrgCache } from "@/hooks/useProductOrgSettings";
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

export function TimezoneLocaleSection({
  getAuthHeaders,
  isAdmin,
}: {
  getAuthHeaders: () => HeadersInit;
  isAdmin: boolean;
}) {
  const bc = useBrandColor();
  const [timezone,   setTimezone]   = useState("America/Chicago");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [tzSearch,   setTzSearch]   = useState("");
  const [isSaving,   setIsSaving]   = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null);
  const [loadErr,    setLoadErr]    = useState<string | null>(null);
  const [dirty,      setDirty]      = useState(false);

  useEffect(() => {
    const h = new Headers(getAuthHeaders());
    fetch(`${SETTINGS_BASE}/locale`, { headers: h })
      .then((r) => r.json())
      .then((d: { timezone?: string; dateFormat?: string; error?: string }) => {
        if (d.error) { setLoadErr(d.error); return; }
        if (d.timezone)   setTimezone(d.timezone);
        if (d.dateFormat) setDateFormat(d.dateFormat);
      })
      .catch(() => setLoadErr("Failed to load locale settings."));
  }, []);

  const filteredTz = tzSearch.trim()
    ? ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase()))
    : ALL_TIMEZONES;


  const previewNow = new Date().toISOString();
  const previewDate = formatOrgDate(previewNow, { timezone, date_format: dateFormat });
  const previewDateTime = formatOrgDate(previewNow, { timezone, date_format: dateFormat }, true);

  async function handleSave() {
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const h = new Headers(getAuthHeaders());
      h.set("Content-Type", "application/json");
      const r = await fetch(`${SETTINGS_BASE}/locale`, {
        method: "PATCH",
        headers: h,
        body: JSON.stringify({ timezone, dateFormat: dateFormat }),
      });
      const d = await r.json() as { timezone?: string; dateFormat?: string; error?: string };
      if (!r.ok) { setSaveMsg(d.error ?? "Failed to save."); return; }
      const cached = getCachedProductOrg();
      if (cached) updateProductOrgCache({ ...cached, timezone, date_format: dateFormat });
      setSaveMsg("Saved!");
      setDirty(false);
    } catch {
      setSaveMsg("Failed to save.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Timezone &amp; Locale</h2>
      <p className="text-sm text-gray-500 mb-5">
        Set the timezone and date format used for all timestamps in this workspace.
      </p>

      {loadErr && (
        <p className="text-sm text-red-600 mb-4">{loadErr}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Timezone selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Timezone</label>
          <input
            type="text"
            placeholder="Search timezones…"
            value={tzSearch}
            onChange={(e) => setTzSearch(e.target.value)}
            disabled={!isAdmin}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 mb-1.5 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <div
            role="listbox"
            aria-label="Timezone"
            className={[
              "h-36 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white focus:outline-none",
              "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent",
              !isAdmin ? "opacity-60 pointer-events-none" : "",
            ].join(" ")}
            style={{ scrollbarWidth: "thin", scrollbarColor: "#D1D5DB transparent" }}
          >
            {filteredTz.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400 italic">No timezones match.</p>
            ) : filteredTz.map((tz) => {
              const isSelected = timezone === tz;
              return (
                <button
                  key={tz}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!isAdmin}
                  onClick={() => { setTimezone(tz); setDirty(true); setSaveMsg(null); }}
                  className={`w-full flex items-center justify-between px-3 py-1 text-sm transition-colors ${isSelected ? "font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                  style={isSelected ? { backgroundColor: bc + "18", color: bc } : undefined}
                >
                  <span>{tz.replace(/_/g, " ")}</span>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: bc }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Selected: <span className="font-mono font-medium text-gray-600">{timezone}</span></p>
        </div>

        {/* Date format selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Date Format</label>
          <div className="flex flex-col gap-2">
            {DATE_FORMAT_OPTIONS.map((opt) => {
              const isSelected = dateFormat === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"} ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}
                >
                  <input
                    type="radio"
                    name="dateFormat"
                    value={opt.value}
                    checked={isSelected}
                    disabled={!isAdmin}
                    onChange={() => { setDateFormat(opt.value); setDirty(true); setSaveMsg(null); }}
                    className="sr-only"
                  />
                  {/* Custom radio circle */}
                  <span
                    className="shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: isSelected ? bc : "#0E1D4A",
                      backgroundColor: isSelected ? bc : "transparent",
                    }}
                  >
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-sm text-gray-700 font-mono">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-4 mb-5">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2">Preview</p>
        <div className="flex flex-wrap gap-x-8 gap-y-1.5 text-sm">
          <span><span className="font-medium text-[#0E1D4A] mr-1.5">Date:</span><span className="font-mono text-[#64748B]">{previewDate}</span></span>
          <span><span className="font-medium text-[#0E1D4A] mr-1.5">Date &amp; Time:</span><span className="font-mono text-[#64748B]">{previewDateTime}</span></span>
          <span><span className="font-medium text-[#0E1D4A] mr-1.5">Timezone:</span><span className="font-mono text-[#64748B]">{timezone}</span></span>
        </div>
      </div>

      {isAdmin && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSaving || !dirty}
            onClick={() => { void handleSave(); }}
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors brand-btn-hover"
            style={{ backgroundColor: bc }}
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg === "Saved!" ? "text-green-600" : "text-red-600"}`}>
              {saveMsg}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
