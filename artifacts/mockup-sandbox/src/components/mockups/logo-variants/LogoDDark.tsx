export default function LogoDDark() {
  return (
    <div style={{
      width: "100%", height: "100%", minHeight: "100vh",
      background: "#0B1220",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "48px", fontFamily: "'Inter', sans-serif",
    }}>
      {/* Wordmark row */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 4h18l6 6v22H6V4z" fill="white" />
          <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
          <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="rgba(11,18,32,0.3)" />
          <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="rgba(11,18,32,0.3)" />
          <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="rgba(11,18,32,0.3)" />
          <circle cx="26" cy="28" r="5" fill="#C49A38" />
          <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ color: "white", fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>Docuplete</span>
      </div>

      {/* Icon only */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <svg width="80" height="80" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 4h18l6 6v22H6V4z" fill="white" />
          <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
          <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="rgba(11,18,32,0.3)" />
          <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="rgba(11,18,32,0.3)" />
          <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="rgba(11,18,32,0.3)" />
          <circle cx="26" cy="28" r="5" fill="#C49A38" />
          <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Icon only · 80px</span>
      </div>

      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.7rem" }}>On navy · #0B1220</span>
    </div>
  );
}
