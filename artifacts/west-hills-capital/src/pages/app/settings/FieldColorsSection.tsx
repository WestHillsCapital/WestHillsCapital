import { useEffect, useRef, useState } from "react";
import { SETTINGS_BASE, useBrandColor } from "./settingsUtils";
import type { FieldColorConfig } from "@/hooks/useProductOrgSettings";

// ── Palette directions ────────────────────────────────────────────────────────
type PaletteDir = {
  id: string;
  label: string;
  description: string;
  colors: string[];
  defaultActive: string[];
};

const PALETTE_DIRECTIONS: PaletteDir[] = [
  {
    id: "bright",
    label: "Bright",
    description: "Balanced, works for everything",
    colors: [
      "#C48787", "#C4997A", "#C4A96A", "#8FAF82", "#6BAFA0",
      "#6B9EC4", "#7680C4", "#9474C4", "#B474C4", "#C474A4",
      "#C4A06B", "#7A9E82", "#7490C4", "#A08EC4", "#C49A38",
      "#C45A5A", "#E05C8A", "#5CAE6A", "#5CC4C4", "#5C82C4",
      "#6B7AC4", "#C4B04F", "#B474BC", "#5BA8A0",
    ],
    defaultActive: [
      "#C48787", "#C4997A", "#C4A96A", "#8FAF82", "#6BAFA0",
      "#6B9EC4", "#7680C4", "#9474C4", "#B474C4", "#C474A4",
      "#C4A06B", "#7A9E82", "#7490C4", "#A08EC4", "#C49A38",
    ],
  },
  {
    id: "pastel",
    label: "Pastel",
    description: "Soft, airy tones",
    colors: [
      "#F2C0C0", "#F2CABC", "#F2C0D8", "#EDB8E8",
      "#D0B8F2", "#BABCF2", "#B8CEF2", "#AAD8F2",
      "#A8E2DC", "#A8E2CC", "#BAEABB", "#CCEAB8",
      "#F4DEB2", "#F4D4A0", "#F4C89A", "#F4BCA8",
      "#EABAB0", "#E8C4BE", "#E8CCCE", "#D8C2EA",
      "#C8C4F2", "#BACAF2", "#AAD8EE", "#B2DCEC",
    ],
    defaultActive: [
      "#F2C0C0", "#F2CABC", "#F2C0D8", "#EDB8E8",
      "#D0B8F2", "#BABCF2", "#B8CEF2", "#AAD8F2",
      "#A8E2DC", "#A8E2CC", "#BAEABB", "#CCEAB8",
      "#F4DEB2", "#F4D4A0", "#F4C89A",
    ],
  },
  {
    id: "vivid",
    label: "Vivid",
    description: "Bold, high-contrast",
    colors: [
      "#D43030", "#D03268", "#C82890", "#B020A4",
      "#7820C8", "#4030CC", "#2055CC", "#1E80D0",
      "#189AC0", "#18A8A0", "#20A840", "#36A820",
      "#C4A000", "#C47000", "#C44C00", "#C02828",
      "#A82048", "#902070", "#782098", "#5828AA",
      "#3840B8", "#1850C8", "#1888C0", "#18A070",
    ],
    defaultActive: [
      "#D43030", "#D03268", "#C82890", "#B020A4",
      "#7820C8", "#4030CC", "#2055CC", "#1E80D0",
      "#189AC0", "#18A8A0", "#20A840", "#36A820",
      "#C4A000", "#C47000", "#C44C00",
    ],
  },
  {
    id: "earth",
    label: "Earth",
    description: "Warm, natural tones",
    colors: [
      "#9E4C2E", "#B0602E", "#B87A40", "#C09050",
      "#CC9C50", "#C8A850", "#C8B870", "#BCAA78",
      "#9A8A60", "#8A7850", "#886848", "#906040",
      "#7A5038", "#6A4030", "#7A6050", "#906860",
      "#A07C60", "#B89070", "#C8A878", "#D0B888",
      "#B0A078", "#9A9068", "#8C8060", "#907858",
    ],
    defaultActive: [
      "#9E4C2E", "#B0602E", "#B87A40", "#C09050",
      "#CC9C50", "#C8A850", "#C8B870", "#BCAA78",
      "#9A8A60", "#8A7850", "#886848", "#906040",
      "#7A5038", "#6A4030", "#7A6050",
    ],
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Blues, teals and seafoams",
    colors: [
      "#0870AC", "#1082C0", "#2096CC", "#28A8CC",
      "#30B0C4", "#28A898", "#20A888", "#20A870",
      "#1898AC", "#2090BC", "#2880BC", "#3070BC",
      "#3868B0", "#4868B0", "#4878B8", "#5888C0",
      "#6898C8", "#70A8CC", "#38A8B8", "#30A8C0",
      "#3898B8", "#2888B8", "#2098C0", "#1878A8",
    ],
    defaultActive: [
      "#0870AC", "#1082C0", "#2096CC", "#28A8CC",
      "#30B0C4", "#28A898", "#20A888", "#20A870",
      "#1898AC", "#2090BC", "#2880BC", "#3070BC",
      "#3868B0", "#4868B0", "#4878B8",
    ],
  },
  {
    id: "sunset",
    label: "Sunset",
    description: "Pinks, corals and warm purples",
    colors: [
      "#C83050", "#D83860", "#E04870", "#E05880",
      "#D84880", "#C83888", "#C02890", "#B82898",
      "#A020A8", "#8820B0", "#7028B8", "#5838C0",
      "#D04040", "#D85040", "#DC6040", "#E07040",
      "#E08050", "#DC9050", "#D88848", "#CC8040",
      "#E06060", "#DC5050", "#CC4058", "#C83868",
    ],
    defaultActive: [
      "#C83050", "#D83860", "#E04870", "#E05880",
      "#D84880", "#C83888", "#C02890", "#B82898",
      "#A020A8", "#8820B0", "#7028B8", "#5838C0",
      "#D04040", "#D85040", "#DC6040",
    ],
  },
  {
    id: "mono",
    label: "Mono",
    description: "Cool grays and slate",
    colors: [
      "#3A4250", "#424A58", "#4A5260", "#525A68",
      "#5A6270", "#626A78", "#6A7280", "#727A88",
      "#7A8290", "#828A98", "#8A92A0", "#929AA8",
      "#404858", "#485060", "#505868", "#586070",
      "#606878", "#687080", "#707888", "#788090",
      "#445060", "#4E5A6A", "#586472", "#60707A",
    ],
    defaultActive: [
      "#3A4250", "#424A58", "#4A5260", "#525A68",
      "#5A6270", "#626A78", "#6A7280", "#727A88",
      "#7A8290", "#828A98", "#8A92A0", "#929AA8",
      "#404858", "#485060", "#505868",
    ],
  },
];

