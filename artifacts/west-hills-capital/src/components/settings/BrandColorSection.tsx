import { useRef, useState } from "react";
import { BRAND_PRESETS } from "@/utils/brandPresets";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type ColorScheme = "internal" | "product";

interface BrandColorSectionProps {
  brandColor: string;
  onChange: (color: string) => void;
  /** Called after onChange when the user clicks an extracted candidate swatch.
   *  Implementations should persist the color immediately (auto-save). */
  onAutoSave?: (color: string) => Promise<void>;
  extractEndpoint: string;
  getAuthHeaders: () => HeadersInit;
  colorScheme?: ColorScheme;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const SCHEMES: Record<ColorScheme, {
  border: string;
  bg: string;
  text: string;
  muted: string;
  ring: string;
  activePresetBorder: string;
}> = {
  internal: {
    border:             "border-[#DDD5C4]",
    bg:                 "bg-[#FAFAF8]",
    text:               "text-[#0F1C3F]",
    muted:              "text-[#6B7A99]",
    ring:               "focus:ring-2 focus:ring-[#0F1C3F]/20 focus:border-[#0F1C3F]",
    activePresetBorder: "border-[#0F1C3F]",
  },
  product: {
    border:             "border-gray-200",
    bg:                 "bg-gray-50",
    text:               "text-gray-900",
    muted:              "text-gray-500",
    ring:               "focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900",
    activePresetBorder: "border-gray-900",
  },
};

export function BrandColorSection({
  brandColor,
  onChange,
  onAutoSave,
  extractEndpoint,
  getAuthHeaders,
  colorScheme = "internal",
}: BrandColorSectionProps) {
  const s = SCHEMES[colorScheme];
  const [extractUrl, setExtractUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<string[]>([]);
  const extractInputRef = useRef<HTMLInputElement>(null);

  const validColor = HEX_RE.test(brandColor) ? brandColor : "#C49A38";

  async function handleExtract() {
    const url = extractUrl.trim();
    if (!url) return;
    setIsExtracting(true);
    setExtractError(null);
    setCandidates([]);
    try {
      const res = await fetch(extractEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { colors?: string[]; error?: string };
      if (!res.ok || data.error) {
        setExtractError(data.error ?? "Could not extract colors from that URL.");
        return;
      }
      if (!data.colors?.length) {
        setExtractError("No brand colors found on that page. Try a different URL.");
        return;
      }
      setCandidates(data.colors);
    } catch {
      setExtractError("Request failed. Check your connection and try again.");
    } finally {
      setIsExtracting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Color picker row */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          id="brand-color"
          type="color"
          value={validColor}
          onChange={(e) => onChange(e.target.value)}
          className={`w-10 h-10 rounded border cursor-pointer p-0.5 bg-white shrink-0 ${s.border}`}
        />
        <input
          type="text"
          value={brandColor}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          placeholder="#C49A38"
          className={`w-28 rounded-lg border px-3 py-2 text-sm font-mono placeholder:opacity-50 focus:outline-none ${s.border} ${s.bg} ${s.text} ${s.ring}`}
        />
        <div
          className={`w-8 h-8 rounded border shrink-0 ${s.border}`}
          style={{ backgroundColor: validColor }}
        />
      </div>

      {/* Preset palettes */}
      <div>
        <p className={`text-xs mb-2 ${s.muted}`}>Presets</p>
        <div className="flex flex-wrap gap-2 pb-6">
          {BRAND_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              title={preset.name}
              onClick={() => onChange(preset.hex)}
              className={`group relative w-7 h-7 rounded-full border-2 transition-all ${
                brandColor.toLowerCase() === preset.hex.toLowerCase()
                  ? `${s.activePresetBorder} scale-110 shadow-sm`
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: preset.hex }}
            >
              <span className="sr-only">{preset.name}</span>
              <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity ${s.muted}`}>
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Extract from website */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <p className={`text-xs ${s.muted}`}>Extract from your website</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[9px] leading-none cursor-default select-none ${s.border} ${s.muted}`}>?</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">Fetches brand colors from your public website URL. Usage is rate-limited — please allow a few seconds between requests.</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-2">
          <input
            ref={extractInputRef}
            type="url"
            value={extractUrl}
            onChange={(e) => { setExtractUrl(e.target.value); setExtractError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleExtract(); }}
            placeholder="https://yourcompany.com"
            disabled={isExtracting}
            className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm placeholder:opacity-50 focus:outline-none disabled:opacity-60 ${s.border} ${s.bg} ${s.text} ${s.ring}`}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => { void handleExtract(); }}
                disabled={isExtracting || !extractUrl.trim()}
                className={`shrink-0 text-sm rounded-lg border px-3 py-2 bg-white hover:opacity-80 disabled:opacity-40 transition-opacity ${s.border} ${s.text}`}
              >
                {isExtracting ? (
                  <span className="flex items-center gap-1.5">
                    <span className={`w-3 h-3 border border-t-transparent rounded-full animate-spin inline-block ${s.border}`} />
                    Extracting…
                  </span>
                ) : "Extract"}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Pull brand colors from your public website URL — rate-limited to prevent overuse</TooltipContent>
          </Tooltip>
        </div>

        {extractError && (
          <p className="mt-1.5 text-xs text-red-600">{extractError}</p>
        )}

        {candidates.length > 0 && (
          <div className="mt-3 pb-6">
            <p className={`text-xs mb-2 ${s.muted}`}>Found — click to apply</p>
            <div className="flex gap-2 flex-wrap">
              {candidates.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => { onChange(c); setCandidates([]); onAutoSave?.(c); }}
                  className={`group relative w-8 h-8 rounded border-2 hover:scale-110 transition-all ${s.border}`}
                  style={{ backgroundColor: c }}
                >
                  <span className="sr-only">{c}</span>
                  <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity ${s.muted}`}>
                    {c}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
