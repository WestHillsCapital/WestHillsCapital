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
  type DomainStatus,
  type CustomDomainInfo,
  domainStatusBadge,
} from "./settingsUtils";

export function CustomDomainSection({ getAuthHeaders, isAdmin }: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  function authHeaders(contentType?: string): HeadersInit {
    const h = new Headers(getAuthHeaders());
    if (contentType) h.set("Content-Type", contentType);
    return h;
  }
  const bc = useBrandColor();

  const [info, setInfo] = useState<CustomDomainInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; cnames_found: string[] } | null>(null);

  function loadInfo() {
    setIsLoading(true);
    setLoadError(null);
    fetch(`${SETTINGS_BASE}/custom-domain`, { headers: authHeaders() })
      .then(async (r) => {
        const data = await r.json() as CustomDomainInfo & { error?: string };
        if (!r.ok) { setLoadError(data.error ?? "Failed to load custom domain info"); return; }
        setInfo(data);
        setDomainInput(data.custom_domain ?? "");
      })
      .catch(() => setLoadError("Failed to load custom domain info"))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadInfo(); }, []);

  function isApexDomain(domain: string): boolean {
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    const parts = clean.split(".");
    // Common two-part TLDs (co.uk, com.au, etc.)
    const twoPartTlds = ["co.uk","co.nz","co.za","com.au","com.br","com.mx","net.au","org.au"];
    const twoPartTld = twoPartTlds.some((t) => clean.endsWith(`.${t}`));
    const minParts = twoPartTld ? 3 : 2;
    return parts.length <= minParts;
  }

  async function handleSave() {
    setSaveError(null);
    setVerifyResult(null);

    const trimmed = domainInput.trim();
    if (trimmed && isApexDomain(trimmed)) {
      setSaveError(
        `"${trimmed}" is a root domain — DNS doesn't allow CNAME records on root domains. ` +
        `Use a subdomain instead, e.g. "www.${trimmed}" or "forms.${trimmed}".`
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/custom-domain`, {
        method: "PUT",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ domain: trimmed }),
      });
      const data = await res.json() as { custom_domain?: string | null; status?: string; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Failed to save domain."); return; }
      setInfo((prev) => prev ? { ...prev, custom_domain: data.custom_domain ?? null, status: (data.status as DomainStatus) ?? null } : prev);
      setDomainInput(data.custom_domain ?? "");
    } catch { setSaveError("Failed to save domain."); }
    finally { setIsSaving(false); }
  }

  async function handleVerify() {
    setVerifyResult(null);
    setSaveError(null);
    setIsVerifying(true);
    if (info) setInfo({ ...info, status: "verifying" });
    try {
      const res = await fetch(`${SETTINGS_BASE}/custom-domain/verify`, {
        method: "POST",
        headers: authHeaders("application/json"),
        body: "{}",
      });
      const data = await res.json() as { verified?: boolean; status?: string; cnames_found?: string[]; error?: string };
      if (!res.ok) { setSaveError(data.error ?? "Verification failed."); loadInfo(); return; }
      setVerifyResult({ verified: data.verified ?? false, cnames_found: data.cnames_found ?? [] });
      setInfo((prev) => prev ? { ...prev, status: (data.status as DomainStatus) ?? prev.status } : prev);
    } catch { setSaveError("Verification failed. Please try again."); loadInfo(); }
    finally { setIsVerifying(false); }
  }

  async function handleRemove() {
    setSaveError(null);
    setVerifyResult(null);
    setIsSaving(true);
    try {
      const res = await fetch(`${SETTINGS_BASE}/custom-domain`, {
        method: "PUT",
        headers: authHeaders("application/json"),
        body: JSON.stringify({ domain: "" }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setSaveError(d.error ?? "Failed to remove domain."); return; }
      setInfo((prev) => prev ? { ...prev, custom_domain: null, status: null } : prev);
      setDomainInput("");
    } catch { setSaveError("Failed to remove domain."); }
    finally { setIsSaving(false); }
  }

  const isFree = info?.plan_tier === "free";
  const hasDomain = !!info?.custom_domain;
  const status = info?.status ?? null;
  const cnameTarget = info?.cname_target ?? "interview.docuplete.com";
  const domainDirty = domainInput.trim().toLowerCase() !== (info?.custom_domain ?? "");

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Custom domain</h2>
          <p className="text-xs text-gray-500 mt-0.5">Serve interview links from your own subdomain for a fully white-labeled experience.</p>
        </div>
        {!isLoading && hasDomain && domainStatusBadge(status)}
      </div>

      {loadError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{loadError}</p>
        </div>
      )}

      {saveError && (
        <div className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-700">{saveError}</p>
        </div>
      )}

      {isLoading ? (
        <div className="px-6 py-8 flex justify-center">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : isFree ? (
        /* Upgrade prompt for free plan */
        <div className="px-6 py-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Available on Pro &amp; Enterprise</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Upgrade your plan to use a custom subdomain like{" "}
                <span className="font-mono font-medium">forms.yourcompany.com</span> for all interview links.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors whitespace-nowrap"
              onClick={() => document.getElementById("billing-section")?.scrollIntoView({ behavior: "smooth" })}
            >
              Upgrade plan
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Domain input */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Custom subdomain <span className="text-gray-400 font-normal">(e.g. forms.yourcompany.com — root domains not supported)</span></label>
              {isAdmin ? (
                <>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => { setDomainInput(e.target.value); setSaveError(null); setVerifyResult(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && domainDirty) void handleSave(); }}
                      placeholder="forms.yourcompany.com"
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 font-mono placeholder:text-gray-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                    />
                    <button
                      type="button"
                      disabled={isSaving || !domainDirty}
                      onClick={() => { void handleSave(); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap brand-btn-hover disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: bc }}
                    >
                      {isSaving ? "Saving…" : "Save"}
                    </button>
                    {hasDomain && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => { void handleRemove(); }}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">Enter the full subdomain where interviews will be served, e.g. <span className="font-mono">forms.acme.com</span>.</p>
                </>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 font-mono">
                  {hasDomain ? info?.custom_domain : <span className="text-gray-400 font-sans italic">Not configured</span>}
                </div>
              )}
            </div>

            {/* DNS instructions */}
            {hasDomain && (() => {
              const fullDomain = info?.custom_domain ?? "";
              // The subdomain prefix — e.g. "forms" from "forms.acme.com"
              // Some providers want just the prefix; some want the full hostname.
              const dotIndex = fullDomain.indexOf(".");
              const subPrefix = dotIndex > -1 ? fullDomain.slice(0, dotIndex) : fullDomain;
              const rootDomain = dotIndex > -1 ? fullDomain.slice(dotIndex + 1) : "";
              return (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-800 mb-1">Step 1 — Log in to your DNS provider</p>
                    <p className="text-xs text-gray-600">
                      Go to the DNS settings for <span className="font-mono font-medium">{rootDomain || fullDomain}</span> at your domain registrar (GoDaddy, Namecheap, Cloudflare, Route 53, etc.).
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-800 mb-2">Step 2 — Add a new CNAME record</p>
                    <p className="text-xs text-gray-600 mb-2">Create a new record with these exact values:</p>
                    <div className="border-t border-b border-gray-300 overflow-hidden">
                      <table className="text-xs w-full bg-white">
                        <thead className="bg-gray-100 border-b border-gray-200">
                          <tr className="text-gray-500 text-left">
                            <th className="px-3 py-2 font-medium w-1/4">Field</th>
                            <th className="px-3 py-2 font-medium">Value to enter</th>
                            <th className="px-3 py-2 font-medium text-gray-400">Also called</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          <tr>
                            <td className="px-3 py-2.5 text-gray-600 font-medium">Type</td>
                            <td className="px-3 py-2.5"><CopyBadge value="CNAME" /></td>
                            <td className="px-3 py-2.5 text-gray-400">Record type</td>
                          </tr>
                          <tr className="bg-amber-50/40">
                            <td className="px-3 py-2.5 text-gray-600 font-medium">Name / Host</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <CopyBadge value={subPrefix} />
                                <span className="text-gray-400 text-[10px]">or <CopyBadge value={fullDomain} /></span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400">Host, Subdomain, Alias</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2.5 text-gray-600 font-medium">Value / Points to</td>
                            <td className="px-3 py-2.5"><CopyBadge value={cnameTarget} /></td>
                            <td className="px-3 py-2.5 text-gray-400">Target, Destination, Answer</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2.5 text-gray-600 font-medium">TTL</td>
                            <td className="px-3 py-2.5 font-mono text-gray-700">3600</td>
                            <td className="px-3 py-2.5 text-gray-400">Leave as default if unsure</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2 leading-relaxed">
                      <strong>GoDaddy / Namecheap tip:</strong> Use just <CopyBadge value={subPrefix} /> in the Name field — they automatically append your root domain.<br />
                      <strong>Cloudflare tip:</strong> Enter the full hostname <CopyBadge value={fullDomain} /> and make sure the proxy (orange cloud) is <strong>turned OFF</strong> (grey cloud / DNS only).
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-800 mb-1">Step 3 — Save and click Verify below</p>
                    <p className="text-xs text-gray-600">
                      DNS changes usually propagate within a few minutes, but can take up to 48 hours. If Verify fails, wait 5 minutes and try again.
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Status guidance */}
            {hasDomain && (
              <div className="space-y-3">
                {status === "active" && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
                    <span className="font-semibold">Domain is active.</span> New interview links will use{" "}
                    <span className="font-mono">{info?.custom_domain}</span> as their host.
                  </div>
                )}
                {status === "error" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                    <span className="font-semibold">DNS verification failed.</span> Make sure the CNAME record above is saved at your DNS provider, then click Verify again. Changes can take a few minutes to propagate.
                  </div>
                )}
                {status === "unverified" && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <span className="font-semibold">Domain saved but not yet verified.</span> Add the CNAME record above, then click Verify.
                  </div>
                )}
                {verifyResult && verifyResult.verified && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
                    <span className="font-semibold">Verified successfully!</span> Your custom domain is now active.
                  </div>
                )}
                {verifyResult && !verifyResult.verified && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                    <span className="font-semibold">Could not verify DNS.</span>{" "}
                    {verifyResult.cnames_found.length > 0
                      ? <>Found CNAME pointing to <span className="font-mono">{verifyResult.cnames_found[0]}</span> — expected <span className="font-mono">{cnameTarget}</span>.</>
                      : <>No CNAME record found for this domain. Check your DNS settings and try again after a few minutes.</>
                    }
                  </div>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    disabled={isVerifying || !hasDomain}
                    onClick={() => { void handleVerify(); }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {isVerifying ? "Checking DNS…" : status === "active" ? "Re-verify" : "Verify"}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

