import { useState } from "react";

/**
 * Variant 2 — Interaction & Affordance Visibility
 * Tradeoff: interactive controls make every option discoverable.
 * Users can click sizes to focus, toggle background context,
 * and copy the SVG. Higher affordance but more visual complexity.
 */
export default function FaviconV2Affordance() {
  const [activeBg, setActiveBg] = useState<"light" | "white" | "dark">("light");
  const [focusSize, setFocusSize] = useState<number>(64);
  const [copied, setCopied] = useState(false);

  const FaviconSVG = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="180" height="180" rx="38" fill="#0E1D4A"/>
      <path d="M38 28h74l30 30v94H38V28z" fill="white" opacity="0.95"/>
      <path d="M112 28l30 30h-30V28z" fill="#C49A38"/>
      <rect x="54" y="78" width="48" height="7" rx="3.5" fill="#0E1D4A" opacity="0.25"/>
      <rect x="54" y="94" width="66" height="7" rx="3.5" fill="#0E1D4A" opacity="0.25"/>
      <rect x="54" y="110" width="38" height="7" rx="3.5" fill="#0E1D4A" opacity="0.25"/>
      <circle cx="124" cy="138" r="24" fill="#C49A38"/>
      <path d="M113 138l8 8 14-14" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const bgMap = { light: "#F4F7FD", white: "#FFFFFF", dark: "#0B1220" };
  const textMap = { light: "#5A6A8A", white: "#5A6A8A", dark: "rgba(255,255,255,0.6)" };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "#F4F7FD",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 36, fontFamily: "'Inter', sans-serif", padding: "48px 32px",
    }}>

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A97B0", marginBottom: 4 }}>Favicon</p>
        <p style={{ fontSize: 13, color: "#4B5A7A", margin: 0 }}>At actual browser-tab sizes</p>
      </div>

      {/* Tab sim */}
      <div style={{ background: "#E0E8F4", borderRadius: 10, padding: "6px 16px 0", display: "flex", gap: 2, width: 340 }}>
        <div style={{ background: "white", borderRadius: "8px 8px 0 0", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <FaviconSVG size={16} />
          <span style={{ fontSize: 12, color: "#0B1220", fontWeight: 500 }}>Docuplete</span>
        </div>
        <div style={{ background: "#CDD6E6", borderRadius: "8px 8px 0 0", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, flex: 1, opacity: 0.55 }}>
          <div style={{ width: 16, height: 16, background: "#B0BAC8", borderRadius: 3 }} />
          <span style={{ fontSize: 12, color: "#4B5A7A" }}>Other tab</span>
        </div>
      </div>

      {/* Interactive size picker */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A97B0", margin: 0 }}>Click a size to focus</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          {[16, 32, 64, 128].map(size => {
            const active = size === focusSize;
            return (
              <button key={size} onClick={() => setFocusSize(size)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  background: active ? "white" : "transparent",
                  border: active ? "2px solid #0E1D4A" : "2px solid transparent",
                  borderRadius: 12, padding: "14px 12px",
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: active ? "0 2px 12px rgba(14,29,74,0.15)" : "none",
                  outline: "none",
                }}>
                <FaviconSVG size={size} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 600, color: active ? "#0E1D4A" : "#8A97B0" }}>{size}px</span>
              </button>
            );
          })}
        </div>

        {/* Focused detail pane */}
        <div style={{ background: "white", border: "1px solid #E0E8F4", borderRadius: 14, padding: "20px 28px", display: "flex", alignItems: "center", gap: 20, minWidth: 320 }}>
          <FaviconSVG size={focusSize} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0B1220" }}>{focusSize}×{focusSize}px</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8A97B0" }}>
              {focusSize === 16 ? "Browser tab · favicon.ico" : focusSize === 32 ? "Bookmark bar · favicon-32.png" : focusSize === 64 ? "App switcher · favicon-64.png" : "Touch / homescreen icon"}
            </p>
          </div>
          <button onClick={handleCopy} style={{
            marginLeft: "auto", background: copied ? "#0E1D4A" : "#F4F7FD",
            color: copied ? "white" : "#0E1D4A", border: "1px solid #DDE4F0",
            borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 600,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {copied ? "Copied ✓" : "Copy SVG"}
          </button>
        </div>
      </div>

      {/* Background toggle */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", gap: 8, background: "white", border: "1px solid #E0E8F4", borderRadius: 10, padding: 4 }}>
          {(["light", "white", "dark"] as const).map(bg => (
            <button key={bg} onClick={() => setActiveBg(bg)} style={{
              padding: "6px 16px", borderRadius: 7, border: "none",
              background: activeBg === bg ? "#0E1D4A" : "transparent",
              color: activeBg === bg ? "white" : "#5A6A8A",
              fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}>
              {bg.charAt(0).toUpperCase() + bg.slice(1)}
            </button>
          ))}
        </div>
        <div style={{
          background: bgMap[activeBg], borderRadius: 16,
          border: activeBg === "white" ? "1px solid #E0E8F4" : "none",
          padding: "24px 36px", display: "flex", alignItems: "center", gap: 12,
          transition: "background 0.2s",
        }}>
          <FaviconSVG size={32} />
          <span style={{ fontSize: 12, color: textMap[activeBg], fontWeight: 500 }}>on {activeBg}</span>
        </div>
      </div>

    </div>
  );
}
