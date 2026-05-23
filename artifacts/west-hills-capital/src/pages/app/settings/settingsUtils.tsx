import { useEffect, useRef, useState } from "react";
import { PLAN_DATA, annualMonthlyPrice, type PlanKey } from "@workspace/plan-data";
import { useUser } from "@clerk/react";
import { isClerkAPIResponseError } from "@clerk/react/errors";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { useProductAuth } from "@/hooks/useProductAuth";
import { useProductRole } from "@/hooks/useProductRole";
import { useProductOrgSettings, updateProductOrgCache, getCachedProductOrg, type ProductOrgSettings } from "@/hooks/useProductOrgSettings";
import { formatOrgDate, formatOrgRelative } from "@/lib/orgDateFormat";
import { BrandColorSection } from "@/components/settings/BrandColorSection";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export const SETTINGS_BASE = `${API_BASE}/api/v1/product/settings`;
export const AUTH_BASE = `${API_BASE}/api/v1/product/auth`;

export interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

export interface NewKeyResult {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

export interface TeamMember {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  role_label: string;
  status: string;
  last_seen_at: string | null;
  invited_at: string | null;
  invited_by: string | null;
  is_current_user: boolean;
}

export const ROLE_OPTIONS = [
  { value: "admin",    label: "Admin" },
  { value: "member",   label: "Member" },
  { value: "readonly", label: "Read-only" },
];

export function roleBadge(role: string) {
  if (role === "admin")    return <span className="inline-flex items-center rounded-full bg-[#EEF1FA] border border-[#BEC8E4] px-2 py-0.5 text-[10px] font-semibold text-[#0E1D4A]">Admin</span>;
  if (role === "readonly") return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Read-only</span>;
  return <span className="inline-flex items-center rounded-full bg-[#F0F4FF] border border-[#C8D4F0] px-2 py-0.5 text-[10px] font-semibold text-[#2B4BAB]">Member</span>;
}

export function CopyBadge({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <span
      className="group relative inline-flex items-center gap-1 cursor-pointer rounded px-1.5 py-0.5 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors"
      onClick={copy}
      title="Click to copy"
    >
      <span className="font-mono font-semibold text-gray-900 text-[11px]">{value}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5">
        {copied ? (
          <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.991 1.057 1.991 2.176v1.5c0 .513-.406.957-.92.997a48.7 48.7 0 01-7.332.022 1.002 1.002 0 01-.92-.997v-1.5c0-1.12.891-2.048 1.991-2.176a48.424 48.424 0 011.927-.184" />
          </svg>
        )}
      </span>
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white whitespace-nowrap pointer-events-none z-10 shadow-sm">
          ✓ Copied to clipboard
        </span>
      )}
    </span>
  );
}

export function CopySnippet({ command, label = "Install" }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group relative w-full text-left rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 hover:border-gray-300 hover:bg-gray-100 transition-colors focus:outline-none"
      title="Click to copy"
    >
      <p className="text-[10px] text-gray-400 mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs font-mono text-gray-700">{command}</code>
        <span className="shrink-0">
          {copied ? (
            <span className="text-[10px] font-medium text-green-600 whitespace-nowrap">✓ Copied</span>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.991 1.057 1.991 2.176v1.5c0 .513-.406.957-.92.997a48.7 48.7 0 01-7.332.022 1.002 1.002 0 01-.92-.997v-1.5c0-1.12.891-2.048 1.991-2.176a48.424 48.424 0 011.927-.184" />
            </svg>
          )}
        </span>
      </div>
      {copied && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white whitespace-nowrap pointer-events-none z-10 shadow-sm">
          ✓ Copied to clipboard
        </span>
      )}
    </button>
  );
}

export function StyledSelect({ value, onChange, disabled, children, size = "sm" }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "md"
    ? "px-3 py-2 pr-9 text-sm"
    : "px-2.5 py-1.5 pr-8 text-xs";
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`appearance-none rounded-lg border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls}`}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}

export function formatRelative(iso: string | null): string {
  return formatOrgRelative(iso, getCachedProductOrg());
}

export interface BillingLineItem {
  description: string;
  quantity: number;
  unit_amount_cents: number;
  amount_cents: number;
}

