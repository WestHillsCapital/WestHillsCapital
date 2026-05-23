import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { Button } from "@/components/ui/button";
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

export function TeamSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();
  const { show: showUpgrade } = useUpgradeModal();

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
    setIsInviting(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/team/invite`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json() as { member?: TeamMember; emailSent?: boolean; error?: string; upgrade_required?: boolean; required_plan?: string };
      if (res.status === 402 && data.upgrade_required) {
        showUpgrade({ limitType: "seats", requiredPlan: (data.required_plan as "pro" | "enterprise") ?? "pro" });
        return;
      }
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
          {!isLoading && (
            <div className="mt-1.5 w-24 h-1 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round((seatCount / Math.max(seatLimit, 1)) * 100))}%`,
                  backgroundColor: bc,
                }}
              />
            </div>
          )}
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
            <StyledSelect value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} size="md">
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </StyledSelect>
            <button
              type="button"
              disabled={isInviting}
              onClick={() => { void handleInvite(); }}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors brand-btn-hover"
              style={{ backgroundColor: bc }}
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
                      <>
                        <span className="text-[10px] text-amber-600 font-medium">Pending invitation</span>
                        {member.invited_at && (
                          <span className="text-[10px] text-gray-400">&middot; {formatDate(member.invited_at)}</span>
                        )}
                        {member.invited_by && (
                          <span className="text-[10px] text-gray-400">&middot; Invited by {member.invited_by}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-gray-400">
                          {member.invited_at
                            ? `Joined ${formatDate(member.invited_at)}`
                            : `Last seen ${formatRelative(member.last_seen_at)}`}
                        </span>
                        {isAdmin && member.invited_by && (
                          <span className="text-[10px] text-gray-400">&middot; Invited by {member.invited_by}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Admin controls */}
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <StyledSelect
                      value={member.role}
                      disabled={changingRoleId === member.id}
                      onChange={(e) => { void handleChangeRole(member.id, e.target.value); }}
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </StyledSelect>

                    {confirmRemoveId === member.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600 whitespace-nowrap">Remove?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={removingId === member.id}
                          onClick={() => { void handleRemove(member.id); }}
                          className="h-7 px-2.5 text-xs"
                        >
                          {removingId === member.id ? "…" : "Yes"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmRemoveId(null)}
                          className="h-7 px-2.5 text-xs"
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setConfirmRemoveId(member.id); setActionError(null); }}
                        title="Remove member"
                        className="h-7 w-7"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </Button>
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
