import { useEffect, useRef, useState } from "react";
import { SETTINGS_BASE, useBrandColor } from "./settingsUtils";
import type { FieldColorConfig } from "@/hooks/useProductOrgSettings";

// ── Master palette ────────────────────────────────────────────────────────────
// 24 colors shown as a toggleable grid. The active subset forms the palette
// that is randomly cycled when new fields are created.
const MASTER_PALETTE = [
  // Warm: reds / pinks
  "#C45A5A", "#C48787", "#C474A4", "#E05C8A",
  // Warm: oranges / golds
  "#C4997A", "#C4A06B", "#C49A38", "#C4B04F",
  // Cool: greens
  "#8FAF82", "#7A9E82", "#5CAE6A", "#6BAFA0",
  // Cool: teals / cyans
  "#5BA8A0", "#5CC4C4", "#6B9EC4", "#7490C4",
  // Cool: blues / indigos
  "#5C82C4", "#6B7AC4", "#7680C4", "#5C8FD4",
  // Purple / mauve
  "#9474C4", "#A08EC4", "#B474C4", "#C474B4",
];

const DEFAULT_ACTIVE_PALETTE = [
  "#C48787", "#C4997A", "#C4A96A", "#8FAF82", "#6BAFA0",
  "#6B9EC4", "#7680C4", "#9474C4", "#B474C4", "#C474A4",
  "#C4A06B", "#7A9E82", "#7490C4", "#A08EC4", "#C49A38",
];

const DEFAULT_TYPE_COLORS: Record<string, string> = {
  ssn: "#DC2626",
  dob: "#EA580C",
};