export interface BillingInfo {
  plan_tier: string;
  subscription_status: string | null;
  billing_period_start: string | null;
  next_renewal_at: string | null;
  trial_end: string | null;
  renewal_amount_cents: number | null;
  billing_interval: string | null;
  line_items?: BillingLineItem[];
  has_stripe_customer: boolean;
  has_stripe_subscription: boolean;
  limits: {
    max_packages: number | null;
    max_submissions_per_month: number | null;
    max_seats: number;
  };
  usage: {
    packages: number;
    submissions: number;
    seats: number;
  };
}

export const PLAN_LABELS: Record<string, string> = {
  free:       "Starter",
  starter:    "Starter",
  pro:        "Pro",
  developer:  "Developer",
  enterprise: "Enterprise",
};

export function planBadge(tier: string) {
  if (tier === "enterprise")  return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Enterprise</span>;
  if (tier === "developer")   return <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Developer</span>;
  if (tier === "pro")         return <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Pro</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Starter</span>;
}

export function statusBadge(status: string | null) {
  if (!status) return null;
  if (status === "trialing")
    return <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">Trial</span>;
  if (status === "active")
    return <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Active</span>;
  if (status === "past_due")
    return <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">Past due</span>;
  if (status === "canceled" || status === "cancelled")
    return <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Cancelled</span>;
  return <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">{status}</span>;
}

export function UsageBar({ label, used, limit, unit = "" }: { label: string; used: number; limit: number | null; unit?: string }) {
  const bc = useBrandColor();
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isOver = limit !== null && used >= limit;
  const barColor = isOver ? "#EF4444" : pct > 80 ? "#F59E0B" : bc;
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-600">{label}</span>
        {limit === null ? (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4zm0 0c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z"/>
            </svg>
            Unlimited
          </span>
        ) : (
          <span className={`text-xs font-medium tabular-nums ${isOver ? "text-red-600" : "text-gray-700"}`}>
            {`${used.toLocaleString()} / ${limit.toLocaleString()}${unit}`}
          </span>
        )}
      </div>
      {limit !== null ? (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
        </div>
      ) : (
        <div className="h-1.5 rounded-full bg-gray-100" />
      )}
    </div>
  );
}

export function formatDate(iso: string | null): string {
  return formatOrgDate(iso, getCachedProductOrg());
}

export function useBrandColor(): string {
  const org = useProductOrgSettings();
  return org?.brand_color ?? "#C49A38";
}

export function getTextForBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#111827" : "#ffffff";
}

export interface BankEntry {
  id:           number;
  remaining:    number;
  amount:       number;
  source:       string;
  pack_size:    number;
  deposited_at: string;
  expires_at:   string;
}

export interface PackTier {
  size:        number;
  monthly:     number;
  annual:      number;
  annualPerMo: number;
}


export interface IntegrationsStatus {
  zapier: { api_key_count: number; first_key_prefix: string | null; available: boolean };
  slack: { connected: boolean; channel_name: string | null; connected_at: string | null; available: boolean };
  gdrive: { connected: boolean; email: string | null; folder_name: string | null; connected_at: string | null; available: boolean };
  storage: {
    provider: "gdrive" | "onedrive" | "dropbox" | null;
    connected: boolean;
    email: string | null;
    folder_name: string | null;
    connected_at: string | null;
    available: { gdrive: boolean; onedrive: boolean; dropbox: boolean };
  };
  hubspot: { connected: boolean; hub_domain: string | null; connected_at: string | null; available: boolean };
}

