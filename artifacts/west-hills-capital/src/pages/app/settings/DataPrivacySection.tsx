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

export function DataPrivacySection({
  getAuthHeaders,
  isAdmin,
  orgName,
}: {
  getAuthHeaders: () => HeadersInit;
  isAdmin: boolean;
  orgName: string;
}) {
  const bc = useBrandColor();
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }

  const [isLoading,           setIsLoading]           = useState(true);
  const [loadError,           setLoadError]           = useState<string | null>(null);
  const [retentionDays,       setRetentionDays]       = useState<number | null>(null);
  const [pendingRetention,    setPendingRetention]    = useState<number | null>(null);
  const [retentionInitialised, setRetentionInitialised] = useState(false);
  const [deletionRequestedAt, setDeletionRequestedAt] = useState<string | null>(null);
  const [deletionRequestedBy, setDeletionRequestedBy] = useState<string | null>(null);

  const [isExporting,    setIsExporting]    = useState(false);
  const [exportSuccess,  setExportSuccess]  = useState(false);
  const [exportError,    setExportError]    = useState<string | null>(null);

  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [retentionSaved,    setRetentionSaved]    = useState(false);
  const [retentionError,    setRetentionError]    = useState<string | null>(null);

  const [showDeleteDialog, setShowDeleteDialog]   = useState(false);
  const [confirmNameInput, setConfirmNameInput]   = useState("");
  const [isDeleting,       setIsDeleting]         = useState(false);
  const [deleteError,      setDeleteError]        = useState<string | null>(null);
  const [isCancelling,     setIsCancelling]       = useState(false);

  function loadSettings() {
    setIsLoading(true);
    setLoadError(null);
    fetch(`${SETTINGS_BASE}/data-privacy`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as {
          submissionRetentionDays?: number | null;
          deletionRequestedAt?: string | null;
          deletionRequestedBy?: string | null;
          error?: string;
        };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load data & privacy settings"); return; }
        setRetentionDays(data.submissionRetentionDays ?? null);
        setPendingRetention(data.submissionRetentionDays ?? null);
        setRetentionInitialised(true);
        setDeletionRequestedAt(data.deletionRequestedAt ?? null);
        setDeletionRequestedBy(data.deletionRequestedBy ?? null);
      })
      .catch(() => setLoadError("Failed to load data & privacy settings"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadSettings(); }, []);

  async function handleRequestExport() {
    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/data/request-export`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) { setExportError(data.error ?? "Failed to request export."); return; }
      setExportSuccess(true);
    } catch { setExportError("Failed to request export."); }
    finally   { setIsExporting(false); }
  }

  async function handleSaveRetention() {
    setIsSavingRetention(true);
    setRetentionSaved(false);
    setRetentionError(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/data-privacy`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ submissionRetentionDays: pendingRetention }),
      });
      const data = await res.json() as { submissionRetentionDays?: number | null; error?: string };
      if (!res.ok) { setRetentionError(data.error ?? "Failed to save retention setting."); return; }
      setRetentionDays(data.submissionRetentionDays ?? null);
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 3000);
    } catch { setRetentionError("Failed to save retention setting."); }
    finally   { setIsSavingRetention(false); }
  }

  async function handleRequestDeletion() {
    if (confirmNameInput.trim() !== orgName.trim()) {
      setDeleteError(`Type your organization name exactly: "${orgName}"`);
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res  = await fetch(`${SETTINGS_BASE}/data/request-deletion`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ confirmName: confirmNameInput.trim() }),
      });
      const data = await res.json() as { deletionRequestedAt?: string; deletionRequestedBy?: string; error?: string };
      if (!res.ok) { setDeleteError(data.error ?? "Failed to request account deletion."); return; }
      setDeletionRequestedAt(data.deletionRequestedAt ?? new Date().toISOString());
      setDeletionRequestedBy(data.deletionRequestedBy ?? null);
      setShowDeleteDialog(false);
      setConfirmNameInput("");
    } catch { setDeleteError("Failed to request account deletion."); }
    finally   { setIsDeleting(false); }
  }

  async function handleCancelDeletion() {
    setIsCancelling(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/data/cancel-deletion`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (res.ok) {
        setDeletionRequestedAt(null);
        setDeletionRequestedBy(null);
      }
    } catch { /* ignore */ }
    finally { setIsCancelling(false); }
  }

  const retentionChanged = retentionInitialised && pendingRetention !== retentionDays;
  const graceEnd = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <>
      <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {/* Header */}
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Data &amp; Privacy</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your organization&apos;s data, retention, and account lifecycle.
          </p>
        </div>

        {/* Privacy summary */}
        <div className="px-6 py-6">
          <p className="text-sm font-medium text-gray-900 mb-1">Privacy</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Docuplete processes document interview responses on your behalf. Your data is stored securely,
            never sold, and only accessed by Docuplete staff to provide support or comply with legal obligations.{" "}
            <a
              href="https://docuplete.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Read our Privacy Policy →
            </a>
          </p>
        </div>

        {isLoading ? (
          <div className="px-6 py-6 flex justify-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="px-6 py-4">
            <p className="text-xs text-red-700">{loadError}</p>
          </div>
        ) : (
          <>
            {/* Data export */}
            <div className="px-6 py-6">
              <p className="text-sm font-medium text-gray-900 mb-1">Data export</p>
              <p className="text-xs text-gray-500 mb-3">
                Export all your organization&apos;s data — packages, submissions, team members, and settings — as a
                ZIP archive. You&apos;ll receive the download link by email within a few minutes.
              </p>
              {exportError && <p className="mb-2 text-xs text-red-700">{exportError}</p>}
              {isAdmin ? (
                exportSuccess ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-1.5">
                    <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-green-700">Export link requested. Check your inbox in a few minutes.</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={() => { void handleRequestExport(); }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                  >
                    {isExporting && (
                      <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-700 rounded-full animate-spin" />
                    )}
                    {isExporting ? "Generating ZIP Archive…" : "Request data export"}
                  </button>
                )
              ) : (
                <p className="text-xs text-gray-400 italic">Only admins can request a data export.</p>
              )}
            </div>

            {/* Submission retention */}
            <div className="px-6 py-6">
              <p className="text-sm font-medium text-gray-900 mb-1">Submission retention</p>
              <p className="text-xs text-gray-500 mb-3">
                Automatically delete submission records after a set period. Deleted submissions cannot be recovered.
              </p>
              {retentionError && <p className="mb-2 text-xs text-red-700">{retentionError}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <select
                    value={pendingRetention === null ? "null" : String(pendingRetention)}
                    disabled={!isAdmin}
                    onChange={(e) => setPendingRetention(e.target.value === "null" ? null : Number(e.target.value))}
                    className="appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-900/20 disabled:opacity-60 cursor-pointer"
                  >
                    {RETENTION_OPTIONS.map((o) => (
                      <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {isAdmin && retentionChanged && (
                  <button
                    type="button"
                    disabled={isSavingRetention}
                    onClick={() => { void handleSaveRetention(); }}
                    className="rounded-lg px-4 py-1.5 text-sm font-medium text-white transition-colors brand-btn-hover"
                    style={{ backgroundColor: bc }}
                  >
                    {isSavingRetention ? "Saving…" : "Save retention changes"}
                  </button>
                )}
                {retentionSaved && <span className="text-xs text-green-700">Saved</span>}
              </div>
              {!isAdmin && <p className="mt-2 text-xs text-gray-400 italic">Only admins can change the retention period.</p>}
            </div>

            {/* Account deletion — admin only */}
            {isAdmin && (
              <div className="px-6 py-6">
                <p className="text-sm font-medium text-gray-900 mb-1">Delete account</p>
                {deletionRequestedAt ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-800 mb-1">Account deletion scheduled</p>
                    <p className="text-xs text-red-700 mb-3 leading-relaxed">
                      Deletion was requested by{" "}
                      <span className="font-medium">{deletionRequestedBy ?? "an admin"}</span>{" "}
                      on {formatDate(deletionRequestedAt)}.
                      {graceEnd && (
                        <>
                          {" "}Your account and all its data will be permanently deleted on{" "}
                          <span className="font-medium">{formatDate(graceEnd.toISOString())}</span>{" "}
                          unless you cancel.
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={isCancelling}
                      onClick={() => { void handleCancelDeletion(); }}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors"
                    >
                      {isCancelling ? "Cancelling…" : "Cancel deletion"}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                      Permanently delete your organization account, including all packages, submissions, team members,
                      and settings. You have a 7-day grace period to cancel before the deletion is irreversible.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowDeleteDialog(true)}
                      className="rounded-lg border border-red-500 bg-transparent px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white transition-all"
                    >
                      Delete account…
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Deletion confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Delete account</h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              This will permanently delete your organization including all packages, submissions, and team members.
              You will have a <strong>7-day window</strong> to cancel before deletion is irreversible.
            </p>
            <p className="text-xs font-medium text-gray-700 mb-1">
              Type your organization name to confirm:{" "}
              <span className="font-mono text-gray-900">{orgName}</span>
            </p>
            <input
              type="text"
              value={confirmNameInput}
              onChange={(e) => { setConfirmNameInput(e.target.value); setDeleteError(null); }}
              placeholder={orgName}
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-400 mb-2"
            />
            {deleteError && <p className="text-xs text-red-700 mb-2">{deleteError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowDeleteDialog(false); setConfirmNameInput(""); setDeleteError(null); }}
                className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting || confirmNameInput.trim() !== orgName.trim()}
                onClick={() => { void handleRequestDeletion(); }}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "Requesting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
