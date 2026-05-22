export default function FaviconPreview() {
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

  const sizes = [16, 32, 64, 128];

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "#F8FAFF",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "48px", fontFamily: "'Inter', sans-serif", padding: "48px",
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A97B0", marginBottom: "4px" }}>Favicon</p>
        <p style={{ fontSize: "13px", color: "#4B5A7A", margin: 0 }}>At actual browser-tab sizes</p>
      </div>

      {/* Tab simulation */}
      <div style={{
        background: "#E8EDF5", borderRadius: "10px", padding: "6px 16px 0 16px",
        display: "flex", gap: "2px", width: "360px",
      }}>
        <div style={{
          background: "white", borderRadius: "8px 8px 0 0", padding: "8px 16px",
          display: "flex", alignItems: "center", gap: "6px", flex: 1,
        }}>
          <FaviconSVG size={16} />
          <span style={{ fontSize: "12px", color: "#0B1220", fontWeight: 500 }}>Docuplete</span>
        </div>
        <div style={{
          background: "#D4DCE9", borderRadius: "8px 8px 0 0", padding: "8px 16px",
          display: "flex", alignItems: "center", gap: "6px", flex: 1, opacity: 0.6,
        }}>
          <div style={{ width: 16, height: 16, background: "#B0BAC8", borderRadius: 3 }} />
          <span style={{ fontSize: "12px", color: "#4B5A7A" }}>Other tab</span>
        </div>
      </div>

      {/* Size grid */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "40px" }}>
        {sizes.map(size => (
          <div key={size} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <FaviconSVG size={size} />
            <span style={{ fontSize: "10px", color: "#8A97B0", fontWeight: 600 }}>{size}px</span>
          </div>
        ))}
      </div>

      {/* On dark bg */}
      <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
        <div style={{ background: "#0B1220", borderRadius: 12, padding: "16px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <FaviconSVG size={32} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>on dark</span>
        </div>
        <div style={{ background: "white", border: "1px solid #E8EDF5", borderRadius: 12, padding: "16px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <FaviconSVG size={32} />
          <span style={{ fontSize: "12px", color: "#4B5A7A" }}>on white</span>
        </div>
        <div style={{ background: "#F8FAFF", border: "1px solid #E8EDF5", borderRadius: 12, padding: "16px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <FaviconSVG size={32} />
          <span style={{ fontSize: "12px", color: "#4B5A7A" }}>on light</span>
        </div>
      </div>
    </div>
  );
}