export interface AuditLogMetadataMap {
  "team.invite":               { role: string };
  "team.remove":               { role: string };
  "team.role_change":          { from_role: string; to_role: string };
  "apikey.create":             Record<string, never>;
  "apikey.revoke":             Record<string, never>;
  "apikey.rename":             Record<string, never>;
  "branding.update_name":      { from: string; to: string };
  "branding.update_color":     { from: string; to: string };
  "branding.upload_logo":      Record<string, never>;
  "branding.remove_logo":      Record<string, never>;
  "branding.upload_form_logo": Record<string, never>;
  "branding.remove_form_logo": Record<string, never>;
  "plan.checkout_initiated":   { plan: string };
  "plan.change":               { from_plan: string; to_plan: string; status: string; event_type: string };
  "email_settings.update":     { senderName: string | null; replyTo: string | null; footerLength: number };
  "interview_defaults.update": { linkExpiryDays: number | null; reminderEnabled: boolean; reminderDays: number; defaultLocale: string };
  "settings.update_locale":    { timezone: string; dateFormat: string };
  "data.update_retention":     { submissionRetentionDays: number | null };
  "data.export_requested":     Record<string, never>;
  "data.deletion_requested":   { graceWindowDays: number; stripeCancelled?: boolean };
  "data.deletion_cancelled":   Record<string, never>;
  "security.2fa_enabled":             Record<string, never>;
  "security.2fa_disabled":            Record<string, never>;
  "security.session_revoked":         Record<string, never>;
  "security.trusted_device_revoked":  Record<string, never>;
  "custom_domain.set":         Record<string, never>;
  "custom_domain.verify":      { status: string; cnames: string[] };
  "auth.login":                { method: string };
  "auth.login_failed":         { reason?: string };
  "integration.connect":       { provider: string };
  "integration.disconnect":    { provider: string };
  "field.create":              { fieldType: string };
  "field.update":              { fieldType: string };
  "field.delete":              Record<string, never>;
}

export type KnownAuditAction = keyof AuditLogMetadataMap;

export interface AuditLogEntryBase {
  id: number;
  actor_email: string | null;
  resource_type: string | null;
  resource_label: string | null;
  ip_address: string | null;
  location: string | null;
  created_at: string;
}

export type AuditLogEntry = {
  [A in KnownAuditAction]: AuditLogEntryBase & { action: A; metadata: AuditLogMetadataMap[A] };
}[KnownAuditAction];

export const ACTION_LABELS: Record<string, string> = {
  "team.invite":               "Invited team member",
  "team.remove":               "Removed team member",
  "team.role_change":          "Changed member role",
  "apikey.create":             "Created API key",
  "apikey.revoke":             "Revoked API key",
  "apikey.rename":             "Renamed API key",
  "branding.update_name":      "Updated organization name",
  "branding.update_color":     "Updated brand color",
  "branding.upload_logo":      "Uploaded logo",
  "branding.remove_logo":      "Removed logo",
  "branding.upload_form_logo": "Uploaded form logo",
  "branding.remove_form_logo": "Removed form logo",
  "plan.checkout_initiated":   "Initiated plan upgrade",
  "plan.change":               "Plan changed",
  "email_settings.update":     "Updated email settings",
  "interview_defaults.update": "Updated interview defaults",
  "settings.update_locale":    "Updated locale settings",
  "data.update_retention":     "Updated data retention",
  "data.export_requested":     "Data export requested",
  "data.deletion_requested":   "Account deletion requested",
  "data.deletion_cancelled":   "Account deletion cancelled",
  "security.2fa_enabled":      "Enabled two-factor auth",
  "security.2fa_disabled":     "Disabled two-factor auth",
  "security.session_revoked":  "Revoked session",
  "security.trusted_device_revoked": "Revoked trusted device",
  "custom_domain.set":         "Set custom domain",
  "custom_domain.verify":      "Verified custom domain",
  "auth.login":                "Logged in",
  "auth.login_failed":         "Login failed",
  "integration.connect":       "Connected integration",
  "integration.disconnect":    "Disconnected integration",
  "field.create":              "Created field",
  "field.update":              "Updated field",
  "field.delete":              "Deleted field",
};

