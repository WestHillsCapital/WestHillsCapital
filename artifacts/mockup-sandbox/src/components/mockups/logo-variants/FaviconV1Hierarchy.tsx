/**
 * Variant 1 — Information Hierarchy
 * Tradeoff: every visual decision serves scanability.
 * Explicit section labels, strong typographic scale, and
 * progressive disclosure (tab context → sizes → surfaces).
 * Dense but instantly scannable by a designer reviewing specs.
 */
export default function FaviconV1Hierarchy() {
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

  const Section = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div style={{ width: "100%", maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, borderBottom: "1px solid #E2E8F4", paddingBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase", color: "#0E1D4A" }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: "#8A97B0" }}>{sub}</span>}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "#F4F7FD",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: 40, fontFamily: "'Inter', sans-serif", padding: "48px 32px",
    }}>

      {/* Page title */}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0B1220", margin: 0 }}>Favicon</h1>
        <p style={{ fontSize: 13, color: "#5A6A8A", margin: "6px 0 0" }}>Docuplete — Browser icon spec sheet</p>
      </div>

      {/* 1 — In-context */}
      <Section label="1 — In-context" sub="Active browser tab">
        <div style={{ background: "#E0E8F4", borderRadius: 10, padding: "6px 16px 0", display: "flex", gap: 2, width: 340 }}>
          <div style={{ background: "white", borderRadius: "8px 8px 0 0", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, flex: 1, boxShadow: "0 -2px 6px rgba(0,0,0,0.06)" }}>
            <FaviconSVG size={16} />
            <span style={{ fontSize: 12, color: "#0B1220", fontWeight: 600 }}>Docuplete</span>
          </div>
          <div style={{ background: "#CDD6E6", borderRadius: "8px 8px 0 0", padding: "8px 16px", display: "flex", alignItems: "center", gap: 6, flex: 1, opacity: 0.55 }}>
            <div style={{ width: 16, height: 16, background: "#B0BAC8", borderRadius: 3 }} />
            <span style={{ fontSize: 12, color: "#4B5A7A" }}>Other tab</span>
          </div>
        </div>
      </Section>

      {/* 2 — All sizes */}
      <Section label="2 — Sizes" sub="All rendered sizes">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 32 }}>
          {[16, 32, 64, 128].map(size => (
            <div key={size} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center", background: "white", borderRadius: 10, border: "1px solid #DDE4F0" }}>
                <FaviconSVG size={size} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0E1D4A" }}>{size}px</span>
              <span style={{ fontSize: 10, color: "#8A97B0" }}>{size <= 16 ? "Tab bar" : size <= 32 ? "Bookmark" : size <= 64 ? "App switcher" : "Touch icon"}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 — Surfaces */}
      <Section label="3 — Surfaces" sub="32px on key backgrounds">
        <div style={{ display: "flex", gap: 16 }}>
          {[
            { bg: "#0B1220", label: "Dark", textColor: "rgba(255,255,255,0.7)", border: "none" },
            { bg: "#FFFFFF", label: "White", textColor: "#4B5A7A", border: "1px solid #E0E8F4" },
            { bg: "#F4F7FD", label: "Light", textColor: "#4B5A7A", border: "1px solid #E0E8F4" },
          ].map(({ bg, label, textColor, border }) => (
            <div key={label} style={{ background: bg, border, borderRadius: 10, padding: "14px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, minWidth: 100 }}>
              <FaviconSVG size={32} />
              <span style={{ fontSize: 11, fontWeight: 600, color: textColor }}>{label}</span>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