const DEFAULT_TYPE_COLORS: Record<string, string> = {
  ssn: "#DC2626",
  dob: "#EA580C",
};

const TYPE_OPTIONS = [
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
function caseEq(a: string, b: string) { return a.toUpperCase() === b.toUpperCase(); }

function getInit(cfg: FieldColorConfig | null) {
  const dir = PALETTE_DIRECTIONS.find(d => d.id === (cfg?.direction ?? "bright")) ?? PALETTE_DIRECTIONS[0];
  return {
    palette:    cfg?.palette    ?? [...dir.defaultActive],
    typeColors: cfg?.typeColors ?? DEFAULT_TYPE_COLORS,
    dirId:      dir.id,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FieldColorsSection({
  getAuthHeaders,
  currentConfig,
  onConfigChange,
}: {
  getAuthHeaders: () => HeadersInit;
  currentConfig: FieldColorConfig | null;
  onConfigChange: (config: FieldColorConfig | null) => void;
}) {
  const bc = useBrandColor();
  const init = getInit(currentConfig);

  const [palette,    setPalette]    = useState<string[]>(init.palette);
  const [typeColors, setTypeColors] = useState<Record<string, string>>(init.typeColors);
  const [dirId,      setDirId]      = useState<string>(init.dirId);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq        = useRef(0);

  const [showAdd, setShowAdd] = useState(false);
  const [addHex,  setAddHex]  = useState("#");
  const [addPick, setAddPick] = useState("#7490C4");
  const addRef = useRef<HTMLDivElement>(null);

  const [openType,       setOpenType]       = useState<string | null>(null);
  const [customTypeHex,  setCustomTypeHex]  = useState<Record<string, string>>({});
  const typeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const i = getInit(currentConfig);
    setPalette(i.palette);
    setTypeColors(i.typeColors);
    setDirId(i.dirId);
  }, [currentConfig]);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setShowAdd(false);
    }
    if (showAdd) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showAdd]);

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
    nextPalette:    string[],
    nextTypeColors: Record<string, string>,
    nextDirId:      string,
    sendNull = false,
  ) {
    setSaving(true);
    setError(null);
    const id = ++seq.current;
    try {
      const body: FieldColorConfig | null = sendNull
        ? null
        : { palette: nextPalette, typeColors: nextTypeColors, direction: nextDirId };
      const res  = await fetch(`${SETTINGS_BASE}/org`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ fieldPalette: body }),
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

  // ── Actions ────────────────────────────────────────────────────────────────
  function applyDirection(newId: string) {
    const dir = PALETTE_DIRECTIONS.find(d => d.id === newId);
    if (!dir) return;
    const next = [...dir.defaultActive];
    setPalette(next);
    setDirId(newId);
    void doSave(next, typeColors, newId);
  }

  function toggleMaster(color: string) {
    const active = palette.some(c => caseEq(c, color));
    const next   = active ? palette.filter(c => !caseEq(c, color)) : [...palette, color];
    if (next.length === 0) return;
    setPalette(next);
    void doSave(next, typeColors, dirId);
  }

  function removeCustom(color: string) {
    const next = palette.filter(c => !caseEq(c, color));
    if (next.length === 0) return;
    setPalette(next);
    void doSave(next, typeColors, dirId);
  }

  function handleAddColor() {
    const hex = addHex.trim().toUpperCase();
    if (!isValidHex(hex)) { setError("Enter a valid 6-digit hex (e.g. #3B6CB7)."); return; }
    if (palette.some(c => caseEq(c, hex))) { setError("That color is already in your palette."); return; }
    const next = [...palette, hex];
    setPalette(next);
    setAddHex("#");
    setShowAdd(false);
    setError(null);
    void doSave(next, typeColors, dirId);
  }

  function setTypeOverride(type: string, color: string | null) {
    const next = { ...typeColors };
    if (color === null) delete next[type]; else next[type] = color.toUpperCase();
    setTypeColors(next);
    setOpenType(null);
    void doSave(palette, next, dirId);
  }

  function resetToDefaults() {
    const dir = PALETTE_DIRECTIONS[0];
    setPalette([...dir.defaultActive]);
    setTypeColors(DEFAULT_TYPE_COLORS);
    setDirId(dir.id);
    void doSave([...dir.defaultActive], DEFAULT_TYPE_COLORS, dir.id, true);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentDir       = PALETTE_DIRECTIONS.find(d => d.id === dirId) ?? PALETTE_DIRECTIONS[0];
  const dirColors        = currentDir.colors;
  const customColors     = palette.filter(c => !dirColors.some(m => caseEq(m, c)));
  const activeMasterCnt  = palette.filter(c => dirColors.some(m => caseEq(m, c))).length;
  const isDefault        = currentConfig === null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section id="field-colors-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

      {/* Header */}
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Field colors</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Customize the palette and per-type color assignments used when new fields are auto-colored.
          </p>
        </div>
      </div>

      {/* ── Palette style ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium text-gray-900">Palette style</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Pick a color family to start from. You can still toggle individual colors below.
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            {PALETTE_DIRECTIONS.map((dir) => {
              const sel = dirId === dir.id;
              return (
                <button
                  key={dir.id}
                  type="button"
                  disabled={saving}
                  onClick={() => applyDirection(dir.id)}
                  title={dir.description}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all
                    ${sel
                      ? "border-gray-800 bg-gray-50 text-gray-900"
                      : "border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex gap-[3px]">
                    {dir.colors.slice(0, 5).map((c, i) => (
                      <span key={i} className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  {dir.label}
                  {sel && (
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Selecting a style resets your active palette to that style's default colors.
          </p>
        </div>
      </div>

      {/* ── Active colors ──────────────────────────────────────────────────── */}
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium text-gray-900">Active colors</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Toggle individual colors on or off. Active colors are randomly cycled when new fields are created.
          </p>
        </div>
        <div className="flex-1 min-w-0">
          {/* Direction color grid */}
          <div className="grid grid-cols-8 gap-2 mb-3">
            {dirColors.map((color) => {
              const active = palette.some(c => caseEq(c, color));
              return (
                <button
                  key={color}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleMaster(color)}
                  title={`${active ? "Remove" : "Add"} ${color.toUpperCase()}`}
                  className="relative w-8 h-8 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: active ? color : `${color}38`,
                    border:    active ? `2px solid ${color}` : "2px solid #E5E7EB",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,.18)" : undefined,
                  }}
                >
                  {active ? (
                    <svg
                      viewBox="0 0 12 12"
                      className="w-3 h-3 absolute inset-0 m-auto drop-shadow-sm"
                      fill="none" stroke="white" strokeWidth={2.5}
                      strokeLinecap="round" strokeLinejoin="round"
                    >
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

          {/* Count */}
          <p className="text-xs text-gray-400 mb-3">
            <span className="font-semibold text-gray-600">{activeMasterCnt}</span> of {dirColors.length} colors active
            {customColors.length > 0 && (
              <> · <span className="font-semibold text-gray-600">{customColors.length}</span> custom</>
            )}
          </p>

          {/* Custom colors */}
          {customColors.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {customColors.map((color) => (
                <div key={color} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                  <div className="w-3.5 h-3.5 rounded flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: color }} />
                  <span className="text-[11px] font-mono text-gray-600">{color.toUpperCase()}</span>
                  <button
                    type="button"
                    onClick={() => removeCustom(color)}
                    disabled={saving}
                    className="ml-0.5 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-50"
                    aria-label={`Remove ${color}`}
                  >
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                      <path d="M1 1l8 8M9 1L1 9" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add custom color */}
          <div className="relative inline-block" ref={addRef}>
              <button
                type="button"
                disabled={saving}
                onClick={() => { setShowAdd(v => !v); setError(null); }}
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
                      onChange={e => { setAddPick(e.target.value); setAddHex(e.target.value.toUpperCase()); }}
                      className="h-9 w-10 rounded cursor-pointer border border-gray-200 p-0.5 flex-shrink-0"
                    />
                    <input
                      type="text"
                      value={addHex}
                      maxLength={7}
                      onChange={e => { setAddHex(e.target.value); if (isValidHex(e.target.value)) setAddPick(e.target.value); }}
                      onKeyDown={e => { if (e.key === "Enter") handleAddColor(); }}
                      placeholder="#RRGGBB"
                      className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-gray-900/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColor}
                    className="w-full rounded-lg py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: bc }}
                  >
                    Add to palette
                  </button>
                </div>
              )}
            </div>
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

                  <div
                    className="relative flex-shrink-0 ml-3"
                    ref={el => { typeRefs.current[opt.value] = el; }}
                  >
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setOpenType(isOpen ? null : opt.value)}
                      className="flex items-center gap-2 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs hover:border-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60 min-w-[116px]"
                    >
                      {assigned ? (
                        <>
                          <span className="w-3.5 h-3.5 rounded flex-shrink-0 ring-1 ring-black/10" style={{ backgroundColor: assigned }} />
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

                    {isOpen && (
                      <div className="absolute right-0 top-10 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
                        {/* Auto */}
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
                                  outline:      sel ? `2px solid ${color}` : undefined,
                                  outlineOffset: sel ? "2px" : undefined,
                                  boxShadow:    sel ? "0 0 0 3px white inset" : "0 1px 2px rgba(0,0,0,.15)",
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
                            onChange={e => setCustomTypeHex(p => ({ ...p, [opt.value]: e.target.value }))}
                            className="h-8 w-9 rounded border border-gray-200 p-0.5 cursor-pointer flex-shrink-0"
                          />
                          <input
                            type="text"
                            value={customTypeHex[opt.value] ?? ""}
                            maxLength={7}
                            onChange={e => setCustomTypeHex(p => ({ ...p, [opt.value]: e.target.value }))}
                            onKeyDown={e => {
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
          {!isDefault && (
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
          {saved && !saving && (
            <span className="text-xs text-green-600 font-medium">✓ Saved</span>
          )}
        </div>
      </div>
    </section>
  );
}