export const ACTION_FILTER_OPTIONS = [
  { value: "",                                label: "All activity" },
  { value: "auth.login",                      label: "Login" },
  { value: "auth.login_failed",               label: "Login failed" },
  { value: "team.invite",                     label: "Team invite" },
  { value: "team.remove",                     label: "Member removal" },
  { value: "team.role_change",                label: "Role change" },
  { value: "apikey.create",                   label: "API key created" },
  { value: "apikey.revoke",                   label: "API key revoked" },
  { value: "apikey.rename",                   label: "API key renamed" },
  { value: "security.2fa_enabled",            label: "2FA enabled" },
  { value: "security.2fa_disabled",           label: "2FA disabled" },
  { value: "security.session_revoked",        label: "Session revoked" },
  { value: "security.trusted_device_revoked", label: "Trusted device revoked" },
  { value: "integration.connect",             label: "Integration connected" },
  { value: "integration.disconnect",          label: "Integration disconnected" },
  { value: "field.create",                    label: "Field created" },
  { value: "field.update",                    label: "Field updated" },
  { value: "field.delete",                    label: "Field deleted" },
  { value: "branding.update_name",            label: "Org name change" },
  { value: "branding.update_color",           label: "Brand color change" },
  { value: "branding.upload_logo",            label: "Logo uploaded" },
  { value: "branding.remove_logo",            label: "Logo removed" },
  { value: "email_settings.update",           label: "Email settings" },
  { value: "interview_defaults.update",       label: "Interview defaults" },
  { value: "settings.update_locale",          label: "Locale settings" },
  { value: "data.update_retention",           label: "Retention policy" },
  { value: "data.export_requested",           label: "Data export" },
  { value: "data.deletion_requested",         label: "Deletion request" },
  { value: "plan.checkout_initiated",         label: "Plan upgrade initiated" },
  { value: "plan.change",                     label: "Plan changed" },
];

export function actionBadgeColor(action: string): string {
  if (/revoke|remove|delete|disconnect|failed/.test(action))                        return "bg-red-50 border-red-200 text-red-700";
  if (/create|invite|upload|add|checkout|connect$|enabled|^auth\.login$/.test(action)) return "bg-green-50 border-green-200 text-green-700";
  if (/update|rename|change|role|disabled|verify|\.set$|export|login/.test(action)) return "bg-blue-50 border-blue-200 text-blue-700";
  return "bg-gray-100 border-gray-200 text-gray-600";
}

export function formatTimestamp(iso: string): string {
  return formatOrgDate(iso, getCachedProductOrg(), true);
}

// ── Notifications Section ────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = [
  {
    label: "Interviews",
    events: [
      { key: "submission_received",   label: "New submission received", description: "When a client completes an interview form" },
    ],
  },
  {
    label: "Team",
    events: [
      { key: "team_member_joined",  label: "Team member joined",  description: "When a team member accepts their invitation" },
      { key: "team_member_removed", label: "Team member removed", description: "When a team member is removed from your organization" },
    ],
  },
  {
    label: "Billing",
    events: [
      { key: "billing_plan_change",    label: "Plan changed",       description: "When your subscription plan changes" },
      { key: "billing_payment_failed", label: "Payment failed",     description: "When a billing payment attempt fails" },
      { key: "plan_limit_warning",     label: "Plan limit warning", description: "When you're approaching a plan usage limit" },
    ],
  },
  {
    label: "Security",
    events: [
      { key: "api_key_created", label: "API key created", description: "When a new API key is generated in your organization" },
      { key: "api_key_revoked", label: "API key revoked", description: "When an API key is revoked" },
    ],
  },
] as const;

export interface NotifPref {
  event_key: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
}


export const RETENTION_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Keep forever", value: null },
  { label: "30 days",      value: 30 },
  { label: "90 days",      value: 90 },
  { label: "180 days",     value: 180 },
  { label: "1 year",       value: 365 },
  { label: "2 years",      value: 730 },
];

export const DATE_FORMAT_OPTIONS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY  (e.g. 04/28/2026)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY  (e.g. 28/04/2026)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD  (e.g. 2026-04-28)" },
];