const TYPE_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "ssn",      label: "SSN",          hint: "Social Security Number" },
  { value: "dob",      label: "Date of Birth", hint: "Sensitive date" },
  { value: "email",    label: "Email",         hint: "Email address" },
  { value: "phone",    label: "Phone",         hint: "Phone number" },
  { value: "date",     label: "Date",          hint: "MM/DD/YYYY" },
  { value: "number",   label: "Number",        hint: "Numeric value" },
  { value: "currency", label: "Currency",      hint: "Dollar amount" },
  { value: "zip",      label: "ZIP Code",      hint: "5-digit ZIP" },
  { value: "name",     label: "Name",          hint: "Name format" },
  { value: "state",    label: "State",         hint: "US state code" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function isValidHex(s: string) { return HEX_RE.test(s.trim()); }

function masterIncludes(master: string[], color: string) {
  return master.some((m) => m.toUpperCase() === color.toUpperCase());
}

function defaultConfig(): FieldColorConfig {
  return { palette: DEFAULT_ACTIVE_PALETTE, typeColors: DEFAULT_TYPE_COLORS };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FieldColorsSection({
  getAuthHeaders,
  isAdmin,
  currentConfig,
  onConfigChange,
}: {
  getAuthHeaders: () => HeadersInit;
  isAdmin: boolean;
  currentConfig: FieldColorConfig | null;
  onConfigChange: (config: FieldColorConfig | null) => void;
}) {
  const bc = useBrandColor();

  const init = currentConfig ?? defaultConfig();
  const [palette, setPalette]         = useState<string[]>(init.palette);
  const [typeColors, setTypeColors]   = useState<Record<string, string>>(init.typeColors);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const savedTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq                           = useRef(0);

  // Add-custom-color panel
  const [showAdd, setShowAdd]         = useState(false);
  const [addHex, setAddHex]           = useState("#");
  const [addPick, setAddPick]         = useState("#7490C4");
  const addRef                        = useRef<HTMLDivElement>(null);

  // Per-type dropdown
  const [openType, setOpenType]       = useState<string | null>(null);
  const typeRefs                      = useRef<Record<string, HTMLDivElement | null>>({});
  const [customTypeHex, setCustomTypeHex] = useState<Record<string, string>>({});

  // Sync when parent config changes
  useEffect(() => {
    const c = currentConfig ?? defaultConfig();
    setPalette(c.palette);
    setTypeColors(c.typeColors);
  }, [currentConfig]);

  // Click-outside: add panel
  useEffect(() => {
    function h(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAdd(false);
    }
    if (showAdd) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showAdd]);

  // Click-outside: type dropdowns
  useEffect(() => {
    if (!openType) return;
    function h(e: MouseEvent) {
      const ref = typeRefs.current[openType!];
      if (ref && !ref.contains(e.target as Node)) setOpenType(null);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [openType]);

  // ── Save ───────────────────────────────────────────────────────────────────
  async function doSave(
    nextPalette: string[],
    nextTypeColors: Record<string, string>,
    sendNull = false,
  ) {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    const id = ++seq.current;
    try {
      const body = sendNull ? null : { palette: nextPalette, typeColors: nextTypeColors };
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ fieldPalette: body }),
      });
      const data = await res.json() as {
        org?: { field_palette?: FieldColorConfig | null };
        error?: string;
      };
      if (id !== seq.current) return;
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      onConfigChange(sendNull ? null : (data.org?.field_palette ?? body));
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      if (id === seq.current) setError("Failed to save. Please try again.");
    } finally {
      if (id === seq.current) setSaving(false);
    }
  }

  // ── Palette actions ────────────────────────────────────────────────────────
  function toggleMaster(color: string) {
    const upper = color.toUpperCase();
    const active = palette.some((c) => c.toUpperCase() === upper);
    const next = active
      ? palette.filter((c) => c.toUpperCase() !== upper)
      : [...palette, color];
    if (next.length === 0) return;
    setPalette(next);
    void doSave(next, typeColors);
  }

  function removeCustom(color: string) {
    const upper = color.toUpperCase();
    const next = palette.filter((c) => c.toUpperCase() !== upper);
    if (next.length === 0) return;
    setPalette(next);
    void doSave(next, typeColors);
  }

  function handleAddColor() {
    const hex = addHex.trim().toUpperCase();
    if (!isValidHex(hex)) { setError("Enter a valid 6-digit hex (e.g. #3B6CB7)."); return; }
    if (palette.some((c) => c.toUpperCase() === hex)) { setError("That color is already in your palette."); return; }
    const next = [...palette, hex];
    setPalette(next);
    setAddHex("#");
    setShowAdd(false);
    setError(null);
    void doSave(next, typeColors);
  }

  // ── Type override actions ──────────────────────────────────────────────────
  function setTypeOverride(type: string, color: string | null) {
    const next = { ...typeColors };
    if (color === null) {
      delete next[type];
    } else {
      next[type] = color.toUpperCase();
    }
    setTypeColors(next);
    setOpenType(null);
    void doSave(palette, next);
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function resetToDefaults() {
    setPalette(DEFAULT_ACTIVE_PALETTE);
    setTypeColors(DEFAULT_TYPE_COLORS);
    void doSave(DEFAULT_ACTIVE_PALETTE, DEFAULT_TYPE_COLORS, true);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const customColors   = palette.filter((c) => !masterIncludes(MASTER_PALETTE, c));
  const activeMasterCount = palette.filter((c) => masterIncludes(MASTER_PALETTE, c)).length;
  const isDefault = currentConfig === null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section id="field-colors-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

      {/* Header */}
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Field colors</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Customize the palette and per-type color assignments used when auto-assigning colors to new fields.
        </p>
      </div>

      {/* ── Color palette ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium text-gray-900">Color palette</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Toggle colors on or off. Active colors are randomly cycled when new fields are added.
          </p>
        </div>
        <div className="flex-1 min-w-0">
          {/* Master palette grid */}
          <div className="grid grid-cols-8 gap-2 mb-3">
            {MASTER_PALETTE.map((color) => {
              const active = palette.some((c) => c.toUpperCase() === color.toUpperCase());
              return (
                <button
                  key={color}
                  type="button"
                  disabled={!isAdmin || saving}
                  onClick={() => toggleMaster(color)}
                  title={`${active ? "Remove" : "Add"} ${color.toUpperCase()}`}
                  className="relative w-8 h-8 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: active ? color : `${color}35`,
                    border: active ? `2px solid ${color}` : "2px solid #E5E7EB",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,.18)" : undefined,
                    ...(active ? {} : { filter: "grayscale(20%)" }),
                  }}
                >
                  {active ? (
                    <svg viewBox="0 0 12 12" className="w-3 h-3 absolute inset-0 m-auto drop-shadow-sm" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="block w-5 h-px rotate-45 bg-gray-300 rounded" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active count */}
          <p className="text-xs text-gray-400 mb-3">
            <span className="font-semibold text-gray-600">{activeMasterCount}</span> of {MASTER_PALETTE.length} preset colors active
            {customColors.length > 0 && (
              <> · <span className="font-semibold text-gray-600">{customColors.length}</span> custom</>
            )}
          </p>

          {/* Custom colors strip */}
          {customColors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {customColors.map((color) => (
                <div
                  key={color}
                  className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5"
                >
                  <div
                    className="w-3.5 h-3.5 rounded flex-shrink-0 ring-1 ring-black/10"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[11px] font-mono text-gray-600">{color.toUpperCase()}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => removeCustom(color)}
                      disabled={saving}
                      className="ml-0.5 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                      aria-label={`Remove ${color}`}
                    >
                      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" d="M1 1l8 8M9 1L1 9" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add custom color */}
          {isAdmin && (
            <div className="relative inline-block" ref={addRef}>
              <button
                type="button"
                disabled={saving}
                onClick={() => { setShowAdd((v) => !v); setError(null); }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-dashed border-gray-300 hover:border-gray-400 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 2v8M2 6h8" />
                </svg>
                Add custom color
              </button>
              {showAdd && (
                <div className="absolute left-0 top-10 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-56">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Custom color</p>
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="color"
                      value={addPick}
                      onChange={(e) => { setAddPick(e.target.value); setAddHex(e.target.value.toUpperCase()); }}
                      className="h-9 w-10 rounded cursor-pointer border border-gray-200 p-0.5 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={addHex}
                      maxLength={7}
                      onChange={(e) => { setAddHex(e.target.value); if (isValidHex(e.target.value)) setAddPick(e.target.value); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddColor(); }}
                      placeholder="#RRGGBB"
                      className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="w-full rounded-lg py-1.5 text-xs font-semibold text-white transition-colors"
                    style={{ backgroundColor: bc }}
                  >
                    Add to palette
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Type overrides ─────────────────────────────────────────────────── */}
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium text-gray-900">Type overrides</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Pin a specific color to a validation type. Fields of that type always get this color instead of a random one.
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="border border-gray-200 rounded-xl overflow-visible divide-y divide-gray-100">
            {TYPE_OPTIONS.map((opt) => {
              const assigned = typeColors[opt.value] ?? null;
              const isOpen   = openType === opt.value;
              return (
                <div key={opt.value} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                    <span className="ml-2 text-xs text-gray-400 hidden sm:inline">{opt.hint}</span>
                  </div>

                  {/* Color selector */}
                  <div
                    className="relative flex-shrink-0 ml-3"
                    ref={(el) => { typeRefs.current[opt.value] = el; }}
                  >
                    <button
                      type="button"
                      disabled={!isAdmin || saving}
                      onClick={() => setOpenType(isOpen ? null : opt.value)}
                      className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs hover:border-gray-300 transition-colors disabled:opacity-50 min-w-[116px]"
                    >
                      {assigned ? (
                        <>
                          <span
                            className="w-3.5 h-3.5 rounded flex-shrink-0 ring-1 ring-black/10"
                            style={{ backgroundColor: assigned }}
                          />
                          <span className="font-mono text-gray-700">{assigned.toUpperCase()}</span>
                        </>
                      ) : (
                        <>
                          <span className="w-3.5 h-3.5 rounded flex-shrink-0 border-2 border-dashed border-gray-300" />
                          <span className="text-gray-400">Auto</span>
                        </>
                      )}
                      <svg viewBox="0 0 10 6" className="w-2.5 h-2.5 ml-auto flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                        <path d="M1 1l4 4 4-4" />
                      </svg>
                    </button>

                    {/* Dropdown */}
                    {isOpen && (
                      <div className="absolute right-0 top-10 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
                        {/* Auto option */}
                        <button
                          type="button"
                          onClick={() => setTypeOverride(opt.value, null)}
                          className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-gray-50 mb-2 text-xs text-left"
                        >
                          <span className="w-4 h-4 rounded border-2 border-dashed border-gray-300 flex-shrink-0" />
                          <span className="font-medium text-gray-700">Auto — random from palette</span>
                          {!assigned && (
                            <svg viewBox="0 0 12 12" className="w-3 h-3 ml-auto text-green-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </button>

                        {/* Palette swatches */}
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-2 mb-2">From palette</p>
                        <div className="flex flex-wrap gap-1.5 px-1 mb-3">
                          {palette.map((color) => {
                            const sel = assigned?.toUpperCase() === color.toUpperCase();
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setTypeOverride(opt.value, color)}
                                className="w-7 h-7 rounded-lg transition-all focus:outline-none"
                                title={color.toUpperCase()}
                                style={{
                                  backgroundColor: color,
                                  outline: sel ? `2px solid ${color}` : undefined,
                                  outlineOffset: sel ? "2px" : undefined,
                                  boxShadow: sel ? "0 0 0 3px white inset" : "0 1px 2px rgba(0,0,0,.15)",
                                }}
                              />
                            );
                          })}
                        </div>

                        {/* Custom hex */}
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-2 mb-2">Custom hex</p>
                        <div className="flex items-center gap-2 px-1">
                          <input
                            type="color"
                            value={customTypeHex[opt.value] ?? "#7490C4"}
                            onChange={(e) => setCustomTypeHex((p) => ({ ...p, [opt.value]: e.target.value }))}
                            className="h-8 w-9 rounded border border-gray-200 p-0.5 cursor-pointer flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={customTypeHex[opt.value] ?? ""}
                            maxLength={7}
                            onChange={(e) => setCustomTypeHex((p) => ({ ...p, [opt.value]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = customTypeHex[opt.value] ?? "";
                                if (isValidHex(v)) setTypeOverride(opt.value, v);
                              }
                            }}
                            placeholder="#RRGGBB"
                            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const v = customTypeHex[opt.value] ?? "";
                              if (isValidHex(v)) setTypeOverride(opt.value, v);
                            }}
                            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ backgroundColor: bc }}
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 bg-gray-50/50 rounded-b-xl flex items-center justify-between min-h-[52px]">
        <div className="flex items-center gap-3">
          {isAdmin && !isDefault && (
            <button
              type="button"
              disabled={saving}
              onClick={resetToDefaults}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              Reset to defaults
            </button>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Saving…</span>
            </div>
          )}
          {saved && !saving && <span className="text-xs text-green-600 font-medium">✓ Saved</span>}
        </div>
      </div>
    </section>
  );
}
