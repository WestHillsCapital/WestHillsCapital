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
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      {items.length === 0 && <div className="text-xs text-[#8A9BB8]">No field groups yet. Add one to bundle fields for fast package setup.</div>}
      <div className="space-y-2">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const memberCount = item.fieldIds.length;
          const usagePackages = item.usagePackages ?? [];
          return (
            <div key={item.id} className="rounded border border-[#EFE8D8] bg-[#F8F6F0] p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {isExpanded ? (
                    <Input
                      value={item.name}
                      onChange={(e) => onChange(item.id, { name: e.target.value })}
                      className="h-7 text-xs bg-white font-medium"
                    />
                  ) : (
                    <div className="text-xs font-medium text-[#0F1C3F] truncate">{item.name}</div>
                  )}
                  <div className="text-[10px] text-[#8A9BB8] mt-0.5">
                    {memberCount} field{memberCount !== 1 ? "s" : ""}
                    {memberCount > 0 && (
                      <span className="ml-1 truncate">
                        — {item.fieldIds.slice(0, 3).map((id) => fieldLibrary.find((f) => f.id === id)?.label ?? id).join(", ")}
                        {memberCount > 3 ? ` +${memberCount - 3} more` : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5">
                    {usagePackages.length === 0 ? (
                      <span className="text-[#B0BED4]">Not used in any packages</span>
                    ) : (
                      <span className="text-[#6B7A99]">
                        Used in {usagePackages.length} package{usagePackages.length !== 1 ? "s" : ""}
                        {" — "}{usagePackages.slice(0, 3).map((p) => p.name).join(", ")}
                        {usagePackages.length > 3 ? ` +${usagePackages.length - 3} more` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onUseGroup && (
                    <button
                      type="button"
                      onClick={() => onUseGroup(item)}
                      title="Add all group fields to current package"
                      className="text-[11px] text-[#6B7A99] hover:text-[#1B4FD8] transition-colors"
                    >
                      Use
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="text-[11px] text-[#8A9BB8] hover:text-[#4A5568]"
                  >
                    {isExpanded ? "▲" : "▾"}
                  </button>
                </div>
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
              )}
            </div>
          );
        })}
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
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="mb-2 relative">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input type="text" placeholder="Search…" value={entitySearch} onChange={(e) => setEntitySearch(e.target.value)} className="w-full h-7 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-2 bg-white focus:outline-none focus:border-[#1B4FD8]" />
      </div>
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {filteredEntities.map((item) => (
          <div key={item.id} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.name} onChange={(e) => onChange(item.id, { name: e.target.value })} className="h-8 text-xs bg-white" />
            {showKind && (
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-[#8A9BB8]">Category</label>
                <input
                  type="text"
                  list={`kind-suggestions-${item.id}`}
                  value={item.kind ?? "general"}
                  onChange={(e) => onChange(item.id, { kind: e.target.value })}
                  placeholder="e.g. Vendor, Partner…"
                  className="w-full border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white"
                />
                {kindSuggestions && kindSuggestions.length > 0 && (
                  <datalist id={`kind-suggestions-${item.id}`}>
                    {kindSuggestions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={item.phone ?? ""} onChange={(e) => onChange(item.id, { phone: e.target.value })} className="h-8 text-xs bg-white" />
              <Input placeholder="Email" value={item.email ?? ""} onChange={(e) => onChange(item.id, { email: e.target.value })} className="h-8 text-xs bg-white" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-[#6B7A99]">
                <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} />
                Active
              </label>
              <div className="flex items-center gap-2">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="text-[11px] text-red-500 disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Deleting…" : "Delete"}
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
        ))}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">None yet.</div>}
        {items.length > 0 && filteredEntities.length === 0 && <div className="text-xs text-[#8A9BB8]">No results for "{entitySearch}".</div>}
      </div>
    </div>
  );
}

export function TransactionTypesPanel({
  items,
  onAdd,
  onChange,
  onSave,
  onDelete,
}: {
  items: TransactionType[];
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
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [selectLastOnAdd, setSelectLastOnAdd] = useState(false);
  const prevItemsLengthRef = useRef(items.length);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  const q = searchQuery.trim().toLowerCase();
  const visibleItems = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  const selectedItem = items.find((i) => i.scope === selectedScope) ?? null;

  useEffect(() => {
    if (selectLastOnAdd && items.length > prevItemsLengthRef.current) {
      const newest = items[items.length - 1];
      if (newest) {
        setSelectedScope(newest.scope);
        setMobileView("detail");
        setTimeout(() => selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
      }
      setSelectLastOnAdd(false);
    }
    prevItemsLengthRef.current = items.length;
  }, [items, selectLastOnAdd]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    const first = visibleItems[0];
    if (first) {
      setSelectedScope(first.scope);
      setTimeout(() => selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
    else setSelectLastOnAdd(true);
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
    if (err) {
      setPanelError(err);
    } else {
      setSelectedScope(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Transaction Types</h3>
          <p className="text-[11px] text-[#8A9BB8]">Manage the types available to packages and interview launchers.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "+ Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}

      {/* Two-pane master-detail */}
      <div className="flex border border-[#DDD5C4] rounded overflow-hidden" style={{ height: "400px" }}>
        {/* LEFT: list */}
        <div
          className={`flex flex-col border-r border-[#DDD5C4] bg-[#F8F6F0] shrink-0 ${mobileView === "detail" ? "hidden md:flex" : "flex"}`}
          style={{ width: "200px" }}
        >
          {/* Search */}
          <div className="p-2 border-b border-[#E8E0D4] bg-[#F8F6F0]">
            <div className="relative">
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Search types…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-6 bg-white focus:outline-none focus:border-[#1B4FD8]"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#B0BCCE] hover:text-[#6B7A99]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable list — ↑/↓ keyboard navigation */}
          <div
            ref={listScrollRef}
            className="flex-1 overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              if (visibleItems.length === 0) return;
              e.preventDefault();
              const currentIdx = visibleItems.findIndex((i) => i.scope === selectedScope);
              let nextIdx: number;
              if (e.key === "ArrowDown") {
                nextIdx = currentIdx < visibleItems.length - 1 ? currentIdx + 1 : 0;
              } else {
                nextIdx = currentIdx > 0 ? currentIdx - 1 : visibleItems.length - 1;
              }
              const next = visibleItems[nextIdx];
              if (next) {
                setSelectedScope(next.scope);
                setMobileView("detail");
                setTimeout(() => selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 16);
              }
            }}
          >
            {visibleItems.map((item) => {
              const isSel = item.scope === selectedScope;
              return (
                <button
                  key={item.scope}
                  ref={isSel ? selectedRowRef : null}
                  type="button"
                  onClick={() => { setSelectedScope(item.scope); setMobileView("detail"); }}
                  className={`w-full text-left px-3 py-2 border-b border-[#EFE8D8] transition-colors ${isSel ? "bg-[#0F1C3F]" : "bg-transparent hover:bg-[#EDE7D9]"}`}
                >
                  <div className={`text-[11px] font-medium leading-tight line-clamp-2 ${!item.label ? "italic opacity-50" : isSel ? "text-white" : "text-[#0F1C3F]"}`}>
                    {item.label || "untitled"}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isSel ? "text-white/60" : "text-[#8A9BB8]"}`}>
                    {item.active ? "Active" : "Inactive"}
                  </div>
                </button>
              );
            })}
            {visibleItems.length === 0 && (
              <div className="p-5 text-[11px] text-[#8A9BB8] text-center">
                {searchQuery ? `No results for "${searchQuery}".` : "No types yet."}
              </div>
            )}
          </div>

          {/* Count footer */}
          <div className="px-3 py-1.5 border-t border-[#E8E0D4] text-[10px] text-[#8A9BB8] shrink-0 bg-[#F8F6F0]">
            {visibleItems.length} of {items.length} type{items.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* RIGHT: detail / edit */}
        <div className={`flex-1 min-w-0 overflow-y-auto bg-[#FDFCFA] ${mobileView === "list" ? "hidden md:block" : "block"}`}>
          {selectedItem ? (
            <div className="p-4 space-y-3 text-sm">
              <button type="button" onClick={() => setMobileView("list")} className="md:hidden flex items-center gap-1 text-[11px] text-[#6B7A99] hover:text-[#0F1C3F] mb-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                Back to list
              </button>

              <div>
                <div className="text-[10px] text-[#8A9BB8] font-medium uppercase tracking-wide mb-1">Label</div>
                <Input
                  value={selectedItem.label}
                  onChange={(e) => onChange(selectedItem.scope, { label: e.target.value })}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div>
                <div className="text-[10px] text-[#8A9BB8] font-medium uppercase tracking-wide mb-1">Sort order</div>
                <Input
                  type="number"
                  value={selectedItem.sort_order}
                  onChange={(e) => onChange(selectedItem.scope, { sort_order: Number(e.target.value || 0) })}
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7A99]">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={selectedItem.active}
                    onChange={(e) => onChange(selectedItem.scope, { active: e.target.checked })}
                  />
                  Active
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EFE8D8]">
                <span className="text-[10px] text-[#B0BCCE]">{selectedItem.scope}</span>
                <div className="flex gap-3">
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(selectedItem)}
                      disabled={deletingScope === selectedItem.scope}
                      className="text-[11px] text-red-500 disabled:opacity-50"
                    >
                      {deletingScope === selectedItem.scope ? "Deleting…" : "Delete"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSave(selectedItem)}
                    disabled={savingScope === selectedItem.scope}
                    className="text-[11px] font-medium text-[#C49A38] disabled:opacity-50"
                  >
                    {savingScope === selectedItem.scope ? "Saving…" : savedScope === selectedItem.scope ? "✓ Saved" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[11px] text-[#8A9BB8]">
              Select a type to edit
            </div>
          )}
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
  const changed: string[] = [];
  const checks: Array<[keyof FieldLibraryItem, string]> = [
    ["label",          "label"],
    ["category",       "category"],
    ["type",           "type"],
    ["source",         "prefill"],
    ["sensitive",      "sensitive"],
    ["required",       "required"],
    ["active",         "active"],
    ["validationType", "validation"],
    ["sortOrder",      "order"],
  ];
  for (const [key, name] of checks) {
    if (JSON.stringify(older[key]) !== JSON.stringify(newer[key])) changed.push(name);
  }
  if (JSON.stringify(older.options) !== JSON.stringify(newer.options)) changed.push("options");
  if (
    older.validationPattern !== newer.validationPattern ||
    older.validationMessage !== newer.validationMessage
  ) {
    if (!changed.includes("validation")) changed.push("validation");
  }
  if (newer.restoredFromVersion != null) return `Restored from v${newer.restoredFromVersion}`;
  return changed.length > 0 ? changed.join(", ") : "minor changes";
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
  const [sortBy, setSortBy] = useState<"default" | "most-answered">("default");
  const [showNeverUsed, setShowNeverUsed] = useState(false);
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
    dupFields: FieldLibraryImportField[];
  } | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<FieldLibraryImportResult | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [selectLastOnAdd, setSelectLastOnAdd] = useState(false);
  const prevItemsLengthRef = useRef(items.length);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

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
    if (selectLastOnAdd && items.length > prevItemsLengthRef.current) {
      const newest = items[items.length - 1];
      if (newest) {
        setSelectedId(newest.id);
        setMobileView("detail");
        setTimeout(() => selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
      }
      setSelectLastOnAdd(false);
    }
    prevItemsLengthRef.current = items.length;
  }, [items, selectLastOnAdd]);

  // When search produces a filtered list, auto-select and scroll to first match
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    const first = items.find((i) =>
      i.label.toLowerCase().includes(q) ||
      (i.category ?? "").toLowerCase().includes(q) ||
      (i.source ?? "").toLowerCase().includes(q)
    );
    if (first) {
      setSelectedId(first.id);
      setTimeout(() => selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }
  }, [searchQuery, items]);

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
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as FieldLibraryImportPayload;
        if (!parsed || !Array.isArray(parsed.fields)) {
          setImportParseError("File does not contain a valid field library export (missing \"fields\" array).");
          return;
        }
        const existingLabelSet = new Set(items.map((i) => i.label.trim().toLowerCase()));
        const newFields: FieldLibraryImportField[] = [];
        const dupFields: FieldLibraryImportField[] = [];
        for (const f of parsed.fields) {
          if (!f.label?.trim()) continue;
          if (existingLabelSet.has(f.label.trim().toLowerCase())) {
            dupFields.push(f);
          } else {
            newFields.push(f);
          }
        }
        setImportPreview({ payload: parsed, newFields, dupFields });
      } catch {
        setImportParseError("Could not parse the file — make sure it is a valid JSON export.");
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
    else setSelectLastOnAdd(true);
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
    else setSelectedId(null);
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

  // Filtering / sorting
  const hasUsageData = items.some((i) => i.packageCount !== undefined);
  const q = searchQuery.trim().toLowerCase();
  let visibleItems = [...items];
  if (q) visibleItems = visibleItems.filter((i) =>
    i.label.toLowerCase().includes(q) ||
    (i.category ?? "").toLowerCase().includes(q) ||
    (i.source ?? "").toLowerCase().includes(q)
  );
  if (showNeverUsed) visibleItems = visibleItems.filter((i) => (i.packageCount ?? 0) === 0);
  if (sortBy === "most-answered") visibleItems = [...visibleItems].sort((a, b) => (b.answerCount ?? 0) - (a.answerCount ?? 0));

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const isInherited = !!(selectedItem?.inherited || (selectedItem as (FieldLibraryItem & { inheritedFrom?: string }) | null)?.inheritedFrom);
  const h = showHints;

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      {importPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#DDD5C4] w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-5 pt-5 pb-3 border-b border-[#EFE8D8]">
              <h2 className="text-sm font-semibold text-[#0F1C3F]">Review import</h2>
              <p className="text-[11px] text-[#6B7A99] mt-0.5">
                {importPreview.newFields.length} field{importPreview.newFields.length !== 1 ? "s" : ""} will be added
                {importPreview.dupFields.length > 0 && `, ${importPreview.dupFields.length} already exist and will be skipped`}
                {(importPreview.payload.fieldGroups ?? []).length > 0 && `, ${(importPreview.payload.fieldGroups ?? []).length} group${(importPreview.payload.fieldGroups ?? []).length !== 1 ? "s" : ""} included`}.
              </p>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1">
              {importPreview.newFields.length === 0 && importPreview.dupFields.length === 0 && (
                <p className="text-[11px] text-[#8A9BB8]">No fields found in this file.</p>
              )}
              {importPreview.newFields.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-[#0F1C3F] truncate">{f.label}</span>
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#059669] font-medium text-[10px]">New</span>
                </div>
              ))}
              {importPreview.dupFields.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px] opacity-50">
                  <span className="text-[#0F1C3F] truncate">{f.label}</span>
                  <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#F0F0F0] text-[#9CA3AF] font-medium text-[10px]">Duplicate</span>
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
                disabled={importLoading || (importPreview.newFields.length === 0 && (importPreview.payload.fieldGroups ?? []).length === 0)}
                onClick={() => void handleImportConfirm()}
                className="text-xs bg-[#1B4FD8] text-white rounded px-3 py-1.5 disabled:opacity-50 hover:bg-[#1540B0] transition-colors"
              >
                {importLoading
                  ? "Importing…"
                  : importPreview.newFields.length > 0
                    ? `Import ${importPreview.newFields.length} field${importPreview.newFields.length !== 1 ? "s" : ""}`
                    : `Import ${(importPreview.payload.fieldGroups ?? []).length} group${(importPreview.payload.fieldGroups ?? []).length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {importResult && (
        <div className="mb-2 rounded bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] px-3 py-2 text-[11px] flex items-start justify-between gap-2">
          <span>
            Added {importResult.added} field{importResult.added !== 1 ? "s" : ""}
            {importResult.skipped > 0 && `, skipped ${importResult.skipped} duplicate${importResult.skipped !== 1 ? "s" : ""}`}
            {(importResult.groupsAdded ?? 0) > 0 && `, added ${importResult.groupsAdded} group${(importResult.groupsAdded ?? 0) !== 1 ? "s" : ""}`}
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
        <div className="flex items-center gap-2">
          {onImport && (
            <>
              <input ref={importFileRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImportFileChange} />
              <button
                type="button"
                onClick={() => { setImportParseError(null); setImportResult(null); importFileRef.current?.click(); }}
                className="text-xs text-[#6B7A99] hover:text-[#0F1C3F] transition-colors"
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
                className="text-xs text-[#6B7A99] hover:text-[#0F1C3F] disabled:opacity-50 transition-colors flex items-center gap-0.5"
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
          <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
            {adding ? "Adding…" : "+ Add"}
          </button>
        </div>
      </div>
      {/* Search bar above the two-pane layout */}
      <div className="relative mb-2">
        <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#B0BCCE] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input
          type="text"
          placeholder="Search fields…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-7 text-[11px] rounded border border-[#D4C9B5] pl-6 pr-6 bg-white focus:outline-none focus:border-[#1B4FD8]"
        />
        {searchQuery && (
          <button type="button" onClick={() => setSearchQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#B0BCCE] hover:text-[#6B7A99]">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>
      {/* Two-pane master-detail */}
      <div className="flex border border-[#DDD5C4] rounded overflow-hidden" style={{ height: "520px" }}>
        {/* LEFT: settings-nav style field list */}
        <div
          className={`flex flex-col border-r border-[#DDD5C4] bg-[#F8F6F0] shrink-0 ${mobileView === "detail" ? "hidden md:flex" : "flex"}`}
          style={{ width: "200px" }}
        >
          {/* Sort / filter (usage data only) */}
          {hasUsageData && (
            <div className="px-2 py-1.5 border-b border-[#E8E0D4] flex flex-wrap items-center gap-1.5 bg-[#F8F6F0]">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "default" | "most-answered")} className="h-5 text-[10px] border border-[#D4C9B5] rounded px-1 bg-white text-[#4A5568]">
                <option value="default">Sort: default</option>
                <option value="most-answered">Most answered</option>
              </select>
              <button type="button" onClick={() => setShowNeverUsed((v) => !v)} className={`h-5 text-[10px] px-1.5 rounded border transition-colors ${showNeverUsed ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "border-[#D4C9B5] text-[#6B7A99] hover:border-[#0F1C3F] hover:text-[#0F1C3F] bg-white"}`}>
                {showNeverUsed ? "✕" : "Unused"}
              </button>
            </div>
          )}
          {/* Scrollable field list — ↑/↓ keyboard navigation */}
          <div
            ref={listScrollRef}
            className="flex-1 overflow-y-auto"
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              if (visibleItems.length === 0) return;
              e.preventDefault();
              const currentIdx = visibleItems.findIndex((i) => i.id === selectedId);
              let nextIdx: number;
              if (e.key === "ArrowDown") {
                nextIdx = currentIdx < visibleItems.length - 1 ? currentIdx + 1 : 0;
              } else {
                nextIdx = currentIdx > 0 ? currentIdx - 1 : visibleItems.length - 1;
              }
              const nextItem = visibleItems[nextIdx];
              if (nextItem) {
                setSelectedId(nextItem.id);
                setMobileView("detail");
                setTimeout(() => selectedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 16);
              }
            }}
          >
            {visibleItems.map((item) => {
              const isSel = item.id === selectedId;
              const pkgCount = item.packageCount ?? 0;
              const listTags = optimisticTagsMap.get(item.id) ?? item.complianceTags ?? [];
              return (
                <button
                  key={item.id}
                  ref={isSel ? selectedRowRef : null}
                  type="button"
                  onClick={() => { setSelectedId(item.id); setMobileView("detail"); }}
                  className={`w-full text-left px-3 py-2 border-b border-[#EFE8D8] transition-colors ${isSel ? "bg-[#0F1C3F]" : "bg-transparent hover:bg-[#EDE7D9]"}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={`text-[11px] font-medium leading-tight line-clamp-2 ${!item.label ? "italic opacity-50" : isSel ? "text-white" : "text-[#0F1C3F]"}`}>
                      {item.label || "untitled"}
                    </span>
                    <span className={`shrink-0 mt-0.5 text-[9px] px-1 rounded capitalize ${isSel ? "bg-white/20 text-white" : "bg-[#EFE8D8] text-[#6B7A99]"}`}>{item.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {item.category && <span className={`text-[10px] truncate ${isSel ? "text-white/70" : "text-[#8A9BB8]"}`}>{item.category}</span>}
                    {hasUsageData && pkgCount > 0 && <span className={`shrink-0 text-[9px] font-medium ${isSel ? "text-white/80" : "text-[#1B4FD8]"}`}>{pkgCount}p</span>}
                    {listTags.length > 0 && allComplianceTags && (
                      <div className="flex gap-0.5 shrink-0 ml-auto">
                        {listTags.slice(0, 4).map((tagName) => {
                          const tagMeta = allComplianceTags.find((t) => t.name === tagName);
                          return <span key={tagName} className="w-1.5 h-1.5 rounded-full opacity-80" style={{ backgroundColor: tagMeta?.color ?? "#6B7A99" }} />;
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {visibleItems.length === 0 && (
              <div className="p-5 text-[11px] text-[#8A9BB8] text-center">
                {searchQuery ? `No results for "${searchQuery}".` : showNeverUsed ? "All fields are used." : "No shared fields yet."}
              </div>
            )}
          </div>
          {/* Count footer */}
          <div className="px-3 py-1.5 border-t border-[#E8E0D4] text-[10px] text-[#8A9BB8] shrink-0 bg-[#F8F6F0]">
            {visibleItems.length} of {items.length} field{items.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* RIGHT: detail / edit panel */}
        <div className={`flex-1 min-w-0 overflow-y-auto bg-[#FDFCFA] ${mobileView === "list" ? "hidden md:block" : "block"}`}>
          {selectedItem ? (
            <div className="p-4 space-y-2 text-sm">
              <button type="button" onClick={() => setMobileView("list")} className="md:hidden flex items-center gap-1 text-[11px] text-[#6B7A99] hover:text-[#0F1C3F] mb-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                Back to list
              </button>
              {panelError && <div className="rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
              {selectedItem.packageCount !== undefined && (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${selectedItem.packageCount > 0 ? "bg-[#EBF0FB] text-[#1B4FD8]" : "bg-[#F0F0F0] text-[#9CA3AF]"}`}>{selectedItem.packageCount} pkg{selectedItem.packageCount !== 1 ? "s" : ""}</span>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${(selectedItem.answerCount ?? 0) > 0 ? "bg-[#ECFDF5] text-[#059669]" : "bg-[#F0F0F0] text-[#9CA3AF]"}`}>{(selectedItem.answerCount ?? 0).toLocaleString()} answered</span>
                  {selectedItem.lastAnswered && <span className="text-[#8A9BB8]">last {relativeTime(selectedItem.lastAnswered)}</span>}
                </div>
              )}
              <div className="relative pt-1">
                {h && <HL>Label</HL>}
                <Input value={selectedItem.label} onChange={(e) => onChange(selectedItem.id, { label: e.target.value })} className="h-8 text-xs bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative pt-1">
                  {h && <HL>Category</HL>}
                  <Input placeholder="Category" value={selectedItem.category} onChange={(e) => onChange(selectedItem.id, { category: e.target.value })} className="h-8 text-xs bg-white" />
                </div>
                <div className="relative pt-1">
                  {h && <HL>Prefill source</HL>}
                  <Input placeholder="Prefill source" value={selectedItem.source} onChange={(e) => onChange(selectedItem.id, { source: e.target.value })} className="h-8 text-xs bg-white" />
                </div>
              </div>
              <div className="relative pt-1">
                {h && <HL>Sort order</HL>}
                <Input type="number" placeholder="Sort order" value={selectedItem.sortOrder} onChange={(e) => onChange(selectedItem.id, { sortOrder: Number(e.target.value || 100) })} className="h-8 text-xs bg-white" />
              </div>
              <div className="relative pt-1">
                {h && <HL>Field type</HL>}
                <div className="flex flex-wrap gap-1">
                  {([
                    { value: "text",     label: "Text",     tip: "A freeform typed response — any text the user types" },
                    { value: "radio",    label: "Radio",    tip: "One selection from a group — only one option can be chosen" },
                    { value: "checkbox", label: "Checkbox", tip: "A checked or unchecked box — supports multiple selections when options are defined" },
                    { value: "dropdown", label: "Dropdown", tip: "A choice from a predefined list — single selection from a dropdown menu" },
                  ] as const).map(({ value, label, tip }) => (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <button type="button" onClick={() => onChange(selectedItem.id, { type: value })} className={`px-2 py-0.5 text-xs rounded border transition-colors ${selectedItem.type === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}>{label}</button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">{tip}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <div className="relative pt-1">
                {h && <HL>Validation rule</HL>}
                <div role="group" aria-label="Validation rule" className="flex flex-wrap gap-1">
                  {([
                    { value: "none",     label: "None",     tip: "No validation — any input is accepted" },
                    { value: "name",     label: "Name",     tip: "Validates as a person's name — letters, spaces, hyphens, and apostrophes" },
                    { value: "email",    label: "Email",    tip: "Validates as an email address — must contain @ and a valid domain" },
                    { value: "phone",    label: "Phone",    tip: "Validates as a US phone number — 10 digits, accepts common formats like (555) 555-5555" },
                    { value: "ssn",      label: "SSN",      tip: "Validates as a Social Security Number — expects NNN-NN-NNNN format" },
                    { value: "number",   label: "Number",   tip: "Validates as a numeric value — digits only, no formatting" },
                    { value: "currency", label: "Currency", tip: "Validates as a dollar amount — accepts values like 1,234.56 or $1234" },
                    { value: "date",     label: "Date",     tip: "Validates as a date — expects MM/DD/YYYY format" },
                    { value: "custom",   label: "Custom",   tip: "Validates against a custom regular expression pattern you provide below" },
                  ] as const).map(({ value, label, tip }) => (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <button type="button" aria-pressed={(selectedItem.validationType ?? "none") === value} onClick={() => onChange(selectedItem.id, { validationType: value as FieldItem["validationType"] })} className={`px-2 py-0.5 text-xs rounded border transition-colors ${(selectedItem.validationType ?? "none") === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}>{label}</button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">{tip}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <div className="relative pt-1">
                {h && <HL>Options</HL>}
                <Textarea
                  placeholder={
                    selectedItem.type === "checkbox"
                      ? "One checkbox per line, e.g.\nI agree to the terms and conditions\nI am a US person or entity"
                      : selectedItem.type === "dropdown"
                      ? "One option per line, e.g.\nOption A\nOption B\nOption C"
                      : selectedItem.type === "radio"
                      ? "One choice per line, e.g.\nYes\nNo\nUnsure"
                      : "One option per line (used for Radio, Checkbox, or Dropdown fields)"
                  }
                  value={selectedItem.options.join("\n")}
                  onChange={(e) => onChange(selectedItem.id, { options: e.target.value.split("\n").filter(Boolean) })}
                  className="min-h-16 text-xs bg-white"
                />
              </div>
              {selectedItem.validationType === "custom" && <Input placeholder="Regex pattern" value={selectedItem.validationPattern ?? ""} onChange={(e) => onChange(selectedItem.id, { validationPattern: e.target.value })} className="h-8 text-xs bg-white" />}
              <div className="relative pt-1">
                {h && <HL>Validation message</HL>}
                <Input placeholder="Validation message" value={selectedItem.validationMessage ?? ""} onChange={(e) => onChange(selectedItem.id, { validationMessage: e.target.value })} className="h-8 text-xs bg-white" />
              </div>
              <div className="relative pt-1">
                {h && <HL>Active · Required · Sensitive</HL>}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7A99]">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={selectedItem.active} onChange={(e) => onChange(selectedItem.id, { active: e.target.checked })} />
                    Active
                    <Tooltip><TooltipTrigger asChild><span className="inline-flex items-center text-[#B0BCCE] cursor-default"><Info className="w-2.5 h-2.5" /></span></TooltipTrigger><TooltipContent side="top" className="max-w-[180px] text-xs">Field appears in the interview form when active.</TooltipContent></Tooltip>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={selectedItem.required} onChange={(e) => onChange(selectedItem.id, { required: e.target.checked })} />
                    Required
                    <Tooltip><TooltipTrigger asChild><span className="inline-flex items-center text-[#B0BCCE] cursor-default"><Info className="w-2.5 h-2.5" /></span></TooltipTrigger><TooltipContent side="top" className="max-w-[180px] text-xs">Staff must fill this field before the document can be generated.</TooltipContent></Tooltip>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={selectedItem.sensitive} onChange={(e) => onChange(selectedItem.id, { sensitive: e.target.checked })} />
                    Sensitive
                    <Tooltip><TooltipTrigger asChild><span className="inline-flex items-center text-[#B0BCCE] cursor-default"><Info className="w-2.5 h-2.5" /></span></TooltipTrigger><TooltipContent side="top" className="max-w-[180px] text-xs">Value is masked in logs and exports to protect private data.</TooltipContent></Tooltip>
                  </label>
                </div>
              </div>
              {allComplianceTags !== undefined && (
                <div className="relative pt-1">
                  {(() => {
                    const displayTags = optimisticTagsMap.get(selectedItem.id) ?? selectedItem.complianceTags ?? [];
                    const applyTagChange = (next: string[]) => {
                      setOptimisticTagsMap((m) => { const n = new Map(m); n.set(selectedItem.id, next); return n; });
                      setTagSavingId(selectedItem.id);
                      void onSetComplianceTags!(selectedItem.id, next).then((err) => {
                        setTagSavingId(null);
                        if (err) {
                          setOptimisticTagsMap((m) => { const n = new Map(m); n.delete(selectedItem.id); return n; });
                          setPanelError(err);
                        } else {
                          setOptimisticTagsMap((m) => { const n = new Map(m); n.delete(selectedItem.id); return n; });
                        }
                      });
                    };
                    return (
                      <>
                        <div className="flex flex-wrap items-center gap-1 min-h-[20px]">
                          {displayTags.map((tagName) => {
                            const tagMeta = allComplianceTags.find((t) => t.name === tagName);
                            return (
                              <ComplianceTagChip
                                key={tagName}
                                name={tagName}
                                color={tagMeta?.color ?? "#6B7A99"}
                                onRemove={onSetComplianceTags ? () => {
                                  applyTagChange(displayTags.filter((n) => n !== tagName));
                                } : undefined}
                              />
                            );
                          })}
                          {onSetComplianceTags && (
                            <button type="button" onClick={() => setTagPickerOpenId((prev) => prev === selectedItem.id ? null : selectedItem.id)} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors px-1">
                              {tagSavingId === selectedItem.id ? "Saving…" : "+ Tags"}
                            </button>
                          )}
                        </div>
                        {tagPickerOpenId === selectedItem.id && onSetComplianceTags && (
                          <ComplianceTagPicker
                            allTags={allComplianceTags}
                            selectedTagNames={displayTags}
                            onToggle={(tagName) => {
                              const next = displayTags.includes(tagName)
                                ? displayTags.filter((n) => n !== tagName)
                                : [...displayTags, tagName];
                              applyTagChange(next);
                            }}
                            onClose={() => setTagPickerOpenId(null)}
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                {onLoadVersions && (
                  <button type="button" onClick={() => void toggleHistory(selectedItem.id)} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors">
                    {historyOpenId === selectedItem.id ? "▲ Hide history" : "▾ History"}
                  </button>
                )}
                {onLoadAnalytics && (
                  <button type="button" onClick={() => void toggleAnalytics(selectedItem.id)} className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors">
                    {analyticsOpenId === selectedItem.id ? "▲ Hide analytics" : "▾ Analytics"}
                  </button>
                )}
              </div>
              {onLoadVersions && historyOpenId === selectedItem.id && (
                <div className="rounded border border-[#E8E0D4] bg-[#F8F5EF] p-2 text-[11px]">
                  {historyLoadingId === selectedItem.id && <p className="text-[#8A9BB8]">Loading history…</p>}
                  {historyError && <p className="text-red-500">{historyError}</p>}
                  {!historyLoadingId && !historyError && (() => {
                    const versions = historyMap.get(selectedItem.id) ?? [];
                    if (versions.length === 0) return <p className="text-[#8A9BB8]">No saved versions yet.</p>;
                    return (
                      <ul className="space-y-1">
                        {versions.map((v, idx) => {
                          const prevSnap = versions[idx + 1]?.snapshot;
                          const summary  = diffSummary(prevSnap, v.snapshot);
                          const author   = v.changedBy ?? "unknown";
                          return (
                            <li key={v.id} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-medium text-[#0B1220]">{relativeTime(v.changedAt)}</span>
                                {" · "}
                                <span className="text-[#6B7A99] truncate max-w-[140px] inline-block align-bottom">{author}</span>
                                <div className="text-[10px] text-[#8A9BB8] truncate">{summary}</div>
                              </div>
                              {onRestoreVersion && (
                                <button type="button" disabled={restoringVersionId === v.id} onClick={() => void handleRestore(selectedItem.id, v.id)} className="shrink-0 text-[10px] text-[#C49A38] hover:text-[#A07820] disabled:opacity-50">
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
              {onLoadAnalytics && analyticsOpenId === selectedItem.id && (
                <div>
                  {analyticsLoadingId === selectedItem.id && <p className="text-[11px] text-[#8A9BB8]">Loading analytics…</p>}
                  {analyticsError && analyticsOpenId === selectedItem.id && <p className="text-[11px] text-red-500">{analyticsError}</p>}
                  {!analyticsLoadingId && !analyticsError && analyticsMap.has(selectedItem.id) && (
                    <FieldAnalyticsPanel analytics={analyticsMap.get(selectedItem.id)!} isSensitive={selectedItem.sensitive} />
                  )}
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t border-[#EFE8D8]">
                <span className="text-[10px] text-[#B0BCCE]">{selectedItem.id}</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => onUse(selectedItem)} className="text-[11px] text-[#6B7A99] hover:text-[#0F1C3F]">Use in package</button>
                  {onDelete && !isInherited && (
                    <button type="button" onClick={() => void handleDelete(selectedItem)} disabled={deletingId === selectedItem.id} className="text-[11px] text-red-500 disabled:opacity-50">
                      {deletingId === selectedItem.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                  <button type="button" onClick={() => void handleSave(selectedItem)} disabled={savingId === selectedItem.id} className="text-[11px] font-medium text-[#C49A38] disabled:opacity-50">
                    {savingId === selectedItem.id ? "Saving…" : savedId === selectedItem.id ? "✓ Saved" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <svg className="w-8 h-8 text-[#C4B99A] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M3.75 6a2.25 2.25 0 012.25-2.25h12A2.25 2.25 0 0120.25 6v12a2.25 2.25 0 01-2.25 2.25h-12A2.25 2.25 0 013.75 18V6z"/></svg>
              <p className="text-[11px] text-[#8A9BB8]">Select a field to edit, or click <strong className="text-[#C49A38]">+ Add</strong> to create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
