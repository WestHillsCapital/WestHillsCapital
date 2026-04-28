import { useEffect, useRef, useState } from "react";
import { useProductAuth } from "@/hooks/useProductAuth";
import { updateProductOrgCache, type ProductOrgSettings } from "@/hooks/useProductOrgSettings";
import { BrandColorSection } from "@/components/settings/BrandColorSection";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/v1/product/settings`;
const AUTH_BASE = `${API_BASE}/api/v1/product/auth`;

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

interface NewKeyResult {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

interface TeamMember {
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

const ROLE_OPTIONS = [
  { value: "admin",    label: "Admin" },
  { value: "member",   label: "Member" },
  { value: "readonly", label: "Read-only" },
];

function roleBadge(role: string) {
  if (role === "admin")    return <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Admin</span>;
  if (role === "readonly") return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Read-only</span>;
  return <span className="inline-flex items-center rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Member</span>;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

interface BillingInfo {
  plan_tier: string;
  subscription_status: string | null;
  billing_period_start: string | null;
  next_renewal_at: string | null;
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

const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", enterprise: "Enterprise" };

function planBadge(tier: string) {
  if (tier === "enterprise") return <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Enterprise</span>;
  if (tier === "pro")        return <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">Pro</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Free</span>;
}

function statusBadge(status: string | null) {
  if (!status) return null;
  if (status === "active" || status === "trialing")
    return <span className="text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Active</span>;
  if (status === "past_due")
    return <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">Past due</span>;
  if (status === "canceled" || status === "cancelled")
    return <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Cancelled</span>;
  return <span className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">{status}</span>;
}

function UsageBar({ label, used, limit, unit = "" }: { label: string; used: number; limit: number | null; unit?: string }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isOver = limit !== null && used >= limit;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        {limit === null ? (
          <span className="text-xs font-medium text-gray-500 italic">Unlimited</span>
        ) : (
          <span className={`text-xs font-medium ${isOver ? "text-red-600" : "text-gray-700"}`}>
            {`${used.toLocaleString()} / ${limit.toLocaleString()}${unit}`}
          </span>
        )}
      </div>
      {limit !== null && (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-gray-900"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function BillingSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isPortaling, setIsPortaling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "enterprise">("pro");

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/billing`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { billing?: BillingInfo; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load billing info"); return; }
        if (data.billing) setBilling(data.billing);
      })
      .catch(() => setLoadError("Failed to load billing info"))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleUpgrade() {
    setActionError(null);
    setIsUpgrading(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/billing/checkout`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json() as { url?: string; error?: string; setup_required?: boolean };
      if (!res.ok) {
        setActionError(data.error ?? "Failed to start checkout.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch { setActionError("Failed to start checkout."); }
    finally { setIsUpgrading(false); }
  }

  async function handlePortal() {
    setActionError(null);
    setIsPortaling(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/billing/portal`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setActionError(data.error ?? "Failed to open billing portal."); return; }
      if (data.url) window.open(data.url, "_blank");
    } catch { setActionError("Failed to open billing portal."); }
    finally { setIsPortaling(false); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Billing</h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage your subscription and plan limits.</p>
        </div>
        {!isLoading && billing && (
          <div className="flex items-center gap-2">
            {planBadge(billing.plan_tier)}
            {statusBadge(billing.subscription_status)}
          </div>
        )}
      </div>

      {loadError && (
        <div className="px-6 py-4 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {actionError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{actionError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : billing ? (
        <>
          {/* Usage bars */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-4">Usage this billing period</p>
            <UsageBar
              label="Packages"
              used={billing.usage.packages}
              limit={billing.limits.max_packages}
            />
            <UsageBar
              label="Interview submissions"
              used={billing.usage.submissions}
              limit={billing.limits.max_submissions_per_month}
              unit="/mo"
            />
            <UsageBar
              label="Team seats"
              used={billing.usage.seats}
              limit={billing.limits.max_seats}
            />
          </div>

          {/* Plan details */}
          <div className="px-6 py-4 bg-gray-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {PLAN_LABELS[billing.plan_tier] ?? billing.plan_tier} plan
                </p>
                {billing.next_renewal_at && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Renews {formatDate(billing.next_renewal_at)}
                  </p>
                )}
                {billing.plan_tier === "free" && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upgrade to unlock more packages, submissions, and seats.
                  </p>
                )}
              </div>

              {/* CTA */}
              {billing.plan_tier === "free" ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value as "pro" | "enterprise")}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                  >
                    <option value="pro">Pro — 5 seats · 500 submissions/mo</option>
                    <option value="enterprise">Enterprise — unlimited</option>
                  </select>
                  <button
                    type="button"
                    disabled={isUpgrading}
                    onClick={() => { void handleUpgrade(); }}
                    className="rounded-lg bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors whitespace-nowrap"
                  >
                    {isUpgrading ? "Opening…" : "Upgrade"}
                  </button>
                </div>
              ) : billing.has_stripe_subscription ? (
                <button
                  type="button"
                  disabled={isPortaling}
                  onClick={() => { void handlePortal(); }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {isPortaling ? "Opening…" : "Manage billing"}
                </button>
              ) : null}
            </div>
          </div>

          {/* Plan comparison table */}
          {billing.plan_tier === "free" && (
            <div className="px-6 py-4">
              <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Compare plans</p>
              <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-700 w-1/2">Feature</th>
                      <th className="px-4 py-2.5 text-center font-medium text-gray-700">Free</th>
                      <th className="px-4 py-2.5 text-center font-medium text-indigo-700">Pro</th>
                      <th className="px-4 py-2.5 text-center font-medium text-amber-700">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="px-4 py-2.5 text-gray-700">Packages</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">3</td>
                      <td className="px-4 py-2.5 text-center text-indigo-700 font-medium">Unlimited</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-medium">Unlimited</td>
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-700">Submissions / month</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">50</td>
                      <td className="px-4 py-2.5 text-center text-indigo-700 font-medium">500</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-medium">Unlimited</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 text-gray-700">Team seats</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">1</td>
                      <td className="px-4 py-2.5 text-center text-indigo-700 font-medium">5</td>
                      <td className="px-4 py-2.5 text-center text-amber-700 font-medium">Unlimited</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function TeamSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [seatCount, setSeatCount] = useState(0);
  const [seatLimit, setSeatLimit] = useState(10);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [seatLimitReached, setSeatLimitReached] = useState(false);

  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function loadTeam() {
    setIsLoading(true);
    setLoadError(null);
    fetch(`${SETTINGS_BASE}/team`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { members?: TeamMember[]; seat_count?: number; seat_limit?: number; is_admin?: boolean; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load team"); return; }
        setMembers(data.members ?? []);
        setSeatCount(data.seat_count ?? 0);
        setSeatLimit(data.seat_limit ?? 10);
        setIsAdmin(data.is_admin ?? false);
      })
      .catch(() => setLoadError("Failed to load team"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadTeam(); }, []);

  async function handleInvite() {
    if (!inviteEmail.trim()) { setInviteError("Email is required."); return; }
    setInviteError(null);
    setInviteSuccess(null);
    setSeatLimitReached(false);
    setIsInviting(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/invite`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json() as { member?: TeamMember; emailSent?: boolean; error?: string; upgrade_required?: boolean };
      if (res.status === 402 && data.upgrade_required) { setSeatLimitReached(true); return; }
      if (!res.ok) { setInviteError(data.error ?? "Failed to send invitation."); return; }
      setInviteEmail("");
      setInviteSuccess(
        data.emailSent === false
          ? `${inviteEmail.trim()} was added as a pending member. No email was sent — ask them to sign up at the app URL.`
          : `Invitation email sent to ${inviteEmail.trim()}.`,
      );
      loadTeam();
    } catch { setInviteError("Failed to send invitation."); }
    finally { setIsInviting(false); }
  }

  async function handleChangeRole(memberId: number, newRole: string) {
    setChangingRoleId(memberId);
    setActionError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/${memberId}/role`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json() as { member?: TeamMember; error?: string };
      if (!res.ok) { setActionError(data.error ?? "Failed to update role."); return; }
      loadTeam();
    } catch { setActionError("Failed to update role."); }
    finally { setChangingRoleId(null); }
  }

  async function handleRemove(memberId: number) {
    setRemovingId(memberId);
    setConfirmRemoveId(null);
    setActionError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/${memberId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setActionError(data.error ?? "Failed to remove member."); return; }
      loadTeam();
    } catch { setActionError("Failed to remove member."); }
    finally { setRemovingId(null); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Team</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${seatCount} of ${seatLimit} seat${seatLimit !== 1 ? "s" : ""} used`}
          </p>
        </div>
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {actionError && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-700">{actionError}</p>
        </div>
      )}

      {/* Invite form — admins only */}
      {isAdmin && (
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-gray-900 mb-3">Invite a team member</p>
          {seatLimitReached && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start justify-between gap-2">
              <span>
                Your plan&apos;s seat limit has been reached.{" "}
                <button
                  type="button"
                  className="underline font-semibold hover:text-amber-900"
                  onClick={() => document.getElementById("billing-section")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Upgrade your plan
                </button>{" "}
                to invite more team members.
              </span>
              <button type="button" onClick={() => setSeatLimitReached(false)} className="text-amber-500 hover:text-amber-800 shrink-0 leading-none">&times;</button>
            </div>
          )}
          {inviteError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{inviteError}</div>
          )}
          {inviteSuccess && (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">{inviteSuccess}</div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
              placeholder="colleague@company.com"
              className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
            >
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button
              type="button"
              disabled={isInviting}
              onClick={() => { void handleInvite(); }}
              className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
            >
              {isInviting ? "Sending…" : "Send invite"}
            </button>
          </div>
        </div>
      )}

      {/* Member list */}
      <div className="px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No team members yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 -mx-6">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-6 py-3">
                {/* Avatar placeholder */}
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-semibold text-gray-500 uppercase">
                  {(member.display_name ?? member.email).charAt(0)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.display_name ?? member.email}
                    </p>
                    {member.display_name && (
                      <span className="text-xs text-gray-400 truncate">{member.email}</span>
                    )}
                    {member.is_current_user && (
                      <span className="text-[10px] text-gray-400 font-medium">(you)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {roleBadge(member.role)}
                    {member.status === "pending" ? (
                      <span className="text-[10px] text-amber-600 font-medium">Pending invitation</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">
                        Last seen {formatRelative(member.last_seen_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Admin controls */}
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={member.role}
                      disabled={changingRoleId === member.id}
                      onChange={(e) => { void handleChangeRole(member.id, e.target.value); }}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-50"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>

                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600 whitespace-nowrap">Remove?</span>
                        <button
                          type="button"
                          disabled={removingId === member.id}
                          onClick={() => { void handleRemove(member.id); }}
                          className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
                        >
                          {removingId === member.id ? "…" : "Yes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setConfirmRemoveId(member.id); setActionError(null); }}
                        className="text-xs text-gray-400 hover:text-red-600 transition-colors px-1"
                        title="Remove member"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong>Admin</strong> — full access including settings and team management.{" "}
            <strong>Member</strong> — can run interviews and view results.{" "}
            <strong>Read-only</strong> — view access only.
          </p>
        </div>
      )}
    </section>
  );
}

interface IntegrationsStatus {
  zapier: { api_key_count: number; first_key_prefix: string | null; available: boolean };
  slack: { connected: boolean; channel_name: string | null; connected_at: string | null; available: boolean };
}

function IntegrationsSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackDisconnecting, setSlackDisconnecting] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackSuccess, setSlackSuccess] = useState<string | null>(null);

  function loadStatus() {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/integrations`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { integrations?: IntegrationsStatus; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load integrations"); return; }
        if (data.integrations) setStatus(data.integrations);
      })
      .catch(() => setLoadError("Failed to load integrations"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadStatus();

    // Handle Slack OAuth callback — Slack redirects back to this page with ?code=&state=
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    // Clean the URL immediately so params don't linger on refresh
    if (code || state || oauthError) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (oauthError === "access_denied") {
      setSlackError("Slack connection was cancelled.");
      return;
    }

    if (code && state) {
      const redirectUri = window.location.origin + window.location.pathname;
      setSlackConnecting(true);
      const headers = new Headers(getAuthHeaders());
      headers.set("Content-Type", "application/json");
      fetch(`${SETTINGS_BASE}/integrations/slack/exchange`, {
        method: "POST",
        headers,
        body: JSON.stringify({ code, state, redirectUri }),
      })
        .then(async (r) => {
          const data = await r.json() as { success?: boolean; channel_name?: string; error?: string };
          if (!r.ok) { setSlackError(data.error ?? "Failed to connect Slack."); return; }
          setSlackSuccess(`Connected to ${data.channel_name ?? "Slack"} successfully. You'll now receive submission notifications there.`);
          loadStatus();
        })
        .catch(() => setSlackError("Failed to connect Slack."))
        .finally(() => setSlackConnecting(false));
    }
  }, []);

  async function handleSlackConnect() {
    setSlackError(null);
    setSlackConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const res = await fetch(`${SETTINGS_BASE}/integrations/slack/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { setSlackError(data.error ?? "Failed to initiate Slack connection."); setSlackConnecting(false); return; }
      if (data.url) window.location.href = data.url;
    } catch {
      setSlackError("Failed to initiate Slack connection.");
      setSlackConnecting(false);
    }
  }

  async function handleSlackDisconnect() {
    setSlackDisconnecting(true);
    setSlackError(null);
    setSlackSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/slack`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setSlackError("Failed to disconnect Slack."); return; }
      loadStatus();
    } catch {
      setSlackError("Failed to disconnect Slack.");
    } finally {
      setSlackDisconnecting(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Integrations</h2>
        <p className="text-xs text-gray-500 mt-0.5">Connect Docuplete to the tools your team already uses.</p>
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
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* ── Zapier card ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FF4A00] flex items-center justify-center shrink-0 text-white font-bold text-sm">Z</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Zapier</p>
                  <p className="text-[10px] text-gray-400">Automate with 5,000+ apps</p>
                </div>
                {(status?.zapier.api_key_count ?? 0) > 0
                  ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                  : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
                }
              </div>
              {(status?.zapier.api_key_count ?? 0) > 0 && status?.zapier.first_key_prefix ? (
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                  <p className="text-[10px] text-gray-400 mb-1">API key in use</p>
                  <code className="text-xs font-mono text-gray-700">{status.zapier.first_key_prefix}…</code>
                  {status.zapier.api_key_count > 1 && (
                    <span className="ml-2 text-[10px] text-gray-400">+{status.zapier.api_key_count - 1} more</span>
                  )}
                </div>
              ) : null}
              <p className="text-xs text-gray-500 leading-relaxed">
                {(status?.zapier.api_key_count ?? 0) === 0
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
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  {(status?.zapier.api_key_count ?? 0) === 0 ? "Create API key" : "Manage keys"}
                </button>
              </div>
            </div>

            {/* ── Slack card ──────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#4A154B] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Slack</p>
                  <p className="text-[10px] text-gray-400">Submission notifications</p>
                </div>
                {status?.slack.connected
                  ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                  : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
                }
              </div>

              {slackConnecting && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                  Connecting to Slack…
                </div>
              )}
              {slackError && <p className="text-xs text-red-600">{slackError}</p>}
              {slackSuccess && <p className="text-xs text-green-700">{slackSuccess}</p>}

              {status?.slack.connected ? (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Posting to <span className="font-medium text-gray-700">{status.slack.channel_name ?? "your channel"}</span>.
                    You'll receive a notification whenever a client completes a document submission.
                  </p>
                  <button
                    type="button"
                    disabled={slackDisconnecting}
                    onClick={() => { void handleSlackDisconnect(); }}
                    className="mt-auto pt-1 text-xs text-gray-400 hover:text-red-600 transition-colors text-left disabled:opacity-60"
                  >
                    {slackDisconnecting ? "Disconnecting…" : "Disconnect Slack"}
                  </button>
                </>
              ) : !status?.slack.available ? (
                <p className="text-xs text-gray-400 leading-relaxed">
                  Slack integration is not enabled on this server. Contact your administrator to configure <code className="font-mono">SLACK_CLIENT_ID</code>.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Get notified in Slack whenever a client completes a document submission interview.
                  </p>
                  <div className="mt-auto pt-1">
                    <button
                      type="button"
                      disabled={slackConnecting}
                      onClick={() => { void handleSlackConnect(); }}
                      className="rounded-lg bg-[#4A154B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#611565] disabled:opacity-60 transition-colors"
                    >
                      Add to Slack
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── Coming soon placeholder ─────────────────────────────────── */}
            <div className="rounded-xl border border-dashed border-gray-200 p-5 flex flex-col gap-3 opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">More coming soon</p>
                  <p className="text-[10px] text-gray-300">HubSpot, Salesforce, and more</p>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">CRM integrations are on the roadmap.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
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
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  function loadKeys() {
    setIsLoadingKeys(true);
    setKeysError(null);
    setRenameError(null);
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

  function startRename(key: ApiKey) {
    setRenamingId(key.id);
    setRenameValue(key.name);
    setRenameError(null);
    setConfirmRevokeId(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
    setRenameError(null);
  }

  async function handleRename(id: number) {
    const trimmed = renameValue.trim();
    if (!trimmed) { setRenameError("Name is required."); return; }
    if (trimmed.length > 100) { setRenameError("Name must be 100 characters or fewer."); return; }
    setRenameError(null);
    setIsSavingRename(true);
    try {
      const res = await fetch(`${AUTH_BASE}/api-keys/${id}`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json() as { success?: boolean; id?: number; name?: string; error?: string };
      if (!res.ok) { setRenameError(data.error ?? "Failed to rename key."); return; }
      setRenamingId(null);
      setRenameValue("");
      loadKeys();
    } catch {
      setRenameError("Failed to rename key.");
    } finally {
      setIsSavingRename(false);
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
              <div key={key.id} className="px-6 py-3">
                {renamingId === key.id ? (
                  /* ── Inline rename mode ── */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(key.id);
                          if (e.key === "Escape") cancelRename();
                        }}
                        maxLength={100}
                        autoFocus
                        className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                      />
                      <button
                        type="button"
                        disabled={isSavingRename}
                        onClick={() => { void handleRename(key.id); }}
                        className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
                      >
                        {isSavingRename ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                    {renameError && (
                      <p className="text-xs text-red-600">{renameError}</p>
                    )}
                  </div>
                ) : (
                  /* ── Normal display mode ── */
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{key.name}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="shrink-0 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700 cursor-default">Full Access</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">Grants full API access: read live pricing data, submit interview sessions, and manage DocuFill packages programmatically.</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <code className="font-mono">{key.keyPrefix}…</code>
                        {" · "}
                        Created {formatDate(key.createdAt)}
                        {" · "}
                        Last used: {key.lastUsedAt ? formatRelative(key.lastUsedAt) : "Never"}
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
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => startRename(key)}
                          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(key.id)}
                          className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                        >
                          Revoke
                        </button>
                      </div>
                    )}
                  </div>
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
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameFieldError, setNameFieldError] = useState<string | null>(null);
  const [logoSaved, setLogoSaved] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameEdited = useRef(false);
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flashFieldSaved(field: "name" | "logo" | "color") {
    if (field === "name") {
      setNameSaved(true);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      nameSavedTimer.current = setTimeout(() => setNameSaved(false), 3000);
    } else if (field === "logo") {
      setLogoSaved(true);
      if (logoSavedTimer.current) clearTimeout(logoSavedTimer.current);
      logoSavedTimer.current = setTimeout(() => setLogoSaved(false), 3000);
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

  // Auto-save name with 700ms debounce — only fires when user has edited the field
  useEffect(() => {
    if (!nameEdited.current || !org) return;
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(async () => {
      if (!name.trim()) {
        setNameFieldError("Organization name cannot be empty.");
        return;
      }
      setNameFieldError(null);
      try {
        const res = await fetch(`${SETTINGS_BASE}/org`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ name: name.trim() }),
        });
        const data = await res.json() as { org?: ProductOrgSettings; error?: string };
        if (!res.ok) { setNameFieldError(data.error ?? "Failed to save name"); return; }
        if (data.org) { applyOrg(data.org); }
        flashFieldSaved("name");
      } catch { setNameFieldError("Failed to save name. Please try again."); }
    }, 700);
  }, [name]);

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
      flashFieldSaved("color");
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
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your organization's branding and preferences.</p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</div>
      )}

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
      <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
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
              onChange={(e) => { nameEdited.current = true; setName(e.target.value); }}
              placeholder="Your organization name"
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 w-full"
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
              role="button"
              tabIndex={0}
              aria-label={displayLogoUrl ? "Click or drop to replace logo" : "Click or drop to upload logo"}
              onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUploadingLogo) logoInputRef.current?.click(); }}
              onDragOver={handleLogoDragOver}
              onDragLeave={handleLogoDragLeave}
              onDrop={(e) => { void handleLogoDrop(e); }}
              className={[
                "relative flex items-center justify-center rounded-xl border-2 transition-colors cursor-pointer select-none overflow-hidden",
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
            <div className="flex items-center gap-3">
              {displayLogoUrl && (
                <>
                  <button
                    type="button"
                    disabled={isUploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleRemoveLogo(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </>
              )}
              {logoSaved && (
                <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
              )}
            </div>
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

      {/* Billing section */}
      <div id="billing-section">
        <BillingSection getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Team section */}
      <TeamSection getAuthHeaders={getAuthHeaders} />

      {/* Integrations section */}
      <IntegrationsSection getAuthHeaders={getAuthHeaders} />

      {/* API Keys section */}
      <div id="api-keys-section">
        <ApiKeysSection getAuthHeaders={getAuthHeaders} />
      </div>
    </div>
  );
}
