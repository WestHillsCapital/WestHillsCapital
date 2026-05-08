import { useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Entity, TransactionType, FieldLibraryItem, FieldVersionRow } from "@/lib/docufill-local-types";
import type { FieldItem } from "@/lib/docufill-types";

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
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
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
                  placeholder="e.g. Custodian, Depository…"
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

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Types</h3>
          <p className="text-[11px] text-[#8A9BB8]">Manage the types available to packages and interview launchers.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <div key={item.scope} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.label} onChange={(e) => onChange(item.scope, { label: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-[#6B7A99]">
                <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.scope, { active: e.target.checked })} />
                Active
              </label>
              <div className="flex items-center gap-2">
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingScope === item.scope}
                    className="text-[11px] text-red-500 disabled:opacity-50"
                  >
                    {deletingScope === item.scope ? "Deleting…" : "Delete"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSave(item)}
                  disabled={savingScope === item.scope}
                  className="text-[11px] text-[#C49A38] disabled:opacity-50"
                >
                  {savingScope === item.scope ? "Saving…" : savedScope === item.scope ? "✓ Saved" : "Save"}
                </button>
              </div>
            </div>
            <div className="text-[10px] text-[#8A9BB8]">{item.scope}</div>
          </div>
        ))}
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

export function FieldLibraryPanel({
  items,
  onAdd,
  onChange,
  onSave,
  onUse,
  onDelete,
  onLoadVersions,
  onRestoreVersion,
}: {
  items: FieldLibraryItem[];
  onAdd: () => Promise<string | null>;
  onChange: (id: string, patch: Partial<FieldLibraryItem>) => void;
  onSave: (item: FieldLibraryItem) => Promise<string | null>;
  onUse: (item: FieldLibraryItem) => void;
  onDelete?: (id: string) => Promise<string | null>;
  onLoadVersions?: (fieldId: string) => Promise<FieldVersionRow[] | string>;
  onRestoreVersion?: (fieldId: string, versionId: number) => Promise<string | null>;
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

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Shared Field Library</h3>
            <span className="relative">
              <button type="button" onClick={() => setShowHints((v) => !v)} className={`flex items-center justify-center w-4 h-4 rounded-full border text-[10px] leading-none select-none transition-colors ${showHints ? "bg-[#C49A38] border-[#C49A38] text-white" : "border-[#C4B99A] text-[#8A9BB8] hover:border-[#C49A38] hover:text-[#C49A38]"}`}>?</button>
              {showHints && (
                <div className="absolute left-0 top-full mt-1.5 w-72 rounded-lg border border-[#DDD5C4] bg-white shadow-lg text-[11px] text-[#4A5568] leading-relaxed px-3 py-2.5 z-50 space-y-1.5">
                  <p><span className="font-semibold text-[#0F1C3F]">Label</span> — the question or prompt shown to the client during the interview.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Category</span> — groups this field with related fields (e.g. "Customer identity", "IRA details").</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Prefill source</span> — the variable key used when mapping this field to a document template (e.g. "firstName").</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Sort order</span> — controls where this field appears relative to others. Lower numbers appear first.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Field type</span> — the kind of input shown: text, date, radio, checkbox, or dropdown.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Validation rule</span> — applies a built-in format check (Name, Email, Phone, SSN, etc.) to the client's entry.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Options</span> — for dropdown, radio, or checkbox fields only. Each line becomes one selectable choice.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Validation message</span> — shown when the client's input fails validation. Leave blank for the default message.</p>
                  <p><span className="font-semibold text-[#0F1C3F]">Active</span> — include in interviews. <span className="font-semibold text-[#0F1C3F]">Required</span> — client must fill in. <span className="font-semibold text-[#0F1C3F]">Sensitive</span> — masked in logs and exports (SSNs, account numbers, etc.).</p>
                </div>
              )}
            </span>
          </div>
          <p className="text-[11px] text-[#8A9BB8]">Define common customer, IRA, beneficiary, and signature fields once, then reuse them in custodian packages.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {items.map((item, idx) => {
          const h = showHints && idx === 1;
          const HL = ({ children }: { children: string }) => (
            <span className="absolute -top-2 left-1.5 z-10 text-[9px] bg-[#C49A38] text-white font-semibold rounded px-1 leading-4 pointer-events-none">{children}</span>
          );
          return (
          <div key={item.id} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <div className="relative pt-1">
              {h && <HL>Label</HL>}
              <Input value={item.label} onChange={(e) => onChange(item.id, { label: e.target.value })} className="h-8 text-xs bg-white" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative pt-1">
                {h && <HL>Category</HL>}
                <Input placeholder="Category" value={item.category} onChange={(e) => onChange(item.id, { category: e.target.value })} className="h-8 text-xs bg-white" />
              </div>
              <div className="relative pt-1">
                {h && <HL>Prefill source</HL>}
                <Input placeholder="Prefill source" value={item.source} onChange={(e) => onChange(item.id, { source: e.target.value })} className="h-8 text-xs bg-white" />
              </div>
            </div>
            <div className="relative pt-1">
              {h && <HL>Sort order</HL>}
              <Input
                type="number"
                placeholder="Sort order"
                value={item.sortOrder}
                onChange={(e) => onChange(item.id, { sortOrder: Number(e.target.value || 100) })}
                className="h-8 text-xs bg-white"
              />
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
                      <button
                        type="button"
                        onClick={() => onChange(item.id, { type: value })}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${item.type === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
                      >
                        {label}
                      </button>
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
                      <button
                        type="button"
                        aria-pressed={(item.validationType ?? "none") === value}
                        onClick={() => onChange(item.id, { validationType: value as FieldItem["validationType"] })}
                        className={`px-2 py-0.5 text-xs rounded border transition-colors ${(item.validationType ?? "none") === value ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : "bg-white text-[#6B7A99] border-[#D4C9B5] hover:border-[#0F1C3F] hover:text-[#0F1C3F]"}`}
                      >
                        {label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">{tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
            <div className="relative pt-1">
              {h && <HL>Options</HL>}
              <Textarea placeholder="Options, one per line" value={item.options.join("\n")} onChange={(e) => onChange(item.id, { options: e.target.value.split("\n").filter(Boolean) })} className="min-h-16 text-xs bg-white" />
            </div>
            {item.validationType === "custom" && <Input placeholder="Regex pattern" value={item.validationPattern ?? ""} onChange={(e) => onChange(item.id, { validationPattern: e.target.value })} className="h-8 text-xs bg-white" />}
            <div className="relative pt-1">
              {h && <HL>Validation message</HL>}
              <Input placeholder="Validation message" value={item.validationMessage ?? ""} onChange={(e) => onChange(item.id, { validationMessage: e.target.value })} className="h-8 text-xs bg-white" />
            </div>
            <div className="relative pt-1">
              {h && <HL>Active · Required · Sensitive</HL>}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7A99]">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} />
                  Active
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-[#B0BCCE] cursor-default"><Info className="w-2.5 h-2.5" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[180px] text-xs">Field appears in the interview form when active.</TooltipContent>
                  </Tooltip>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={item.required} onChange={(e) => onChange(item.id, { required: e.target.checked })} />
                  Required
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-[#B0BCCE] cursor-default"><Info className="w-2.5 h-2.5" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[180px] text-xs">Staff must fill this field before the document can be generated.</TooltipContent>
                  </Tooltip>
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={item.sensitive} onChange={(e) => onChange(item.id, { sensitive: e.target.checked })} />
                  Sensitive
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center text-[#B0BCCE] cursor-default"><Info className="w-2.5 h-2.5" /></span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[180px] text-xs">Value is masked in logs and exports to protect private data.</TooltipContent>
                  </Tooltip>
                </label>
              </div>
            </div>
            {onLoadVersions && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => void toggleHistory(item.id)}
                  className="text-[10px] text-[#8A9BB8] hover:text-[#1B4FD8] transition-colors"
                >
                  {historyOpenId === item.id ? "▲ Hide history" : "▾ History"}
                </button>
                {historyOpenId === item.id && (
                  <div className="mt-1.5 rounded border border-[#E8E0D4] bg-[#F8F5EF] p-2 text-[11px]">
                    {historyLoadingId === item.id && (
                      <p className="text-[#8A9BB8]">Loading history…</p>
                    )}
                    {historyError && historyOpenId === item.id && (
                      <p className="text-red-500">{historyError}</p>
                    )}
                    {!historyLoadingId && !historyError && (() => {
                      const versions = historyMap.get(item.id) ?? [];
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
                                  <button
                                    type="button"
                                    disabled={restoringVersionId === v.id}
                                    onClick={() => void handleRestore(item.id, v.id)}
                                    className="shrink-0 text-[10px] text-[#C49A38] hover:text-[#A07820] disabled:opacity-50"
                                  >
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
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8A9BB8]">{item.id}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => onUse(item)} className="text-[11px] text-[#6B7A99]">Use in package</button>
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
        ); })}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">No shared fields yet.</div>}
      </div>
    </div>
  );
}