export const ALL_TIMEZONES: string[] = (() => {
  try { return Intl.supportedValuesOf("timeZone"); }
  catch { return ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"]; }
})();


// ── Feedback Section ──────────────────────────────────────────────────────────

export type FeedbackType = "bug" | "idea" | "message";

export const FEEDBACK_FIELDS: Record<FeedbackType, Array<{ key: string; label: string; type: "text" | "textarea"; required: boolean; placeholder?: string }>> = {
  bug: [
    { key: "Steps to reproduce",         label: "Steps to reproduce",         type: "textarea", required: true,  placeholder: "1. Go to…\n2. Click…\n3. See error" },
    { key: "What you expected",          label: "What you expected to happen", type: "textarea", required: true,  placeholder: "I expected…" },
    { key: "What actually happened",     label: "What actually happened",      type: "textarea", required: true,  placeholder: "Instead…" },
    { key: "Page or URL",                label: "Page or URL",                 type: "text",     required: false, placeholder: "e.g. /app/settings or the full URL" },
  ],
  idea: [
    { key: "Feature name",               label: "Feature name",                type: "text",     required: true,  placeholder: "e.g. Bulk export PDF" },
    { key: "Problem it solves",          label: "What problem does this solve?", type: "textarea", required: true, placeholder: "Right now I have to…" },
    { key: "How it should work",         label: "How should it work?",         type: "textarea", required: true,  placeholder: "Ideally…" },
  ],
  message: [
    { key: "Subject",                    label: "Subject",                     type: "text",     required: true,  placeholder: "Brief summary" },
    { key: "Message",                    label: "Message",                     type: "textarea", required: true,  placeholder: "Tell us anything" },
  ],
};


export interface UserProfile {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  pending_email: string | null;
}

export interface TwoFAStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface TrustedDevice {
  id: number;
  label: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export interface ActiveSession {
  id: number;
  isCurrent: boolean;
  browser: string;
  os: string;
  device: string;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface LoginEntry {
  id: number;
  browser: string;
  os: string;
  device: string;
  ipAddress: string | null;
  location: string | null;
  createdAt: string;
}


// ── Source Key Mapping Dashboard ──────────────────────────────────────────────

export type PendingRename = {
  fieldId:         string;
  oldKey:          string;
  newKey:          string;
  packageCount:    number;
  sessionCount:    number;
  hubspotProperty: string | null;
};

export function RenameConfirmModal({
  pending, bc, saving, onConfirm, onCancel,
}: {
  pending:   PendingRename;
  bc:        string;
  saving:    boolean;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const { oldKey, newKey, packageCount, sessionCount, hubspotProperty } = pending;
  const isHighImpact = packageCount >= 10 || sessionCount >= 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`px-6 pt-5 pb-4 border-b ${isHighImpact ? "border-amber-100 bg-amber-50/60" : "border-gray-100"}`}>
          <div className="flex items-start gap-3">
            {isHighImpact ? (
              <div className="mt-0.5 flex-shrink-0 rounded-full bg-amber-100 p-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            ) : (
              <div className="mt-0.5 flex-shrink-0 rounded-full bg-blue-50 p-1.5">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2 2 0 002-2V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 3.375 3.375 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Review source key rename</h3>
              <p className="mt-0.5 text-xs text-gray-500">Make sure downstream integrations are updated after saving.</p>
            </div>
          </div>
        </div>

        {/* Rename preview */}
        <div className="px-6 py-4 flex items-center gap-3">
          <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 text-center truncate">{oldKey}</code>
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <code className="flex-1 rounded-lg px-3 py-2 font-mono text-xs text-center truncate" style={{ background: `${bc}14`, color: bc }}>{newKey || <span className="italic text-gray-400">(empty)</span>}</code>
        </div>

        {/* Impact summary */}
        <div className="px-6 pb-4">
          <div className={`rounded-lg border px-4 py-3 text-xs space-y-2 ${isHighImpact ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-gray-50"}`}>
            <p className={`font-medium ${isHighImpact ? "text-amber-800" : "text-gray-700"}`}>
              {isHighImpact ? "⚠\u00a0 " : ""}This change will affect{" "}
              <strong>{packageCount.toLocaleString()} {packageCount === 1 ? "package" : "packages"}</strong>
              {sessionCount > 0 && (
                <> and <strong>{sessionCount.toLocaleString()} active {sessionCount === 1 ? "session" : "sessions"}</strong></>
              )}.
            </p>
            {hubspotProperty && (
              <p className="text-gray-600 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.164 7.931V5.085a2.153 2.153 0 10-2.14 0v2.846a5.12 5.12 0 00-2.263 1.356L8.34 6.48a2.153 2.153 0 10-1.017 1.802l5.42 2.807a5.164 5.164 0 00-.16 1.257 5.12 5.12 0 002.31 4.299l-1.594 2.76a2.153 2.153 0 101.741.982l1.594-2.76a5.164 5.164 0 001.53.232 5.133 5.133 0 10-1-10.928z" />
                </svg>
                HubSpot sync active — this key maps to <strong>{hubspotProperty}</strong>. Renaming will break the sync until updated.
              </p>
            )}
            <p className="text-gray-500">Any API prefill calls using <code className="font-mono bg-white/70 px-1 rounded">{oldKey}</code> will stop working until updated.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: isHighImpact ? "#d97706" : bc }}
          >
            {saving ? "Saving…" : "Confirm rename"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsageBadge({ packageCount, sessionCount }: { packageCount: number; sessionCount: number }) {
  const isHigh   = sessionCount >= 50;
  const isMedium = sessionCount >= 10 && !isHigh;
  return (
    <div className="flex flex-col gap-0.5 min-w-[72px] leading-relaxed">
      <span className="text-[10px] text-gray-500">
        {packageCount} {packageCount === 1 ? "pkg" : "pkgs"}
      </span>
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium ${
          isHigh   ? "text-red-600"   :
          isMedium ? "text-amber-600" :
          sessionCount > 0 ? "text-amber-500" : "text-gray-300"
        }`}
      >
        {sessionCount > 0 && (
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        )}
        {sessionCount.toLocaleString()} {sessionCount === 1 ? "session" : "sessions"}
      </span>
    </div>
  );
}

export type SkField = {
  fieldId: string; fieldLabel: string; fieldType: string; sensitive: boolean;
  packageId: number; packageName: string; packageStatus: string; interviewMode: string | null;
};
export type SkGroup    = { sourceKey: string; fields: SkField[]; builtinHubspotProperty: string | null; packageCount: number; sessionCount: number };
export type SkMappings = { hubspot: Record<string, string>; csv: Record<string, string> };
export type SkPkg      = { id: number; name: string; status: string };


// ── Custom Domain types ───────────────────────────────────────────────────────
export type DomainStatus = "unverified" | "verifying" | "active" | "error" | null;

export interface CustomDomainInfo {
  plan_tier: string;
  custom_domain: string | null;
  status: DomainStatus;
  verified_at: string | null;
  cname_target: string;
}

export function domainStatusBadge(status: DomainStatus) {
  if (!status) return null;
  if (status === "active")      return <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">Active</span>;
  if (status === "verifying")   return <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Verifying\u2026</span>;
  if (status === "error")       return <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">Error</span>;
  return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Unverified</span>;
}

// ── Interview Defaults types ──────────────────────────────────────────────────
export interface InterviewDefaults {
  linkExpiryDays:  number | null;
  reminderEnabled: boolean;
  reminderDays:    number;
  defaultLocale:   string;
}

export const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish (Espa\xf1ol)" },
  { value: "fr", label: "French (Fran\xe7ais)" },
  { value: "de", label: "German (Deutsch)" },
  { value: "pt", label: "Portuguese (Portugu\xeas)" },
  { value: "zh", label: "Chinese (\u4e2d\u6587)" },
  { value: "ja", label: "Japanese (\u65e5\u672c\u8a9e)" },
  { value: "ko", label: "Korean (\ud55c\uad6d\uc5b4)" },
  { value: "ar", label: "Arabic (\u0627\u0644\u0639\u0631\u0628\u064a\u0629)" },
];

export const EXPIRY_PRESETS: { value: string; label: string }[] = [
  { value: "never",  label: "Never expires" },
  { value: "7",      label: "7 days" },
  { value: "14",     label: "14 days" },
  { value: "30",     label: "30 days" },
  { value: "90",     label: "90 days" },
  { value: "custom", label: "Custom\u2026" },
];

export function expiryToPreset(days: number | null): string {
  if (days === null) return "never";
  if ([7, 14, 30, 90].includes(days)) return String(days);
  return "custom";
}

// ── Email Customization types ─────────────────────────────────────────────────
export interface EmailSettings {
  senderName:  string | null;
  replyTo:     string | null;
  footer:      string | null;
  senderEmail: string | null;
}
