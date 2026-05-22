import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Entity, TransactionType, FieldLibraryItem, FieldVersionRow, FieldAnalytics, FieldGroup, ComplianceTag } from "@/lib/docuplete-local-types";
import type { FieldItem } from "@/lib/docuplete-types";

function HL({ children }: { children: string }) {
  return (
    <span className="absolute -top-[9px] left-1.5 z-10 text-[9px] text-[#8A9BB8] font-medium bg-[#FDFCFA] px-0.5 leading-none pointer-events-none tracking-wide">{children}</span>
  );
}

export type FieldLibraryImportField = {
  id?: string;
  label: string;
  category?: string;
  type?: string;
  source?: string;
  options?: string[];
  sensitive?: boolean;
  required?: boolean;
  validationType?: string;
  validationPattern?: string | null;
  validationMessage?: string | null;
  active?: boolean;
  sortOrder?: number;
  complianceTags?: string[];
};

export type FieldLibraryImportGroup = {
  name: string;
  description?: string | null;
  fieldIds?: string[];
  sortOrder?: number;
};

export type FieldLibraryImportPayload = {
  version?: number;
  fields: FieldLibraryImportField[];
  fieldGroups?: FieldLibraryImportGroup[];
};

export type FieldLibraryImportResult = {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
  groupsAdded?: number;
  groupsSkipped?: number;
};

