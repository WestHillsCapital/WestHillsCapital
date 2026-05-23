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

export function IntegrationsSection({ getAuthHeaders }: { getAuthHeaders: () => HeadersInit }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackDisconnecting, setSlackDisconnecting] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackSuccess, setSlackSuccess] = useState<string | null>(null);

  const [storageConnecting, setStorageConnecting] = useState(false);
  const [storageDisconnecting, setStorageDisconnecting] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageSuccess, setStorageSuccess] = useState<string | null>(null);
  const [storageFolderInput, setStorageFolderInput] = useState("");
  const [storageUpdatingFolder, setStorageUpdatingFolder] = useState(false);

  const [gdriveConnecting, setGdriveConnecting] = useState(false);
  const [gdriveDisconnecting, setGdriveDisconnecting] = useState(false);
  const [gdriveError, setGdriveError] = useState<string | null>(null);
  const [gdriveSuccess, setGdriveSuccess] = useState<string | null>(null);
  const [gdriveFolderInput, setGdriveFolderInput] = useState("");
  const [gdriveUpdatingFolder, setGdriveUpdatingFolder] = useState(false);

  const [hubspotConnecting, setHubspotConnecting] = useState(false);
  const [hubspotDisconnecting, setHubspotDisconnecting] = useState(false);
  const [hubspotError, setHubspotError] = useState<string | null>(null);
  const [hubspotSuccess, setHubspotSuccess] = useState<string | null>(null);

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

    // Handle OAuth callbacks — providers redirect back to this page with ?code=&state=
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");
    const storageProvider = params.get("storage_provider") as "gdrive" | "onedrive" | "dropbox" | null;
    const isStorage  = !!storageProvider;
    const isGdrive   = params.get("gdrive")   === "1";
    const isHubSpot  = params.get("hubspot")  === "1";

    // Clean the URL immediately so params don't linger on refresh
    if (code || state || oauthError || isStorage || isGdrive || isHubSpot) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (isStorage && storageProvider) {
      // Cloud Storage OAuth callback (new provider-agnostic flow)
      if (oauthError === "access_denied") {
        setStorageError("Storage connection was cancelled.");
        return;
      }
      if (code && state) {
        const redirectUri = window.location.origin + window.location.pathname + `?storage_provider=${storageProvider}`;
        setStorageConnecting(true);
        const headers = new Headers(getAuthHeaders());
        headers.set("Content-Type", "application/json");
        fetch(`${SETTINGS_BASE}/integrations/storage/exchange`, {
          method: "POST",
          headers,
          body: JSON.stringify({ provider: storageProvider, code, state, redirectUri }),
        })
          .then(async (r) => {
            const data = await r.json() as { success?: boolean; email?: string; folder_name?: string; error?: string };
            if (!r.ok) { setStorageError(data.error ?? "Failed to connect storage provider."); return; }
            const providerName = storageProvider === "gdrive" ? "Google Drive" : storageProvider === "onedrive" ? "OneDrive" : "Dropbox";
            setStorageSuccess(`Connected ${providerName} as ${data.email ?? "your account"}. Files will be saved to "${data.folder_name ?? "Docuplete Submissions"}".`);
            loadStatus();
          })
          .catch(() => setStorageError("Failed to connect storage provider."))
          .finally(() => setStorageConnecting(false));
      }
      return;
    }

    if (isGdrive) {
      // Google Drive OAuth callback (legacy — kept for backward compat)
      if (oauthError === "access_denied") {
        setGdriveError("Google Drive connection was cancelled.");
        return;
      }
      if (code && state) {
        const redirectUri = window.location.origin + window.location.pathname + "?gdrive=1";
        setGdriveConnecting(true);
        const headers = new Headers(getAuthHeaders());
        headers.set("Content-Type", "application/json");
        fetch(`${SETTINGS_BASE}/integrations/gdrive/exchange`, {
          method: "POST",
          headers,
          body: JSON.stringify({ code, state, redirectUri }),
        })
          .then(async (r) => {
            const data = await r.json() as { success?: boolean; email?: string; folder_name?: string; error?: string };
            if (!r.ok) { setGdriveError(data.error ?? "Failed to connect Google Drive."); return; }
            setGdriveSuccess(`Connected as ${data.email ?? "your Google account"}. Files will be saved to "${data.folder_name ?? "Docuplete Submissions"}".`);
            loadStatus();
          })
          .catch(() => setGdriveError("Failed to connect Google Drive."))
          .finally(() => setGdriveConnecting(false));
      }
      return;
    }

    if (isHubSpot) {
      // HubSpot OAuth callback
      if (oauthError === "access_denied") {
        setHubspotError("HubSpot connection was cancelled.");
        return;
      }
      if (code && state) {
        const redirectUri = window.location.origin + window.location.pathname + "?hubspot=1";
        setHubspotConnecting(true);
        const headers = new Headers(getAuthHeaders());
        headers.set("Content-Type", "application/json");
        fetch(`${SETTINGS_BASE}/integrations/hubspot/exchange`, {
          method: "POST",
          headers,
          body: JSON.stringify({ code, state, redirectUri }),
        })
          .then(async (r) => {
            const data = await r.json() as { success?: boolean; hub_domain?: string; error?: string };
            if (!r.ok) { setHubspotError(data.error ?? "Failed to connect HubSpot."); return; }
            setHubspotSuccess(`Connected to HubSpot portal${data.hub_domain ? ` (${data.hub_domain})` : ""}.`);
            loadStatus();
          })
          .catch(() => setHubspotError("Failed to connect HubSpot."))
          .finally(() => setHubspotConnecting(false));
      }
      return;
    }

    // Slack OAuth callback
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

  async function handleStorageConnect(provider: "gdrive" | "onedrive" | "dropbox") {
    setStorageError(null);
    setStorageConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname + `?storage_provider=${provider}`;
      const res = await fetch(`${SETTINGS_BASE}/integrations/storage/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ provider, redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setStorageError(data.error ?? "Failed to initiate connection."); setStorageConnecting(false); return; }
      window.location.href = data.url;
    } catch {
      setStorageError("Failed to initiate connection.");
      setStorageConnecting(false);
    }
  }

  async function handleStorageDisconnect() {
    setStorageDisconnecting(true);
    setStorageError(null);
    setStorageSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/storage`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setStorageError("Failed to disconnect."); return; }
      loadStatus();
    } catch {
      setStorageError("Failed to disconnect.");
    } finally {
      setStorageDisconnecting(false);
    }
  }

  async function handleStorageUpdateFolder() {
    if (!storageFolderInput.trim()) return;
    setStorageUpdatingFolder(true);
    setStorageError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/storage/folder`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ folderInput: storageFolderInput }),
      });
      const data = await res.json() as { success?: boolean; folder_name?: string; error?: string };
      if (!res.ok) { setStorageError(data.error ?? "Could not update folder."); return; }
      setStorageFolderInput("");
      setStorageSuccess(`Folder updated to "${data.folder_name ?? storageFolderInput}".`);
      loadStatus();
    } catch {
      setStorageError("Failed to update folder.");
    } finally {
      setStorageUpdatingFolder(false);
    }
  }

  async function handleGdriveConnect() {
    setGdriveError(null);
    setGdriveConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname + "?gdrive=1";
      const res = await fetch(`${SETTINGS_BASE}/integrations/gdrive/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setGdriveError(data.error ?? "Failed to initiate Google Drive connection."); setGdriveConnecting(false); return; }
      window.location.href = data.url;
    } catch {
      setGdriveError("Failed to initiate Google Drive connection.");
      setGdriveConnecting(false);
    }
  }

  async function handleGdriveDisconnect() {
    setGdriveDisconnecting(true);
    setGdriveError(null);
    setGdriveSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/gdrive`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setGdriveError("Failed to disconnect Google Drive."); return; }
      loadStatus();
    } catch {
      setGdriveError("Failed to disconnect Google Drive.");
    } finally {
      setGdriveDisconnecting(false);
    }
  }

  async function handleHubSpotConnect() {
    setHubspotError(null);
    setHubspotSuccess(null);
    setHubspotConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname + "?hubspot=1";
      const res = await fetch(`${SETTINGS_BASE}/integrations/hubspot/connect`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ redirectUri }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { setHubspotError(data.error ?? "Failed to initiate HubSpot connection."); setHubspotConnecting(false); return; }
      window.location.href = data.url;
    } catch {
      setHubspotError("Failed to initiate HubSpot connection.");
      setHubspotConnecting(false);
    }
  }

  async function handleHubSpotDisconnect() {
    setHubspotDisconnecting(true);
    setHubspotError(null);
    setHubspotSuccess(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/hubspot`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) { setHubspotError("Failed to disconnect HubSpot."); return; }
      loadStatus();
    } catch {
      setHubspotError("Failed to disconnect HubSpot.");
    } finally {
      setHubspotDisconnecting(false);
    }
  }

  async function handleGdriveUpdateFolder() {
    if (!gdriveFolderInput.trim()) return;
    setGdriveUpdatingFolder(true);
    setGdriveError(null);
    try {
      const res = await fetch(`${SETTINGS_BASE}/integrations/gdrive/folder`, {
        method: "PATCH",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ folderInput: gdriveFolderInput }),
      });
      const data = await res.json() as { success?: boolean; folder_name?: string; error?: string };
      if (!res.ok) { setGdriveError(data.error ?? "Could not update folder."); return; }
      setGdriveFolderInput("");
      setGdriveSuccess(`Folder updated to "${data.folder_name ?? gdriveFolderInput}".`);
      loadStatus();
    } catch {
      setGdriveError("Failed to update folder.");
    } finally {
      setGdriveUpdatingFolder(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Integrations</h2>
        <p className="text-xs text-gray-500 mt-0.5">Connect Docuplete to services your team already uses — Drive, Slack, and CRMs.</p>
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
                  : !status?.slack.available
                    ? <span className="ml-auto inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">Requires Setup</span>
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
                    className="mt-auto w-fit rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    {slackDisconnecting ? "Disconnecting…" : "Disconnect Slack"}
                  </button>
                </>
              ) : !status?.slack.available ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Not enabled on this server. Ask your administrator to configure{" "}
                    <code className="font-mono font-medium">SLACK_CLIENT_ID</code>.
                  </p>
                </div>
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

            {/* ── Cloud Storage section (Google Drive / OneDrive / Dropbox) ── */}
            <div className="rounded-xl border border-gray-200 sm:col-span-2 flex flex-col gap-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cloud Storage</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Connect one provider to auto-save submitted PDF packets. Only one can be active at a time.</p>
              </div>

              {storageConnecting && (
                <div className="px-5 py-3 flex items-center gap-2 text-xs text-gray-500 border-b border-gray-100">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                  Connecting to storage provider…
                </div>
              )}
              {storageError && <div className="px-5 py-2 border-b border-red-100 bg-red-50"><p className="text-xs text-red-600">{storageError}</p></div>}
              {storageSuccess && <div className="px-5 py-2 border-b border-green-100 bg-green-50"><p className="text-xs text-green-700">{storageSuccess}</p></div>}

              {status?.storage?.connected && (
                <div className="px-5 py-3 border-b border-gray-100 bg-white flex flex-col gap-2">
                  <p className="text-xs text-gray-500">
                    Connected as <span className="font-medium text-gray-700">{status.storage.email ?? "your account"}</span>.
                    {" "}Packets are saved to <span className="font-medium text-gray-700">"{status.storage.folder_name ?? "Docuplete Submissions"}"</span>.
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder={
                        status.storage.provider === "dropbox"
                          ? "Enter a Dropbox path (e.g. /My Folder)"
                          : status.storage.provider === "onedrive"
                          ? "Enter an OneDrive item ID to change folder"
                          : "Paste a Google Drive folder URL or ID"
                      }
                      value={storageFolderInput}
                      onChange={(e) => setStorageFolderInput(e.target.value)}
                      className="flex-1 min-w-0 text-xs rounded-lg border border-gray-200 px-3 py-1.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                    <button
                      type="button"
                      disabled={storageUpdatingFolder || !storageFolderInput.trim()}
                      onClick={() => { void handleStorageUpdateFolder(); }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors shrink-0 brand-btn-hover disabled:opacity-60"
                      style={{ backgroundColor: bc }}
                    >
                      {storageUpdatingFolder ? "Updating…" : "Update folder"}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={storageDisconnecting}
                    onClick={() => { void handleStorageDisconnect(); }}
                    className="w-fit rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    {storageDisconnecting ? "Disconnecting…" : "Disconnect storage"}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">

                {/* Google Drive */}
                {(() => {
                  const isConnected = status?.storage?.connected && status.storage.provider === "gdrive";
                  const isAvailable = status?.storage?.available?.gdrive ?? false;
                  const otherConnected = status?.storage?.connected && status.storage.provider !== "gdrive";
                  return (
                    <div className="p-5 flex flex-col gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#1AA260] flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 17.01a5.09 5.09 0 01-3.6-1.49A5.12 5.12 0 011.1 12a5.07 5.07 0 011.49-3.6A5.07 5.07 0 016.18 6.9h2.18V9H6.18a3.01 3.01 0 000 6.02h2.18v2.09H6.18zm11.64 0h-2.18v-2.09h2.18a3.01 3.01 0 000-6.02h-2.18V6.9h2.18a5.07 5.07 0 013.6 1.49A5.09 5.09 0 0122.91 12a5.12 5.12 0 01-1.49 3.52 5.07 5.07 0 01-3.6 1.49zM8.09 13.09v-2.18h7.82v2.18H8.09z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">Google Drive</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${isConnected ? "border-transparent" : !isAvailable || otherConnected ? "border-gray-300" : "border-[#0E1D4A]"}`}
                          style={isConnected ? { backgroundColor: bc } : {}}
                        />
                      </div>
                      {isConnected ? (
                        <p className="text-[11px] text-green-700">Connected as <span className="font-medium">{status?.storage?.email ?? "your account"}</span></p>
                      ) : !isAvailable ? (
                        <p className="text-[11px] text-gray-400">Configure <code className="font-mono">GOOGLE_OAUTH_CLIENT_ID</code> to enable.</p>
                      ) : otherConnected ? (
                        <p className="text-[11px] text-gray-400">Disconnect your current provider first, then connect Google Drive.</p>
                      ) : (
                        <p className="text-[11px] text-gray-500">Save packets directly to a Google Drive folder.</p>
                      )}
                      {!isConnected && isAvailable && !otherConnected && (
                        <button
                          type="button"
                          disabled={storageConnecting}
                          onClick={() => { void handleStorageConnect("gdrive"); }}
                          className="mt-auto rounded-lg bg-[#1AA260] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#158a51] disabled:opacity-60 transition-colors w-fit"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* OneDrive */}
                {(() => {
                  const isConnected = status?.storage?.connected && status.storage.provider === "onedrive";
                  const isAvailable = status?.storage?.available?.onedrive ?? false;
                  const otherConnected = status?.storage?.connected && status.storage.provider !== "onedrive";
                  return (
                    <div className="p-5 flex flex-col gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#0078D4] flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10.327 6.325A6.002 6.002 0 0 1 22 9.5c0 .343-.03.679-.087 1.007A4.5 4.5 0 0 1 19.5 19H6a4 4 0 0 1-.893-7.898A6.002 6.002 0 0 1 10.327 6.325Z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">OneDrive</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${isConnected ? "border-transparent" : !isAvailable || otherConnected ? "border-gray-300" : "border-[#0E1D4A]"}`}
                          style={isConnected ? { backgroundColor: bc } : {}}
                        />
                      </div>
                      {isConnected ? (
                        <p className="text-[11px] text-green-700">Connected as <span className="font-medium">{status?.storage?.email ?? "your account"}</span></p>
                      ) : !isAvailable ? (
                        <p className="text-[11px] text-gray-400">Configure <code className="font-mono">ONEDRIVE_CLIENT_ID</code> to enable.</p>
                      ) : otherConnected ? (
                        <p className="text-[11px] text-gray-400">Disconnect your current provider first, then connect OneDrive.</p>
                      ) : (
                        <p className="text-[11px] text-gray-500">Save packets to Microsoft OneDrive via your Microsoft account.</p>
                      )}
                      {!isConnected && isAvailable && !otherConnected && (
                        <button
                          type="button"
                          disabled={storageConnecting}
                          onClick={() => { void handleStorageConnect("onedrive"); }}
                          className="mt-auto rounded-lg bg-[#0078D4] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#006bbf] disabled:opacity-60 transition-colors w-fit"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Dropbox */}
                {(() => {
                  const isConnected = status?.storage?.connected && status.storage.provider === "dropbox";
                  const isAvailable = status?.storage?.available?.dropbox ?? false;
                  const otherConnected = status?.storage?.connected && status.storage.provider !== "dropbox";
                  return (
                    <div className="p-5 flex flex-col gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#0061FE] flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 2 .5 5.75l5.5 3.5 5.5-3.5L6 2ZM17.5 2 12 5.75l5.5 3.5 5.5-3.5L17.5 2ZM.5 12.75 6 16.5l5.5-3.5-5.5-3.5-5.5 3.25Zm17 0-5.5 3.75 5.5 3.5 5.5-3.5-5.5-3.75ZM6 17.75l5.5 3.5 5.5-3.5-5.5-3.5-5.5 3.5Z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900">Dropbox</p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 transition-all ${isConnected ? "border-transparent" : !isAvailable || otherConnected ? "border-gray-300" : "border-[#0E1D4A]"}`}
                          style={isConnected ? { backgroundColor: bc } : {}}
                        />
                      </div>
                      {isConnected ? (
                        <p className="text-[11px] text-green-700">Connected as <span className="font-medium">{status?.storage?.email ?? "your account"}</span></p>
                      ) : !isAvailable ? (
                        <p className="text-[11px] text-gray-400">Configure <code className="font-mono">DROPBOX_CLIENT_ID</code> to enable.</p>
                      ) : otherConnected ? (
                        <p className="text-[11px] text-gray-400">Disconnect your current provider first, then connect Dropbox.</p>
                      ) : (
                        <p className="text-[11px] text-gray-500">Save packets to your Dropbox account folder.</p>
                      )}
                      {!isConnected && isAvailable && !otherConnected && (
                        <button
                          type="button"
                          disabled={storageConnecting}
                          onClick={() => { void handleStorageConnect("dropbox"); }}
                          className="mt-auto rounded-lg bg-[#0061FE] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[#0050d8] disabled:opacity-60 transition-colors w-fit"
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── HubSpot card ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#FF7A59] flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 8.25V5.87A2.25 2.25 0 0 0 15 3.75H15a2.25 2.25 0 0 0-2.25 2.25v2.37a4.5 4.5 0 0 0-1.31.73L8.1 7.2A3.75 3.75 0 1 0 6.75 9.9l3.26 1.9a4.47 4.47 0 0 0 0 2.44L6.75 16.1A3.75 3.75 0 1 0 8.1 18.8l3.34-1.85a4.5 4.5 0 1 0 5.06-8.7ZM6.75 11.25a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm9-5.25a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">HubSpot CRM</p>
                  <p className="text-[10px] text-gray-400">Create contacts on submission</p>
                </div>
                {status?.hubspot?.connected
                  ? <span className="ml-auto inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-medium text-green-700">Connected</span>
                  : !status?.hubspot?.available
                    ? <span className="ml-auto inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">Requires Setup</span>
                    : <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">Not connected</span>
                }
              </div>

              {hubspotConnecting && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin shrink-0" />
                  Connecting to HubSpot…
                </div>
              )}
              {hubspotError   && <p className="text-xs text-red-600">{hubspotError}</p>}
              {hubspotSuccess && <p className="text-xs text-green-700">{hubspotSuccess}</p>}

              {status?.hubspot?.connected ? (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Connected to HubSpot portal
                    {status.hubspot.hub_domain ? <> — <span className="font-medium text-gray-700">{status.hubspot.hub_domain}</span></> : ""}.
                    Submitting a Docuplete packet with HubSpot enabled will create or update a contact.
                  </p>
                  <button
                    type="button"
                    disabled={hubspotDisconnecting}
                    onClick={() => { void handleHubSpotDisconnect(); }}
                    className="mt-auto w-fit rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    {hubspotDisconnecting ? "Disconnecting…" : "Disconnect HubSpot"}
                  </button>
                </>
              ) : !status?.hubspot?.available ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Not enabled on this server. Ask your administrator to configure{" "}
                    <code className="font-mono font-medium">HUBSPOT_CLIENT_ID</code>.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Automatically create or update a HubSpot CRM contact whenever a Docuplete packet is submitted.
                    Enable the HubSpot channel on any Docuplete package to activate.
                  </p>
                  <div className="mt-auto pt-1">
                    <button
                      type="button"
                      disabled={hubspotConnecting}
                      onClick={() => { void handleHubSpotConnect(); }}
                      className="rounded-lg bg-[#FF7A59] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e8603f] disabled:opacity-60 transition-colors"
                    >
                      Connect HubSpot
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
                  <p className="text-[10px] text-gray-300">Salesforce and more</p>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">More CRM integrations are on the roadmap.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
