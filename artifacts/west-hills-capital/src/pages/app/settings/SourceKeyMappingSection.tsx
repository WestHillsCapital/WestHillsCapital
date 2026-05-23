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

export function SourceKeyMappingSection({
  getAuthHeaders,
  isAdmin,
}: { getAuthHeaders: () => HeadersInit; isAdmin: boolean }) {
  const bc       = useBrandColor();
  const DEV_BASE = `${API_BASE}/api/v1/product/developer`;

  const [tab,          setTab]          = useState<"reference" | "edit" | "mappings">("reference");
  const [loading,      setLoading]      = useState(true);
  const [err,          setErr]          = useState<string | null>(null);
  const [groups,       setGroups]       = useState<SkGroup[]>([]);
  const [packages,     setPackages]     = useState<SkPkg[]>([]);
  const [selPkg,       setSelPkg]       = useState<number | null>(null);
  const [mappings,     setMappings]     = useState<SkMappings>({ hubspot: {}, csv: {} });
  const [localMappings,setLocalMappings]= useState<SkMappings>({ hubspot: {}, csv: {} });
  const [editing,       setEditing]       = useState<{ fieldId: string; value: string } | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [savingMaps,    setSavingMaps]    = useState(false);
  const [savedId,       setSavedId]       = useState<string | null>(null);
  const [mapsSaved,     setMapsSaved]     = useState(false);
  const [copyId,        setCopyId]        = useState<string | null>(null);
  const [pendingRename, setPendingRename] = useState<PendingRename | null>(null);

  function load() {
    setLoading(true); setErr(null);
    void Promise.all([
      fetch(`${DEV_BASE}/source-keys`,        { headers: getAuthHeaders() }).then((r) => r.json() as Promise<{ sourceKeys: SkGroup[]; packages: SkPkg[] }>),
      fetch(`${DEV_BASE}/source-key-mappings`, { headers: getAuthHeaders() }).then((r) => r.json() as Promise<{ mappings: SkMappings }>),
    ]).then(([sk, mp]) => {
      const g = sk.sourceKeys ?? [];
      const p = sk.packages   ?? [];
      const m = mp.mappings   ?? { hubspot: {}, csv: {} };
      setGroups(g); setPackages(p); setMappings(m); setLocalMappings(m);
      if (p.length > 0) setSelPkg((prev) => prev ?? p[0].id);
    }).catch(() => setErr("Failed to load source key data"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Fields for the selected package (flattened for the Edit tab)
  const pkgFields = selPkg
    ? groups.flatMap((g) =>
        g.fields
          .filter((f) => f.packageId === selPkg)
          .map((f) => ({
            ...f,
            sourceKey:           g.sourceKey,
            sessionCount:        g.sessionCount,
            packageCount:        g.packageCount,
            builtinHubspotProp:  g.builtinHubspotProperty,
          })),
      )
    : [];

  /** Open the review modal; called by both Save button and Enter key. */
  function openRenameModal(f: typeof pkgFields[number]) {
    if (!editing || editing.value === f.sourceKey || !editing.value.trim()) return;
    const hubspotProperty =
      mappings.hubspot[f.sourceKey] ||
      localMappings.hubspot[f.sourceKey] ||
      f.builtinHubspotProp ||
      null;
    setPendingRename({
      fieldId:      f.fieldId,
      oldKey:       f.sourceKey,
      newKey:       editing.value,
      packageCount: f.packageCount,
      sessionCount: f.sessionCount,
      hubspotProperty,
    });
  }

  async function handleSaveField() {
    if (!editing || !selPkg) return;
    setSaving(true);
    try {
      const res = await fetch(`${DEV_BASE}/source-keys`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ packageId: selPkg, fieldId: editing.fieldId, newSourceKey: editing.value }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setErr(d.error ?? "Save failed"); return; }
      setSavedId(editing.fieldId);
      setTimeout(() => setSavedId(null), 2000);
      setEditing(null);
      load();
    } catch { setErr("Save failed"); }
    finally   { setSaving(false); }
  }

  async function handleSaveMappings() {
    setSavingMaps(true);
    try {
      // Strip empty values before sending
      const clean: SkMappings = {
        hubspot: Object.fromEntries(Object.entries(localMappings.hubspot).filter(([, v]) => v.trim())),
        csv:     Object.fromEntries(Object.entries(localMappings.csv).filter(([, v]) => v.trim())),
      };
      const res = await fetch(`${DEV_BASE}/source-key-mappings`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify(clean),
      });
      if (!res.ok) { setErr("Failed to save mappings"); return; }
      setMappings(clean); setLocalMappings(clean);
      setMapsSaved(true); setTimeout(() => setMapsSaved(false), 3000);
    } catch { setErr("Failed to save mappings"); }
    finally  { setSavingMaps(false); }
  }

  function copyKey(key: string) {
    void navigator.clipboard.writeText(key);
    setCopyId(key); setTimeout(() => setCopyId(null), 1500);
  }

  const tabBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
      active
        ? "bg-white text-gray-900 shadow-sm border border-gray-200"
        : "text-gray-500 hover:text-gray-700"
    }`;

  if (loading) {
    return (
      <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Source Keys</h2>
          <p className="text-xs text-gray-500 mt-0.5">Map prefill keys to fields and external systems.</p>
        </div>
        <div className="px-6 py-10 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

      {/* ── Header + tab strip ──────────────────────────────────────────── */}
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Source Keys</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-md">
            Short identifiers used in API prefill calls. Reference existing keys,
            rename them per package, and map them to HubSpot properties or CSV column headers.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
          <button className={tabBtn(tab === "reference")} onClick={() => setTab("reference")}>Reference</button>
          <button className={tabBtn(tab === "edit")}      onClick={() => setTab("edit")}>Edit</button>
          <button className={tabBtn(tab === "mappings")}  onClick={() => setTab("mappings")}>Mappings</button>
        </div>
      </div>

      {err && (
        <div className="mx-6 mb-0 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{err}</div>
      )}

      {/* ── Reference tab ───────────────────────────────────────────────── */}
      {tab === "reference" && (
        <div className="overflow-x-auto">
          {groups.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-400">No source keys found.</p>
              <p className="text-xs text-gray-400 mt-1">Add fields to a package and assign source keys to see them here.</p>
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-gray-500 text-[10px] uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left font-medium">Source Key</th>
                    <th className="px-4 py-2.5 text-left font-medium">Fields</th>
                    <th className="px-4 py-2.5 text-left font-medium">Packages</th>
                    <th className="px-4 py-2.5 text-left font-medium">Usage</th>
                    <th className="px-4 py-2.5 text-left font-medium">HubSpot</th>
                    <th className="px-4 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groups.map((g) => {
                    const customHs   = mappings.hubspot[g.sourceKey];
                    const hubspot    = customHs ?? g.builtinHubspotProperty;
                    const isBuiltin  = !customHs && !!g.builtinHubspotProperty;
                    const pkgs       = Array.from(new Map(g.fields.map((f) => [f.packageId, f.packageName])));
                    return (
                      <tr key={g.sourceKey} className="group even:bg-slate-50/40 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <code className="font-mono text-[11px] bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 select-all">
                            {g.sourceKey}
                          </code>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          <div className="flex flex-col gap-0.5">
                            {g.fields.slice(0, 2).map((f) => (
                              <span key={f.fieldId} className="truncate max-w-[160px]">{f.fieldLabel}</span>
                            ))}
                            {g.fields.length > 2 && (
                              <span className="text-gray-400">+{g.fields.length - 2} more</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {pkgs.map(([id, name]) => (
                              <span
                                key={id}
                                className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 font-medium truncate max-w-[130px]"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <UsageBadge packageCount={g.packageCount} sessionCount={g.sessionCount} />
                        </td>
                        <td className="px-4 py-2.5">
                          {hubspot ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                isBuiltin
                                  ? "bg-orange-50 text-orange-700 border border-orange-200"
                                  : "bg-orange-50 text-orange-900 border border-orange-300"
                              }`}
                            >
                              <svg className="w-2.5 h-2.5 shrink-0 text-[#FF7A59]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                              </svg>
                              {isBuiltin && <span className="opacity-60 font-normal">built-in ·</span>}
                              <code className="font-mono">{hubspot}</code>
                            </span>
                          ) : (
                            <span className="text-[#64748B]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => copyKey(g.sourceKey)}
                            title="Copy source key"
                            className="rounded p-1 hover:bg-gray-100 text-gray-400 group-hover:text-[#0E1D4A] hover:text-[#0E1D4A] transition-colors"
                          >
                            {copyId === g.sourceKey ? (
                              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
                {groups.length} unique source {groups.length === 1 ? "key" : "keys"} across{" "}
                {packages.length} {packages.length === 1 ? "package" : "packages"}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Edit tab ────────────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div>
          {packages.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-gray-400">No packages found.</div>
          ) : (
            <>
              {/* Package picker */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                <label className="text-xs font-medium text-gray-500 shrink-0">Package</label>
                <select
                  value={selPkg ?? ""}
                  onChange={(e) => { setSelPkg(Number(e.target.value)); setEditing(null); }}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {!isAdmin && (
                  <span className="ml-auto text-[10px] text-gray-400">Admin role required to edit source keys.</span>
                )}
              </div>

              {pkgFields.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs text-gray-400">
                  No fields with source keys in this package.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-medium">Field</th>
                      <th className="px-4 py-2.5 text-left font-medium">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium">Source Key</th>
                      <th className="px-4 py-2.5 text-left font-medium">Usage</th>
                      {isAdmin && <th className="px-4 py-2.5 text-left font-medium w-28" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pkgFields.map((f) => {
                      const isEditing   = editing?.fieldId === f.fieldId;
                      const isSaved     = savedId === f.fieldId;
                      const isSystemKey = (f as unknown as { sourceKey: string }).sourceKey === "esign-system";
                      return (
                        <tr
                          key={f.fieldId}
                          className={`group transition-colors ${isEditing ? "bg-blue-50/30" : "even:bg-slate-50/40 hover:bg-slate-50"}`}
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 shrink-0 flex items-center justify-center">
                                {f.sensitive && (
                                  <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                )}
                              </span>
                              <span className="text-gray-800 font-medium">{f.fieldLabel}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`font-mono rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              (f.fieldType?.toLowerCase() === "signature" || f.fieldType?.toLowerCase() === "initials")
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : f.fieldType?.toLowerCase() === "date"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : (f.fieldType?.toLowerCase() === "number" || f.fieldType?.toLowerCase() === "integer")
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : f.fieldType?.toLowerCase() === "boolean"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-gray-100 text-gray-600 border border-gray-200"
                            }`}>{f.fieldType}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <div className="flex flex-col gap-1">
                                <input
                                  autoFocus
                                  value={editing.value}
                                  onChange={(e) => setEditing({ ...editing, value: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                                  onKeyDown={(e) => { if (e.key === "Enter") openRenameModal(f); if (e.key === "Escape") setEditing(null); }}
                                  placeholder="e.g. firstName"
                                  className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 w-40"
                                />
                                {f.sessionCount >= 10 && (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${f.sessionCount >= 50 ? "text-red-600" : "text-amber-600"}`}>
                                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                    </svg>
                                    Used in {f.sessionCount.toLocaleString()} sessions — renaming affects API prefill
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <code
                                  className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                                    isSaved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                  }`}
                                >
                                  {isSaved ? "✓ saved" : f.sourceKey}
                                </code>
                                {isSystemKey && (
                                  <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <UsageBadge packageCount={f.packageCount} sessionCount={f.sessionCount} />
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-2.5">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => openRenameModal(f)}
                                    disabled={saving}
                                    className="rounded px-2 py-1 text-[10px] font-medium text-white transition-colors disabled:opacity-50"
                                    style={{ backgroundColor: bc }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditing(null)}
                                    className="rounded px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditing({ fieldId: f.fieldId, value: f.sourceKey })}
                                  disabled={isSystemKey}
                                  className="w-16 rounded px-2 py-1 text-[10px] font-medium text-gray-500 border border-gray-200 hover:border-[#0E1D4A] hover:text-[#0E1D4A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:text-gray-500"
                                >
                                  Edit
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Mappings tab ────────────────────────────────────────────────── */}
      {tab === "mappings" && (
        <div>
          <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Define how each source key maps to external system fields.{" "}
              <span className="text-gray-400">
                Built-in HubSpot mappings are shown as placeholders — enter a value to override.
                CSV column headers are used when exporting sessions to a spreadsheet.
              </span>
            </p>
          </div>

          {groups.length === 0 ? (
            <div className="px-6 py-12 text-center text-xs text-gray-400">No source keys found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-medium w-1/4">Source Key</th>
                      <th className="px-4 py-2.5 text-left font-medium w-[37.5%]">
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-[#f77f52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          HubSpot Property
                        </span>
                      </th>
                      <th className="px-4 py-2.5 text-left font-medium w-[37.5%]">CSV Column Header</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groups.map((g) => {
                      const customHs  = localMappings.hubspot[g.sourceKey] ?? "";
                      const customCsv = localMappings.csv[g.sourceKey]     ?? "";
                      return (
                        <tr key={g.sourceKey} className="group even:bg-slate-50/40 hover:bg-slate-50 focus-within:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-2.5">
                            <code className="font-mono text-[11px] bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                              {g.sourceKey}
                            </code>
                          </td>
                          <td className="px-4 py-2.5">
                            {isAdmin ? (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={customHs}
                                  onChange={(e) =>
                                    setLocalMappings((m) => ({ ...m, hubspot: { ...m.hubspot, [g.sourceKey]: e.target.value } }))
                                  }
                                  placeholder={g.builtinHubspotProperty ? `${g.builtinHubspotProperty} (built-in)` : "e.g. firstname"}
                                  list="hs-props-list"
                                  className={`w-full rounded border px-2 py-1 pr-6 text-[11px] font-mono text-gray-700 focus:outline-none focus:ring-1 transition-colors ${
                                    g.builtinHubspotProperty && !customHs
                                      ? "bg-green-50 border-green-200 placeholder-green-700/60 focus:ring-green-300"
                                      : "bg-white border-gray-200 placeholder-gray-300 focus:ring-gray-300"
                                  }`}
                                />
                                {g.builtinHubspotProperty && !customHs && (
                                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-green-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-600 font-mono">
                                {customHs || g.builtinHubspotProperty || <span className="text-gray-300">—</span>}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {isAdmin ? (
                              <input
                                type="text"
                                value={customCsv}
                                onChange={(e) =>
                                  setLocalMappings((m) => ({ ...m, csv: { ...m.csv, [g.sourceKey]: e.target.value } }))
                                }
                                placeholder={g.fields[0]?.fieldLabel ?? g.sourceKey}
                                className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300"
                              />
                            ) : (
                              <span className="text-[11px] text-gray-600">
                                {customCsv || <span className="text-gray-300">—</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <datalist id="hs-props-list">
                  {["email","firstname","lastname","phone","company","address","city","state","zip","jobtitle","website","industry","lifecyclestage","hs_lead_status"].map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              {isAdmin && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-3">
                  <button
                    onClick={() => void handleSaveMappings()}
                    disabled={savingMaps || JSON.stringify(localMappings) === JSON.stringify(mappings)}
                    className="rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-all brand-btn-hover disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: bc }}
                  >
                    {savingMaps ? "Saving…" : "Save changes"}
                  </button>
                  {mapsSaved && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
                  <button
                    onClick={() => setLocalMappings(mappings)}
                    className="ml-auto text-xs font-medium text-[#0E1D4A] hover:text-[#0E1D4A]/70 transition-colors"
                  >
                    Reset
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {pendingRename && (
        <RenameConfirmModal
          pending={pendingRename}
          bc={bc}
          saving={saving}
          onConfirm={() => { void handleSaveField(); setPendingRename(null); }}
          onCancel={() => setPendingRename(null)}
        />
      )}
    </section>
  );
}