// ─── Tiny SVG sparkline ───────────────────────────────────────────────────────
function Sparkline({ data }: { data: Array<{ date: string; count: number }> }) {
  const W = 72, H = 18;
  if (data.length === 0) {
    return <svg width={W} height={H} aria-hidden><line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#D1D5DB" strokeWidth={1} /></svg>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  if (data.length === 1) {
    const y = H - (data[0].count / max) * (H - 4) - 2;
    return <svg width={W} height={H} aria-hidden><circle cx={W / 2} cy={y} r={2} fill="#1B4FD8" /></svg>;
  }
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.count / max) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={W} height={H} aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke="#1B4FD8" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Analytics panel inside a field card ─────────────────────────────────────
function FieldAnalyticsPanel({ analytics, isSensitive }: { analytics: FieldAnalytics; isSensitive: boolean }) {
  const answerPct = analytics.answerRate !== null ? Math.round(analytics.answerRate * 100) : null;
  return (
    <div className="rounded border border-[#E0D8CC] bg-[#F5F2EC] px-2.5 py-2 text-[11px] space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="font-semibold text-[#0B1220] text-xs">{analytics.packageCount}</div>
          <div className="text-[#8A9BB8]">packages</div>
        </div>
        <div>
          <div className="font-semibold text-[#0B1220] text-xs">{analytics.answerCount.toLocaleString()}</div>
          <div className="text-[#8A9BB8]">answers</div>
        </div>
        <div>
          <div className="font-semibold text-[#0B1220] text-xs">{answerPct !== null ? `${answerPct}%` : "—"}</div>
          <div className="text-[#8A9BB8]">answer rate</div>
        </div>
      </div>
      {analytics.histogram.length > 0 && (
        <div>
          <div className="text-[10px] text-[#8A9BB8] mb-1">Last 30 days</div>
          <Sparkline data={analytics.histogram} />
        </div>
      )}
      {!isSensitive && analytics.topValues.length > 0 && (
        <div>
          <div className="text-[10px] text-[#8A9BB8] mb-1">Top answers</div>
          <ul className="space-y-0.5">
            {analytics.topValues.slice(0, 5).map((tv) => (
              <li key={tv.value} className="flex items-center gap-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#1B4FD8] shrink-0"
                  style={{ width: `${Math.round((tv.count / analytics.topValues[0].count) * 48)}px` }}
                />
                <span className="truncate text-[#4A5568] max-w-[120px]">{tv.value}</span>
                <span className="ml-auto text-[#8A9BB8] shrink-0">{tv.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isSensitive && (
        <p className="text-[10px] text-[#8A9BB8] italic">Raw values hidden — field is marked sensitive.</p>
      )}
    </div>
  );
}

// ─── Field Groups Panel ───────────────────────────────────────────────────────
export function FieldGroupsPanel({
  items,
  fieldLibrary,
  onAdd,
  onChange,
  onSave,
  onDelete,
  onUseGroup,
}: {
  items: FieldGroup[];
  fieldLibrary: FieldLibraryItem[];
  onAdd: () => Promise<string | null>;
  onChange: (id: number, patch: Partial<FieldGroup>) => void;
  onSave: (item: FieldGroup) => Promise<string | null>;
  onDelete: (id: number) => Promise<string | null>;
  onUseGroup?: (group: FieldGroup) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: FieldGroup) {
    setSavingId(item.id);
    setPanelError(null);
    setSavedId(null);
    const err = await onSave(item);
    setSavingId(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  async function handleDelete(item: FieldGroup) {
    if (!confirm(`Delete group "${item.name}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    setPanelError(null);
    const err = await onDelete(item.id);
    setDeletingId(null);
    if (err) setPanelError(err);
  }

  function toggleField(item: FieldGroup, fieldId: string) {
    const next = item.fieldIds.includes(fieldId)
      ? item.fieldIds.filter((id) => id !== fieldId)
      : [...item.fieldIds, fieldId];
    onChange(item.id, { fieldIds: next });
  }

  const filteredLibrary = fieldSearch.trim()
    ? fieldLibrary.filter((f) => f.label.toLowerCase().includes(fieldSearch.toLowerCase()) || f.category.toLowerCase().includes(fieldSearch.toLowerCase()))
    : fieldLibrary;

  const byCategory = filteredLibrary.reduce<Record<string, FieldLibraryItem[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Field Groups</h3>
          <p className="text-[11px] text-[#8A9BB8]">Bundle common fields for one-click addition to any package.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#4A5568] hover:text-[#0F1C3F] hover:border-[#0F1C3F] disabled:opacity-50 transition-colors flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          {adding ? "Adding…" : "Add Group"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="mb-2 relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input type="text" placeholder="Search groups…" value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} className="w-full h-8 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-2 bg-white focus:outline-none focus:border-[#1B4FD8]" />
      </div>
      {items.length === 0 && <div className="text-xs text-[#8A9BB8]">No field groups yet. Add one to bundle fields for fast package setup.</div>}
      <div className="grid md:grid-cols-2 gap-2 items-stretch">
        {items.filter((i) => !groupSearch.trim() || i.name.toLowerCase().includes(groupSearch.toLowerCase())).map((item) => {
          const isExpanded = expandedId === item.id;
          const memberCount = item.fieldIds.length;
          const usagePackages = item.usagePackages ?? [];
          return (
            <div key={item.id} className="flex flex-col rounded border border-[#EFE8D8] bg-[#F8F6F0] p-2 overflow-hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 overflow-hidden">
                  {isExpanded ? (
                    <Input
                      value={item.name}
                      onChange={(e) => onChange(item.id, { name: e.target.value })}
                      className="h-7 text-xs bg-white font-medium"
                    />
                  ) : (
                    <div className="text-xs font-medium text-[#0F1C3F] truncate">{item.name}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#EBF0FB] text-[#1B4FD8] text-[9px] font-semibold leading-none shrink-0">
                      {memberCount} field{memberCount !== 1 ? "s" : ""}
                    </span>
                    {memberCount > 0 && (
                      <span className="text-[10px] text-[#8A9BB8] truncate min-w-0">
                        {item.fieldIds.slice(0, 3).map((id) => fieldLibrary.find((f) => f.id === id)?.label ?? id).join(", ")}
                        {memberCount > 3 ? ` +${memberCount - 3} more` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {usagePackages.length === 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#F0F0EF] text-[#B0BCCE] text-[9px] font-medium leading-none">No packages</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#059669] text-[9px] font-semibold leading-none shrink-0">
                          {usagePackages.length}p
                        </span>
                        <span className="text-[10px] text-[#6B7A99] truncate min-w-0">
                          {usagePackages.slice(0, 3).map((p) => p.name).join(", ")}
                          {usagePackages.length > 3 ? ` +${usagePackages.length - 3} more` : ""}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded hover:bg-[#EFE8D8] text-[#8A9BB8] hover:text-[#4A5568] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                  </svg>
                </button>
              </div>
              {isExpanded && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    placeholder="Description (optional)"
                    value={item.description ?? ""}
                    onChange={(e) => onChange(item.id, { description: e.target.value || null })}
                    className="min-h-12 text-xs bg-white"
                  />
                  <div className="text-[11px] font-medium text-[#4A5568] mt-1">Fields in this group</div>
                  <Input
                    placeholder="Search fields…"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="h-7 text-xs bg-white"
                  />
                  <div className="max-h-52 overflow-y-auto rounded border border-[#E8E0D4] bg-white text-[11px]">
                    {Object.keys(byCategory).sort().map((cat) => (
                      <div key={cat}>
                        <div className="sticky top-0 bg-[#F5F2EC] border-b border-[#EFE8D8] px-2 py-0.5 text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide">{cat}</div>
                        {byCategory[cat].map((f) => (
                          <label key={f.id} className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[#F5F2EC]">
                            <input
                              type="checkbox"
                              checked={item.fieldIds.includes(f.id)}
                              onChange={() => toggleField(item, f.id)}
                              className="shrink-0"
                            />
                            <span className={`truncate ${item.fieldIds.includes(f.id) ? "text-[#0F1C3F] font-medium" : "text-[#4A5568]"}`}>{f.label}</span>
                            {f.inherited && <span className="ml-1 shrink-0 text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1 rounded" title={`Inherited from ${f.inheritedFrom ?? "parent account"}`}>inherited</span>}
                            {f.sensitive && <span className="ml-auto shrink-0 text-[9px] bg-red-100 text-red-600 px-1 rounded">sensitive</span>}
                          </label>
                        ))}
                      </div>
                    ))}
                    {filteredLibrary.length === 0 && (
                      <div className="px-2 py-3 text-[#8A9BB8] text-center">No fields match "{fieldSearch}"</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="text-[11px] text-red-500 disabled:opacity-50"
                    >
                      {deletingId === item.id ? "Deleting…" : "Delete"}
                    </button>
                    <div className="flex items-center gap-3">
                      {onUseGroup && (
                        <button
                          type="button"
                          onClick={() => onUseGroup(item)}
                          title="Add all group fields to current package"
                          className="text-[11px] text-[#1B4FD8] hover:underline"
                        >
                          Use
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSave(item)}
                        disabled={savingId === item.id}
                        className="text-[11px] text-[#C49A38] disabled:opacity-50"
                      >
                        {savingId === item.id ? "Saving…" : savedId === item.id ? "✓ Saved" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {items.length > 0 && groupSearch.trim() && !items.some((i) => i.name.toLowerCase().includes(groupSearch.toLowerCase())) && (
          <div className="text-xs text-[#8A9BB8] col-span-2">No groups match "{groupSearch}".</div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="rounded border border-dashed border-[#D4C9B5] bg-white p-8 text-center text-sm text-[#6B7A99]">{message}</div>;
}

export function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#DDD5C4] bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-[#6B7A99]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[#8A9BB8]">{detail}</div>
    </div>
  );
}

export function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-[#6B7A99] mb-1">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function EntityPanel({
  title,
  items,
  onAdd,
  onChange,
  onSave,
  onDelete,
  showKind,
  kindSuggestions,
}: {
  title: string;
  items: Entity[];
  onAdd: () => Promise<string | null>;
  onChange: (id: number, patch: Partial<Entity>) => void;
  onSave: (item: Entity) => Promise<string | null>;
  onDelete?: (id: number) => Promise<string | null>;
  showKind?: boolean;
  kindSuggestions?: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [entitySearch, setEntitySearch] = useState("");

  const filteredEntities = entitySearch.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(entitySearch.toLowerCase()))
    : items;

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: Entity) {
    setSavingId(item.id);
    setPanelError(null);
    setSavedId(null);
    const err = await onSave(item);
    setSavingId(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  async function handleDelete(item: Entity) {
    if (!onDelete) return;
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    setPanelError(null);
    const err = await onDelete(item.id);
    setDeletingId(null);
    if (err) setPanelError(err);
  }

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={handleAdd} disabled={adding} className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#4A5568] hover:text-[#0F1C3F] hover:border-[#0F1C3F] disabled:opacity-50 transition-colors flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          {adding ? "Adding…" : `Add ${title.replace(/s$/, "")}`}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="mb-2 relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input type="text" placeholder="Search…" value={entitySearch} onChange={(e) => setEntitySearch(e.target.value)} className="w-full h-7 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-2 bg-white focus:outline-none focus:border-[#1B4FD8]" />
      </div>
      <div className="grid md:grid-cols-2 gap-2 items-stretch text-sm">
        {filteredEntities.map((item) => (
          <div key={item.id} className="flex flex-col rounded bg-[#F8F6F0] border border-[#EFE8D8] overflow-hidden">
            <div className="p-2 space-y-2 flex-1">
              <Input value={item.name} onChange={(e) => onChange(item.id, { name: e.target.value })} className="h-8 text-xs bg-white" placeholder="Group name" />
              {showKind && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF] uppercase">Category</span>
                  <input
                    type="text"
                    list={`kind-suggestions-${item.id}`}
                    value={item.kind ?? "general"}
                    onChange={(e) => onChange(item.id, { kind: e.target.value })}
                    placeholder="e.g. Vendor, Partner…"
                    className="w-full border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-[#1B4FD8]"
                  />
                  {kindSuggestions && kindSuggestions.length > 0 && (
                    <datalist id={`kind-suggestions-${item.id}`}>
                      {kindSuggestions.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF] uppercase">Phone number</span>
                  <Input placeholder="—" value={item.phone ?? ""} onChange={(e) => onChange(item.id, { phone: e.target.value })} className="h-8 text-xs bg-white" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF] uppercase">Email address</span>
                  <Input placeholder="—" value={item.email ?? ""} onChange={(e) => onChange(item.id, { email: e.target.value })} className="h-8 text-xs bg-white" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold tracking-wider text-[#9CA3AF] uppercase">Status</span>
                  <label className="flex items-center gap-1.5 h-8 text-[11px] text-[#6B7A99] cursor-pointer">
                    <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} className="accent-[#0F1C3F]" />
                    Active
                  </label>
                </div>
              </div>
            </div>
            {/* Footer action bar */}
            <div className="flex items-center justify-between gap-2 px-2 py-2 border-t border-[#E0D8CC] bg-[#EDE9E1]">
              <span className="text-[10px] font-mono text-[#B0BCCE]">id:{item.id}</span>
              <div className="flex items-center gap-1.5">
                {onDelete && (
                  <button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.id} className="h-7 px-2.5 text-[11px] rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button type="button" onClick={() => handleSave(item)} disabled={savingId === item.id} className="h-7 px-2.5 text-[11px] font-medium rounded border border-[#C49A38] bg-[#C49A38] text-white hover:bg-[#A07820] hover:border-[#A07820] disabled:opacity-50 transition-colors">
                  {savingId === item.id ? "Saving…" : savedId === item.id ? "✓ Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">None yet.</div>}
        {items.length > 0 && filteredEntities.length === 0 && <div className="text-xs text-[#8A9BB8]">No results for "{entitySearch}".</div>}
      </div>
    </div>
  );
}

export function TransactionTypesPanel({
  items,
  groups,
  onAdd,
  onChange,
  onSave,
  onDelete,
}: {
  items: TransactionType[];
  groups: Entity[];
  onAdd: () => Promise<string | null>;
  onChange: (scope: string, patch: Partial<TransactionType>) => void;
  onSave: (item: TransactionType) => Promise<string | null>;
  onDelete?: (scope: string) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [savedScope, setSavedScope] = useState<string | null>(null);
  const [deletingScope, setDeletingScope] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const availableGroups = groups.filter((g) => g.active !== false);
  const q = searchQuery.trim().toLowerCase();
  const visibleItems = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: TransactionType) {
    setSavingScope(item.scope);
    setPanelError(null);
    setSavedScope(null);
    const err = await onSave(item);
    setSavingScope(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedScope(item.scope);
      setTimeout(() => setSavedScope(null), 2000);
    }
  }

  async function handleDelete(item: TransactionType) {
    if (!onDelete) return;
    if (!confirm(`Delete type "${item.label}"? This cannot be undone.`)) return;
    setDeletingScope(item.scope);
    setPanelError(null);
    const err = await onDelete(item.scope);
    setDeletingScope(null);
    if (err) setPanelError(err);
  }

  function toggleGroup(item: TransactionType, groupId: number) {
    const current = item.group_ids ?? [];
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    onChange(item.scope, { group_ids: next });
  }

  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpenScope, setMenuOpenScope] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpenScope) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenScope(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenScope]);

  async function handleBlurSave(item: TransactionType) {
    setSavingScope(item.scope);
    setPanelError(null);
    setSavedScope(null);
    const err = await onSave(item);
    setSavingScope(null);
    if (err) setPanelError(err);
    else { setSavedScope(item.scope); setTimeout(() => setSavedScope(null), 1500); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Transaction Types</h3>
          <p className="text-[11px] text-[#8A9BB8]">Types with no groups assigned are universal — visible to all packages.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#4A5568] hover:text-[#0F1C3F] hover:border-[#0F1C3F] disabled:opacity-50 transition-colors flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          {adding ? "Adding…" : "Add Type"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="relative mb-2">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input type="text" placeholder="Search types…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-8 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-6 bg-white focus:outline-none focus:border-[#1B4FD8]" />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#B0BCCE] hover:text-[#6B7A99]">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Ledger table */}
      <div className="rounded border border-[#DDD5C4]" style={{ overflow: "clip" }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F2EC] border-b border-[#DDD5C4] text-[9px] font-semibold text-[#8A9BB8] uppercase tracking-wider">
          <span className="flex-1">Label</span>
          <span className="w-14 text-center shrink-0">Sort</span>
          {availableGroups.length > 0 && <span className="shrink-0 w-40">Groups</span>}
          <span className="w-12 text-center shrink-0">Active</span>
          <span className="w-6 shrink-0" />
        </div>
        <div className="divide-y divide-[#EFE8D8]">
          {visibleItems.map((item) => {
            const assignedGroupIds = item.group_ids ?? [];
            const isSaving = savingScope === item.scope;
            const isSaved = savedScope === item.scope;
            const isDeleting = deletingScope === item.scope;
            const menuOpen = menuOpenScope === item.scope;
            return (
              <div key={item.scope} className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${isDeleting ? "opacity-40 pointer-events-none" : "hover:bg-[#FDFCFA]"}`}>
                {/* Label */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => onChange(item.scope, { label: e.target.value })}
                    onBlur={(e) => void handleBlurSave({ ...item, label: e.target.value })}
                    className="w-full h-7 text-xs rounded border border-transparent bg-transparent hover:border-[#D4C9B5] focus:border-[#1B4FD8] focus:bg-white px-1.5 focus:outline-none transition-colors"
                    placeholder="Label"
                  />
                </div>
                {/* Sort */}
                <div className="w-14 shrink-0">
                  <input
                    type="number"
                    value={item.sort_order}
                    onChange={(e) => onChange(item.scope, { sort_order: Number(e.target.value || 0) })}
                    onBlur={(e) => void handleBlurSave({ ...item, sort_order: Number(e.target.value || 0) })}
                    className="w-full h-7 text-xs text-center rounded border border-transparent bg-transparent hover:border-[#D4C9B5] focus:border-[#1B4FD8] focus:bg-white px-1 focus:outline-none transition-colors"
                  />
                </div>
                {/* Groups */}
                {availableGroups.length > 0 && (
                  <div className="w-40 shrink-0 flex flex-wrap gap-0.5 items-center">
                    {availableGroups.map((g) => {
                      const checked = assignedGroupIds.includes(g.id as number);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            const current = item.group_ids ?? [];
                            const next = current.includes(g.id as number) ? current.filter((id) => id !== g.id) : [...current, g.id as number];
                            onChange(item.scope, { group_ids: next });
                            void handleBlurSave({ ...item, group_ids: next });
                          }}
                          className={`text-[9px] rounded px-1 py-0.5 border leading-none transition-colors ${checked ? "bg-[#0F1C3F] border-[#0F1C3F] text-white" : "bg-white border-[#D4C9B5] text-[#8A9BB8] hover:border-[#C49A38] hover:text-[#C49A38]"}`}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                    {assignedGroupIds.length === 0 && (
                      <span className="text-[9px] text-[#B0BCCE] italic leading-none">universal</span>
                    )}
                  </div>
                )}
                {/* Active */}
                <div className="w-12 shrink-0 flex justify-center">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => {
                      const newActive = e.target.checked;
                      onChange(item.scope, { active: newActive });
                      void handleBlurSave({ ...item, active: newActive });
                    }}
                    className="accent-[#0F1C3F] cursor-pointer"
                  />
                </div>
                {/* Status / menu */}
                <div className="w-6 shrink-0 flex items-center justify-center relative">
                  {isSaving ? (
                    <svg className="w-3.5 h-3.5 text-[#B0BCCE] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  ) : isSaved ? (
                    <svg className="w-3.5 h-3.5 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  ) : (
                    <div ref={menuOpen ? menuRef : null} className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuOpenScope(menuOpen ? null : item.scope)}
                        className="flex items-center justify-center w-6 h-6 rounded text-[#C4B99A] hover:text-[#6B7A99] hover:bg-[#EFE8D8] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                      </button>
                      {menuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-[#DDD5C4] rounded shadow-lg z-30 py-1 text-[11px]">
                          <div className="px-2.5 py-1 text-[9px] font-mono text-[#B0BCCE] border-b border-[#EFE8D8] truncate">{item.scope}</div>
                          {onDelete && (
                            <button type="button" onClick={() => void handleDelete(item)} className="w-full text-left px-2.5 py-1.5 text-red-600 hover:bg-red-50">
                              Delete type
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div className="px-4 py-6 text-xs text-[#8A9BB8] text-center">No types yet. Click Add Type to create one.</div>}
          {items.length > 0 && visibleItems.length === 0 && <div className="px-4 py-6 text-xs text-[#8A9BB8] text-center">No results for "{searchQuery}".</div>}
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function diffSummary(
  older: Partial<FieldLibraryItem> | undefined,
  newer: Partial<FieldLibraryItem> & { restoredFromVersion?: number },
): string {
  if (!older) return "Initial save";
  if (newer.restoredFromVersion != null) return `Restored from v${newer.restoredFromVersion}`;
  const lines: string[] = [];
  const q = (v: unknown) => (typeof v === "string" ? `"${v}"` : String(v ?? ""));
  if (older.label !== newer.label)
    lines.push(`Label: ${q(older.label)} → ${q(newer.label)}`);
  if (older.category !== newer.category)
    lines.push(`Category: ${q(older.category)} → ${q(newer.category)}`);
  if (older.type !== newer.type)
    lines.push(`Type: ${older.type} → ${newer.type}`);
  if (older.source !== newer.source)
    lines.push(`Prefill source: ${q(older.source)} → ${q(newer.source)}`);
  if (older.active !== newer.active)
    lines.push(`Active: ${older.active ? "on" : "off"} → ${newer.active ? "on" : "off"}`);
  if (older.required !== newer.required)
    lines.push(`Required: ${older.required ? "on" : "off"} → ${newer.required ? "on" : "off"}`);
  if (older.sensitive !== newer.sensitive)
    lines.push(`Sensitive: ${older.sensitive ? "on" : "off"} → ${newer.sensitive ? "on" : "off"}`);
  if (older.validationType !== newer.validationType)
    lines.push(`Validation: ${older.validationType ?? "none"} → ${newer.validationType ?? "none"}`);
  if (older.validationPattern !== newer.validationPattern)
    lines.push(`Pattern: ${q(older.validationPattern)} → ${q(newer.validationPattern)}`);
  if (older.validationMessage !== newer.validationMessage)
    lines.push(`Message: ${q(older.validationMessage)} → ${q(newer.validationMessage)}`);
  if (older.sortOrder !== newer.sortOrder)
    lines.push(`Sort order: ${older.sortOrder} → ${newer.sortOrder}`);
  if (JSON.stringify(older.options) !== JSON.stringify(newer.options)) {
    const oldN = (older.options ?? []).length;
    const newN = (newer.options ?? []).length;
    lines.push(oldN !== newN ? `Options: ${oldN} → ${newN} items` : `Options updated (${newN} items)`);
  }
  return lines.length > 0 ? lines.join(" · ") : "No changes detected";
}

// ─── Compliance tag chip (inline display) ────────────────────────────────────
function ComplianceTagChip({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      {name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100 leading-none">×</button>
      )}
    </span>
  );
}

// ─── Compliance tag picker popover ───────────────────────────────────────────
function ComplianceTagPicker({
  allTags,
  selectedTagNames,
  onToggle,
  onClose,
}: {
  allTags: ComplianceTag[];
  selectedTagNames: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-[#DDD5C4] bg-white shadow-lg py-1"
    >
      <div className="px-2 pt-1 pb-0.5 text-[10px] text-[#8A9BB8] uppercase tracking-wide font-semibold">Compliance tags</div>
      {allTags.length === 0 && (
        <div className="px-3 py-2 text-[11px] text-[#8A9BB8]">No tags defined.</div>
      )}
      {allTags.map((tag) => {
        const selected = selectedTagNames.includes(tag.name);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => onToggle(tag.name)}
            className="flex items-center gap-2 w-full px-2 py-1 text-left hover:bg-[#F8F6F0] transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border"
              style={{ backgroundColor: selected ? tag.color : "transparent", borderColor: tag.color }}
            />
            <span className="text-[11px] text-[#0B1220] flex-1 truncate">{tag.name}</span>
            {tag.isRequired && <span className="text-[9px] text-[#DC2626] font-semibold">REQ</span>}
          </button>
        );
      })}
      <div className="border-t border-[#EFE8D8] mt-1 pt-1 px-2 pb-1">
        <button type="button" onClick={onClose} className="text-[10px] text-[#8A9BB8] hover:text-[#0F1C3F]">Done</button>
      </div>
    </div>
  );
}

export function FieldLibraryPanel({
  items,
  allComplianceTags,
  onAdd,
  onChange,
  onSave,
  onSetComplianceTags,
  onUse,
  onDelete,
  onLoadVersions,
  onRestoreVersion,
  onLoadAnalytics,
  onExport,
  onImport,
  openFieldId,
  onClearOpenField,
}: {
  items: FieldLibraryItem[];
  allComplianceTags?: ComplianceTag[];
  onAdd: () => Promise<string | null>;
  onChange: (id: string, patch: Partial<FieldLibraryItem>) => void;
  onSave: (item: FieldLibraryItem) => Promise<string | null>;
  onSetComplianceTags?: (fieldId: string, tags: string[]) => Promise<string | null>;
  onUse: (item: FieldLibraryItem) => void;
  onDelete?: (id: string) => Promise<string | null>;
  onLoadVersions?: (fieldId: string) => Promise<FieldVersionRow[] | string>;
  onRestoreVersion?: (fieldId: string, versionId: number) => Promise<string | null>;
  onLoadAnalytics?: (fieldId: string) => Promise<FieldAnalytics | string>;
  onExport?: (format: "json" | "csv") => Promise<void>;
  onImport?: (data: FieldLibraryImportPayload) => Promise<FieldLibraryImportResult | string>;
  openFieldId?: string;
  onClearOpenField?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Map<string, FieldVersionRow[]>>(() => new Map());
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [analyticsOpenId, setAnalyticsOpenId] = useState<string | null>(null);
  const [analyticsMap, setAnalyticsMap] = useState<Map<string, FieldAnalytics>>(() => new Map());
  const [analyticsLoadingId, setAnalyticsLoadingId] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [tagPickerOpenId, setTagPickerOpenId] = useState<string | null>(null);
  const [tagSavingId, setTagSavingId] = useState<string | null>(null);
  // Optimistic map: fieldId → tag names — updated immediately on click so the
  // picker dot and chips reflect the change before the API responds.
  const [optimisticTagsMap, setOptimisticTagsMap] = useState<Map<string, string[]>>(() => new Map());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState<"json" | "csv" | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{
    payload: FieldLibraryImportPayload;
    newFields: FieldLibraryImportField[];
    changedFields: FieldLibraryImportField[];
    dupFields: FieldLibraryImportField[];
  } | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<FieldLibraryImportResult | null>(null);

  function parseCsvLine(line: string): string[] {
    const cols: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { cols.push(cur); cur = ""; }
        else { cur += ch; }
      }
    }
    cols.push(cur);
    return cols;
  }

  function parseCsvToFieldLibrary(csvText: string): FieldLibraryImportPayload {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    if (!headers.includes("label")) throw new Error("CSV is missing a required \"label\" column.");
    const col = (name: string) => headers.indexOf(name);
    const fields: FieldLibraryImportField[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCsvLine(lines[i]);
      const get = (name: string) => (col(name) >= 0 ? (vals[col(name)] ?? "").trim() : "");
      const label = get("label");
      if (!label) continue;
      const optStr = get("options");
      const tagStr = get("compliancetags");
      fields.push({
        label,
        ...(get("category")          && { category:          get("category") }),
        ...(get("type")              && { type:              get("type") }),
        ...(get("source")            && { source:            get("source") }),
        ...(get("sensitive")         && { sensitive:         get("sensitive").toLowerCase() === "true" }),
        ...(get("required")          && { required:          get("required").toLowerCase()  === "true" }),
        ...(get("validationtype")    && { validationType:    get("validationtype") }),
        ...(get("validationpattern") && { validationPattern: get("validationpattern") }),
        ...(get("validationmessage") && { validationMessage: get("validationmessage") }),
        ...(get("active") !== ""     && { active: get("active").toLowerCase() !== "false" }),
        ...(get("sortorder")         && { sortOrder:         Number(get("sortorder")) || 100 }),
        ...(optStr                   && { options:           optStr.split("|").map((s) => s.trim()).filter(Boolean) }),
        ...(tagStr                   && { complianceTags:    tagStr.split("|").map((s) => s.trim()).filter(Boolean) }),
      });
    }
    if (fields.length === 0) throw new Error("No valid field rows found in CSV.");
    return { fields };
  }
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [advancedIds, setAdvancedIds] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!openFieldId) return;
    setExpandedIds((prev) => { const n = new Set(prev); n.add(openFieldId); return n; });
    onClearOpenField?.();
    setTimeout(() => {
      document.getElementById(`field-row-${openFieldId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [openFieldId]);


  async function handleExport(format: "json" | "csv") {
    if (!onExport) return;
    setExportMenuOpen(false);
    setExportLoading(format);
    try { await onExport(format); } finally { setExportLoading(null); }
  }

  function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImportParseError(null);
    setImportPreview(null);
    setImportResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        let parsed: FieldLibraryImportPayload;
        if (isCsv) {
          parsed = parseCsvToFieldLibrary(text);
        } else {
          const json = JSON.parse(text) as FieldLibraryImportPayload;
          if (!json || !Array.isArray(json.fields)) {
            setImportParseError("File does not contain a valid field library export (missing \"fields\" array).");
            return;
          }
          parsed = json;
        }
        const existingLabelSet = new Set(items.map((i) => i.label.trim().toLowerCase()));
        const existingByLabel = new Map(items.map((i) => [i.label.trim().toLowerCase(), i]));
        const newFields: FieldLibraryImportField[] = [];
        const changedFields: FieldLibraryImportField[] = [];
        const dupFields: FieldLibraryImportField[] = [];

        function importHasDifferences(f: FieldLibraryImportField, ex: (typeof items)[0]): boolean {
          if (f.category !== undefined && (f.category || "General").trim() !== (ex.category || "General")) return true;
          if (f.type !== undefined && f.type !== ex.type) return true;
          if (f.source !== undefined && (f.source || "interview") !== (ex.source || "interview")) return true;
          if (f.sensitive !== undefined && f.sensitive !== ex.sensitive) return true;
          if (f.required !== undefined && f.required !== ex.required) return true;
          if (f.validationType !== undefined && f.validationType !== ex.validationType) return true;
          if (f.validationPattern !== undefined && (f.validationPattern ?? null) !== (ex.validationPattern ?? null)) return true;
          if (f.validationMessage !== undefined && (f.validationMessage ?? null) !== (ex.validationMessage ?? null)) return true;
          if (f.active !== undefined && f.active !== ex.active) return true;
          if (f.options !== undefined) {
            const a = [...f.options].sort().join("|");
            const b = [...(ex.options ?? [])].sort().join("|");
            if (a !== b) return true;
          }
          return false;
        }

        for (const f of parsed.fields) {
          if (!f.label?.trim()) continue;
          const key = f.label.trim().toLowerCase();
          if (existingLabelSet.has(key)) {
            const ex = existingByLabel.get(key)!;
            if (!ex.inherited && !ex.locked && importHasDifferences(f, ex)) {
              changedFields.push(f);
            } else {
              dupFields.push(f);
            }
          } else {
            newFields.push(f);
          }
        }
        setImportPreview({ payload: parsed, newFields, changedFields, dupFields });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setImportParseError(isCsv
          ? `Could not parse CSV — ${msg}`
          : "Could not parse the file — make sure it is a valid JSON or CSV export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImportConfirm() {
    if (!onImport || !importPreview) return;
    setImportLoading(true);
    const result = await onImport(importPreview.payload);
    setImportLoading(false);
    setImportPreview(null);
    if (typeof result === "string") {
      setPanelError(result);
    } else {
      setImportResult(result);
      setTimeout(() => setImportResult(null), 6000);
    }
  }

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: FieldLibraryItem) {
    setSavingId(item.id);
    setPanelError(null);
    setSavedId(null);
    const result = await onSave(item);
    setSavingId(null);
    if (result === "__cancelled__") {
      // Admin dismissed the impact confirmation — no save occurred, no UI change needed
    } else if (result) {
      setPanelError(result);
    } else {
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  async function handleDelete(item: FieldLibraryItem) {
    if (!onDelete) return;
    if (!confirm(`Delete field "${item.label}"? This cannot be undone.`)) return;
    setDeletingId(item.id);
    setPanelError(null);
    const err = await onDelete(item.id);
    setDeletingId(null);
    if (err) setPanelError(err);
  }

  async function toggleHistory(fieldId: string) {
    if (historyOpenId === fieldId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(fieldId);
    if (historyMap.has(fieldId) || !onLoadVersions) return;
    setHistoryLoadingId(fieldId);
    setHistoryError(null);
    const result = await onLoadVersions(fieldId);
    setHistoryLoadingId(null);
    if (typeof result === "string") {
      setHistoryError(result);
    } else {
      setHistoryMap((prev) => new Map(prev).set(fieldId, result));
    }
  }

  async function handleRestore(fieldId: string, versionId: number) {
    if (!onRestoreVersion) return;
    setRestoringVersionId(versionId);
    setHistoryError(null);
    const err = await onRestoreVersion(fieldId, versionId);
    setRestoringVersionId(null);
    if (err) {
      setHistoryError(err);
    } else {
      // Invalidate cached history for this field so it reloads fresh
      setHistoryMap((prev) => { const m = new Map(prev); m.delete(fieldId); return m; });
      setHistoryOpenId(null);
    }
  }

  async function toggleAnalytics(fieldId: string) {
    if (analyticsOpenId === fieldId) {
      setAnalyticsOpenId(null);
      return;
    }
    setAnalyticsOpenId(fieldId);
    if (analyticsMap.has(fieldId) || !onLoadAnalytics) return;
    setAnalyticsLoadingId(fieldId);
    setAnalyticsError(null);
    const result = await onLoadAnalytics(fieldId);
    setAnalyticsLoadingId(null);
    if (typeof result === "string") {
      setAnalyticsError(result);
    } else {
      setAnalyticsMap((prev) => new Map(prev).set(fieldId, result));
    }
  }

  const q = searchQuery.trim().toLowerCase();
  const visibleItems = q
    ? items.filter((i) =>
        i.label.toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q) ||
        String(i.id).toLowerCase().includes(q)
      )
    : items;

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#DDD5C4] w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-[#EFE8D8]">
              <h2 className="text-sm font-semibold text-[#0F1C3F]">Review import</h2>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">
                {importPreview.newFields.length > 0 && `${importPreview.newFields.length} field${importPreview.newFields.length !== 1 ? "s" : ""} will be added`}
                {importPreview.newFields.length > 0 && (importPreview.changedFields.length > 0 || importPreview.dupFields.length > 0 || (importPreview.payload.fieldGroups ?? []).length > 0) && ", "}
                {importPreview.changedFields.length > 0 && `${importPreview.changedFields.length} will be updated`}
                {importPreview.changedFields.length > 0 && (importPreview.dupFields.length > 0 || (importPreview.payload.fieldGroups ?? []).length > 0) && ", "}
                {importPreview.dupFields.length > 0 && `${importPreview.dupFields.length} unchanged (skipped)`}
                {importPreview.dupFields.length > 0 && (importPreview.payload.fieldGroups ?? []).length > 0 && ", "}
                {(importPreview.payload.fieldGroups ?? []).length > 0 && `${(importPreview.payload.fieldGroups ?? []).length} group${(importPreview.payload.fieldGroups ?? []).length !== 1 ? "s" : ""} included`}
                {importPreview.newFields.length === 0 && importPreview.changedFields.length === 0 && importPreview.dupFields.length === 0 && (importPreview.payload.fieldGroups ?? []).length === 0 && "No fields found"}.
              </p>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1">
              {importPreview.newFields.length === 0 && importPreview.changedFields.length === 0 && importPreview.dupFields.length === 0 && (
                <p className="text-[11px] text-[#8A9BB8]">No fields found in this file.</p>
              )}
              {importPreview.newFields.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#0F1C3F] truncate">{f.label}</span>
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] font-medium text-[10px]">New</span>
                </div>
              ))}
              {importPreview.changedFields.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#0F1C3F] truncate">{f.label}</span>
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] font-medium text-[10px]">Update</span>
                </div>
              ))}
              {importPreview.dupFields.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px] opacity-50">
                  <span className="text-[#0F1C3F] truncate">{f.label}</span>
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#F0F0F0] text-[#9CA3AF] font-medium text-[10px]">No change</span>
                </div>
              ))}
              {(importPreview.payload.fieldGroups ?? []).length > 0 && (
                <div className="pt-2 mt-2 border-t border-[#EFE8D8]">
                  <p className="text-[10px] text-[#8A9BB8] font-medium uppercase tracking-wide mb-1">Field groups</p>
                  {(importPreview.payload.fieldGroups ?? []).map((g, i) => (
                    <div key={i} className="text-[11px] text-[#4A5568]">{g.name}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-[#EFE8D8] flex items-center justify-end gap-2">
              <button type="button" onClick={() => setImportPreview(null)} disabled={importLoading} className="text-xs text-[#6B7A99] hover:text-[#0F1C3F] disabled:opacity-50">Cancel</button>
              <button
                type="button"
                disabled={importLoading || (importPreview.newFields.length === 0 && importPreview.changedFields.length === 0 && (importPreview.payload.fieldGroups ?? []).length === 0)}
                onClick={() => void handleImportConfirm()}
                className="text-xs bg-[#1B4FD8] text-white rounded px-3 py-1.5 disabled:opacity-50 hover:bg-[#1540B0] transition-colors"
              >
                {importLoading
                  ? "Importing…"
                  : (() => {
                      const actionCount = importPreview.newFields.length + importPreview.changedFields.length;
                      if (actionCount > 0) return `Import ${actionCount} field${actionCount !== 1 ? "s" : ""}`;
                      return `Import ${(importPreview.payload.fieldGroups ?? []).length} group${(importPreview.payload.fieldGroups ?? []).length !== 1 ? "s" : ""}`;
                    })()}
              </button>
            </div>
          </div>
        </div>
      )}
      {importResult && (
        <div className="mb-2 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-3 py-2 text-[11px] flex items-start justify-between gap-2">
          <span>
            {importResult.added > 0 && `Added ${importResult.added} field${importResult.added !== 1 ? "s" : ""}`}
            {importResult.added > 0 && (importResult.updated > 0 || importResult.skipped > 0 || (importResult.groupsAdded ?? 0) > 0) && ", "}
            {(importResult.updated ?? 0) > 0 && `updated ${importResult.updated}`}
            {(importResult.updated ?? 0) > 0 && (importResult.skipped > 0 || (importResult.groupsAdded ?? 0) > 0) && ", "}
            {importResult.skipped > 0 && `${importResult.skipped} unchanged (skipped)`}
            {importResult.skipped > 0 && (importResult.groupsAdded ?? 0) > 0 && ", "}
            {(importResult.groupsAdded ?? 0) > 0 && `added ${importResult.groupsAdded} group${(importResult.groupsAdded ?? 0) !== 1 ? "s" : ""}`}
            {importResult.added === 0 && (importResult.updated ?? 0) === 0 && importResult.skipped === 0 && (importResult.groupsAdded ?? 0) === 0 && "Nothing to import"}
            {importResult.errors.length > 0 && ` — ${importResult.errors.length} error${importResult.errors.length !== 1 ? "s" : ""}`}.
          </span>
          <button type="button" onClick={() => setImportResult(null)} className="text-[#065F46] opacity-60 hover:opacity-100 shrink-0">✕</button>
        </div>
      )}
      {importParseError && (
        <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px] flex items-center justify-between gap-2">
          <span>{importParseError}</span>
          <button type="button" onClick={() => setImportParseError(null)} className="text-red-500 hover:text-red-700 shrink-0">✕</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Shared Field Library</h3>
            <span className="relative">
              <button type="button" onClick={() => setShowHints((v) => !v)} className={`flex items-center justify-center w-4 h-4 rounded-full border text-[10px] leading-none select-none transition-colors ${showHints ? "bg-[#C49A38] border-[#C49A38] text-white" : "border-[#C4B99A] text-[#8A9BB8] hover:border-[#C49A38] hover:text-[#C49A38]"}`}>?</button>
              {showHints && (
                <div className="absolute left-0 top-full mt-1.5 w-72 rounded-lg border border-[#DDD5C4] bg-white shadow-lg text-[11px] text-[#4A5568] leading-relaxed px-3 py-2.5 z-50 space-y-1.5">
                  <p><span className="font-semibold text-[#0F1C3F]">Label</span> — the question or prompt shown to the client during the interview.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Category</span> — groups this field with related fields (e.g. "Personal info", "Account details").</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Prefill source</span> — the variable key used when mapping this field to a document template (e.g. "firstName").</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Sort order</span> — controls where this field appears relative to others. Lower numbers appear first.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Field type</span> — the kind of input shown: text, date, radio, checkbox, or dropdown.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Validation rule</span> — applies a built-in format check (Name, Email, Phone, SSN, etc.) to the client's entry.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Options</span> — for dropdown, radio, or checkbox fields only. Enter one option per line — plain text, no quotes or commas needed. Example:<br /><code className="font-mono text-[10px] text-[#1B4FD8]">Option A<br />Option B<br />Option C</code></p>
                  <p><span className="font-semibold text-[#0F1C3F]">Validation message</span> — shown when the client's input fails validation. Leave blank for the default message.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Active</span> — include in interviews. <span className="font-semibold text-[#0F1C3F]">Required</span> — client must fill in. <span className="font-semibold text-[#0F1C3F]">Sensitive</span> — masked in logs and exports (SSNs, account numbers, etc.).</p>
                </div>
              )}
            </span>
          </div>
          <p className="text-[11px] text-[#8A9BB8]">Define common fields once and reuse them across your document packages.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {onImport && (
            <>
              <input ref={importFileRef} type="file" accept="application/json,.json,.csv,text/csv" className="sr-only" onChange={handleImportFileChange} />
              <button
                type="button"
                onClick={() => { setImportParseError(null); setImportResult(null); importFileRef.current?.click(); }}
                className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#6B7A99] hover:text-[#0F1C3F] hover:border-[#0F1C3F] transition-colors"
              >
                Import
              </button>
            </>
          )}
          {onExport && (
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={!!exportLoading}
                className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#6B7A99] hover:text-[#0F1C3F] hover:border-[#0F1C3F] disabled:opacity-50 transition-colors flex items-center gap-0.5"
              >
                {exportLoading ? "Exporting…" : "Export"}
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4"/></svg>
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-[#DDD5C4] rounded shadow-lg z-30 py-1 text-[11px]">
                  <button type="button" onClick={() => void handleExport("json")} className="w-full text-left px-3 py-1.5 hover:bg-[#F8F6F0] text-[#0F1C3F]">JSON</button>
                  <button type="button" onClick={() => void handleExport("csv")} className="w-full text-left px-3 py-1.5 hover:bg-[#F8F6F0] text-[#0F1C3F]">CSV</button>
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={handleAdd} disabled={adding} className="h-7 px-2.5 text-xs rounded border border-[#C49A38] bg-[#C49A38] text-white hover:bg-[#A07820] hover:border-[#A07820] disabled:opacity-50 transition-colors">
            {adding ? "Adding…" : "+ Add"}
          </button>
        </div>
      </div>
      <div className="relative mb-2">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input
          type="text"
          placeholder="Search fields…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-8 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-6 bg-white focus:outline-none focus:border-[#1B4FD8]"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#B0BCCE] hover:text-[#6B7A99]">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>
      <div className="rounded border border-[#DDD5C4] divide-y divide-[#EFE8D8]" style={{ overflow: "clip" }}>
        {visibleItems.map((item) => {
          const isEditing = expandedIds.has(item.id) || showHints;
          const showAdvanced = advancedIds.has(item.id) || showHints;
          const itemIsInherited = !!(item.inherited || (item as FieldLibraryItem & { inheritedFrom?: string }).inheritedFrom);
          const displayTags = optimisticTagsMap.get(item.id) ?? item.complianceTags ?? [];
          const applyTagChange = (next: string[]) => {
            setOptimisticTagsMap((m) => { const n = new Map(m); n.set(item.id, next); return n; });
            setTagSavingId(item.id);
            void onSetComplianceTags!(item.id, next).then((err) => {
              setTagSavingId(null);
              if (err) {
                setOptimisticTagsMap((m) => { const n = new Map(m); n.delete(item.id); return n; });
                setPanelError(err);
              } else {
                setOptimisticTagsMap((m) => { const n = new Map(m); n.delete(item.id); return n; });
              }
            });
          };
          const TYPE_CLS: Record<string, string> = {
            text: "bg-[#EBF0FB] text-[#1B4FD8]",
            date: "bg-[#F0FDF4] text-[#15803D]",
            radio: "bg-[#FFF7ED] text-[#C2410C]",
            checkbox: "bg-[#F5F3FF] text-[#7C3AED]",
            dropdown: "bg-[#ECFDF5] text-[#065F46]",
          };
          const toggleEdit = () => setExpandedIds((prev) => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; });
          const toggleAdvanced = () => setAdvancedIds((prev) => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; });
          return (
            <div key={item.id} id={`field-row-${item.id}`}>
              {/* ── Collapsed summary row ── */}
              <div className={`flex items-center gap-2 px-3 min-h-[44px] py-1.5 transition-colors ${isEditing ? "bg-[#F5F3EE]" : "bg-white hover:bg-[#FDFCFA]"}`}>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-xs font-medium text-[#0F1C3F] truncate">{item.label || <em className="text-[#B0BCCE] not-italic">Untitled</em>}</div>
                  <div className="text-[10px] font-mono text-[#B0BCCE] truncate">{String(item.id)}</div>
                </div>
                {item.packageCount !== undefined && (
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.packageCount > 0 ? "bg-[#EBF0FB] text-[#1B4FD8]" : "bg-[#F0F0F0] text-[#9CA3AF]"}`}>{item.packageCount}p</span>
                )}
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${TYPE_CLS[item.type] ?? "bg-[#F0F0F0] text-[#6B7A99]"}`}>{item.type}</span>
                {item.active
                  ? <span className="shrink-0 hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-[#ECFDF5] text-[#059669] font-medium">Active</span>
                  : <span className="shrink-0 hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#9CA3AF] font-medium">Inactive</span>}
                {item.sensitive && <span className="shrink-0 hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">Sensitive</span>}
                {itemIsInherited && <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">Inherited</span>}
                <button
                  type="button"
                  title={isEditing ? "Collapse" : "Edit field"}
                  onClick={toggleEdit}
                  className={`shrink-0 flex items-center justify-center w-7 h-7 rounded border transition-colors ${isEditing ? "bg-[#0F1C3F] border-[#0F1C3F] text-white" : "border-[#D4C9B5] bg-white text-[#6B7A99] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={isEditing ? "M5 15l7-7 7 7" : "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"} />
                  </svg>
                </button>
              </div>
              {/* ── Edit drawer ── */}
              {isEditing && (
                <div className="border-t border-[#EFE8D8] bg-[#F8F6F0] px-3 pt-3 pb-3 space-y-2">
                  {item.packageCount !== undefined && (
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${item.packageCount > 0 ? "bg-[#EBF0FB] text-[#1B4FD8]" : "bg-[#F0F0F0] text-[#9CA3AF]"}`}>{item.packageCount}p</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-medium ${(item.answerCount ?? 0) > 0 ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#F0F0F0] text-[#9CA3AF]"}`}>{(item.answerCount ?? 0).toLocaleString()} ans</span>
                      {item.lastAnswered && <span className="text-[#8A9BB8]">last {relativeTime(item.lastAnswered)}</span>}
                    </div>
                  )}
                  <div className="relative pt-1">
                    {showHints && <HL>Label</HL>}
                    <Input value={item.label} onChange={(e) => onChange(item.id, { label: e.target.value })} className="h-8 text-xs bg-white" placeholder="Label" disabled={itemIsInherited} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative pt-1">
                      {showHints && <HL>Category</HL>}
                      <Input placeholder="Category" value={item.category} onChange={(e) => onChange(item.id, { category: e.target.value })} className="h-8 text-xs bg-white" disabled={itemIsInherited} />
                    </div>
                    <div className="relative pt-1">
                      {showHints && <HL>Field type</HL>}
                      <div className="flex flex-wrap gap-1">
                        {(["text", "radio", "checkbox", "dropdown"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => onChange(item.id, { type: t })} disabled={itemIsInherited} className={`px-2 py-0.5 text-[10px] rounded border capitalize transition-colors ${item.type === t ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F]"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative pt-1">
                      {showHints && <HL>Prefill source</HL>}
                      <Input placeholder="Prefill source (e.g. clientName)" value={item.source} onChange={(e) => onChange(item.id, { source: e.target.value })} className="h-8 text-xs bg-white" disabled={itemIsInherited} />
                    </div>
                    <div className="w-20 shrink-0 relative pt-1">
                      {showHints && <HL>Sort</HL>}
                      <Input type="number" placeholder="Sort" value={item.sortOrder} onChange={(e) => onChange(item.id, { sortOrder: Number(e.target.value || 100) })} className="h-8 text-xs bg-white" disabled={itemIsInherited} />
                    </div>
                  </div>
                  <div className="relative pt-1">
                    {showHints && <HL>Active · Required · Sensitive</HL>}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7A99]">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} disabled={itemIsInherited} /> Active</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={item.required} onChange={(e) => onChange(item.id, { required: e.target.checked })} disabled={itemIsInherited} /> Required</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={item.sensitive} onChange={(e) => onChange(item.id, { sensitive: e.target.checked })} disabled={itemIsInherited} /> Sensitive</label>
                    </div>
                  </div>
                  {!itemIsInherited && (
                    <button type="button" onClick={toggleAdvanced} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors">
                      {showAdvanced ? "▲ Less" : "▾ More options"}
                    </button>
                  )}
                  {showAdvanced && !itemIsInherited && (
                    <div className="space-y-2 border-t border-[#EFE8D8] pt-2">
                      <div className="relative pt-1">
                        {showHints && <HL>Validation rule</HL>}
                        <div className="flex flex-wrap gap-1">
                          {(["none", "name", "email", "phone", "ssn", "number", "currency", "date", "custom"] as const).map((v) => (
                            <button key={v} type="button" onClick={() => onChange(item.id, { validationType: v as FieldLibraryItem["validationType"] })} className={`px-2 py-0.5 text-[10px] rounded border capitalize transition-colors ${(item.validationType ?? "none") === v ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F]"}`}>{v}</button>
                          ))}
                        </div>
                      </div>
                      {item.validationType === "custom" && <Input placeholder="Regex pattern" value={item.validationPattern ?? ""} onChange={(e) => onChange(item.id, { validationPattern: e.target.value })} className="h-8 text-xs bg-white" />}
                      <div className="relative pt-1">
                        {showHints && <HL>Validation message</HL>}
                        <Input placeholder="Validation message" value={item.validationMessage ?? ""} onChange={(e) => onChange(item.id, { validationMessage: e.target.value })} className="h-8 text-xs bg-white" />
                      </div>
                      <div className="relative pt-1">
                        {showHints && <HL>Options</HL>}
                        <Textarea
                          placeholder={item.type === "checkbox" ? "One checkbox per line" : item.type === "radio" ? "One choice per line" : item.type === "dropdown" ? "One option per line" : "Options (one per line)"}
                          value={item.options.join("\n")}
                          onChange={(e) => onChange(item.id, { options: e.target.value.split("\n").filter(Boolean) })}
                          className="min-h-16 text-xs bg-white"
                        />
                      </div>
                      {allComplianceTags !== undefined && (
                        <div className="relative">
                          <div className="flex flex-wrap items-center gap-1 min-h-[20px]">
                            {displayTags.map((tagName) => {
                              const tagMeta = allComplianceTags.find((t) => t.name === tagName);
                              return <ComplianceTagChip key={tagName} name={tagName} color={tagMeta?.color ?? "#6B7A99"} onRemove={(!itemIsInherited && onSetComplianceTags) ? () => applyTagChange(displayTags.filter((n) => n !== tagName)) : undefined} />;
                            })}
                            {!itemIsInherited && onSetComplianceTags && (
                              <button type="button" onClick={() => setTagPickerOpenId((prev) => prev === item.id ? null : item.id)} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] px-1">
                                {tagSavingId === item.id ? "Saving…" : "+ Tags"}
                              </button>
                            )}
                          </div>
                          {tagPickerOpenId === item.id && !itemIsInherited && onSetComplianceTags && (
                            <ComplianceTagPicker allTags={allComplianceTags} selectedTagNames={displayTags} onToggle={(tagName) => applyTagChange(displayTags.includes(tagName) ? displayTags.filter((n) => n !== tagName) : [...displayTags, tagName])} onClose={() => setTagPickerOpenId(null)} />
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-3">
                        {onLoadVersions && (
                          <button type="button" onClick={() => void toggleHistory(item.id)} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors">
                            {historyOpenId === item.id ? "▲ Hide history" : "▾ History"}
                          </button>
                        )}
                        {onLoadAnalytics && (
                          <button type="button" onClick={() => void toggleAnalytics(item.id)} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors">
                            {analyticsOpenId === item.id ? "▲ Hide analytics" : "▾ Analytics"}
                          </button>
                        )}
                      </div>
                      {onLoadVersions && historyOpenId === item.id && (
                        <div className="rounded border border-[#E8E0D4] bg-[#F8F5EF] p-2 text-[11px]">
                          {historyLoadingId === item.id && <p className="text-[#8A9BB8]">Loading history…</p>}
                          {historyError && <p className="text-red-500">{historyError}</p>}
                          {!historyLoadingId && !historyError && (() => {
                            const versions = historyMap.get(item.id) ?? [];
                            if (versions.length === 0) return <p className="text-[#8A9BB8]">No saved versions yet.</p>;
                            return (
                              <ul className="space-y-1">
                                {versions.map((v, idx) => {
                                  const prevSnap = versions[idx + 1]?.snapshot;
                                  const summary = diffSummary(prevSnap, v.snapshot);
                                  const author = v.changedBy ?? "unknown";
                                  return (
                                    <li key={v.id} className="flex items-start gap-3 py-0.5">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-1.5">
                                          <span className="font-medium text-[#0B1220] whitespace-nowrap">{relativeTime(v.changedAt)}</span>
                                          <span className="text-[#C4B99A]">·</span>
                                          <span className="text-[#6B7A99] text-[10px] truncate">{author}</span>
                                        </div>
                                        <div className="text-[10px] text-[#8A9BB8]">{summary}</div>
                                      </div>
                                      {onRestoreVersion && (
                                        <button type="button" disabled={restoringVersionId === v.id} onClick={() => void handleRestore(item.id, v.id)} className="shrink-0 text-[10px] text-[#C49A38] hover:text-[#A07820] disabled:opacity-50 pt-0.5">
                                          {restoringVersionId === v.id ? "Restoring…" : "Restore"}
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            );
                          })()}
                        </div>
                      )}
                      {onLoadAnalytics && analyticsOpenId === item.id && (
                        <div>
                          {analyticsLoadingId === item.id && <p className="text-[11px] text-[#8A9BB8]">Loading analytics…</p>}
                          {analyticsError && <p className="text-[11px] text-red-500">{analyticsError}</p>}
                          {!analyticsLoadingId && !analyticsError && analyticsMap.has(item.id) && (
                            <FieldAnalyticsPanel analytics={analyticsMap.get(item.id)!} isSensitive={item.sensitive} />
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Footer: isolated shaded action bar */}
                  <div className="-mx-3 -mb-3 mt-3 px-3 py-2.5 border-t border-[#E0D8CC] bg-[#EDE9E1] rounded-b flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-[#A8A09A]">{item.id}</span>
                    <div className="flex items-center gap-1.5">
                      {itemIsInherited ? (
                        <span className="text-[10px] text-[#8A9BB8] italic">
                          {item.inheritedFrom === "platform" ? "Platform field · read-only" : "Inherited · read-only"}
                        </span>
                      ) : (
                        <>
                          {onDelete && (
                            <button type="button" onClick={() => void handleDelete(item)} disabled={deletingId === item.id} className="h-7 px-2.5 text-[11px] rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                              {deletingId === item.id ? "Deleting…" : "Delete"}
                            </button>
                          )}
                          <button type="button" onClick={() => void handleSave(item)} disabled={savingId === item.id} className="h-7 px-2.5 text-[11px] font-medium rounded border border-[#C49A38] bg-[#C49A38] text-white hover:bg-[#A07820] hover:border-[#A07820] disabled:opacity-50 transition-colors">
                            {savingId === item.id ? "Saving…" : savedId === item.id ? "✓ Saved" : "Save field changes"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {items.length === 0 && <div className="px-4 py-6 text-xs text-[#8A9BB8] text-center">No fields yet. Click + Add to create one.</div>}
        {items.length > 0 && visibleItems.length === 0 && <div className="px-4 py-6 text-xs text-[#8A9BB8] text-center">No results for "{searchQuery}".</div>}
      </div>
    </div>
  );
}

const PRESET_COLORS = ["#DC2626", "#D97706", "#059669", "#2563EB", "#7C3AED", "#DB2777", "#0F1C3F", "#C49A38", "#6B7A99"];

export function ComplianceTagsPanel({
  items,
  onCreate,
  onUpdate,
  onDelete,
}: {
  items: ComplianceTag[];
  onCreate: (tag: { name: string; color: string; description?: string; isRequired: boolean }) => Promise<string | null>;
  onUpdate: (id: number, patch: { name?: string; color?: string; description?: string | null; isRequired?: boolean }) => Promise<string | null>;
  onDelete: (id: number) => Promise<string | null>;
}) {
  const [panelError, setPanelError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { name: string; color: string; description: string; isRequired: boolean }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTag, setNewTag] = useState({ name: "", color: "#2563EB", description: "", isRequired: false });
  const [creating, setCreating] = useState(false);

  function startEdit(tag: ComplianceTag) {
    setEditingId(tag.id);
    setDrafts((d) => ({ ...d, [tag.id]: { name: tag.name, color: tag.color, description: tag.description ?? "", isRequired: tag.isRequired } }));
  }

  function patchDraft(id: number, patch: Partial<{ name: string; color: string; description: string; isRequired: boolean }>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function handleSave(tag: ComplianceTag) {
    const draft = drafts[tag.id];
    if (!draft) return;
    setSavingId(tag.id);
    setPanelError(null);
    const err = await onUpdate(tag.id, { name: draft.name.trim() || tag.name, color: draft.color, description: draft.description || null, isRequired: draft.isRequired });
    setSavingId(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedId(tag.id);
      setTimeout(() => { setSavedId(null); setEditingId(null); }, 1500);
    }
  }

  async function handleDelete(tag: ComplianceTag) {
    if (!confirm(`Delete tag "${tag.name}"? This cannot be undone.`)) return;
    setDeletingId(tag.id);
    setPanelError(null);
    const err = await onDelete(tag.id);
    setDeletingId(null);
    if (err) setPanelError(err);
  }

  async function handleCreate() {
    if (!newTag.name.trim()) return;
    setCreating(true);
    setPanelError(null);
    const err = await onCreate({ name: newTag.name.trim(), color: newTag.color, description: newTag.description || undefined, isRequired: newTag.isRequired });
    setCreating(false);
    if (err) {
      setPanelError(err);
    } else {
      setShowNewForm(false);
      setNewTag({ name: "", color: "#2563EB", description: "", isRequired: false });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0F1C3F]">Compliance Tags</h3>
          <p className="text-[11px] text-[#8A9BB8]">Tags are used in the Field Library to mark fields for compliance auditing. Built-in tags cannot be deleted.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowNewForm(true); setPanelError(null); }}
          disabled={showNewForm}
          className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#4A5568] hover:text-[#0F1C3F] hover:border-[#0F1C3F] disabled:opacity-50 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          New Tag
        </button>
      </div>

      {panelError && <div className="mb-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-xs">{panelError}</div>}

      {showNewForm && (
        <div className="mb-3 rounded border border-[#DDD5C4] bg-[#F8F6F0] p-3 space-y-2">
          <div className="text-[11px] font-semibold text-[#0F1C3F] uppercase tracking-wide mb-1">New Tag</div>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Tag name (e.g. FINRA, KYC, AML)"
                value={newTag.name}
                onChange={(e) => setNewTag((t) => ({ ...t, name: e.target.value }))}
                className="w-full h-7 text-xs rounded border border-[#D4C9B5] px-2 bg-white focus:outline-none focus:border-[#1B4FD8]"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setNewTag((t) => ({ ...t, color: c }))}
                  className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${newTag.color === c ? "border-[#0F1C3F] scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={newTag.color} onChange={(e) => setNewTag((t) => ({ ...t, color: e.target.value }))}
                className="w-5 h-5 rounded cursor-pointer border-none p-0" title="Custom color" />
            </div>
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={newTag.description}
            onChange={(e) => setNewTag((t) => ({ ...t, description: e.target.value }))}
            className="w-full h-7 text-xs rounded border border-[#D4C9B5] px-2 bg-white focus:outline-none focus:border-[#1B4FD8]"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs text-[#4A5568] cursor-pointer">
              <input type="checkbox" checked={newTag.isRequired} onChange={(e) => setNewTag((t) => ({ ...t, isRequired: e.target.checked }))} className="accent-[#0F1C3F]" />
              Required for compliance
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowNewForm(false); setNewTag({ name: "", color: "#2563EB", description: "", isRequired: false }); }}
                className="h-7 px-2.5 text-xs rounded border border-[#D4C9B5] bg-white text-[#6B7A99] hover:border-[#0F1C3F] hover:text-[#0F1C3F] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreate()} disabled={creating || !newTag.name.trim()}
                className="h-7 px-2.5 text-xs font-medium rounded border border-[#C49A38] bg-[#C49A38] text-white hover:bg-[#A07820] hover:border-[#A07820] disabled:opacity-50 transition-colors">
                {creating ? "Creating…" : "Create Tag"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded border border-[#DDD5C4] divide-y divide-[#EFE8D8]" style={{ overflow: "clip" }}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F2EC] text-[9px] font-semibold text-[#8A9BB8] uppercase tracking-wider">
          <span className="w-3 shrink-0" />
          <span className="flex-1">Name</span>
          <span className="w-20 shrink-0 text-center">Required</span>
          <span className="w-16 shrink-0 text-center">Built-in</span>
          <span className="w-20 shrink-0" />
        </div>
        {items.length === 0 && (
          <div className="px-4 py-6 text-xs text-[#8A9BB8] text-center">No tags yet — click New Tag to create one.</div>
        )}
        {items.map((tag) => {
          const isEditing = editingId === tag.id;
          const draft = drafts[tag.id];
          const isSaving = savingId === tag.id;
          const isSaved = savedId === tag.id;
          const isDeleting = deletingId === tag.id;
          const displayColor = isEditing ? (draft?.color ?? tag.color) : tag.color;
          return (
            <div key={tag.id} className={`flex items-center gap-2 px-3 py-2 transition-colors ${isDeleting ? "opacity-40 pointer-events-none" : isEditing ? "bg-[#F5F3EE]" : "bg-white hover:bg-[#FDFCFA]"}`}>
              <div className="w-3 shrink-0 flex justify-center">
                <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: displayColor }} />
              </div>
              {isEditing && draft ? (
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => patchDraft(tag.id, { name: e.target.value })}
                      disabled={tag.isBuiltin}
                      className="flex-1 h-6 text-xs rounded border border-[#D4C9B5] px-1.5 bg-white focus:outline-none focus:border-[#1B4FD8] disabled:opacity-60 disabled:bg-[#F5F2EC]"
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => patchDraft(tag.id, { color: c })}
                          className={`w-3.5 h-3.5 rounded-full border-2 transition-transform hover:scale-110 ${draft.color === c ? "border-[#0F1C3F] scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                      <input type="color" value={draft.color} onChange={(e) => patchDraft(tag.id, { color: e.target.value })}
                        className="w-4 h-4 rounded cursor-pointer border-none p-0" title="Custom color" />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(e) => patchDraft(tag.id, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="w-full h-6 text-xs rounded border border-[#D4C9B5] px-1.5 bg-white focus:outline-none focus:border-[#1B4FD8]"
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#0F1C3F]">{tag.name}</div>
                  {tag.description && <div className="text-[10px] text-[#8A9BB8] truncate">{tag.description}</div>}
                </div>
              )}
              <div className="w-20 shrink-0 flex justify-center">
                {isEditing && draft ? (
                  <input type="checkbox" checked={draft.isRequired} onChange={(e) => patchDraft(tag.id, { isRequired: e.target.checked })} className="accent-[#0F1C3F] cursor-pointer" />
                ) : (
                  tag.isRequired
                    ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Required</span>
                    : <span className="text-[10px] text-[#B0BCCE]">Optional</span>
                )}
              </div>
              <div className="w-16 shrink-0 flex justify-center">
                {tag.isBuiltin
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F0F0] text-[#9CA3AF] font-medium">Built-in</span>
                  : <span className="text-[10px] text-[#B0BCCE]">Custom</span>}
              </div>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1.5">
                {isSaving ? (
                  <svg className="w-3.5 h-3.5 text-[#B0BCCE] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                ) : isSaved ? (
                  <svg className="w-3.5 h-3.5 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                ) : isEditing ? (
                  <>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="h-6 px-1.5 text-[10px] rounded border border-[#D4C9B5] bg-white text-[#6B7A99] hover:border-[#0F1C3F] hover:text-[#0F1C3F] transition-colors">
                      Cancel
                    </button>
                    <button type="button" onClick={() => void handleSave(tag)}
                      className="h-6 px-1.5 text-[10px] font-medium rounded border border-[#C49A38] bg-[#C49A38] text-white hover:bg-[#A07820] hover:border-[#A07820] transition-colors">
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startEdit(tag)}
                      className="h-6 w-6 flex items-center justify-center rounded border border-[#D4C9B5] bg-white text-[#6B7A99] hover:border-[#0F1C3F] hover:text-[#0F1C3F] transition-colors"
                      title="Edit tag">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    {!tag.isBuiltin && (
                      <button type="button" onClick={() => void handleDelete(tag)} disabled={isDeleting}
                        className="h-6 w-6 flex items-center justify-center rounded border border-red-200 bg-white text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-400 transition-colors disabled:opacity-50"
                        title="Delete tag">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
