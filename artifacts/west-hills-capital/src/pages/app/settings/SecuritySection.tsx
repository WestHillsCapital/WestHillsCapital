import { useUser } from "@clerk/react";
import { isClerkAPIResponseError } from "@clerk/react/errors";
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

export function SecuritySection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOtherDevices, setSignOutOtherDevices] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const passwordSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [spNew, setSpNew] = useState("");
  const [spConfirm, setSpConfirm] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);
  const [spSaved, setSpSaved] = useState(false);
  const spSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (passwordSavedTimer.current) clearTimeout(passwordSavedTimer.current);
      if (spSavedTimer.current) clearTimeout(spSavedTimer.current);
    };
  }, []);

  async function handleSetPassword() {
    if (!user) return;
    if (spNew !== spConfirm) {
      setSpError("Passwords do not match.");
      return;
    }
    if (spNew.length < 8) {
      setSpError("Password must be at least 8 characters.");
      return;
    }
    setIsSettingPassword(true);
    setSpError(null);
    setSpSaved(false);
    try {
      await user.updatePassword({ newPassword: spNew });
      await user.reload();
      setSpNew("");
      setSpConfirm("");
      setSpSaved(true);
      if (spSavedTimer.current) clearTimeout(spSavedTimer.current);
      spSavedTimer.current = setTimeout(() => setSpSaved(false), 4000);
    } catch (err: unknown) {
      if (isClerkAPIResponseError(err) && err.errors.some(e => e.code === "session_step_up_verification_required")) {
        window.location.href = `/app/sign-in?redirect_url=${encodeURIComponent("/app/settings")}`;
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to set password.";
      setSpError(msg);
    } finally {
      setIsSettingPassword(false);
    }
  }

  async function handlePasswordChange() {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: signOutOtherDevices });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSignOutOtherDevices(false);
      setPasswordSaved(true);
      if (passwordSavedTimer.current) clearTimeout(passwordSavedTimer.current);
      passwordSavedTimer.current = setTimeout(() => setPasswordSaved(false), 4000);
    } catch (err: unknown) {
      if (isClerkAPIResponseError(err) && err.errors.some(e => e.code === "session_step_up_verification_required")) {
        window.location.href = `/app/sign-in?redirect_url=${encodeURIComponent("/app/settings")}`;
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setPasswordError(msg);
    } finally {
      setIsSavingPassword(false);
    }
  }

  const [twoFA, setTwoFA] = useState<TwoFAStatus | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [revokingDeviceId, setRevokingDeviceId] = useState<number | null>(null);
  const [revokeDeviceError, setRevokeDeviceError] = useState<string | null>(null);

  const [setupStep, setSetupStep] = useState<"idle" | "scan" | "verify" | "codes">("idle");
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [disableStep, setDisableStep] = useState<"idle" | "confirm">("idle");
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableBusy, setDisableBusy] = useState(false);

  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      fetch(`${SETTINGS_BASE}/security/2fa/status`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${SETTINGS_BASE}/security/sessions`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${SETTINGS_BASE}/security/login-history`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${SETTINGS_BASE}/security/trusted-devices`, { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([fa, sess, hist, devices]) => {
        const faData      = fa as { enabled?: boolean; backupCodesRemaining?: number; error?: string };
        const sessData    = sess as { sessions?: ActiveSession[]; error?: string };
        const histData    = hist as { history?: LoginEntry[]; error?: string };
        const devicesData = devices as { trustedDevices?: TrustedDevice[]; error?: string };
        const firstError = faData.error ?? sessData.error ?? histData.error ?? devicesData.error;
        if (firstError) { setLoadError(firstError); return; }
        setTwoFA({ enabled: faData.enabled ?? false, backupCodesRemaining: faData.backupCodesRemaining ?? 0 });
        setSessions(sessData.sessions ?? []);
        setLoginHistory(histData.history ?? []);
        setTrustedDevices(devicesData.trustedDevices ?? []);
      })
      .catch(() => setLoadError("Failed to load security info"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleStartSetup() {
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/2fa/setup`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { qrCode?: string; secret?: string; error?: string };
      if (!res.ok) { setSetupError(data.error ?? "Failed to start 2FA setup"); return; }
      setSetupQr(data.qrCode ?? null);
      setSetupSecret(data.secret ?? null);
      setSetupStep("scan");
    } catch { setSetupError("Failed to start 2FA setup"); }
    finally { setSetupBusy(false); }
  }

  async function handleVerifyEnable() {
    if (!setupCode.trim()) { setSetupError("Enter the 6-digit code from your authenticator app."); return; }
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/2fa/enable`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ code: setupCode }),
      });
      const data = await res.json() as { success?: boolean; backupCodes?: string[]; error?: string };
      if (!res.ok) { setSetupError(data.error ?? "Invalid code"); return; }
      setBackupCodes(data.backupCodes ?? []);
      setSetupStep("codes");
      setTwoFA({ enabled: true, backupCodesRemaining: data.backupCodes?.length ?? 8 });
    } catch { setSetupError("Failed to enable 2FA"); }
    finally { setSetupBusy(false); }
  }

  async function handleDisable() {
    if (!disableCode.trim()) { setDisableError("Enter a 6-digit code or backup code to confirm."); return; }
    setDisableBusy(true);
    setDisableError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/2fa`, {
        method: "DELETE",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setDisableError(data.error ?? "Failed to disable 2FA"); return; }
      setTwoFA({ enabled: false, backupCodesRemaining: 0 });
      setDisableStep("idle");
      setDisableCode("");
    } catch { setDisableError("Failed to disable 2FA"); }
    finally { setDisableBusy(false); }
  }

  async function handleRevokeSession(sessionId: number) {
    setRevokingId(sessionId);
    setRevokeError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/sessions/${sessionId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setRevokeError(data.error ?? "Failed to revoke session"); return; }
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch { setRevokeError("Failed to revoke session"); }
    finally { setRevokingId(null); }
  }

  async function handleRevokeTrustedDevice(deviceId: number) {
    setRevokingDeviceId(deviceId);
    setRevokeDeviceError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/security/trusted-devices/${deviceId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setRevokeDeviceError(data.error ?? "Failed to revoke trusted device"); return; }
      setTrustedDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch { setRevokeDeviceError("Failed to revoke trusted device"); }
    finally { setRevokingDeviceId(null); }
  }

  function deviceIcon(device: string, os?: string) {
    const d = (device ?? "").toLowerCase();
    const o = (os ?? "").toLowerCase();
    const isMobile = d === "mobile" || o.includes("android") || (o.includes("ios") && !o.includes("ipad"));
    const isTablet = d === "tablet" || o.includes("ipad");
    if (isMobile) {
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
        </svg>
      );
    }
    if (isTablet) {
      return (
        <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
      </svg>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Security</h2>
        <p className="text-xs text-gray-500 mt-0.5">Manage two-factor authentication, active sessions, and login history.</p>
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
          {/* ── Two-Factor Authentication ─────────────────────────────────────── */}
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Two-factor authentication</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add a second layer of security using an authenticator app like Google Authenticator or Authy.
                </p>
                {twoFA?.enabled && (
                  <p className="text-xs text-green-700 mt-1 font-medium">
                    ✓ Enabled — {twoFA.backupCodesRemaining} backup code{twoFA.backupCodesRemaining !== 1 ? "s" : ""} remaining
                  </p>
                )}
              </div>
              {twoFA?.enabled ? (
                <button
                  type="button"
                  onClick={() => { setDisableStep("confirm"); setDisableCode(""); setDisableError(null); }}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  Disable 2FA
                </button>
              ) : (
                <button
                  type="button"
                  disabled={setupBusy || setupStep !== "idle"}
                  onClick={() => { void handleStartSetup(); }}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors brand-btn-hover"
                  style={{ backgroundColor: bc }}
                >
                  {setupBusy ? "Loading…" : "Enable 2FA"}
                </button>
              )}
            </div>

            {/* Setup flow — scan QR */}
            {setupStep === "scan" && setupQr && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-900">Step 1 — Scan this QR code</p>
                <p className="text-xs text-gray-500">Open your authenticator app and scan the code below, or enter the setup key manually.</p>
                <div className="flex justify-center">
                  <img src={setupQr} alt="TOTP QR code" className="w-40 h-40 rounded-lg border border-gray-200" />
                </div>
                {setupSecret && (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-1">Setup key (manual entry)</p>
                    <p className="text-xs font-mono text-gray-700 select-all break-all">{setupSecret}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setSetupStep("verify")}
                    className="rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-colors brand-btn-hover"
                    style={{ backgroundColor: bc }}
                  >
                    Next — Enter code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSetupStep("idle"); setSetupQr(null); setSetupSecret(null); setSetupError(null); }}
                    className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Setup flow — verify code */}
            {setupStep === "verify" && (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-sm font-medium text-gray-900">Step 2 — Verify the code</p>
                <p className="text-xs text-gray-500">Enter the 6-digit code from your authenticator app to confirm setup.</p>
                {setupError && <p className="text-xs text-red-600">{setupError}</p>}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleVerifyEnable(); }}
                    placeholder="123456"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 w-32"
                  />
                  <button
                    type="button"
                    disabled={setupBusy}
                    onClick={() => { void handleVerifyEnable(); }}
                    className="rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors brand-btn-hover"
                    style={{ backgroundColor: bc }}
                  >
                    {setupBusy ? "Verifying…" : "Enable 2FA"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSetupStep("scan"); setSetupCode(""); setSetupError(null); }}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Setup flow — backup codes */}
            {setupStep === "codes" && backupCodes.length > 0 && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-green-900">2FA is now enabled</p>
                <p className="text-xs text-green-700">Save these backup codes in a safe place. Each code can be used once if you lose access to your authenticator app.</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {backupCodes.map((code) => (
                    <span key={code} className="rounded bg-white border border-green-200 px-2 py-1 text-xs font-mono text-gray-800 text-center">{code}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setSetupStep("idle"); setSetupCode(""); setSetupQr(null); setSetupSecret(null); setBackupCodes([]); }}
                  className="rounded-lg bg-green-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-900 transition-colors"
                >
                  Done — I've saved my codes
                </button>
              </div>
            )}

            {/* Disable flow */}
            {disableStep === "confirm" && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-medium text-red-900">Disable two-factor authentication</p>
                <p className="text-xs text-red-700">Enter a 6-digit code from your authenticator app, or one of your backup codes, to confirm.</p>
                {disableError && <p className="text-xs text-red-600 font-medium">{disableError}</p>}
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleDisable(); }}
                    placeholder="123456 or backup code"
                    className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/20 w-48"
                  />
                  <button
                    type="button"
                    disabled={disableBusy}
                    onClick={() => { void handleDisable(); }}
                    className="rounded-lg bg-red-700 px-4 py-2 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60 transition-colors"
                  >
                    {disableBusy ? "Disabling…" : "Confirm disable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDisableStep("idle"); setDisableCode(""); setDisableError(null); }}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Trusted Devices ───────────────────────────────────────────────── */}
          {twoFA?.enabled && (
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-900">Trusted devices</p>
                <span className="text-xs text-gray-400">{trustedDevices.length === 0 ? "None" : `${trustedDevices.length} active`}</span>
              </div>
              {revokeDeviceError && (
                <p className="text-xs text-red-600 mb-2">{revokeDeviceError}</p>
              )}
              {trustedDevices.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No trusted devices. Check "Remember this device for 30 days" when verifying 2FA to skip the prompt on trusted machines.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
                  {trustedDevices.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 bg-white px-3 py-2.5">
                      {deviceIcon(d.label ?? "", "")}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{d.label || "Unknown device"}</p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {d.ipAddress ?? "Unknown IP"} · Trusted {formatRelative(d.createdAt)} · Expires {formatRelative(d.expiresAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={revokingDeviceId === d.id}
                        onClick={() => { void handleRevokeTrustedDevice(d.id); }}
                        className="shrink-0 rounded border border-red-200 bg-transparent px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
                      >
                        {revokingDeviceId === d.id ? "Revoking…" : "Revoke"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Active Sessions ───────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-3">Active sessions</p>
            {revokeError && (
              <p className="text-xs text-red-600 mb-2">{revokeError}</p>
            )}
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No active sessions recorded yet. Sessions appear here after your next page load.</p>
            ) : (
              <ul className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] overflow-hidden">
                {sessions.map((s) => (
                  <li key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${s.isCurrent ? "bg-gray-50" : "bg-white"}`}>
                    {deviceIcon(s.device, s.os)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${s.isCurrent ? "text-gray-800" : "text-gray-500"}`}>
                        {s.browser} on {s.os}
                        {s.isCurrent && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700 uppercase tracking-wide">Current</span>
                        )}
                      </p>
                      <p className={`text-[11px] truncate ${s.isCurrent ? "text-gray-400" : "text-gray-300"}`}>
                        {s.ipAddress ?? "Unknown IP"}{s.location ? ` · ${s.location}` : ""} · Last active {formatRelative(s.lastActiveAt)}
                      </p>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        disabled={revokingId === s.id}
                        onClick={() => { void handleRevokeSession(s.id); }}
                        className="shrink-0 rounded border border-red-200 bg-transparent px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition-colors"
                      >
                        {revokingId === s.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Login History ─────────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-3">Recent login history</p>
            {loginHistory.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No login history recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[#E2E8F0] rounded-lg border border-[#E2E8F0] overflow-hidden">
                {loginHistory.slice(0, 10).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 bg-white px-3 py-2.5">
                    {deviceIcon(entry.device, entry.os)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-500 truncate">{entry.browser} on {entry.os}</p>
                      <p className="text-[11px] text-gray-300 truncate">
                        {entry.ipAddress ?? "Unknown IP"}{entry.location ? ` · ${entry.location}` : ""} · {formatRelative(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Change Password ───────────────────────────────────────────────── */}
          <div className="px-6 py-5">
            <p className="text-sm font-medium text-gray-900 mb-0.5">{user?.passwordEnabled === false ? "Set a password" : "Change password"}</p>
            {user?.passwordEnabled === false ? (
              <div className="mt-3 max-w-md">
                <p className="text-xs text-gray-500 mb-3">
                  Your account uses social sign-in. You can add a password to also sign in with your email.
                </p>
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sp-new-pw">New password</label>
                    <input
                      id="sp-new-pw"
                      type="password"
                      autoComplete="new-password"
                      value={spNew}
                      onChange={(e) => { setSpNew(e.target.value); setSpError(null); setSpSaved(false); }}
                      placeholder="Enter new password"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sp-confirm-pw">Confirm password</label>
                    <input
                      id="sp-confirm-pw"
                      type="password"
                      autoComplete="new-password"
                      value={spConfirm}
                      onChange={(e) => { setSpConfirm(e.target.value); setSpError(null); setSpSaved(false); }}
                      placeholder="Re-enter new password"
                      onKeyDown={(e) => { if (e.key === "Enter" && spNew && spConfirm && spNew === spConfirm) void handleSetPassword(); }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                  </div>
                  {spError && <p className="text-xs text-red-600">{spError}</p>}
                  {spSaved && <p className="text-xs text-green-600 font-medium">✓ Password set successfully.</p>}
                  {(() => {
                    const ready = !isSettingPassword && !!spNew && !!spConfirm && spNew === spConfirm;
                    return (
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => { void handleSetPassword(); }}
                        className={[
                          "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
                          ready
                            ? "text-white brand-btn-hover cursor-pointer"
                            : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed",
                        ].join(" ")}
                        style={ready ? { backgroundColor: bc } : {}}
                      >
                        {isSettingPassword ? "Setting…" : "Set password"}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="mt-3 max-w-md">
                <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sec-cur-pw">Current password</label>
                    <input
                      id="sec-cur-pw"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); setPasswordSaved(false); }}
                      placeholder="Enter current password"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sec-new-pw">New password</label>
                    <input
                      id="sec-new-pw"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); setPasswordSaved(false); }}
                      placeholder="Enter new password"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="sec-confirm-pw">Confirm new password</label>
                    <input
                      id="sec-confirm-pw"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); setPasswordSaved(false); }}
                      placeholder="Re-enter new password"
                      onKeyDown={(e) => {
                        const ready = !!currentPassword && !!newPassword && !!confirmPassword && newPassword === confirmPassword;
                        if (e.key === "Enter" && ready) void handlePasswordChange();
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={signOutOtherDevices}
                      onChange={(e) => setSignOutOtherDevices(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20"
                    />
                    <span className="text-xs text-gray-600">Sign out all other devices</span>
                  </label>
                </div>
                {(() => {
                  const ready = !isSavingPassword && !!currentPassword && !!newPassword && !!confirmPassword && newPassword === confirmPassword;
                  return (
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() => { void handlePasswordChange(); }}
                        className={[
                          "rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
                          ready
                            ? "text-white brand-btn-hover cursor-pointer"
                            : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed",
                        ].join(" ")}
                        style={ready ? { backgroundColor: bc } : {}}
                      >
                        {isSavingPassword ? "Updating…" : "Update password"}
                      </button>
                      {passwordSaved && <span className="text-xs text-green-600 font-medium">✓ Password updated</span>}
                      {passwordError && <span className="text-xs text-red-600">{passwordError}</span>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
