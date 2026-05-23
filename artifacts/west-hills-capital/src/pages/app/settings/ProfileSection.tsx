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

export function ProfileSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);

  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nameEdited = useRef(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSaveSeq = useRef(0);

  function applyProfile(p: UserProfile) {
    setProfile(p);
    if (!nameEdited.current) setDisplayName(p.display_name ?? "");
    setEmail(p.email);
  }

  function flashSaved(field: "name" | "email" | "avatar") {
    if (field === "name") {
      setNameSaved(true);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      nameSavedTimer.current = setTimeout(() => setNameSaved(false), 3000);
    } else if (field === "email") {
      setEmailSaved(true);
      if (emailSavedTimer.current) clearTimeout(emailSavedTimer.current);
      emailSavedTimer.current = setTimeout(() => setEmailSaved(false), 3000);
    } else {
      setAvatarSaved(true);
      if (avatarSavedTimer.current) clearTimeout(avatarSavedTimer.current);
      avatarSavedTimer.current = setTimeout(() => setAvatarSaved(false), 3000);
    }
  }

  useEffect(() => {
    setIsLoading(true);
    fetch(`${SETTINGS_BASE}/profile`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as { profile?: UserProfile; error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load profile"); return; }
        if (data.profile) applyProfile(data.profile);
      })
      .catch(() => setLoadError("Failed to load profile"))
      .finally(() => setIsLoading(false));

    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
      if (emailSavedTimer.current) clearTimeout(emailSavedTimer.current);
      if (avatarSavedTimer.current) clearTimeout(avatarSavedTimer.current);
    };
  }, []);

  async function handleDisplayNameSave() {
    if (!nameEdited.current || !profile) return;
    setNameError(null);
    const seq = ++nameSaveSeq.current;
    setIsSavingName(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (seq !== nameSaveSeq.current) return;
      if (!res.ok) { setNameError(data.error ?? "Failed to save name"); return; }
      if (data.profile) { nameEdited.current = false; applyProfile(data.profile); }
      flashSaved("name");
    } catch { if (seq === nameSaveSeq.current) setNameError("Failed to save name."); }
    finally { if (seq === nameSaveSeq.current) setIsSavingName(false); }
  }

  async function handleEmailSave() {
    if (!profile) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    // If the typed value equals the current confirmed email and no pending change
    // is active, there is nothing to do. If a pending change is active but the typed
    // value still equals the confirmed email, also bail — the user hasn't typed a
    // new address, so submitting would just re-trigger state unnecessarily.
    if (trimmed === profile.email.toLowerCase()) {
      setEmailError(null);
      return;
    }
    setEmailError(null);
    setEmailVerificationSent(false);
    setEmailDeliveryFailed(false);
    setIsSavingEmail(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json() as { profile?: UserProfile; email_verification_sent?: boolean; error?: string };
      if (!res.ok) { setEmailError(data.error ?? "Failed to request email change."); return; }
      if (data.profile) applyProfile(data.profile);
      if (data.email_verification_sent) {
        setEmailVerificationSent(true);
      } else if (data.profile?.pending_email) {
        // Email change staged in DB but delivery failed (e.g. email service not configured).
        setEmailDeliveryFailed(true);
      } else {
        flashSaved("email");
      }
    } catch { setEmailError("Failed to request email change."); }
    finally { setIsSavingEmail(false); }
  }

  async function uploadAvatarFile(file: File) {
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setAvatarError("Please upload a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Avatar must be under 5 MB.");
      return;
    }
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile/avatar`, {
        method: "POST",
        headers: { "Content-Type": file.type, ...getAuthHeaders() },
        body: file,
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (!res.ok) { setAvatarError(data.error ?? "Avatar upload failed."); return; }
      if (data.profile) applyProfile(data.profile);
      flashSaved("avatar");
      window.dispatchEvent(new CustomEvent("docuplete:profile-updated"));
    } catch { setAvatarError("Avatar upload failed. Please try again."); }
    finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile/avatar`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (!res.ok) { setAvatarError(data.error ?? "Failed to remove avatar."); return; }
      if (data.profile) applyProfile(data.profile);
      flashSaved("avatar");
      window.dispatchEvent(new CustomEvent("docuplete:profile-updated"));
    } catch { setAvatarError("Failed to remove avatar."); }
    finally { setIsUploadingAvatar(false); }
  }

  async function handleCancelPendingEmail() {
    if (!profile) return;
    setIsSavingEmail(true);
    setEmailVerificationSent(false);
    setEmailDeliveryFailed(false);
    try {
      const res = await fetch(`${SETTINGS_BASE}/profile`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ cancel_pending_email: true }),
      });
      const data = await res.json() as { profile?: UserProfile; error?: string };
      if (!res.ok) return;
      if (data.profile) applyProfile(data.profile);
    } catch { /* noop */ }
    finally { setIsSavingEmail(false); }
  }

  const avatarUrl = profile?.avatar_url ? `${API_BASE}${profile.avatar_url}` : null;
  const initials = ((profile?.display_name ?? profile?.email) || "?").charAt(0).toUpperCase();

  // Handle email verification token from URL (user clicked link in verification email).
  // Lives here so applyProfile() is in scope.
  const [emailVerifiedMsg, setEmailVerifiedMsg] = useState<string | null>(null);
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("verify_email");
    if (!token) return;
    // Don't strip the token from the URL until we get a terminal result, so the user
    // can retry by refreshing if auth isn't ready yet or the network request fails.
    fetch(`${SETTINGS_BASE}/profile/verify-email?token=${encodeURIComponent(token)}`, {
      headers: { ...getAuthHeaders() },
    })
      .then(async (r) => {
        window.history.replaceState({}, "", window.location.pathname);
        const data = await r.json() as { success?: boolean; profile?: UserProfile; error?: string };
        if (!r.ok) { setEmailVerifyError(data.error ?? "Email verification failed."); return; }
        if (data.profile) applyProfile(data.profile);
        setEmailVerifiedMsg(`Your email has been updated to ${data.profile?.email ?? "your new address"}.`);
      })
      .catch(() => {
        setEmailVerifyError("Email verification failed. Please try again.");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section id="profile-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">Your personal display name, email, and avatar.</p>
      </div>

      {emailVerifiedMsg && (
        <div className="px-6 py-3 rounded-lg border border-green-200 bg-green-50 mx-4 mt-3 flex items-start gap-2 text-sm text-green-700">
          <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {emailVerifiedMsg}
        </div>
      )}

      {emailVerifyError && (
        <div className="px-6 py-3 mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{emailVerifyError}</div>
      )}

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : profile ? (
        <>
          {/* Avatar */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0 pt-0.5">
              <label className="text-sm font-medium text-gray-900">Photo</label>
              <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, or WebP · max 5 MB</p>
              {avatarSaved && <span className="text-[11px] text-green-600 font-medium mt-1 block">✓ Saved</span>}
              {avatarError && <span className="text-[11px] text-red-600 mt-1 block">{avatarError}</span>}
            </div>
            <div className="flex items-center gap-4">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatarFile(f); }}
              />
              {/* Avatar circle */}
              <div
                role="button"
                tabIndex={0}
                aria-label={avatarUrl ? "Click to replace photo" : "Click to upload photo"}
                onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !isUploadingAvatar) avatarInputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
                onDragLeave={() => setIsDraggingAvatar(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingAvatar(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void uploadAvatarFile(f);
                }}
                className={[
                  "relative w-16 h-16 rounded-full overflow-hidden flex items-center justify-center cursor-pointer select-none border-2 transition-colors",
                  isDraggingAvatar ? "border-gray-900" : "border-gray-200 hover:border-gray-400",
                  "bg-gray-100",
                ].join(" ")}
              >
                {isUploadingAvatar ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-gray-500">{initials}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={isUploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {avatarUrl ? "Replace" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    disabled={isUploadingAvatar}
                    onClick={() => { void handleRemoveAvatar(); }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Display name */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0 pt-0.5">
              <label className="text-sm font-medium text-gray-900" htmlFor="profile-display-name">Display name</label>
              <p className="text-xs text-gray-400 mt-0.5">Shown to teammates</p>
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => { nameEdited.current = true; setDisplayName(e.target.value); setNameError(null); setNameSaved(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleDisplayNameSave(); }}
                  placeholder="Your name"
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
                <button
                  type="button"
                  disabled={isSavingName || !nameEdited.current}
                  onClick={() => { void handleDisplayNameSave(); }}
                  className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >
                  {isSavingName ? "Saving…" : "Save"}
                </button>
              </div>
              {nameError ? (
                <span className="text-[11px] text-red-600">{nameError}</span>
              ) : nameSaved ? (
                <span className="text-[11px] text-green-600 font-medium">✓ Saved</span>
              ) : null}
            </div>
          </div>

          {/* Email */}
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="w-44 shrink-0 pt-0.5">
              <label className="text-sm font-medium text-gray-900" htmlFor="profile-email">Email address</label>
              <p className="text-xs text-gray-400 mt-0.5">Used to sign in</p>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              {(() => {
                const isPending = !!profile.pending_email;
                const isChanged = email.trim().toLowerCase() !== profile.email.toLowerCase();
                const isBtnDisabled = isSavingEmail || !isChanged || isPending;
                return (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        id="profile-email"
                        type="email"
                        value={email}
                        readOnly={isPending}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(null); setEmailSaved(false); setEmailVerificationSent(false); setEmailDeliveryFailed(false); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !isPending) void handleEmailSave(); }}
                        placeholder="you@company.com"
                        className={[
                          "flex-1 rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none transition-colors",
                          isPending
                            ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
                            : "bg-gray-50 text-gray-900 border-gray-200 focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900",
                        ].join(" ")}
                      />
                      <button
                        type="button"
                        disabled={isBtnDisabled}
                        onClick={() => { void handleEmailSave(); }}
                        className={[
                          "shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150",
                          isBtnDisabled
                            ? "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-[#0E1D4A] text-white border-[#0E1D4A] hover:bg-[#1a2d5a] shadow-sm cursor-pointer",
                        ].join(" ")}
                      >
                        {isSavingEmail ? "Saving…" : "Save"}
                      </button>
                    </div>

                    {emailError && <span className="text-[11px] text-red-600">{emailError}</span>}
                    {emailSaved && <span className="text-[11px] text-green-600 font-medium">✓ Email updated</span>}

                    {/* Persistent pending notice — shown on page load when a change was already staged */}
                    {isPending && !emailVerificationSent && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-amber-800 font-medium">Verification pending</p>
                          {emailDeliveryFailed ? (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Change staged for <strong>{profile.pending_email}</strong>, but the verification email could not be delivered.
                              Please try again or contact your team admin.
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              Click the link sent to <strong>{profile.pending_email}</strong> to confirm the change.
                              Your login remains <strong>{profile.email}</strong> until then.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { void handleCancelPendingEmail(); }}
                          className="text-amber-500 hover:text-amber-700 shrink-0 text-xs leading-none"
                          title="Cancel pending change"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Just-submitted: richer notice naming both addresses */}
                    {emailVerificationSent && isPending && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 flex items-start gap-2">
                        <svg className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-blue-900 font-medium">Verification email sent</p>
                          <p className="text-[11px] text-blue-700 mt-0.5">
                            We sent a confirmation link to <strong>{profile.pending_email}</strong>. Click it to finalize the change.
                            Your login remains <strong>{profile.email}</strong> until verified.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { void handleCancelPendingEmail(); }}
                          className="text-blue-400 hover:text-blue-600 shrink-0 text-xs leading-none"
                          title="Cancel pending change"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
