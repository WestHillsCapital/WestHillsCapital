import { useEffect, useRef, useState } from "react";
import {
  SETTINGS_BASE, useBrandColor,
} from "./settingsUtils";

const DEFAULT_PALETTE = ["#C4A06B", "#7A9E82", "#7490C4", "#A08EC4", "#C49A38", "#C47EA8"];
const MIN_COLORS = 1;
const MAX_COLORS = 12;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHex(s: string): boolean {
  return HEX_RE.test(s.trim());
}

export function FieldColorsSection({
  getAuthHeaders,
  isAdmin,
  currentPalette,
  onPaletteChange,
}: {
  getAuthHeaders: () => HeadersInit;
  isAdmin: boolean;
  currentPalette: string[] | null;
  onPaletteChange: (palette: string[] | null) => void;
}) {
  const bc = useBrandColor();
  const [palette, setPalette] = useState<string[]>(currentPalette ?? DEFAULT_PALETTE);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeq = useRef(0);

  const [addHex, setAddHex] = useState("#");
  const [addPickerColor, setAddPickerColor] = useState("#7490C4");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const addPanelRef = useRef<HTMLDivElement>(null);

  const isDefault = JSON.stringify(palette) === JSON.stringify(DEFAULT_PALETTE);

  useEffect(() => {
    setPalette(currentPalette ?? DEFAULT_PALETTE);
  }, [currentPalette]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target as Node)) {
        setShowAddPanel(false);
      }
    }
    if (showAddPanel) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showAddPanel]);

  async function savePalette(next: string[]) {
    if (!isAdmin) return;
    setIsSaving(true);
    setError(null);
    const seq = ++saveSeq.current;
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ fieldPalette: next }),
      });
      const data = await res.json() as { org?: { field_palette?: string[] | null }; error?: string };
      if (seq !== saveSeq.current) return;
      if (!res.ok) { setError(data.error ?? "Failed to save palette"); return; }
      const saved_palette = data.org?.field_palette ?? next;
      setPalette(saved_palette);
      onPaletteChange(saved_palette);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      if (seq === saveSeq.current) setError("Failed to save palette. Please try again.");
    } finally {
      if (seq === saveSeq.current) setIsSaving(false);
    }
  }

  function removeColor(index: number) {
    if (palette.length <= MIN_COLORS) return;
    const next = palette.filter((_, i) => i !== index);
    setPalette(next);
    void savePalette(next);
  }

  function addColor(hex: string) {
    const trimmed = hex.trim().toUpperCase();
    if (!isValidHex(trimmed)) { setError("Please enter a valid 6-digit hex color (e.g. #3B6CB7)."); return; }
    if (palette.includes(trimmed)) { setError("That color is already in the palette."); return; }
    if (palette.length >= MAX_COLORS) { setError(`Maximum ${MAX_COLORS} colors allowed.`); return; }
    setError(null);
    const next = [...palette, trimmed];
    setPalette(next);
    setAddHex("#");
    setAddPickerColor(trimmed);
    setShowAddPanel(false);
    void savePalette(next);
  }

  async function resetToDefault() {
    if (!isAdmin) return;
    setPalette(DEFAULT_PALETTE);
    setError(null);
    setIsSaving(true);
    const seq = ++saveSeq.current;
    try {
      const res = await fetch(`${SETTINGS_BASE}/org`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ fieldPalette: null }),
      });
      const data = await res.json() as { org?: { field_palette?: string[] | null }; error?: string };
      if (seq !== saveSeq.current) return;
      if (!res.ok) { setError(data.error ?? "Failed to reset palette"); return; }
      onPaletteChange(null);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch {
      if (seq === saveSeq.current) setError("Failed to reset. Please try again.");
    } finally {
      if (seq === saveSeq.current) setIsSaving(false);
    }
  }

  return (
    <section id="field-colors-section" className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      <div className="px-6 py-4">
        <h2 className="text-base font-semibold text-gray-900">Field colors</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Colors auto-assigned to new fields in your packages. Existing field colors are unaffected.
        </p>
      </div>

      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="w-44 shrink-0 pt-0.5">
          <p className="text-sm font-medium text-gray-900">Palette</p>
          <p className="text-xs text-gray-400 mt-0.5">Up to {MAX_COLORS} colors</p>
          {saved && <span className="text-[11px] text-green-600 font-medium mt-1 block">✓ Saved</span>}
        </div>

        <div className="flex-1">
          {/* Swatches */}
          <div className="flex flex-wrap gap-2 mb-4">
            {palette.map((color, i) => (
              <div key={`${color}-${i}`} className="relative group">
                <div
                  className="w-9 h-9 rounded-lg border-2 border-white shadow ring-1 ring-gray-200"
                  style={{ backgroundColor: color }}
                  title={color.toUpperCase()}
                />
                {isAdmin && palette.length > MIN_COLORS && (
                  <button
                    type="button"
                    onClick={() => removeColor(i)}
                    disabled={isSaving}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                    title={`Remove ${color}`}
                    aria-label={`Remove color ${color}`}
                  >
                    <svg viewBox="0 0 10 10" className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M1 1l8 8M9 1L1 9" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {/* Add color button */}
            {isAdmin && palette.length < MAX_COLORS && (
              <div className="relative" ref={addPanelRef}>
                <button
                  type="button"
                  onClick={() => { setShowAddPanel((v) => !v); setError(null); }}
                  disabled={isSaving}
                  className="w-9 h-9 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                  title="Add color"
                  aria-label="Add color"
                >
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M8 3v10M3 8h10" />
                  </svg>
                </button>

                {showAddPanel && (
                  <div className="absolute left-0 top-11 z-30 bg-white rounded-xl border border-gray-200 shadow-lg p-4 w-56">
                    <p className="text-xs font-semibold text-gray-700 mb-3">Add a color</p>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="color"
                        value={addPickerColor}
                        onChange={(e) => {
                          setAddPickerColor(e.target.value);
                          setAddHex(e.target.value.toUpperCase());
                        }}
                        className="h-9 w-10 rounded cursor-pointer border border-gray-200 p-0.5 flex-shrink-0"
                        title="Pick a color"
                      />
                      <input
                        type="text"
                        value={addHex}
                        maxLength={7}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAddHex(v);
                          if (isValidHex(v)) setAddPickerColor(v);
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") addColor(addHex); }}
                        placeholder="#RRGGBB"
                        className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addColor(addHex)}
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

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 mb-3">{error}</p>
          )}

          {/* Color hex labels */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {palette.map((color, i) => (
              <span key={`label-${color}-${i}`} className="text-[10px] font-mono text-gray-400 bg-gray-50 rounded px-1.5 py-0.5 border border-gray-100">
                {color.toUpperCase()}
              </span>
            ))}
          </div>

          {/* Reset link */}
          {isAdmin && !isDefault && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => { void resetToDefault(); }}
              className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors disabled:opacity-50"
            >
              Reset to defaults
            </button>
          )}

          {/* Saving spinner */}
          {isSaving && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="w-3 h-3 border border-gray-300 border-t-gray-700 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Saving…</span>
            </div>
          )}
        </div>
      </div>

      {/* Preview: how these colors appear in the field editor */}
      <div className="px-6 py-4 bg-gray-50/50 rounded-b-xl">
        <p className="text-[11px] font-medium text-gray-500 mb-2 uppercase tracking-wide">Preview</p>
        <div className="flex items-center gap-2 flex-wrap">
          {palette.slice(0, 8).map((color, i) => (
            <div key={`prev-${color}-${i}`} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-700 font-medium">Field {i + 1}</span>
            </div>
          ))}
          {palette.length > 8 && (
            <span className="text-xs text-gray-400">+{palette.length - 8} more</span>
          )}
        </div>
      </div>
    </section>
  );
}
