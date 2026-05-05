// @ts-check
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "../public/screenshots");
fs.mkdirSync(OUT, { recursive: true });

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg: "#080E1A",
  sidebar: "#0A1120",
  panel: "#111827",
  card: "#0F1A2E",
  blue: "#1B4FD8",
  blueLight: "#5B8DEF",
  border: "rgba(255,255,255,0.08)",
  borderMed: "rgba(255,255,255,0.12)",
  text: "rgba(255,255,255,0.85)",
  textSub: "rgba(255,255,255,0.55)",
  textMuted: "rgba(255,255,255,0.35)",
  green: "#22c55e",
  greenBg: "rgba(34,197,94,0.12)",
  red: "#ef4444",
  redBg: "rgba(239,68,68,0.12)",
  amber: "#f59e0b",
  amberBg: "rgba(245,158,11,0.12)",
  purpleBg: "rgba(139,92,246,0.15)",
  purple: "#a78bfa",
};

const W = 1280;
const H = 800;
const TOPBAR_H = 56;
const SIDEBAR_W = 240;

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    </style>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  ${body}
</svg>`;
}

function rect(x, y, w, h, fill, rx = 0, stroke = null, sw = 1) {
  const s = stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : "";
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${s}/>`;
}

function text(x, y, content, size, fill, weight = "normal", anchor = "start") {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${esc(content)}</text>`;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pill(x, y, w, h, bg, textColor, label, rx = 6) {
  return `${rect(x, y, w, h, bg, rx)}<text x="${x + w / 2}" y="${y + h / 2 + 4.5}" font-size="11" fill="${textColor}" font-weight="600" text-anchor="middle">${esc(label)}</text>`;
}

function topbar() {
  return `${rect(0, 0, W, TOPBAR_H, "#080E1A")}
  <rect x="0" y="${TOPBAR_H - 1}" width="${W}" height="1" fill="${C.border}"/>
  <!-- logo -->
  <rect x="16" y="14" width="28" height="28" rx="7" fill="${C.blue}"/>
  <text x="50" y="34" font-size="15" fill="white" font-weight="700">Docuplete</text>
  <rect x="126" y="18" width="38" height="20" rx="4" fill="rgba(255,255,255,0.08)"/>
  <text x="145" y="32" font-size="10" fill="rgba(255,255,255,0.4)" font-weight="600" text-anchor="middle">Docs</text>
  <!-- search -->
  <rect x="${SIDEBAR_W + 16}" y="12" width="320" height="32" rx="8" fill="rgba(255,255,255,0.05)" stroke="${C.border}" stroke-width="1"/>
  <text x="${SIDEBAR_W + 36}" y="32" font-size="13" fill="${C.textMuted}">Search docs…</text>
  <!-- cta -->
  <rect x="${W - 148}" y="13" width="132" height="30" rx="8" fill="${C.blue}"/>
  <text x="${W - 82}" y="33" font-size="13" fill="white" font-weight="600" text-anchor="middle">Start free trial</text>`;
}

function sidebar(activeItem = "") {
  const items = [
    { label: "Getting Started", children: ["What is Docuplete?", "Quick Start", "Plans"] },
    { label: "Building a Package", children: ["Uploading a PDF", "Adding & Editing Fields", "Visual Mapper", "E-Sign Fields", "Single-line vs. Multiline"] },
    { label: "Batch CSV Import", children: ["When to Use Batch", "Downloading Template", "Filling Out CSV", "Uploading & Results", "Understanding Errors"] },
    { label: "Sessions Dashboard", children: ["Interviews Tab", "Batch Runs Tab"] },
    { label: "Sending to Clients", children: ["Generating a Session", "Client Experience", "E-Sign Verification"] },
    { label: "Account & Settings", children: ["API Keys", "Branding", "Channel Defaults"] },
    { label: "Field Library", children: ["Overview", "Adding Library Fields"] },
    { label: "Integrations", children: ["Google Drive", "HubSpot"] },
    { label: "Webhooks & API", children: ["Webhook Setup", "Delivery Logs"] },
  ];

  let out = `${rect(0, TOPBAR_H, SIDEBAR_W, H - TOPBAR_H, C.sidebar)}
  <rect x="${SIDEBAR_W - 1}" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>`;

  let y = TOPBAR_H + 16;
  for (const section of items) {
    out += `<text x="16" y="${y + 12}" font-size="12" fill="${C.textSub}" font-weight="700">${esc(section.label)}</text>`;
    y += 28;
    for (const child of section.children) {
      const isActive = child === activeItem;
      if (isActive) {
        out += `${rect(8, y, SIDEBAR_W - 16, 26, "rgba(27,79,216,0.2)", 8)}`;
      }
      out += `<text x="20" y="${y + 17}" font-size="12" fill="${isActive ? C.blueLight : C.textMuted}" font-weight="${isActive ? "600" : "normal"}">${esc(child)}</text>`;
      y += 28;
      if (y > H - 10) break;
    }
    if (y > H - 10) break;
  }
  return out;
}

function contentArea(x, y) {
  return { x, y, w: W - x };
}

// ─── Individual screenshot generators ─────────────────────────────────────────

function dashboardOverview() {
  const pkg = (x, y, name, sessions, status, statusColor, statusBg) =>
    `${rect(x, y, 340, 88, C.panel, 10, C.border, 1)}
    ${rect(x + 16, y + 16, 40, 40, "rgba(27,79,216,0.15)", 8)}
    <text x="${x + 36}" y="${y + 40}" font-size="20" fill="${C.blueLight}" text-anchor="middle">📄</text>
    ${text(x + 66, y + 30, name, 14, C.text, "600")}
    ${text(x + 66, y + 48, `${sessions} sessions`, 12, C.textSub)}
    ${pill(x + 248, y + 16, 80, 22, statusBg, statusColor, status, 6)}
    <rect x="${x + 16}" y="${y + 72}" width="${340 - 32}" height="1" fill="${C.border}"/>`;

  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}

    <!-- sidebar nav -->
    ${rect(0, TOPBAR_H, 220, H - TOPBAR_H, C.sidebar)}
    <rect x="219" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>
    ${text(16, TOPBAR_H + 32, "Packages", 11, C.textMuted, "700")}
    ${rect(8, TOPBAR_H + 40, 204, 28, "rgba(27,79,216,0.2)", 8)}
    ${text(20, TOPBAR_H + 59, "All Packages", 13, C.blueLight, "600")}
    ${text(20, TOPBAR_H + 87, "Sessions Dashboard", 13, C.textMuted)}
    ${text(20, TOPBAR_H + 115, "Batch Runs", 13, C.textMuted)}
    ${text(20, TOPBAR_H + 143, "Field Library", 13, C.textMuted)}
    ${text(20, TOPBAR_H + 171, "Settings", 13, C.textMuted)}

    <!-- main area -->
    ${rect(220, TOPBAR_H, W - 220, H - TOPBAR_H, C.bg)}

    <!-- header row -->
    ${text(240, TOPBAR_H + 40, "Packages", 22, C.text, "700")}
    ${text(240, TOPBAR_H + 60, "Build and manage your PDF document workflows", 13, C.textSub)}
    ${rect(W - 176, TOPBAR_H + 18, 152, 36, C.blue, 10)}
    ${text(W - 100, TOPBAR_H + 41, "+ New Package", 13, "white", "600", "middle")}

    <!-- packages grid -->
    ${pkg(240, TOPBAR_H + 88, "New Client Intake", "247", "Active", C.green, C.greenBg)}
    ${pkg(596, TOPBAR_H + 88, "IRA Rollover Form", "89", "Active", C.green, C.greenBg)}
    ${pkg(952, TOPBAR_H + 88, "Beneficiary Update", "34", "Draft", C.textSub, "rgba(255,255,255,0.06)")}

    ${pkg(240, TOPBAR_H + 196, "Annual Disclosure", "512", "Active", C.green, C.greenBg)}
    ${pkg(596, TOPBAR_H + 196, "KYC Intake Form", "156", "Active", C.green, C.greenBg)}
    ${pkg(952, TOPBAR_H + 196, "Account Agreement", "78", "Active", C.green, C.greenBg)}

    ${pkg(240, TOPBAR_H + 304, "Lease Agreement", "23", "Active", C.green, C.greenBg)}
    ${pkg(596, TOPBAR_H + 304, "Employment Contract", "61", "Draft", C.textSub, "rgba(255,255,255,0.06)")}
    ${pkg(952, TOPBAR_H + 304, "Consent Form v2", "194", "Active", C.green, C.greenBg)}

    <!-- stats strip -->
    ${rect(240, H - 100, W - 256, 76, C.panel, 10, C.border, 1)}
    ${text(280, H - 72, "Total packages", 11, C.textMuted, "600")}
    ${text(280, H - 50, "9", 22, C.text, "700")}
    ${text(500, H - 72, "Sessions this month", 11, C.textMuted, "600")}
    ${text(500, H - 50, "1,394", 22, C.text, "700")}
    ${text(740, H - 72, "Completion rate", 11, C.textMuted, "600")}
    ${text(740, H - 50, "94.2%", 22, C.green, "700")}
    ${text(960, H - 72, "Avg. fill time", 11, C.textMuted, "600")}
    ${text(960, H - 50, "4m 12s", 22, C.text, "700")}
  `);
}

function quickstartUpload() {
  return svg(`
    ${topbar()}
    ${sidebar("Quick Start")}

    <!-- content -->
    ${text(SIDEBAR_W + 40, TOPBAR_H + 48, "Step 2: Upload your PDF", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 72, "On the package page, click Upload PDF and select your document.", 14, C.textSub)}

    <!-- package page mock -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 96, W - SIDEBAR_W - 64, H - TOPBAR_H - 116, C.panel, 12, C.border, 1)}

    <!-- package header -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 96, W - SIDEBAR_W - 64, 52, "#0D1829", 12)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 147}" width="${W - SIDEBAR_W - 64}" height="1" fill="${C.border}"/>
    ${text(SIDEBAR_W + 64, TOPBAR_H + 127, "New Client Intake", 16, C.text, "700")}
    ${pill(W - 180, TOPBAR_H + 110, 72, 24, C.greenBg, C.green, "Active", 6)}

    <!-- tabs -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 148, W - SIDEBAR_W - 64, 40, "#0D1829")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 173, "Documents", 13, C.blueLight, "600")}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 187}" width="80" height="2" fill="${C.blue}" rx="1"/>
    ${text(SIDEBAR_W + 164, TOPBAR_H + 173, "Fields", 13, C.textMuted)}
    ${text(SIDEBAR_W + 216, TOPBAR_H + 173, "Mapper", 13, C.textMuted)}
    ${text(SIDEBAR_W + 272, TOPBAR_H + 173, "Configuration", 13, C.textMuted)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 187}" width="${W - SIDEBAR_W - 64}" height="1" fill="${C.border}"/>

    <!-- upload drop zone -->
    <rect x="${SIDEBAR_W + 80}" y="${TOPBAR_H + 216}" width="${W - SIDEBAR_W - 144}" height="200" rx="12" fill="rgba(27,79,216,0.06)" stroke="${C.blueLight}" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text x="${(W + SIDEBAR_W) / 2}" y="${TOPBAR_H + 296}" font-size="36" text-anchor="middle">📎</text>
    ${text((W + SIDEBAR_W) / 2, TOPBAR_H + 336, "Drop your PDF here", 16, C.text, "600", "middle")}
    ${text((W + SIDEBAR_W) / 2, TOPBAR_H + 356, "or", 13, C.textMuted, "normal", "middle")}
    ${rect((W + SIDEBAR_W) / 2 - 64, TOPBAR_H + 368, 128, 36, C.blue, 8)}
    ${text((W + SIDEBAR_W) / 2, TOPBAR_H + 391, "Browse files", 13, "white", "600", "middle")}

    <!-- existing doc -->
    ${rect(SIDEBAR_W + 80, TOPBAR_H + 436, W - SIDEBAR_W - 144, 60, C.card, 10, C.border, 1)}
    <rect x="${SIDEBAR_W + 96}" y="${TOPBAR_H + 452}" width="32" height="40" rx="4" fill="rgba(27,79,216,0.2)"/>
    <text x="${SIDEBAR_W + 112}" y="${TOPBAR_H + 477}" font-size="11" fill="${C.blueLight}" text-anchor="middle">PDF</text>
    ${text(SIDEBAR_W + 140, TOPBAR_H + 463, "intake-form-v3.pdf", 13, C.text, "600")}
    ${text(SIDEBAR_W + 140, TOPBAR_H + 480, "2.4 MB  ·  8 pages", 12, C.textMuted)}
    ${pill(W - 200, TOPBAR_H + 455, 60, 22, C.greenBg, C.green, "Ready", 6)}
    ${text(W - 128, TOPBAR_H + 466, "Replace", 12, C.blueLight)}
    ${text(W - 82, TOPBAR_H + 466, "Remove", 12, C.red)}
  `);
}

function quickstartMapper() {
  const fieldList = [
    { name: "Full Legal Name", type: "text", mapped: true },
    { name: "Date of Birth", type: "date", mapped: true },
    { name: "SSN / Tax ID", type: "text", mapped: true },
    { name: "Email Address", type: "email", mapped: true },
    { name: "Phone Number", type: "text", mapped: false },
    { name: "Annual Income", type: "number", mapped: false },
    { name: "Account Type", type: "radio", mapped: true },
  ];

  const FIELD_PANEL = SIDEBAR_W + 220;
  const PDF_X = FIELD_PANEL + 8;
  const PDF_W = W - PDF_X - 200 - 16;

  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}

    <!-- left field panel -->
    ${rect(SIDEBAR_W, TOPBAR_H, 220, H - TOPBAR_H, "#0A1422")}
    <rect x="${SIDEBAR_W + 219}" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>
    ${text(SIDEBAR_W + 12, TOPBAR_H + 28, "Fields", 12, C.textMuted, "700")}
    ${fieldList.map((f, i) => {
      const fy = TOPBAR_H + 48 + i * 52;
      const isActive = i === 0;
      return `${rect(SIDEBAR_W + 8, fy, 204, 44, isActive ? "rgba(27,79,216,0.25)" : "rgba(255,255,255,0.03)", 8, isActive ? C.blue : "none", 1)}
      ${text(SIDEBAR_W + 20, fy + 17, f.name, 12, isActive ? "white" : C.textSub, isActive ? "600" : "normal")}
      ${text(SIDEBAR_W + 20, fy + 32, f.type, 10, isActive ? C.blueLight : C.textMuted)}
      ${f.mapped ? pill(SIDEBAR_W + 176, fy + 13, 30, 18, "rgba(34,197,94,0.15)", C.green, "✓", 4) : ""}`;
    }).join("\n")}

    <!-- PDF canvas -->
    ${rect(PDF_X, TOPBAR_H, PDF_W, H - TOPBAR_H, "#0D1525")}
    ${rect(PDF_X + 20, TOPBAR_H + 20, PDF_W - 40, H - TOPBAR_H - 40, "white", 4)}

    <!-- PDF content lines -->
    ${rect(PDF_X + 40, TOPBAR_H + 40, 200, 2, "#e5e7eb", 1)}
    ${rect(PDF_X + 40, TOPBAR_H + 52, 140, 2, "#e5e7eb", 1)}
    ${text(PDF_X + 40, TOPBAR_H + 78, "CLIENT INFORMATION", 9, "#6b7280", "700")}
    ${rect(PDF_X + 40, TOPBAR_H + 84, PDF_W - 80, 1, "#e5e7eb")}

    ${text(PDF_X + 40, TOPBAR_H + 104, "Full Legal Name:", 9, "#374151")}
    ${rect(PDF_X + 40, TOPBAR_H + 108, 280, 24, "#eff6ff", 3, "#3b82f6", 1.5)}
    <text x="${PDF_X + 180}" y="${TOPBAR_H + 125}" font-size="10" fill="#1d4ed8" text-anchor="middle">Full Legal Name</text>

    ${text(PDF_X + 40, TOPBAR_H + 148, "Date of Birth:", 9, "#374151")}
    ${rect(PDF_X + 40, TOPBAR_H + 152, 120, 20, "#fafafa", 3, "#d1d5db", 1)}

    ${text(PDF_X + 180, TOPBAR_H + 148, "SSN:", 9, "#374151")}
    ${rect(PDF_X + 180, TOPBAR_H + 152, 140, 20, "#fafafa", 3, "#d1d5db", 1)}

    ${text(PDF_X + 40, TOPBAR_H + 188, "Email Address:", 9, "#374151")}
    ${rect(PDF_X + 40, TOPBAR_H + 192, 280, 20, "#fafafa", 3, "#d1d5db", 1)}

    ${text(PDF_X + 40, TOPBAR_H + 228, "Account Type:", 9, "#374151")}
    ${rect(PDF_X + 40, TOPBAR_H + 236, 12, 12, "white", 2, "#9ca3af", 1)}
    ${text(PDF_X + 56, TOPBAR_H + 246, "Individual", 9, "#374151")}
    ${rect(PDF_X + 110, TOPBAR_H + 236, 12, 12, "#1d4ed8", 2)}
    ${text(PDF_X + 126, TOPBAR_H + 246, "Joint", 9, "#374151")}
    ${rect(PDF_X + 160, TOPBAR_H + 236, 12, 12, "white", 2, "#9ca3af", 1)}
    ${text(PDF_X + 176, TOPBAR_H + 246, "Trust", 9, "#374151")}

    <!-- selected field bounding box -->
    <rect x="${PDF_X + 38}" y="${TOPBAR_H + 107}" width="284" height="26" rx="3" fill="none" stroke="#1B4FD8" stroke-width="2"/>
    <!-- corner handles -->
    ${["0,0", "284,0", "0,26", "284,26"].map(p => {
      const [dx, dy] = p.split(",").map(Number);
      return `<rect x="${PDF_X + 38 + dx - 4}" y="${TOPBAR_H + 107 + dy - 4}" width="8" height="8" rx="2" fill="${C.blue}" stroke="white" stroke-width="1"/>`;
    }).join("")}

    <!-- right panel -->
    ${rect(W - 200, TOPBAR_H, 200, H - TOPBAR_H, "#0A1422")}
    <rect x="${W - 200}" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>
    ${text(W - 188, TOPBAR_H + 28, "Mapping Options", 12, C.textMuted, "700")}
    ${text(W - 188, TOPBAR_H + 54, "Font size", 11, C.textMuted)}
    ${rect(W - 188, TOPBAR_H + 60, 80, 28, C.panel, 6, C.border, 1)}
    ${text(W - 148, TOPBAR_H + 78, "11 pt", 12, C.text, "normal", "middle")}
    ${text(W - 188, TOPBAR_H + 104, "Alignment", 11, C.textMuted)}
    ${["left", "center", "right"].map((a, i) => `${rect(W - 188 + i * 40, TOPBAR_H + 110, 36, 28, i === 0 ? C.blue : C.panel, 6, C.border, 1)}
    ${text(W - 170 + i * 40, TOPBAR_H + 128, a[0].toUpperCase(), 11, i === 0 ? "white" : C.textMuted, "600", "middle")}`).join("")}
    ${text(W - 188, TOPBAR_H + 156, "Transform", 11, C.textMuted)}
    ${rect(W - 188, TOPBAR_H + 162, 172, 28, C.panel, 6, C.border, 1)}
    ${text(W - 102, TOPBAR_H + 180, "None", 12, C.text, "normal", "middle")}
    ${rect(W - 188, TOPBAR_H + H - 200, 172, 36, C.blue, 8)}
    ${text(W - 102, TOPBAR_H + H - 178, "Save mapping", 13, "white", "600", "middle")}
  `);
}

function quickstartInterview() {
  return svg(`
    <!-- white interview background -->
    <rect width="${W}" height="${H}" fill="#f9fafb"/>
    <!-- top bar -->
    ${rect(0, 0, W, 60, "white")}
    <rect x="0" y="59" width="${W}" height="1" fill="#e5e7eb"/>
    <!-- brand logo area -->
    ${rect(W / 2 - 100, 14, 200, 32, "#eff6ff", 6)}
    <text x="${W / 2}" y="35" font-size="14" fill="#1d4ed8" font-weight="700" text-anchor="middle">Acme Financial</text>

    <!-- progress bar -->
    ${rect(0, 60, W, 6, "#e5e7eb")}
    ${rect(0, 60, W * 0.45, 6, "#1B4FD8")}

    <!-- step indicator -->
    <text x="${W / 2}" y="96" font-size="12" fill="#6b7280" text-anchor="middle">Step 2 of 5 — Personal Information</text>

    <!-- card -->
    ${rect(W / 2 - 320, 112, 640, 580, "white", 16)}
    <rect x="${W / 2 - 320}" y="112" width="640" height="580" rx="16" fill="none" stroke="#e5e7eb" stroke-width="1"/>

    <!-- card header -->
    <text x="${W / 2}" y="158" font-size="20" fill="#111827" font-weight="700" text-anchor="middle">Personal Information</text>
    <text x="${W / 2}" y="180" font-size="14" fill="#6b7280" text-anchor="middle">Please provide your personal details below.</text>
    <rect x="${W / 2 - 280}" y="196" width="560" height="1" fill="#f3f4f6"/>

    <!-- fields -->
    <text x="${W / 2 - 280}" y="228" font-size="13" fill="#374151" font-weight="600">Full Legal Name *</text>
    ${rect(W / 2 - 280, 236, 560, 44, "#f9fafb", 8, "#d1d5db", 1)}
    <text x="${W / 2 - 264}" y="263" font-size="14" fill="#111827">Margaret A. Johnson</text>
    <rect x="${W / 2 - 280}" y="236" width="560" height="44" rx="8" fill="none" stroke="#1B4FD8" stroke-width="2"/>

    <text x="${W / 2 - 280}" y="304" font-size="13" fill="#374151" font-weight="600">Date of Birth *</text>
    ${rect(W / 2 - 280, 312, 268, 44, "#f9fafb", 8, "#d1d5db", 1)}
    <text x="${W / 2 - 264}" y="339" font-size="14" fill="#6b7280">MM / DD / YYYY</text>

    <text x="${W / 2 + 12}" y="304" font-size="13" fill="#374151" font-weight="600">SSN / Tax ID *</text>
    ${rect(W / 2 + 12, 312, 268, 44, "#f9fafb", 8, "#d1d5db", 1)}
    <text x="${W / 2 + 28}" y="339" font-size="14" fill="#6b7280">XXX-XX-XXXX</text>

    <text x="${W / 2 - 280}" y="380" font-size="13" fill="#374151" font-weight="600">Account Type *</text>
    ${["Individual", "Joint", "Trust / Entity"].map((opt, i) => `
    ${rect(W / 2 - 280 + i * 192, 388, 184, 48, i === 0 ? "#eff6ff" : "#f9fafb", 8, i === 0 ? "#1B4FD8" : "#d1d5db", i === 0 ? 2 : 1)}
    <circle cx="${W / 2 - 280 + i * 192 + 20}" cy="${388 + 24}" r="8" fill="${i === 0 ? "#1B4FD8" : "white"}" stroke="${i === 0 ? "#1B4FD8" : "#9ca3af"}" stroke-width="2"/>
    ${i === 0 ? `<circle cx="${W / 2 - 280 + 20}" cy="${388 + 24}" r="4" fill="white"/>` : ""}
    <text x="${W / 2 - 280 + i * 192 + 40}" y="${388 + 28}" font-size="14" fill="${i === 0 ? "#1d4ed8" : "#374151"}" font-weight="${i === 0 ? "600" : "normal"}">${opt}</text>`).join("")}

    <!-- continue button -->
    ${rect(W / 2 - 280, 460, 560, 52, "#1B4FD8", 10)}
    <text x="${W / 2}" y="491" font-size="15" fill="white" font-weight="600" text-anchor="middle">Continue</text>

    <!-- back link -->
    <text x="${W / 2}" y="532" font-size="13" fill="#6b7280" text-anchor="middle">← Back to previous step</text>

    <!-- footer -->
    <rect x="0" y="${H - 48}" width="${W}" height="48" fill="white"/>
    <rect x="0" y="${H - 49}" width="${W}" height="1" fill="#e5e7eb"/>
    <text x="${W / 2}" y="${H - 20}" font-size="12" fill="#9ca3af" text-anchor="middle">Powered by Docuplete · Secure &amp; encrypted · Questions? Contact support@acmefinancial.com</text>
  `);
}

function quickstartDownload() {
  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}

    <!-- session detail page -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 20, W - SIDEBAR_W - 56, H - TOPBAR_H - 36, C.panel, 12, C.border, 1)}

    <!-- breadcrumb -->
    ${text(SIDEBAR_W + 64, TOPBAR_H + 52, "Sessions Dashboard  /  Margaret A. Johnson", 12, C.textMuted)}

    <!-- session header -->
    ${text(SIDEBAR_W + 64, TOPBAR_H + 88, "Margaret A. Johnson", 22, C.text, "700")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 110, "New Client Intake  ·  Submitted May 3, 2026 at 2:14 PM", 13, C.textSub)}
    ${pill(SIDEBAR_W + 64, TOPBAR_H + 124, 100, 26, C.greenBg, C.green, "✓ Generated", 6)}
    ${rect(W - 220, TOPBAR_H + 76, 160, 40, C.blue, 10)}
    ${text(W - 140, TOPBAR_H + 101, "↓ Download PDF", 14, "white", "600", "middle")}

    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 164}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>

    <!-- two column layout -->
    ${text(SIDEBAR_W + 64, TOPBAR_H + 192, "Submitted Answers", 14, C.text, "600")}

    ${[
      ["Full Legal Name", "Margaret A. Johnson"],
      ["Date of Birth", "April 7, 1978"],
      ["SSN / Tax ID", "●●●-●●-4521"],
      ["Email Address", "margaret.j@email.com"],
      ["Phone Number", "(555) 847-2290"],
      ["Account Type", "Individual"],
      ["Annual Income", "$142,000"],
      ["Investment Objective", "Growth"],
    ].map(([label, val], i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const rx = SIDEBAR_W + 64 + col * 380;
      const ry = TOPBAR_H + 218 + row * 56;
      return `${text(rx, ry, label, 11, C.textMuted, "600")}
      ${text(rx, ry + 20, val, 13, C.text)}`;
    }).join("\n")}

    <!-- audit footer -->
    ${rect(SIDEBAR_W + 64, H - 116, W - SIDEBAR_W - 120, 1, C.border)}
    ${text(SIDEBAR_W + 64, H - 92, "Audit Trail", 12, C.textMuted, "600")}
    ${text(SIDEBAR_W + 64, H - 72, "Session opened May 3, 2026 at 1:58 PM  ·  Submitted 2:14 PM  ·  IP 192.168.1.xx  ·  Session ID: ses_8xKp2mQ", 12, C.textMuted)}

    <!-- sidebar nav (simplified) -->
    ${rect(0, TOPBAR_H, SIDEBAR_W, H - TOPBAR_H, C.sidebar)}
    <rect x="${SIDEBAR_W - 1}" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>
    ${text(16, TOPBAR_H + 32, "Sessions Dashboard", 11, C.textMuted, "700")}
    ${rect(8, TOPBAR_H + 40, SIDEBAR_W - 16, 26, "rgba(27,79,216,0.2)", 8)}
    ${text(20, TOPBAR_H + 57, "Interviews", 12, C.blueLight, "600")}
    ${text(20, TOPBAR_H + 85, "Batch Runs", 12, C.textMuted)}
  `);
}

function uploadDialog() {
  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}
    ${sidebar("Uploading a PDF")}

    <!-- dimmed overlay -->
    <rect x="${SIDEBAR_W}" y="${TOPBAR_H}" width="${W - SIDEBAR_W}" height="${H - TOPBAR_H}" fill="rgba(0,0,0,0.5)"/>

    <!-- modal -->
    ${rect(W / 2 - 240, H / 2 - 220, 480, 440, "#111827", 16, C.borderMed, 1)}
    ${text(W / 2, H / 2 - 188, "Upload PDF", 18, C.text, "700", "middle")}
    ${text(W / 2, H / 2 - 166, "Add a document to this package", 13, C.textSub, "normal", "middle")}
    <rect x="${W / 2 - 220}" y="${H / 2 - 152}" width="440" height="1" fill="${C.border}"/>

    <!-- drop zone -->
    <rect x="${W / 2 - 200}" y="${H / 2 - 136}" width="400" height="172" rx="12" fill="rgba(27,79,216,0.06)" stroke="${C.blueLight}" stroke-width="1.5" stroke-dasharray="6,4"/>
    <text x="${W / 2}" y="${H / 2 - 64}" font-size="40" text-anchor="middle">📄</text>
    ${text(W / 2, H / 2 - 24, "Drag &amp; drop your PDF here", 15, C.text, "600", "middle")}
    ${text(W / 2, H / 2 - 4, "or", 13, C.textMuted, "normal", "middle")}
    ${rect(W / 2 - 60, H / 2 + 12, 120, 32, C.blue, 8)}
    ${text(W / 2, H / 2 + 32, "Choose file", 13, "white", "600", "middle")}

    ${text(W / 2, H / 2 + 56, "PDF up to 50 MB", 11, C.textMuted, "normal", "middle")}

    <!-- password field -->
    <rect x="${W / 2 - 200}" y="${H / 2 + 52}" width="400" height="1" fill="${C.border}"/>
    ${text(W / 2 - 200, H / 2 + 72, "Password (if protected)", 12, C.textMuted, "600")}
    ${rect(W / 2 - 200, H / 2 + 84, 400, 36, C.panel, 8, C.border, 1)}
    ${text(W / 2 - 184, H / 2 + 107, "Leave blank if not password-protected", 12, C.textMuted)}

    <!-- actions -->
    ${rect(W / 2 - 200, H / 2 + 136, 192, 40, C.panel, 8, C.border, 1)}
    ${text(W / 2 - 104, H / 2 + 160, "Cancel", 13, C.textSub, "600", "middle")}
    ${rect(W / 2 + 8, H / 2 + 136, 192, 40, C.blue, 8)}
    ${text(W / 2 + 104, H / 2 + 160, "Upload PDF", 13, "white", "600", "middle")}
  `);
}

function fieldEditor() {
  const fields = [
    { name: "Full Legal Name", type: "Text", key: "full_legal_name", mode: "Required" },
    { name: "Date of Birth", type: "Date", key: "date_of_birth", mode: "Required" },
    { name: "SSN / Tax ID", type: "Text", key: "ssn_tax_id", mode: "Required" },
    { name: "Email Address", type: "Email", key: "email_address", mode: "Optional" },
    { name: "Phone Number", type: "Phone", key: "phone_number", mode: "Optional" },
    { name: "Account Type", type: "Radio", key: "account_type", mode: "Required" },
    { name: "Annual Income", type: "Number", key: "annual_income", mode: "Optional" },
  ];

  return svg(`
    ${topbar()}
    ${sidebar("Adding &amp; Editing Fields")}

    <!-- tabs strip -->
    ${rect(SIDEBAR_W, TOPBAR_H, W - SIDEBAR_W, 44, "#0A1120")}
    <rect x="${SIDEBAR_W}" y="${TOPBAR_H + 43}" width="${W - SIDEBAR_W}" height="1" fill="${C.border}"/>
    ${text(SIDEBAR_W + 20, TOPBAR_H + 27, "Documents", 13, C.textMuted)}
    ${text(SIDEBAR_W + 108, TOPBAR_H + 27, "Fields", 13, C.blueLight, "600")}
    <rect x="${SIDEBAR_W + 105}" y="${TOPBAR_H + 43}" width="46" height="2" fill="${C.blue}" rx="1"/>
    ${text(SIDEBAR_W + 162, TOPBAR_H + 27, "Mapper", 13, C.textMuted)}
    ${text(SIDEBAR_W + 218, TOPBAR_H + 27, "Configuration", 13, C.textMuted)}

    <!-- field list area -->
    ${rect(SIDEBAR_W, TOPBAR_H + 44, 440, H - TOPBAR_H - 44, "#0A1120")}
    <rect x="${SIDEBAR_W + 439}" y="${TOPBAR_H + 44}" width="1" height="${H - TOPBAR_H - 44}" fill="${C.border}"/>
    ${text(SIDEBAR_W + 16, TOPBAR_H + 72, "Interview Fields", 12, C.textMuted, "700")}
    ${rect(W - 168, TOPBAR_H + 56, 148, 32, C.blue, 8)}
    ${text(SIDEBAR_W + 336, TOPBAR_H + 76, "+ Add Field", 13, "white", "600", "middle")}

    ${fields.map((f, i) => {
      const fy = TOPBAR_H + 100 + i * 58;
      const isSelected = i === 2;
      return `${rect(SIDEBAR_W + 8, fy, 424, 50, isSelected ? "rgba(27,79,216,0.15)" : "rgba(255,255,255,0.03)", 8, isSelected ? C.blue : C.border, 1)}
      ${rect(SIDEBAR_W + 20, fy + 14, 3, 22, isSelected ? C.blue : C.border, 2)}
      ${text(SIDEBAR_W + 32, fy + 22, f.name, 13, isSelected ? "white" : C.text, isSelected ? "600" : "normal")}
      ${text(SIDEBAR_W + 32, fy + 38, f.key, 11, isSelected ? C.blueLight : C.textMuted)}
      ${pill(SIDEBAR_W + 328, fy + 15, 56, 20, "rgba(255,255,255,0.06)", C.textSub, f.mode, 4)}`;
    }).join("\n")}

    <!-- right edit panel -->
    ${rect(SIDEBAR_W + 440, TOPBAR_H + 44, W - SIDEBAR_W - 440, H - TOPBAR_H - 44, C.panel)}
    ${text(SIDEBAR_W + 460, TOPBAR_H + 72, "Edit Field", 14, C.text, "600")}
    ${text(SIDEBAR_W + 460, TOPBAR_H + 92, "SSN / Tax ID", 18, "white", "700")}

    ${[
      ["Label", "SSN / Tax ID"],
      ["Key", "ssn_tax_id"],
      ["Interview mode", "Required"],
      ["Placeholder text", "XXX-XX-XXXX"],
    ].map(([label, val], i) => {
      const fy = TOPBAR_H + 120 + i * 72;
      return `${text(SIDEBAR_W + 460, fy, label, 11, C.textMuted, "600")}
      ${rect(SIDEBAR_W + 460, fy + 8, W - SIDEBAR_W - 500, 36, C.card, 8, C.border, 1)}
      ${text(SIDEBAR_W + 476, fy + 31, val, 13, C.text)}`;
    }).join("\n")}

    ${text(SIDEBAR_W + 460, TOPBAR_H + 424, "Conditional logic", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 460, TOPBAR_H + 432, W - SIDEBAR_W - 500, 36, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 476, TOPBAR_H + 455, "Always show", 13, C.textMuted)}

    ${rect(SIDEBAR_W + 460, H - 76, 80, 36, C.panel, 8, C.border, 1)}
    ${text(SIDEBAR_W + 500, H - 54, "Cancel", 13, C.textSub, "600", "middle")}
    ${rect(SIDEBAR_W + 548, H - 76, W - SIDEBAR_W - 588, 36, C.blue, 8)}
    ${text(SIDEBAR_W + 548 + (W - SIDEBAR_W - 588) / 2, H - 54, "Save Field", 13, "white", "600", "middle")}
  `);
}

function mapperOverview() {
  const FIELD_PANEL = 220;
  const RIGHT_PANEL = 188;
  const PDF_X = SIDEBAR_W + FIELD_PANEL;
  const PDF_W = W - PDF_X - RIGHT_PANEL;

  return svg(`
    ${topbar()}

    <!-- top toolbar -->
    ${rect(0, TOPBAR_H, W, 44, "#0A1120")}
    <rect x="0" y="${TOPBAR_H + 43}" width="${W}" height="1" fill="${C.border}"/>
    ${text(16, TOPBAR_H + 27, "← New Client Intake", 13, C.textSub)}
    ${text(W / 2, TOPBAR_H + 27, "Visual Mapper", 14, C.text, "600", "middle")}
    ${pill(W - 140, TOPBAR_H + 12, 124, 26, C.blue, "white", "Save all mappings", 6)}

    <!-- field list panel -->
    ${rect(0, TOPBAR_H + 44, SIDEBAR_W + FIELD_PANEL, H - TOPBAR_H - 44, "#0A1422")}
    <rect x="${SIDEBAR_W + FIELD_PANEL - 1}" y="${TOPBAR_H + 44}" width="1" height="${H - TOPBAR_H - 44}" fill="${C.border}"/>
    ${text(16, TOPBAR_H + 76, "Fields", 12, C.textMuted, "700")}

    ${[
      { n: "Full Legal Name", m: 2, active: true },
      { n: "Date of Birth", m: 1, active: false },
      { n: "SSN / Tax ID", m: 1, active: false },
      { n: "Email Address", m: 1, active: false },
      { n: "Account Type", m: 3, active: false },
      { n: "Annual Income", m: 0, active: false },
      { n: "Signature", m: 1, active: false },
    ].map((f, i) => {
      const fy = TOPBAR_H + 96 + i * 60;
      return `${rect(8, fy, SIDEBAR_W + FIELD_PANEL - 16, 52, f.active ? "rgba(27,79,216,0.2)" : "rgba(255,255,255,0.02)", 8, f.active ? C.blue : "none", 1)}
      ${text(20, fy + 22, f.n, 13, f.active ? "white" : C.textSub, f.active ? "600" : "normal")}
      ${f.m > 0 ? `${text(20, fy + 38, `${f.m} mapping${f.m > 1 ? "s" : ""}`, 11, f.active ? C.blueLight : C.textMuted)}` : `${text(20, fy + 38, "No mappings", 11, C.textMuted)}`}
      ${f.m > 0 ? pill(SIDEBAR_W + FIELD_PANEL - 68, fy + 16, 56, 20, f.active ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.1)", f.active ? C.green : "#16a34a", "mapped", 4) : ""}`;
    }).join("\n")}

    <!-- PDF canvas -->
    ${rect(PDF_X, TOPBAR_H + 44, PDF_W, H - TOPBAR_H - 44, "#1a2a3a")}
    ${rect(PDF_X + 24, TOPBAR_H + 64, PDF_W - 48, H - TOPBAR_H - 88, "white", 4)}

    <!-- PDF content -->
    ${text(PDF_X + 48, TOPBAR_H + 100, "CLIENT INFORMATION FORM", 10, "#374151", "700")}
    ${rect(PDF_X + 48, TOPBAR_H + 108, PDF_W - 96, 1, "#e5e7eb")}

    ${text(PDF_X + 48, TOPBAR_H + 128, "Full Legal Name:", 9, "#374151")}
    ${rect(PDF_X + 48, TOPBAR_H + 132, 260, 28, "#eff6ff", 3, "#1B4FD8", 2)}
    <text x="${PDF_X + 178}" y="${TOPBAR_H + 150}" font-size="9" fill="#1d4ed8" text-anchor="middle">Full Legal Name</text>
    <!-- callout annotation -->
    <circle cx="${PDF_X + 48 + 260 + 20}" cy="${TOPBAR_H + 132 + 14}" r="14" fill="${C.blue}"/>
    <text x="${PDF_X + 48 + 260 + 20}" y="${TOPBAR_H + 132 + 19}" font-size="12" fill="white" font-weight="700" text-anchor="middle">1</text>
    <line x1="${PDF_X + 48 + 260}" y1="${TOPBAR_H + 132 + 14}" x2="${PDF_X + 48 + 260 + 6}" y2="${TOPBAR_H + 132 + 14}" stroke="${C.blue}" stroke-width="2"/>

    ${text(PDF_X + 48, TOPBAR_H + 178, "Date of Birth:", 9, "#374151")}
    ${rect(PDF_X + 48, TOPBAR_H + 182, 120, 24, "#fafafa", 3, "#d1d5db", 1)}

    ${text(PDF_X + 200, TOPBAR_H + 178, "SSN:", 9, "#374151")}
    ${rect(PDF_X + 200, TOPBAR_H + 182, 108, 24, "#fafafa", 3, "#d1d5db", 1)}

    ${text(PDF_X + 48, TOPBAR_H + 224, "Also appearing as:", 9, "#6b7280")}
    ${rect(PDF_X + 48, TOPBAR_H + 228, 260, 28, "#eff6ff", 3, "#1B4FD8", 1.5)}
    <text x="${PDF_X + 178}" y="${TOPBAR_H + 246}" font-size="9" fill="#93c5fd" text-anchor="middle">Full Legal Name</text>
    <!-- second callout -->
    <circle cx="${PDF_X + 48 + 260 + 20}" cy="${TOPBAR_H + 228 + 14}" r="14" fill="${C.blue}"/>
    <text x="${PDF_X + 48 + 260 + 20}" y="${TOPBAR_H + 228 + 19}" font-size="12" fill="white" font-weight="700" text-anchor="middle">2</text>
    <line x1="${PDF_X + 48 + 260}" y1="${TOPBAR_H + 228 + 14}" x2="${PDF_X + 48 + 260 + 6}" y2="${TOPBAR_H + 228 + 14}" stroke="${C.blue}" stroke-width="2"/>

    <!-- legend -->
    ${rect(PDF_X + 24, H - 80, PDF_W - 48, 36, "rgba(0,0,0,0.06)", 6)}
    ${text(PDF_X + 40, H - 58, "ⓘ  Numbered callouts indicate multiple mappings for the same field.", 11, "#6b7280")}

    <!-- right panel -->
    ${rect(W - RIGHT_PANEL, TOPBAR_H + 44, RIGHT_PANEL, H - TOPBAR_H - 44, "#0A1422")}
    <rect x="${W - RIGHT_PANEL}" y="${TOPBAR_H + 44}" width="1" height="${H - TOPBAR_H - 44}" fill="${C.border}"/>
    ${text(W - RIGHT_PANEL + 12, TOPBAR_H + 72, "Formatting", 12, C.textMuted, "700")}
    ${text(W - RIGHT_PANEL + 12, TOPBAR_H + 100, "Font size", 11, C.textMuted)}
    ${rect(W - RIGHT_PANEL + 12, TOPBAR_H + 106, RIGHT_PANEL - 24, 30, C.panel, 6, C.border, 1)}
    ${text(W - RIGHT_PANEL / 2, TOPBAR_H + 126, "11 pt", 12, C.text, "normal", "middle")}
    ${text(W - RIGHT_PANEL + 12, TOPBAR_H + 152, "Alignment", 11, C.textMuted)}
    ${rect(W - RIGHT_PANEL + 12, TOPBAR_H + 158, RIGHT_PANEL - 24, 30, C.blue, 6)}
    ${text(W - RIGHT_PANEL / 2, TOPBAR_H + 178, "Left", 12, "white", "600", "middle")}
    ${text(W - RIGHT_PANEL + 12, TOPBAR_H + 204, "Transform", 11, C.textMuted)}
    ${rect(W - RIGHT_PANEL + 12, TOPBAR_H + 210, RIGHT_PANEL - 24, 30, C.panel, 6, C.border, 1)}
    ${text(W - RIGHT_PANEL / 2, TOPBAR_H + 230, "None", 12, C.text, "normal", "middle")}
    ${rect(W - RIGHT_PANEL + 12, H - 64, RIGHT_PANEL - 24, 36, C.blue, 8)}
    ${text(W - RIGHT_PANEL / 2, H - 42, "Save", 13, "white", "600", "middle")}
  `);
}

function esignField() {
  const PDF_X = SIDEBAR_W + 20;
  const PDF_W = W - PDF_X - 220;

  return svg(`
    ${topbar()}

    <!-- top toolbar -->
    ${rect(0, TOPBAR_H, W, 44, "#0A1120")}
    <rect x="0" y="${TOPBAR_H + 43}" width="${W}" height="1" fill="${C.border}"/>
    ${text(W / 2, TOPBAR_H + 27, "Visual Mapper — E-Sign Fields", 14, C.text, "600", "middle")}

    <!-- field panel -->
    ${rect(0, TOPBAR_H + 44, SIDEBAR_W, H - TOPBAR_H - 44, "#0A1422")}
    <rect x="${SIDEBAR_W - 1}" y="${TOPBAR_H + 44}" width="1" height="${H - TOPBAR_H - 44}" fill="${C.border}"/>
    ${text(12, TOPBAR_H + 72, "Fields", 12, C.textMuted, "700")}

    ${[
      { n: "Client Signature", t: "Signature", active: true },
      { n: "Initials (p.1)", t: "Initials", active: false },
      { n: "Initials (p.3)", t: "Initials", active: false },
      { n: "Date Signed", t: "Date", active: false },
    ].map((f, i) => {
      const fy = TOPBAR_H + 92 + i * 60;
      return `${rect(8, fy, SIDEBAR_W - 16, 52, f.active ? "rgba(27,79,216,0.2)" : "rgba(255,255,255,0.02)", 8, f.active ? C.blue : "none", 1)}
      ${text(20, fy + 22, f.n, 13, f.active ? "white" : C.textSub, f.active ? "600" : "normal")}
      ${text(20, fy + 38, f.t, 11, f.active ? C.blueLight : C.textMuted)}`;
    }).join("\n")}

    <!-- PDF canvas -->
    ${rect(PDF_X, TOPBAR_H + 44, PDF_W, H - TOPBAR_H - 44, "#1a2a3a")}
    ${rect(PDF_X + 20, TOPBAR_H + 64, PDF_W - 40, H - TOPBAR_H - 88, "white", 4)}

    <!-- PDF content -->
    ${text(PDF_X + 44, TOPBAR_H + 96, "INVESTMENT ADVISORY AGREEMENT", 10, "#111827", "700")}
    ${rect(PDF_X + 44, TOPBAR_H + 102, PDF_W - 88, 1, "#e5e7eb")}
    ${[1,2,3].map(i => `${rect(PDF_X + 44, TOPBAR_H + 108 + i * 20, PDF_W - 88 - (i % 2 === 0 ? 80 : 0), 12, "#f3f4f6", 2)}`).join("")}
    ${rect(PDF_X + 44, TOPBAR_H + 172, PDF_W - 88, 12, "#f3f4f6", 2)}
    ${rect(PDF_X + 44, TOPBAR_H + 192, PDF_W - 88 - 120, 12, "#f3f4f6", 2)}

    ${text(PDF_X + 44, TOPBAR_H + 232, "By signing below, you agree to the terms set forth in this Agreement.", 9, "#6b7280")}

    <!-- signature box with active selection -->
    ${rect(PDF_X + 44, TOPBAR_H + 248, 280, 72, "#f0fdf4", 4, "#1B4FD8", 2)}
    <!-- signature image simulation -->
    <path d="M${PDF_X + 60} ${TOPBAR_H + 295} Q${PDF_X + 90} ${TOPBAR_H + 270} ${PDF_X + 120} ${TOPBAR_H + 290} Q${PDF_X + 150} ${TOPBAR_H + 310} ${PDF_X + 180} ${TOPBAR_H + 280} Q${PDF_X + 210} ${TOPBAR_H + 260} ${PDF_X + 260} ${TOPBAR_H + 295}" stroke="#1d4ed8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <text x="${PDF_X + 44 + 1}" y="${TOPBAR_H + 330}" font-size="8" fill="#22c55e">✓ E-signature captured</text>

    <!-- resize handles -->
    ${["0,0", "280,0", "0,72", "280,72"].map(p => {
      const [dx, dy] = p.split(",").map(Number);
      return `<rect x="${PDF_X + 44 + dx - 4}" y="${TOPBAR_H + 248 + dy - 4}" width="8" height="8" rx="2" fill="${C.blue}" stroke="white" stroke-width="1"/>`;
    }).join("")}

    ${text(PDF_X + 44, TOPBAR_H + 352, "Client Name (Print):", 9, "#374151")}
    ${rect(PDF_X + 44, TOPBAR_H + 356, 200, 20, "#fafafa", 3, "#d1d5db", 1)}

    ${text(PDF_X + 280, TOPBAR_H + 352, "Date:", 9, "#374151")}
    ${rect(PDF_X + 280, TOPBAR_H + 356, 100, 20, "#fafafa", 3, "#d1d5db", 1)}

    <!-- right panel -->
    ${rect(W - 220, TOPBAR_H + 44, 220, H - TOPBAR_H - 44, "#0A1422")}
    <rect x="${W - 220}" y="${TOPBAR_H + 44}" width="1" height="${H - TOPBAR_H - 44}" fill="${C.border}"/>
    ${text(W - 208, TOPBAR_H + 72, "Signature Field", 12, C.textMuted, "700")}
    ${text(W - 208, TOPBAR_H + 96, "Scales to fit box", 11, C.textMuted)}
    ${rect(W - 208, TOPBAR_H + 102, 192, 30, C.panel, 6, C.border, 1)}
    ${text(W - 112, TOPBAR_H + 122, "Preserve ratio", 12, C.text, "normal", "middle")}
    ${rect(W - 208, H - 64, 192, 36, C.blue, 8)}
    ${text(W - 112, H - 42, "Save mapping", 13, "white", "600", "middle")}
  `);
}

function textboxConfig() {
  return svg(`
    ${topbar()}
    ${sidebar("Single-line vs. Multiline")}

    <!-- content -->
    ${text(SIDEBAR_W + 40, TOPBAR_H + 48, "Text Box Configuration", 22, C.text, "700")}

    <!-- two-panel layout -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 72, (W - SIDEBAR_W - 56) / 2 - 8, H - TOPBAR_H - 90, C.panel, 12, C.border, 1)}
    ${rect(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2, TOPBAR_H + 72, (W - SIDEBAR_W - 56) / 2 - 8, H - TOPBAR_H - 90, C.panel, 12, C.border, 1)}

    <!-- left panel: single line -->
    ${text(SIDEBAR_W + 64, TOPBAR_H + 108, "Single-line Mode", 16, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 128, "Text fits on one line. Auto-scales font to fit.", 13, C.textSub)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 164, "Mode", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 172, 220, 34, C.blue, 8)}
    ${text(SIDEBAR_W + 174, TOPBAR_H + 193, "Single-line", 13, "white", "600", "middle")}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 224, "Font size", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 232, 104, 34, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 116, TOPBAR_H + 253, "11 pt", 13, C.text, "normal", "middle")}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 284, "Auto-scale font", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 292, 44, 24, C.blue, 12)}
    <circle cx="${SIDEBAR_W + 96}" cy="${TOPBAR_H + 304}" r="9" fill="white"/>
    ${text(SIDEBAR_W + 116, TOPBAR_H + 308, "On", 12, C.text)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 336, "Min font size", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 344, 104, 34, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 116, TOPBAR_H + 365, "7 pt", 13, C.text, "normal", "middle")}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 398, "Overflow behavior", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 406, 220, 34, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 174, TOPBAR_H + 427, "Truncate with …", 13, C.text, "normal", "middle")}

    <!-- preview -->
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 460, 220, 36, "#eff6ff", 6, "#3b82f6", 1.5)}
    ${text(SIDEBAR_W + 174, TOPBAR_H + 482, "Margaret A. Johnson", 11, "#1d4ed8", "normal", "middle")}

    <!-- right panel: multiline -->
    const RX = SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24;
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 108, "Multiline Mode", 16, C.text, "600")}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 128, "Text wraps within the bounding box.", 13, C.textSub)}

    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 164, "Mode", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 172, 220, 34, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24 + 110, TOPBAR_H + 193, "Multiline", 13, C.text, "normal", "middle")}

    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 224, "Font size", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 232, 104, 34, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24 + 52, TOPBAR_H + 253, "10 pt", 13, C.text, "normal", "middle")}

    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 284, "Line height", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 292, 104, 34, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24 + 52, TOPBAR_H + 313, "1.2×", 13, C.text, "normal", "middle")}

    <!-- multiline preview -->
    ${rect(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 24, TOPBAR_H + 352, 220, 80, "#eff6ff", 6, "#3b82f6", 1.5)}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 40, TOPBAR_H + 372, "123 Main Street", 10, "#1d4ed8")}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 40, TOPBAR_H + 387, "Suite 400", 10, "#1d4ed8")}
    ${text(SIDEBAR_W + 40 + (W - SIDEBAR_W - 56) / 2 + 40, TOPBAR_H + 402, "San Francisco, CA 94105", 10, "#1d4ed8")}
  `);
}

function batchRunsList() {
  const runs = [
    { name: "renewals-2026-q1.csv", pkg: "Annual Disclosure", status: "completed", success: 312, err: 0, date: "May 1, 2026" },
    { name: "onboarding-may.csv", pkg: "New Client Intake", status: "completed_errors", success: 87, err: 4, date: "Apr 28, 2026" },
    { name: "beneficiary-updates.csv", pkg: "Beneficiary Update", status: "processing", success: 45, err: 0, date: "Apr 25, 2026" },
    { name: "q4-disclosures.csv", pkg: "Annual Disclosure", status: "completed", success: 501, err: 0, date: "Apr 15, 2026" },
    { name: "ira-rollover-batch.csv", pkg: "IRA Rollover Form", status: "completed", success: 23, err: 2, date: "Apr 10, 2026" },
  ];

  const statusConfig = {
    completed: { label: "Completed", color: C.green, bg: C.greenBg },
    completed_errors: { label: "Errors", color: C.amber, bg: C.amberBg },
    processing: { label: "Processing", color: C.blueLight, bg: "rgba(91,141,239,0.12)" },
  };

  return svg(`
    ${topbar()}
    ${sidebar("Batch Runs Tab")}

    <!-- header -->
    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Batch Runs", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "All CSV import runs across all packages", 13, C.textSub)}

    <!-- table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, H - TOPBAR_H - 96, C.panel, 10, C.border, 1)}
    <!-- header row -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 40, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 119}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["File name", "Package", "Status", "Success", "Errors", "Date"].map((h, i) => {
      const xs = [SIDEBAR_W + 60, SIDEBAR_W + 300, SIDEBAR_W + 480, SIDEBAR_W + 620, SIDEBAR_W + 700, SIDEBAR_W + 800];
      return text(xs[i], TOPBAR_H + 104, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${runs.map((r, i) => {
      const ry = TOPBAR_H + 120 + i * 64;
      const sc = statusConfig[r.status];
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 64, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 63}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      <!-- file icon -->
      ${rect(SIDEBAR_W + 60, ry + 16, 24, 30, "rgba(27,79,216,0.15)", 4)}
      <text x="${SIDEBAR_W + 72}" y="${ry + 36}" font-size="8" fill="${C.blueLight}" text-anchor="middle">CSV</text>
      ${text(SIDEBAR_W + 92, ry + 28, r.name, 13, C.text, "600")}
      ${text(SIDEBAR_W + 300, ry + 36, r.pkg, 12, C.textSub)}
      ${pill(SIDEBAR_W + 480, ry + 22, sc.label.length * 7 + 16, 22, sc.bg, sc.color, sc.label, 6)}
      ${text(SIDEBAR_W + 620, ry + 36, r.success.toLocaleString(), 13, C.green, "600")}
      ${r.err > 0 ? text(SIDEBAR_W + 700, ry + 36, r.err.toString(), 13, C.red, "600") : text(SIDEBAR_W + 700, ry + 36, "—", 13, C.textMuted)}
      ${text(SIDEBAR_W + 800, ry + 36, r.date, 12, C.textMuted)}
      ${pill(W - 152, ry + 20, 100, 26, "rgba(255,255,255,0.05)", C.textSub, "↓ Download ZIP", 6)}`;
    }).join("\n")}
  `);
}

function batchTemplate() {
  return svg(`
    ${topbar()}
    ${sidebar("Downloading Template")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "CSV Template Preview", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Download a pre-built template with the correct column headers for your package.", 13, C.textSub)}

    <!-- download button -->
    ${rect(W - 220, TOPBAR_H + 30, 196, 40, C.blue, 10)}
    ${text(W - 122, TOPBAR_H + 55, "↓ Download Template", 13, "white", "600", "middle")}

    <!-- CSV preview table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, H - TOPBAR_H - 96, C.panel, 10, C.border, 1)}

    <!-- column headers (CSV row 1) -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 44, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 123}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>

    ${["first_name", "last_name", "date_of_birth", "account_type", "annual_income", "ssn", "_client_name"].map((col, i) => {
      const colX = SIDEBAR_W + 56 + i * 140;
      const isSpecial = col.startsWith("_");
      return `${rect(colX - 4, TOPBAR_H + 90, col.length * 7 + 12, 24, isSpecial ? C.purpleBg : "rgba(27,79,216,0.1)", 4)}
      <text x="${colX}" y="${TOPBAR_H + 106}" font-size="11" fill="${isSpecial ? C.purple : C.blueLight}" font-weight="600">${esc(col)}</text>`;
    }).join("\n")}

    <!-- row 1: example data -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 124, W - SIDEBAR_W - 56, 44, "rgba(255,255,255,0.03)")}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 167}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    <text x="${SIDEBAR_W + 52}" y="${TOPBAR_H + 102}" font-size="10" fill="${C.textMuted}" font-style="italic">Row 1 (header)</text>
    ${["John", "Smith", "1975-04-12", "Individual", "85000", "●●●-●●-1234", "John Smith — 2026"].map((val, i) => {
      const colX = SIDEBAR_W + 56 + i * 140;
      return `<text x="${colX}" y="${TOPBAR_H + 150}" font-size="12" fill="${C.text}">${esc(val)}</text>`;
    }).join("\n")}
    <text x="${SIDEBAR_W + 52}" y="${TOPBAR_H + 148}" font-size="10" fill="${C.textMuted}" font-style="italic">Row 2 (example)</text>

    <!-- row 2: blank -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 168, W - SIDEBAR_W - 56, 44, "transparent")}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 211}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["Jane", "Doe", "1982-08-29", "Joint", "124000", "●●●-●●-5678", "Jane Doe — 2026"].map((val, i) => {
      const colX = SIDEBAR_W + 56 + i * 140;
      return `<text x="${colX}" y="${TOPBAR_H + 194}" font-size="12" fill="${C.text}">${esc(val)}</text>`;
    }).join("\n")}
    <text x="${SIDEBAR_W + 52}" y="${TOPBAR_H + 192}" font-size="10" fill="${C.textMuted}" font-style="italic">Row 3</text>

    <!-- special columns callout -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 220, W - SIDEBAR_W - 56, 64, C.purpleBg, 8)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 220}" width="${W - SIDEBAR_W - 56}" height="64" rx="8" fill="none" stroke="${C.purple}" stroke-width="1" stroke-opacity="0.3"/>
    ${text(SIDEBAR_W + 60, TOPBAR_H + 244, "Special columns: _client_name, _client_email, _expiration_days", 13, C.purple, "600")}
    ${text(SIDEBAR_W + 60, TOPBAR_H + 264, "These control session metadata and are optional. Leave blank to use package defaults.", 12, "rgba(167,139,250,0.7)")}

    <!-- rows continue as ellipsis -->
    ${[290, 310].map(offset =>
      `${rect(SIDEBAR_W + 40, TOPBAR_H + offset, W - SIDEBAR_W - 56, 20, "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + offset + 19}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      <text x="${W / 2}" y="${TOPBAR_H + offset + 14}" font-size="12" fill="${C.textMuted}" text-anchor="middle">···</text>`
    ).join("\n")}
  `);
}

function batchUpload() {
  return svg(`
    ${topbar()}
    ${sidebar("Uploading &amp; Results")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Upload & Review", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Submit your CSV file and preview the row mapping before starting the batch run.", 13, C.textSub)}

    <!-- upload zone -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 156, C.panel, 10, C.border, 1)}
    <rect x="${SIDEBAR_W + 60}" y="${TOPBAR_H + 100}" width="${W - SIDEBAR_W - 96}" height="112" rx="8" fill="rgba(27,79,216,0.04)" stroke="${C.blueLight}" stroke-width="1" stroke-dasharray="5,4"/>
    <text x="${W / 2}" y="${TOPBAR_H + 140}" font-size="28" text-anchor="middle">📊</text>
    ${text(W / 2, TOPBAR_H + 168, "Drop CSV here or", 14, C.textSub, "normal", "middle")}
    ${rect(W / 2 - 52, TOPBAR_H + 176, 104, 28, C.blue, 6)}
    ${text(W / 2, TOPBAR_H + 195, "Browse file", 12, "white", "600", "middle")}

    <!-- preview header -->
    ${text(SIDEBAR_W + 40, TOPBAR_H + 252, "Preview — first 5 rows", 14, C.text, "600")}
    ${pill(SIDEBAR_W + 180, TOPBAR_H + 238, 88, 26, C.greenBg, C.green, "✓ 312 rows", 6)}
    ${pill(SIDEBAR_W + 276, TOPBAR_H + 238, 72, 26, "rgba(255,255,255,0.06)", C.textSub, "8 columns", 6)}

    <!-- preview table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 272, W - SIDEBAR_W - 56, H - TOPBAR_H - 316, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 272, W - SIDEBAR_W - 56, 36, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 307}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>

    ${["#", "first_name", "last_name", "date_of_birth", "account_type", "annual_income"].map((h, i) => {
      const xs = [SIDEBAR_W + 56, SIDEBAR_W + 92, SIDEBAR_W + 220, SIDEBAR_W + 350, SIDEBAR_W + 520, SIDEBAR_W + 660];
      return text(xs[i], TOPBAR_H + 294, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${[
      [1, "John", "Smith", "1975-04-12", "Individual", "$85,000"],
      [2, "Jane", "Doe", "1982-08-29", "Joint", "$124,000"],
      [3, "Robert", "Chen", "1968-11-03", "Trust", "$310,000"],
      [4, "Sarah", "Williams", "1991-05-17", "Individual", "$67,500"],
      [5, "Michael", "Brown", "1955-02-28", "Individual", "$220,000"],
    ].map((row, ri) => {
      const ry = TOPBAR_H + 308 + ri * 52;
      const xs = [SIDEBAR_W + 56, SIDEBAR_W + 92, SIDEBAR_W + 220, SIDEBAR_W + 350, SIDEBAR_W + 520, SIDEBAR_W + 660];
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 52, ri % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 51}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      ${row.map((val, ci) => text(xs[ci], ry + 30, String(val), 12, ci === 0 ? C.textMuted : C.text)).join("\n")}`;
    }).join("\n")}

    <!-- start button -->
    ${rect(W - 220, H - 64, 196, 40, C.blue, 10)}
    ${text(W - 122, H - 40, "Start Batch Run →", 14, "white", "600", "middle")}
  `);
}

function batchProgress() {
  return svg(`
    ${topbar()}
    ${sidebar("Uploading &amp; Results")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Batch Run In Progress", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "onboarding-may.csv  ·  New Client Intake  ·  Started May 5, 2026 at 10:42 AM", 13, C.textSub)}

    <!-- progress card -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 140, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 116, "Processing…", 18, C.text, "700")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 138, "87 of 312 rows completed", 14, C.textSub)}

    <!-- progress bar -->
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 156, W - SIDEBAR_W - 120, 12, "rgba(255,255,255,0.06)", 6)}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 156, Math.round((W - SIDEBAR_W - 120) * 0.28), 12, C.blue, 6)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 188, "28% complete  ·  Est. 2 min remaining", 12, C.textMuted)}
    ${pill(W - 132, TOPBAR_H + 100, 88, 28, "rgba(91,141,239,0.15)", C.blueLight, "⟳ Processing", 6)}

    <!-- stats row -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 236, W - SIDEBAR_W - 56, 80, C.panel, 10, C.border, 1)}
    ${[
      { label: "Total rows", val: "312" },
      { label: "Completed", val: "87", color: C.green },
      { label: "Remaining", val: "225", color: C.blueLight },
      { label: "Errors", val: "0", color: C.textMuted },
    ].map((s, i) => {
      const sx = SIDEBAR_W + 64 + i * 220;
      return `${text(sx, TOPBAR_H + 268, s.label, 11, C.textMuted, "600")}
      ${text(sx, TOPBAR_H + 296, s.val, 22, s.color || C.text, "700")}`;
    }).join("\n")}

    <!-- rows list (in progress) -->
    ${text(SIDEBAR_W + 40, TOPBAR_H + 336, "Row Results", 14, C.text, "600")}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 356, W - SIDEBAR_W - 56, H - TOPBAR_H - 372, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 356, W - SIDEBAR_W - 56, 36, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 391}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["Row", "Client name", "Status", "Download"].map((h, i) => {
      const xs = [SIDEBAR_W + 56, SIDEBAR_W + 104, SIDEBAR_W + 480, SIDEBAR_W + 660];
      return text(xs[i], TOPBAR_H + 378, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${[
      { n: 1, name: "John Smith", done: true },
      { n: 2, name: "Jane Doe", done: true },
      { n: 3, name: "Robert Chen", done: true },
      { n: 4, name: "Sarah Williams", done: false },
      { n: 5, name: "Michael Brown", done: false },
    ].map((r, i) => {
      const ry = TOPBAR_H + 392 + i * 52;
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 52, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 51}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      ${text(SIDEBAR_W + 56, ry + 30, String(r.n), 12, C.textMuted)}
      ${text(SIDEBAR_W + 104, ry + 30, r.name, 13, C.text)}
      ${r.done ? pill(SIDEBAR_W + 480, ry + 16, 88, 22, C.greenBg, C.green, "✓ Generated", 4) : pill(SIDEBAR_W + 480, ry + 16, 72, 22, "rgba(91,141,239,0.1)", C.blueLight, "Pending", 4)}
      ${r.done ? `<text x="${SIDEBAR_W + 660}" y="${ry + 30}" font-size="12" fill="${C.blueLight}">↓ PDF</text>` : ""}`;
    }).join("\n")}
  `);
}

function batchErrors() {
  const rows = [
    { n: 4, name: "Sarah Williams", error: "Required field blank: account_type", badge: "Missing value" },
    { n: 7, name: "Thomas Ngyuen", error: "Invalid date format: date_of_birth — expected YYYY-MM-DD", badge: "Bad format" },
    { n: 12, name: "Lisa Park", error: "Option not found: account_type value 'individual' — check capitalization", badge: "Bad option" },
    { n: 19, name: "David Torres", error: "Required field blank: annual_income", badge: "Missing value" },
    { n: 23, name: "Emma Davis", error: "Value too long: notes field exceeds 500 character limit", badge: "Too long" },
  ];

  return svg(`
    ${topbar()}
    ${sidebar("Understanding Errors")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Batch Errors", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "onboarding-may.csv  ·  87 succeeded  ·  5 errors", 13, C.textSub)}

    <!-- error summary banner -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 60, C.amberBg, 8, `rgba(245,158,11,0.3)`, 1)}
    <text x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 109}" font-size="14" fill="${C.amber}" font-weight="600">⚠ 5 rows failed to generate</text>
    ${text(SIDEBAR_W + 64, TOPBAR_H + 127, "Download the error report to fix and re-run only the failed rows.", 12, C.amber)}
    ${rect(W - 228, TOPBAR_H + 90, 172, 36, "rgba(245,158,11,0.15)", 8, `rgba(245,158,11,0.3)`, 1)}
    ${text(W - 142, TOPBAR_H + 112, "↓ Download Error CSV", 12, C.amber, "600", "middle")}

    <!-- table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 156, W - SIDEBAR_W - 56, H - TOPBAR_H - 172, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 156, W - SIDEBAR_W - 56, 36, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 191}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["Row", "Client name", "Issue type", "Error message"].map((h, i) => {
      const xs = [SIDEBAR_W + 56, SIDEBAR_W + 104, SIDEBAR_W + 300, SIDEBAR_W + 460];
      return text(xs[i], TOPBAR_H + 178, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${rows.map((r, i) => {
      const ry = TOPBAR_H + 192 + i * 68;
      const badgeColors = {
        "Missing value": { color: C.red, bg: C.redBg },
        "Bad format": { color: C.amber, bg: C.amberBg },
        "Bad option": { color: C.purple, bg: C.purpleBg },
        "Too long": { color: C.amber, bg: C.amberBg },
      };
      const bc = badgeColors[r.badge];
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 68, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 67}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      ${text(SIDEBAR_W + 56, ry + 36, String(r.n), 13, C.textMuted)}
      ${text(SIDEBAR_W + 104, ry + 36, r.name, 13, C.text, "600")}
      ${pill(SIDEBAR_W + 300, ry + 24, r.badge.length * 7 + 16, 24, bc.bg, bc.color, r.badge, 6)}
      ${text(SIDEBAR_W + 460, ry + 36, r.error, 11, C.textSub)}`;
    }).join("\n")}
  `);
}

function batchRunsDashboard() {
  const runs = [
    { name: "renewals-2026.csv", pkg: "Annual Disclosure", status: "Completed", pct: 100, success: 312, err: 0 },
    { name: "onboarding-may.csv", pkg: "New Client Intake", status: "Completed with errors", pct: 100, success: 87, err: 5 },
    { name: "beneficiary-q2.csv", pkg: "Beneficiary Update", status: "Processing", pct: 62, success: 45, err: 0 },
    { name: "ira-rollover.csv", pkg: "IRA Rollover Form", status: "Completed", pct: 100, success: 23, err: 0 },
    { name: "kyc-batch.csv", pkg: "KYC Intake", status: "Queued", pct: 0, success: 0, err: 0 },
  ];

  const statusChip = (s) => {
    const m = {
      "Completed": { color: C.green, bg: C.greenBg },
      "Completed with errors": { color: C.amber, bg: C.amberBg },
      "Processing": { color: C.blueLight, bg: "rgba(91,141,239,0.12)" },
      "Queued": { color: C.textMuted, bg: "rgba(255,255,255,0.06)" },
    };
    return m[s] || m["Queued"];
  };

  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}

    <!-- sidebar nav -->
    ${rect(0, TOPBAR_H, 220, H - TOPBAR_H, C.sidebar)}
    <rect x="219" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>
    ${text(16, TOPBAR_H + 32, "Sessions Dashboard", 11, C.textMuted, "700")}
    ${text(20, TOPBAR_H + 58, "Interviews", 13, C.textMuted)}
    ${rect(8, TOPBAR_H + 68, 204, 28, "rgba(27,79,216,0.2)", 8)}
    ${text(20, TOPBAR_H + 87, "Batch Runs", 13, C.blueLight, "600")}

    <!-- main -->
    ${text(240, TOPBAR_H + 40, "Batch Runs", 22, C.text, "700")}
    ${text(240, TOPBAR_H + 62, "Track and download results from all CSV import runs.", 13, C.textSub)}

    <!-- table -->
    ${rect(240, TOPBAR_H + 80, W - 256, H - TOPBAR_H - 96, C.panel, 10, C.border, 1)}
    ${rect(240, TOPBAR_H + 80, W - 256, 40, "#0D1829", 10)}
    <rect x="240" y="${TOPBAR_H + 119}" width="${W - 256}" height="1" fill="${C.border}"/>
    ${["File", "Package", "Status", "Progress", "Success", "Errors"].map((h, i) => {
      const xs = [256, 440, 600, 740, 900, 984];
      return text(xs[i], TOPBAR_H + 104, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${runs.map((r, i) => {
      const ry = TOPBAR_H + 120 + i * 72;
      const sc = statusChip(r.status);
      const barW = 120;
      return `${rect(240, ry, W - 256, 72, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="240" y="${ry + 71}" width="${W - 256}" height="1" fill="${C.border}"/>
      ${rect(256, ry + 20, 24, 28, "rgba(27,79,216,0.15)", 4)}
      <text x="268" y="${ry + 39}" font-size="8" fill="${C.blueLight}" text-anchor="middle">CSV</text>
      ${text(288, ry + 34, r.name, 13, C.text, "600")}
      ${text(440, ry + 34, r.pkg, 12, C.textSub)}
      ${pill(600, ry + 24, r.status.length * 6 + 16, 22, sc.bg, sc.color, r.status, 6)}
      <!-- progress bar -->
      ${rect(740, ry + 30, barW, 10, "rgba(255,255,255,0.06)", 5)}
      ${r.pct > 0 ? rect(740, ry + 30, Math.round(barW * r.pct / 100), 10, r.pct === 100 ? C.green : C.blue, 5) : ""}
      <text x="${740 + barW + 8}" y="${ry + 39}" font-size="11" fill="${C.textMuted}">${r.pct}%</text>
      ${r.success > 0 ? `<text x="900" y="${ry + 39}" font-size="12" fill="${C.green}" font-weight="600">${r.success}</text>` : `<text x="900" y="${ry + 39}" font-size="12" fill="${C.textMuted}">—</text>`}
      ${r.err > 0 ? `<text x="984" y="${ry + 39}" font-size="12" fill="${C.red}" font-weight="600">${r.err}</text>` : `<text x="984" y="${ry + 39}" font-size="12" fill="${C.textMuted}">—</text>`}`;
    }).join("\n")}
  `);
}

function interviewsList() {
  const sessions = [
    { name: "Margaret A. Johnson", pkg: "New Client Intake", status: "Generated", created: "May 3, 2026", submitted: "May 3, 2026" },
    { name: "Robert Chen", pkg: "IRA Rollover Form", status: "In Progress", created: "May 3, 2026", submitted: "—" },
    { name: "Sarah Williams", pkg: "New Client Intake", status: "Pending", created: "May 2, 2026", submitted: "—" },
    { name: "David Torres", pkg: "Annual Disclosure", status: "Generated", created: "May 1, 2026", submitted: "May 2, 2026" },
    { name: "Emma Davis", pkg: "Beneficiary Update", status: "Expired", created: "Apr 25, 2026", submitted: "—" },
    { name: "James Wilson", pkg: "New Client Intake", status: "Generated", created: "Apr 24, 2026", submitted: "Apr 25, 2026" },
  ];

  const sc = (s) => ({
    "Generated": { color: C.green, bg: C.greenBg },
    "In Progress": { color: C.blueLight, bg: "rgba(91,141,239,0.12)" },
    "Pending": { color: C.amber, bg: C.amberBg },
    "Expired": { color: C.textMuted, bg: "rgba(255,255,255,0.06)" },
  }[s] || {});

  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}

    <!-- sidebar -->
    ${rect(0, TOPBAR_H, 220, H - TOPBAR_H, C.sidebar)}
    <rect x="219" y="${TOPBAR_H}" width="1" height="${H - TOPBAR_H}" fill="${C.border}"/>
    ${text(16, TOPBAR_H + 32, "Sessions Dashboard", 11, C.textMuted, "700")}
    ${rect(8, TOPBAR_H + 40, 204, 28, "rgba(27,79,216,0.2)", 8)}
    ${text(20, TOPBAR_H + 59, "Interviews", 13, C.blueLight, "600")}
    ${text(20, TOPBAR_H + 87, "Batch Runs", 13, C.textMuted)}

    <!-- main -->
    ${text(240, TOPBAR_H + 40, "Interviews", 22, C.text, "700")}
    ${text(240, TOPBAR_H + 62, "All individual client sessions", 13, C.textSub)}

    <!-- filter bar -->
    ${rect(240, TOPBAR_H + 80, W - 256, 48, C.panel, 10, C.border, 1)}
    ${rect(256, TOPBAR_H + 92, 240, 28, C.card, 8, C.border, 1)}
    ${text(268, TOPBAR_H + 110, "🔍 Search by name or email…", 12, C.textMuted)}
    ${rect(508, TOPBAR_H + 92, 100, 28, C.card, 8, C.border, 1)}
    ${text(558, TOPBAR_H + 110, "Status ▾", 12, C.textMuted, "normal", "middle")}
    ${rect(616, TOPBAR_H + 92, 100, 28, C.card, 8, C.border, 1)}
    ${text(666, TOPBAR_H + 110, "Package ▾", 12, C.textMuted, "normal", "middle")}
    ${rect(W - 200, TOPBAR_H + 92, 124, 28, C.blue, 8)}
    ${text(W - 138, TOPBAR_H + 110, "+ New Session", 12, "white", "600", "middle")}

    <!-- table -->
    ${rect(240, TOPBAR_H + 136, W - 256, H - TOPBAR_H - 152, C.panel, 10, C.border, 1)}
    ${rect(240, TOPBAR_H + 136, W - 256, 36, "#0D1829", 10)}
    <rect x="240" y="${TOPBAR_H + 171}" width="${W - 256}" height="1" fill="${C.border}"/>
    ${["Client name", "Package", "Status", "Created", "Submitted"].map((h, i) => {
      const xs = [256, 420, 600, 760, 900];
      return text(xs[i], TOPBAR_H + 158, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${sessions.map((s, i) => {
      const ry = TOPBAR_H + 172 + i * 60;
      const c = sc(s.status);
      return `${rect(240, ry, W - 256, 60, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="240" y="${ry + 59}" width="${W - 256}" height="1" fill="${C.border}"/>
      ${text(256, ry + 34, s.name, 13, C.text, "600")}
      ${text(420, ry + 34, s.pkg, 12, C.textSub)}
      ${pill(600, ry + 22, s.status.length * 7 + 12, 22, c.bg, c.color, s.status, 6)}
      ${text(760, ry + 34, s.created, 12, C.textMuted)}
      ${text(900, ry + 34, s.submitted, 12, s.submitted !== "—" ? C.text : C.textMuted)}`;
    }).join("\n")}
  `);
}

function createSessionDialog() {
  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}
    ${sidebar("Generating a Session")}
    <rect x="${SIDEBAR_W}" y="${TOPBAR_H}" width="${W - SIDEBAR_W}" height="${H - TOPBAR_H}" fill="rgba(0,0,0,0.5)"/>

    <!-- modal -->
    ${rect(W / 2 - 260, H / 2 - 288, 520, 576, "#111827", 16, C.borderMed, 1)}
    ${text(W / 2, H / 2 - 256, "Create Session", 18, C.text, "700", "middle")}
    ${text(W / 2, H / 2 - 234, "New Client Intake", 13, C.blueLight, "normal", "middle")}
    <rect x="${W / 2 - 240}" y="${H / 2 - 220}" width="480" height="1" fill="${C.border}"/>

    ${[
      { label: "Client name *", val: "Margaret A. Johnson", ph: "" },
      { label: "Client email", val: "margaret.j@email.com", ph: "" },
      { label: "Expiration", val: "30 days (May 4 → Jun 3)", ph: "" },
    ].map((f, i) => {
      const fy = H / 2 - 212 + i * 80;
      return `${text(W / 2 - 240, fy, f.label, 11, C.textMuted, "600")}
      ${rect(W / 2 - 240, fy + 8, 480, 40, C.card, 8, C.border, 1)}
      ${text(W / 2 - 224, fy + 32, f.val, 13, C.text)}`;
    }).join("\n")}

    <!-- prefill section -->
    ${text(W / 2 - 240, H / 2 + 24, "Prefill fields", 11, C.textMuted, "600")}
    ${rect(W / 2 - 240, H / 2 + 32, 480, 120, C.card, 8, C.border, 1)}
    ${text(W / 2 - 224, H / 2 + 56, "First Name", 11, C.textMuted)}
    ${rect(W / 2 - 224, H / 2 + 64, 208, 32, C.panel, 6, C.border, 1)}
    ${text(W / 2 - 208, H / 2 + 84, "Margaret", 12, C.text)}
    ${text(W / 2 + 8, H / 2 + 56, "Last Name", 11, C.textMuted)}
    ${rect(W / 2 + 8, H / 2 + 64, 208, 32, C.panel, 6, C.border, 1)}
    ${text(W / 2 + 24, H / 2 + 84, "Johnson", 12, C.text)}
    ${text(W / 2 - 224, H / 2 + 108, "Email", 11, C.textMuted)}
    ${rect(W / 2 - 224, H / 2 + 116, 432, 32, C.panel, 6, C.border, 1)}
    ${text(W / 2 - 208, H / 2 + 136, "margaret.j@email.com", 12, C.text)}

    <!-- actions -->
    <rect x="${W / 2 - 240}" y="${H / 2 + 160}" width="480" height="1" fill="${C.border}"/>
    ${rect(W / 2 - 240, H / 2 + 172, 232, 44, C.panel, 8, C.border, 1)}
    ${text(W / 2 - 124, H / 2 + 198, "Cancel", 14, C.textSub, "600", "middle")}
    ${rect(W / 2 + 8, H / 2 + 172, 232, 44, C.blue, 8)}
    ${text(W / 2 + 124, H / 2 + 198, "Generate Link →", 14, "white", "600", "middle")}
  `);
}

function clientInterview() {
  return svg(`
    <rect width="${W}" height="${H}" fill="#f8fafc"/>
    ${rect(0, 0, W, 64, "white")}
    <rect x="0" y="63" width="${W}" height="1" fill="#e2e8f0"/>
    <!-- org logo -->
    ${rect(W / 2 - 80, 16, 160, 32, "#eff6ff", 6)}
    <text x="${W / 2}" y="37" font-size="13" fill="#1d4ed8" font-weight="700" text-anchor="middle">Smith Financial Group</text>

    <!-- progress -->
    ${rect(0, 64, W, 4, "#e2e8f0")}
    ${rect(0, 64, W * 0.6, 4, "#1B4FD8")}
    <text x="${W / 2}" y="92" font-size="12" fill="#64748b" text-anchor="middle">Step 3 of 5 — Financial Profile</text>

    <!-- card -->
    ${rect(W / 2 - 340, 108, 680, 568, "white", 16)}
    <rect x="${W / 2 - 340}" y="108" width="680" height="568" rx="16" fill="none" stroke="#e2e8f0" stroke-width="1"/>

    <text x="${W / 2}" y="156" font-size="20" fill="#0f172a" font-weight="700" text-anchor="middle">Financial Profile</text>
    <text x="${W / 2}" y="178" font-size="14" fill="#64748b" text-anchor="middle">This information helps us tailor the right account for you.</text>
    <rect x="${W / 2 - 300}" y="196" width="600" height="1" fill="#f1f5f9"/>

    <!-- annual income -->
    <text x="${W / 2 - 300}" y="228" font-size="13" fill="#374151" font-weight="600">Annual Income *</text>
    ${rect(W / 2 - 300, 236, 600, 48, "#f8fafc", 8, "#1B4FD8", 2)}
    <text x="${W / 2 - 276}" y="267" font-size="16" fill="#0f172a">$</text>
    <text x="${W / 2 - 260}" y="267" font-size="16" fill="#0f172a">142,000</text>

    <!-- net worth -->
    <text x="${W / 2 - 300}" y="308" font-size="13" fill="#374151" font-weight="600">Net Worth (approximate) *</text>
    ${rect(W / 2 - 300, 316, 292, 48, "#f8fafc", 8, "#d1d5db", 1)}
    <text x="${W / 2 - 276}" y="347" font-size="15" fill="#94a3b8">$</text>

    <!-- liquid net worth -->
    <text x="${W / 2 + 8}" y="308" font-size="13" fill="#374151" font-weight="600">Liquid Net Worth *</text>
    ${rect(W / 2 + 8, 316, 292, 48, "#f8fafc", 8, "#d1d5db", 1)}
    <text x="${W / 2 + 32}" y="347" font-size="15" fill="#94a3b8">$</text>

    <!-- investment objective -->
    <text x="${W / 2 - 300}" y="388" font-size="13" fill="#374151" font-weight="600">Primary Investment Objective *</text>
    ${["Capital Preservation", "Income", "Growth", "Aggressive Growth"].map((opt, i) => {
      const ox = W / 2 - 300 + i * 152;
      const isSelected = i === 2;
      return `${rect(ox, 396, 144, 48, isSelected ? "#eff6ff" : "#f8fafc", 8, isSelected ? "#1B4FD8" : "#d1d5db", isSelected ? 2 : 1)}
      <text x="${ox + 72}" y="${396 + 28}" font-size="12" fill="${isSelected ? "#1d4ed8" : "#374151"}" font-weight="${isSelected ? "600" : "normal"}" text-anchor="middle">${opt}</text>`;
    }).join("")}

    <!-- continue -->
    ${rect(W / 2 - 300, 468, 600, 52, "#1B4FD8", 10)}
    <text x="${W / 2}" y="499" font-size="15" fill="white" font-weight="600" text-anchor="middle">Continue</text>

    <!-- back -->
    <text x="${W / 2}" y="540" font-size="13" fill="#64748b" text-anchor="middle">← Back</text>

    <!-- autosave indicator -->
    <text x="${W / 2 - 300}" y="566" font-size="11" fill="#22c55e">✓ Progress saved automatically</text>

    <!-- footer -->
    ${rect(0, H - 44, W, 44, "white")}
    <rect x="0" y="${H - 45}" width="${W}" height="1" fill="#e2e8f0"/>
    <text x="${W / 2}" y="${H - 17}" font-size="12" fill="#94a3b8" text-anchor="middle">Powered by Docuplete · Your data is encrypted and secure</text>
  `);
}

function esignCapture() {
  return svg(`
    <rect width="${W}" height="${H}" fill="#f8fafc"/>
    ${rect(0, 0, W, 64, "white")}
    <rect x="0" y="63" width="${W}" height="1" fill="#e2e8f0"/>
    ${rect(W / 2 - 80, 16, 160, 32, "#eff6ff", 6)}
    <text x="${W / 2}" y="37" font-size="13" fill="#1d4ed8" font-weight="700" text-anchor="middle">Smith Financial Group</text>

    ${rect(0, 64, W, 4, "#e2e8f0")}
    ${rect(0, 64, W * 0.9, 4, "#1B4FD8")}
    <text x="${W / 2}" y="92" font-size="12" fill="#64748b" text-anchor="middle">Step 5 of 5 — Signature</text>

    <!-- identity verified banner -->
    ${rect(W / 2 - 300, 104, 600, 40, "#f0fdf4", 8, "#bbf7d0", 1)}
    <text x="${W / 2}" y="129" font-size="13" fill="#15803d" font-weight="600" text-anchor="middle">✓ Identity verified  —  margaret.j@email.com</text>

    <!-- card -->
    ${rect(W / 2 - 300, 156, 600, 520, "white", 16)}
    <rect x="${W / 2 - 300}" y="156" width="600" height="520" rx="16" fill="none" stroke="#e2e8f0" stroke-width="1"/>

    <text x="${W / 2}" y="204" font-size="20" fill="#0f172a" font-weight="700" text-anchor="middle">Electronic Signature</text>
    <text x="${W / 2}" y="226" font-size="14" fill="#64748b" text-anchor="middle">Review the agreement then sign below.</text>
    <rect x="${W / 2 - 260}" y="242" width="520" height="1" fill="#f1f5f9"/>

    <!-- agreement excerpt -->
    ${rect(W / 2 - 260, 252, 520, 60, "#f8fafc", 8)}
    <text x="${W / 2 - 244}" y="272" font-size="11" fill="#6b7280">By signing below, I confirm that I have read, understand, and agree to the Investment</text>
    <text x="${W / 2 - 244}" y="288" font-size="11" fill="#6b7280">Advisory Agreement, including all disclosures, fee schedules, and risk acknowledgments.</text>
    <text x="${W / 2 - 244}" y="304" font-size="11" fill="#64748b" font-style="italic">Margaret A. Johnson — May 3, 2026</text>

    <!-- signature tabs -->
    ${rect(W / 2 - 260, 324, 256, 36, "#1B4FD8", 8)}
    ${rect(W / 2 + 4, 324, 256, 36, "#f1f5f9", 8, "#d1d5db", 1)}
    <text x="${W / 2 - 132}" y="347" font-size="13" fill="white" font-weight="600" text-anchor="middle">✍ Draw</text>
    <text x="${W / 2 + 132}" y="347" font-size="13" fill="#6b7280" text-anchor="middle">Aa Type</text>

    <!-- signature canvas -->
    ${rect(W / 2 - 260, 368, 520, 148, "#fafbff", 8, "#1B4FD8", 1.5)}
    <!-- drawn signature -->
    <path d="M${W / 2 - 200} 455 Q${W / 2 - 150} 415 ${W / 2 - 100} 445 Q${W / 2 - 50} 475 ${W / 2} 440 Q${W / 2 + 50} 405 ${W / 2 + 120} 450 Q${W / 2 + 160} 470 ${W / 2 + 200} 440" stroke="#1d4ed8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${W / 2}" y="500" font-size="10" fill="#94a3b8" text-anchor="middle">Draw your signature above</text>
    <text x="${W / 2 + 200}" y="508" font-size="11" fill="#3b82f6" text-anchor="end">Clear</text>

    <!-- submit -->
    ${rect(W / 2 - 260, 528, 520, 52, "#1B4FD8", 10)}
    <text x="${W / 2}" y="559" font-size="15" fill="white" font-weight="600" text-anchor="middle">Submit &amp; Sign →</text>

    ${rect(0, H - 44, W, 44, "white")}
    <rect x="0" y="${H - 45}" width="${W}" height="1" fill="#e2e8f0"/>
    <text x="${W / 2}" y="${H - 17}" font-size="12" fill="#94a3b8" text-anchor="middle">Powered by Docuplete · Signature is legally binding under ESIGN Act</text>
  `);
}

function apiKeysPanel() {
  const keys = [
    { name: "CRM Integration", type: "Live", key: "dp_live_a1b2c3d4…", created: "Jan 15, 2026", lastUsed: "May 3, 2026" },
    { name: "Automation Server", type: "Live", key: "dp_live_e5f6g7h8…", created: "Mar 2, 2026", lastUsed: "May 1, 2026" },
    { name: "Test Environment", type: "Test", key: "dp_test_i9j0k1l2…", created: "Mar 2, 2026", lastUsed: "Apr 28, 2026" },
  ];

  return svg(`
    ${topbar()}
    ${sidebar("API Keys")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "API Keys", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Manage API keys for programmatic access to Docuplete.", 13, C.textSub)}
    ${rect(W - 200, TOPBAR_H + 30, 176, 40, C.blue, 10)}
    ${text(W - 112, TOPBAR_H + 55, "+ Generate New Key", 13, "white", "600", "middle")}

    <!-- enterprise callout -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 48, "rgba(139,92,246,0.1)", 8, "rgba(139,92,246,0.2)", 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 108, "🔒  Enterprise feature — API access is available on the Enterprise plan ($3,000/mo)", 13, C.purple)}

    <!-- keys table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 144, W - SIDEBAR_W - 56, H - TOPBAR_H - 160, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 144, W - SIDEBAR_W - 56, 36, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 179}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["Name", "Type", "Key", "Created", "Last used", ""].map((h, i) => {
      const xs = [SIDEBAR_W + 60, SIDEBAR_W + 240, SIDEBAR_W + 320, SIDEBAR_W + 540, SIDEBAR_W + 700, W - 120];
      return text(xs[i], TOPBAR_H + 166, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${keys.map((k, i) => {
      const ry = TOPBAR_H + 180 + i * 72;
      const isLive = k.type === "Live";
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 72, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 71}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      ${text(SIDEBAR_W + 60, ry + 38, k.name, 13, C.text, "600")}
      ${pill(SIDEBAR_W + 240, ry + 26, 44, 22, isLive ? C.greenBg : "rgba(255,255,255,0.06)", isLive ? C.green : C.textMuted, k.type, 4)}
      <!-- key value with blur -->
      ${rect(SIDEBAR_W + 320, ry + 26, 196, 22, C.card, 4, C.border, 1)}
      ${text(SIDEBAR_W + 332, ry + 41, k.key, 11, C.textMuted)}
      ${rect(SIDEBAR_W + 516, ry + 26, 28, 22, C.card, 4)}
      <text x="${SIDEBAR_W + 530}" y="${ry + 41}" font-size="11" fill="${C.blueLight}">⎘</text>
      ${text(SIDEBAR_W + 540, ry + 38, k.created, 12, C.textMuted)}
      ${text(SIDEBAR_W + 700, ry + 38, k.lastUsed, 12, C.textMuted)}
      ${text(W - 120, ry + 38, "Revoke", 12, C.red)}`;
    }).join("\n")}

    <!-- usage note -->
    ${rect(SIDEBAR_W + 40, H - 96, W - SIDEBAR_W - 56, 60, C.panel, 8, C.border, 1)}
    ${text(SIDEBAR_W + 64, H - 72, "Authorization: Bearer dp_live_a1b2c3d4…", 12, C.blueLight, "600")}
    ${text(SIDEBAR_W + 64, H - 52, "Include this header in every API request. Rate limit: 1,000 req/min per organization.", 12, C.textMuted)}
  `);
}

function brandingSettings() {
  return svg(`
    ${topbar()}
    ${sidebar("Branding")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Organization Branding", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Customize the client interview with your logo, colors, and messaging.", 13, C.textSub)}

    <!-- two column: settings left, preview right -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, 480, H - TOPBAR_H - 96, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 540, TOPBAR_H + 80, W - SIDEBAR_W - 556, H - TOPBAR_H - 96, C.panel, 10, C.border, 1)}

    <!-- left: settings -->
    ${text(SIDEBAR_W + 64, TOPBAR_H + 112, "Settings", 14, C.text, "600")}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 144, "Logo", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 152, 200, 60, C.card, 8, C.border, 1)}
    ${rect(SIDEBAR_W + 84, TOPBAR_H + 166, 80, 32, "rgba(27,79,216,0.2)", 6)}
    <text x="${SIDEBAR_W + 124}" y="${TOPBAR_H + 186}" font-size="11" fill="${C.blueLight}" text-anchor="middle">LOGO</text>
    ${text(SIDEBAR_W + 176, TOPBAR_H + 172, "acme-logo.svg", 11, C.textSub)}
    ${text(SIDEBAR_W + 176, TOPBAR_H + 188, "Change", 11, C.blueLight)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 232, "Brand color", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 240, 200, 36, C.card, 8, C.border, 1)}
    ${rect(SIDEBAR_W + 76, TOPBAR_H + 250, 24, 16, "#1B4FD8", 4)}
    ${text(SIDEBAR_W + 108, TOPBAR_H + 263, "#1B4FD8", 12, C.text)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 296, "Interview header text", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 304, 400, 36, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 327, "New Client Application", 12, C.text)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 360, "Footer text", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 368, 400, 60, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 392, "Questions? Call (555) 123-4567", 12, C.text)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 412, "Mon–Fri 9am–5pm ET", 12, C.textMuted)}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 452, "Email sender name", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 460, 400, 36, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 483, "Acme Financial Advisors", 12, C.text)}

    ${rect(SIDEBAR_W + 64, H - 72, 200, 40, C.blue, 8)}
    ${text(SIDEBAR_W + 164, H - 48, "Save Changes", 13, "white", "600", "middle")}

    <!-- right: live preview -->
    ${text(SIDEBAR_W + 564, TOPBAR_H + 112, "Live Preview", 14, C.text, "600")}
    ${rect(SIDEBAR_W + 564, TOPBAR_H + 136, W - SIDEBAR_W - 596, H - TOPBAR_H - 168, "#f8fafc", 8)}
    ${rect(SIDEBAR_W + 564, TOPBAR_H + 136, W - SIDEBAR_W - 596, 44, "white", 8)}
    <rect x="${SIDEBAR_W + 564}" y="${TOPBAR_H + 178}" width="${W - SIDEBAR_W - 596}" height="1" fill="#e5e7eb"/>
    ${rect(SIDEBAR_W + 564 + (W - SIDEBAR_W - 596) / 2 - 60, TOPBAR_H + 147, 120, 22, "#eff6ff", 4)}
    <text x="${SIDEBAR_W + 564 + (W - SIDEBAR_W - 596) / 2}" y="${TOPBAR_H + 162}" font-size="11" fill="#1d4ed8" font-weight="700" text-anchor="middle">Acme Financial</text>

    <!-- mini progress -->
    ${rect(SIDEBAR_W + 564, TOPBAR_H + 179, W - SIDEBAR_W - 596, 4, "#e5e7eb")}
    ${rect(SIDEBAR_W + 564, TOPBAR_H + 179, Math.round((W - SIDEBAR_W - 596) * 0.4), 4, "#1B4FD8")}

    ${rect(SIDEBAR_W + 580, TOPBAR_H + 200, W - SIDEBAR_W - 628, 100, "white", 8, "#e5e7eb", 1)}
    <text x="${SIDEBAR_W + 564 + (W - SIDEBAR_W - 596) / 2}" y="${TOPBAR_H + 232}" font-size="14" fill="#0f172a" font-weight="700" text-anchor="middle">Personal Information</text>
    ${rect(SIDEBAR_W + 596, TOPBAR_H + 248, W - SIDEBAR_W - 692, 36, "#f8fafc", 6, "#d1d5db", 1)}
    <text x="${SIDEBAR_W + 612}" y="${TOPBAR_H + 271}" font-size="11" fill="#94a3b8">Full Name</text>
    ${rect(SIDEBAR_W + 596, TOPBAR_H + 292, W - SIDEBAR_W - 692, 28, "#1B4FD8", 6)}
    <text x="${SIDEBAR_W + 564 + (W - SIDEBAR_W - 596) / 2}" y="${TOPBAR_H + 311}" font-size="11" fill="white" font-weight="600" text-anchor="middle">Continue</text>
  `);
}

function channelsConfig() {
  return svg(`
    ${topbar()}
    ${sidebar("Channel Defaults")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Channel Defaults", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Configure how Docuplete notifies your team and clients.", 13, C.textSub)}

    <!-- section: team notifications -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 196, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 112, "Team Notifications", 15, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 132, "Notify your team when a client submits a session", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 148}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>

    ${text(SIDEBAR_W + 64, TOPBAR_H + 168, "Channel", 11, C.textMuted, "600")}
    ${["Email", "Slack", "Both"].map((opt, i) => {
      const ox = SIDEBAR_W + 64 + i * 148;
      const isSelected = i === 0;
      return `${rect(ox, TOPBAR_H + 176, 140, 36, isSelected ? "rgba(27,79,216,0.15)" : C.card, 8, isSelected ? C.blue : C.border, isSelected ? 1.5 : 1)}
      <circle cx="${ox + 16}" cy="${TOPBAR_H + 194}" r="7" fill="${isSelected ? C.blue : "none"}" stroke="${isSelected ? C.blue : C.border}" stroke-width="1.5"/>
      ${isSelected ? `<circle cx="${ox + 16}" cy="${TOPBAR_H + 194}" r="3" fill="white"/>` : ""}
      ${text(ox + 30, TOPBAR_H + 198, opt, 13, isSelected ? "white" : C.textSub, isSelected ? "600" : "normal")}`;
    }).join("\n")}

    ${text(SIDEBAR_W + 64, TOPBAR_H + 232, "Recipient email addresses", 11, C.textMuted, "600")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 240, W - SIDEBAR_W - 120, 36, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 263, "documents@acmefinancial.com, john.advisor@acmefinancial.com", 12, C.text)}

    <!-- section: client notifications -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 292, W - SIDEBAR_W - 56, 148, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 324, "Client Confirmation", 15, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 344, "Notify clients after they submit", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 360}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${text(SIDEBAR_W + 64, TOPBAR_H + 380, "Send confirmation email with PDF download link", 13, C.text)}
    ${rect(SIDEBAR_W + W - SIDEBAR_W - 120, TOPBAR_H + 374, 44, 24, C.blue, 12)}
    <circle cx="${SIDEBAR_W + W - SIDEBAR_W - 120 + 32}" cy="${TOPBAR_H + 386}" r="9" fill="white"/>
    ${text(SIDEBAR_W + 64, TOPBAR_H + 416, "Requires client email on session. Leave blank to skip.", 12, C.textMuted)}

    <!-- section: expiration reminder -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 456, W - SIDEBAR_W - 56, 120, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 488, "Expiration Reminder", 15, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 508, "Send an automatic reminder 3 days before session expires", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 524}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${text(SIDEBAR_W + 64, TOPBAR_H + 548, "Auto-reminder enabled", 13, C.text)}
    ${rect(SIDEBAR_W + W - SIDEBAR_W - 120, TOPBAR_H + 542, 44, 24, C.blue, 12)}
    <circle cx="${SIDEBAR_W + W - SIDEBAR_W - 120 + 32}" cy="${TOPBAR_H + 554}" r="9" fill="white"/>

    ${rect(SIDEBAR_W + 40, H - 72, 160, 40, C.blue, 8)}
    ${text(SIDEBAR_W + 120, H - 48, "Save Changes", 13, "white", "600", "middle")}
  `);
}

function fieldLibraryList() {
  const fields = [
    { name: "Full Legal Name", type: "Text", key: "full_legal_name", packages: 8, cat: "Personal" },
    { name: "Date of Birth", type: "Date", key: "date_of_birth", packages: 8, cat: "Personal" },
    { name: "Social Security Number", type: "Text", key: "ssn", packages: 6, cat: "Personal" },
    { name: "Email Address", type: "Email", key: "email_address", packages: 7, cat: "Personal" },
    { name: "Street Address", type: "Text", key: "street_address", packages: 5, cat: "Address" },
    { name: "City", type: "Text", key: "city", packages: 5, cat: "Address" },
    { name: "Annual Income", type: "Number", key: "annual_income", packages: 4, cat: "Financial" },
    { name: "Net Worth", type: "Number", key: "net_worth", packages: 4, cat: "Financial" },
    { name: "Account Type", type: "Radio", key: "account_type", packages: 6, cat: "Account" },
  ];

  return svg(`
    ${topbar()}
    ${sidebar("Overview")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Field Library", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Shared field definitions reused across all your packages.", 13, C.textSub)}
    ${rect(W - 200, TOPBAR_H + 30, 176, 40, C.blue, 10)}
    ${text(W - 112, TOPBAR_H + 55, "+ Add Library Field", 13, "white", "600", "middle")}

    <!-- category filter -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 44, C.panel, 10, C.border, 1)}
    ${["All", "Personal", "Address", "Financial", "Account"].map((cat, i) => {
      const cx = SIDEBAR_W + 56 + i * 100;
      const isActive = i === 0;
      return `${rect(cx, TOPBAR_H + 92, 88, 22, isActive ? C.blue : "transparent", 6)}
      ${text(cx + 44, TOPBAR_H + 107, cat, 12, isActive ? "white" : C.textSub, isActive ? "600" : "normal", "middle")}`;
    }).join("\n")}

    <!-- table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 140, W - SIDEBAR_W - 56, H - TOPBAR_H - 156, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 140, W - SIDEBAR_W - 56, 36, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 175}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["Field label", "Key", "Type", "Category", "Used in"].map((h, i) => {
      const xs = [SIDEBAR_W + 60, SIDEBAR_W + 280, SIDEBAR_W + 480, SIDEBAR_W + 600, SIDEBAR_W + 740];
      return text(xs[i], TOPBAR_H + 162, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${fields.map((f, i) => {
      const ry = TOPBAR_H + 176 + i * 52;
      const catColors = { Personal: C.blueLight, Address: C.green, Financial: C.amber, Account: C.purple };
      const catBgs = { Personal: "rgba(91,141,239,0.1)", Address: C.greenBg, Financial: C.amberBg, Account: C.purpleBg };
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 52, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 51}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      ${text(SIDEBAR_W + 60, ry + 30, f.name, 13, C.text, "600")}
      ${text(SIDEBAR_W + 280, ry + 30, f.key, 11, C.textMuted)}
      ${pill(SIDEBAR_W + 480, ry + 16, f.type.length * 7 + 12, 22, "rgba(255,255,255,0.05)", C.textSub, f.type, 4)}
      ${pill(SIDEBAR_W + 600, ry + 16, f.cat.length * 7 + 12, 22, catBgs[f.cat], catColors[f.cat], f.cat, 4)}
      ${text(SIDEBAR_W + 740, ry + 30, `${f.packages} packages`, 12, C.textMuted)}
      ${text(W - 100, ry + 30, "Edit", 12, C.blueLight)}`;
    }).join("\n")}
  `);
}

function addLibraryFields() {
  const libFields = [
    { name: "Full Legal Name", type: "Text", cat: "Personal", selected: true },
    { name: "Date of Birth", type: "Date", cat: "Personal", selected: true },
    { name: "Social Security Number", type: "Text", cat: "Personal", selected: false },
    { name: "Email Address", type: "Email", cat: "Personal", selected: true },
    { name: "Phone Number", type: "Phone", cat: "Personal", selected: false },
    { name: "Annual Income", type: "Number", cat: "Financial", selected: false },
  ];

  return svg(`
    ${topbar()}
    ${rect(0, TOPBAR_H, W, H - TOPBAR_H, C.bg)}
    ${sidebar("Adding Library Fields")}

    <!-- dimmed overlay -->
    <rect x="${SIDEBAR_W}" y="${TOPBAR_H}" width="${W - SIDEBAR_W}" height="${H - TOPBAR_H}" fill="rgba(0,0,0,0.45)"/>

    <!-- modal -->
    ${rect(W / 2 - 280, H / 2 - 296, 560, 592, "#111827", 16, C.borderMed, 1)}
    ${text(W / 2, H / 2 - 264, "Add from Field Library", 18, C.text, "700", "middle")}
    ${text(W / 2, H / 2 - 242, "Select fields to import into this package", 13, C.textSub, "normal", "middle")}

    <!-- search -->
    ${rect(W / 2 - 256, H / 2 - 228, 512, 36, C.card, 8, C.border, 1)}
    ${text(W / 2 - 240, H / 2 - 206, "🔍 Search library fields…", 13, C.textMuted)}

    <!-- category tabs -->
    ${["All (24)", "Personal", "Financial", "Address"].map((t, i) => {
      const tx = W / 2 - 256 + i * 132;
      const isActive = i === 0;
      return `${rect(tx, H / 2 - 184, 124, 28, isActive ? C.blue : "transparent", 6)}
      ${text(tx + 62, H / 2 - 165, t, 12, isActive ? "white" : C.textMuted, isActive ? "600" : "normal", "middle")}`;
    }).join("\n")}

    <!-- field list -->
    <rect x="${W / 2 - 256}" y="${H / 2 - 152}" width="512" height="320" rx="8" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
    ${libFields.map((f, i) => {
      const fy = H / 2 - 152 + i * 52 + 4;
      return `${rect(W / 2 - 252, fy + 2, 504, 48, f.selected ? "rgba(27,79,216,0.1)" : "transparent", 6)}
      <!-- checkbox -->
      ${rect(W / 2 - 236, fy + 14, 20, 20, f.selected ? C.blue : "transparent", 4, f.selected ? C.blue : C.border, 1.5)}
      ${f.selected ? `<text x="${W / 2 - 226}" y="${fy + 29}" font-size="12" fill="white" text-anchor="middle">✓</text>` : ""}
      ${text(W / 2 - 208, fy + 22, f.name, 13, f.selected ? "white" : C.text, f.selected ? "600" : "normal")}
      ${text(W / 2 - 208, fy + 38, `${f.type}  ·  ${f.cat}`, 11, f.selected ? C.blueLight : C.textMuted)}`;
    }).join("\n")}

    <!-- selected count and actions -->
    <rect x="${W / 2 - 256}" y="${H / 2 + 172}" width="512" height="1" fill="${C.border}"/>
    ${text(W / 2 - 256, H / 2 + 192, "3 fields selected", 13, C.textSub)}
    ${rect(W / 2 - 256, H / 2 + 204, 244, 44, C.panel, 8, C.border, 1)}
    ${text(W / 2 - 134, H / 2 + 230, "Cancel", 13, C.textSub, "600", "middle")}
    ${rect(W / 2 + 12, H / 2 + 204, 244, 44, C.blue, 8)}
    ${text(W / 2 + 134, H / 2 + 230, "Import Selected (3)", 13, "white", "600", "middle")}
  `);
}

function googleDriveSettings() {
  return svg(`
    ${topbar()}
    ${sidebar("Google Drive")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Google Drive Integration", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Automatically save completed PDFs to your Google Drive after every submission.", 13, C.textSub)}

    <!-- connected status -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 72, C.panel, 10, C.border, 1)}
    <!-- google drive logo sim -->
    <circle cx="${SIDEBAR_W + 80}" cy="${TOPBAR_H + 116}" r="20" fill="rgba(66,133,244,0.1)"/>
    <text x="${SIDEBAR_W + 80}" y="${TOPBAR_H + 122}" font-size="18" text-anchor="middle">📁</text>
    ${text(SIDEBAR_W + 112, TOPBAR_H + 110, "Google Drive", 15, C.text, "600")}
    ${pill(SIDEBAR_W + 112, TOPBAR_H + 120, 100, 22, C.greenBg, C.green, "✓ Connected", 6)}
    ${text(W - 184, TOPBAR_H + 116, "docs-output@acmefinancial.com", 12, C.textMuted, "normal", "end")}
    ${text(W - 80, TOPBAR_H + 116, "Disconnect", 12, C.red, "normal", "end")}

    <!-- default folder -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 168, W - SIDEBAR_W - 56, 104, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 200, "Default destination folder", 14, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 220, "All packages save here unless overridden per-package.", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 236}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 244, W - SIDEBAR_W - 220, 36, C.card, 8, C.border, 1)}
    <text x="${SIDEBAR_W + 80}" y="${TOPBAR_H + 266}" font-size="12" fill="${C.text}">📁 My Drive / Docuplete / Completed PDFs</text>
    ${rect(W - 148, TOPBAR_H + 244, 84, 36, C.panel, 8, C.border, 1)}
    ${text(W - 106, TOPBAR_H + 266, "Change", 12, C.blueLight, "600", "middle")}

    <!-- file naming -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 288, W - SIDEBAR_W - 56, 128, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 320, "File naming template", 14, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 340, "Use field values as placeholders to generate meaningful file names.", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 356}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 364, W - SIDEBAR_W - 120, 40, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 388, "{{package_name}} - {{last_name}}, {{first_name}} - {{today}}.pdf", 12, C.blueLight)}

    <!-- recent uploads -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 432, W - SIDEBAR_W - 56, 200, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 464, "Recent uploads", 14, C.text, "600")}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 480}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${[
      { name: "New Client Intake - Johnson, Margaret - 2026-05-03.pdf", time: "2 min ago" },
      { name: "New Client Intake - Torres, David - 2026-05-01.pdf", time: "2 days ago" },
      { name: "IRA Rollover Form - Chen, Robert - 2026-04-28.pdf", time: "5 days ago" },
    ].map((u, i) => {
      const uy = TOPBAR_H + 492 + i * 44;
      return `<text x="${SIDEBAR_W + 64}" y="${uy + 16}" font-size="12" fill="${C.text}">📄 ${esc(u.name)}</text>
      <text x="${W - 64}" y="${uy + 16}" font-size="11" fill="${C.textMuted}" text-anchor="end">${u.time}</text>
      <rect x="${SIDEBAR_W + 64}" y="${uy + 22}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>`;
    }).join("\n")}
  `);
}

function hubspotFieldMapping() {
  const mappings = [
    { dp: "first_name", hs: "First name" },
    { dp: "last_name", hs: "Last name" },
    { dp: "email_address", hs: "Email" },
    { dp: "phone_number", hs: "Phone number" },
    { dp: "annual_income", hs: "Annual income (custom)" },
    { dp: "account_type", hs: "Account type (custom)" },
  ];

  return svg(`
    ${topbar()}
    ${sidebar("HubSpot")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "HubSpot Integration", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Sync submission data to HubSpot contacts automatically.", 13, C.textSub)}

    <!-- connection status -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 64, C.panel, 10, C.border, 1)}
    <circle cx="${SIDEBAR_W + 80}" cy="${TOPBAR_H + 112}" r="20" fill="rgba(255,122,89,0.1)"/>
    <text x="${SIDEBAR_W + 80}" y="${TOPBAR_H + 118}" font-size="18" text-anchor="middle">🔗</text>
    ${text(SIDEBAR_W + 112, TOPBAR_H + 106, "HubSpot", 15, C.text, "600")}
    ${pill(SIDEBAR_W + 112, TOPBAR_H + 116, 100, 22, C.greenBg, C.green, "✓ Connected", 6)}
    ${text(W - 80, TOPBAR_H + 112, "Disconnect", 12, C.red, "normal", "end")}

    <!-- field mapping -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 160, W - SIDEBAR_W - 56, H - TOPBAR_H - 240, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 192, "Field Mapping", 15, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 212, "Map Docuplete fields to HubSpot contact properties.", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 228}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>

    <!-- column headers -->
    ${text(SIDEBAR_W + 64, TOPBAR_H + 252, "Docuplete field", 11, C.textMuted, "600")}
    ${text(W / 2 + 40, TOPBAR_H + 252, "HubSpot property", 11, C.textMuted, "600")}

    ${mappings.map((m, i) => {
      const ry = TOPBAR_H + 264 + i * 56;
      return `${rect(SIDEBAR_W + 64, ry, (W - SIDEBAR_W - 200) / 2 - 20, 40, C.card, 8, C.border, 1)}
      ${text(SIDEBAR_W + 80, ry + 25, m.dp, 12, C.blueLight)}
      <!-- arrow -->
      <text x="${SIDEBAR_W + 64 + (W - SIDEBAR_W - 200) / 2 + 10}" y="${ry + 26}" font-size="16" fill="${C.textMuted}">→</text>
      ${rect(W / 2 + 40, ry, (W - SIDEBAR_W - 200) / 2 - 20, 40, C.card, 8, C.border, 1)}
      ${text(W / 2 + 56, ry + 25, m.hs, 12, C.text)}
      ${text(W - 90, ry + 25, "✕", 14, C.textMuted, "normal", "middle")}`;
    }).join("\n")}

    ${rect(SIDEBAR_W + 64, TOPBAR_H + 264 + mappings.length * 56 + 8, 140, 36, C.panel, 8, C.border, 1)}
    ${text(SIDEBAR_W + 134, TOPBAR_H + 264 + mappings.length * 56 + 30, "+ Add mapping", 12, C.blueLight, "600", "middle")}

    <!-- save -->
    ${rect(SIDEBAR_W + 40, H - 72, 160, 40, C.blue, 8)}
    ${text(SIDEBAR_W + 120, H - 48, "Save Mappings", 13, "white", "600", "middle")}
  `);
}

function webhookSetup() {
  return svg(`
    ${topbar()}
    ${sidebar("Webhook Setup")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Webhook Configuration", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Receive real-time HTTP POST notifications when clients submit.", 13, C.textSub)}

    <!-- enterprise callout -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 44, "rgba(139,92,246,0.08)", 8, "rgba(139,92,246,0.2)", 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 107, "🔒  Enterprise feature — Webhooks are available on the Enterprise plan ($3,000/mo)", 12, C.purple)}

    <!-- webhook URL section -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 140, W - SIDEBAR_W - 56, 160, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 172, "Webhook URL", 15, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 192, "Your server endpoint that will receive POST requests from Docuplete.", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 208}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 216, W - SIDEBAR_W - 248, 40, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 241, "https://api.acmefinancial.com/webhooks/docuplete", 13, C.text)}
    ${rect(W - 176, TOPBAR_H + 216, 112, 40, C.blue, 8)}
    ${text(W - 120, TOPBAR_H + 241, "Save & test", 13, "white", "600", "middle")}

    <!-- test ping result -->
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 268, W - SIDEBAR_W - 120, 24, C.greenBg, 6)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 284, "✓ Test ping succeeded — HTTP 200 in 142ms", 12, C.green)}

    <!-- webhook secret section -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 316, W - SIDEBAR_W - 56, 152, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 348, "Webhook Secret", 15, C.text, "600")}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 368, "Use this to verify the HMAC-SHA256 signature on incoming requests.", 12, C.textSub)}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 384}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 392, W - SIDEBAR_W - 248, 40, C.card, 8, C.border, 1)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 417, "wh_sec_a4f8b2c1d9e6f3a0b7c4d1e8f5a2b9c6d3e0f7a4…", 13, C.textMuted)}
    ${rect(W - 176, TOPBAR_H + 392, 112, 40, C.panel, 8, C.border, 1)}
    ${text(W - 120, TOPBAR_H + 417, "⎘ Copy", 13, C.blueLight, "600", "middle")}
    ${rect(SIDEBAR_W + 64, TOPBAR_H + 444, W - SIDEBAR_W - 120, 16, C.amberBg, 4)}
    ${text(SIDEBAR_W + 80, TOPBAR_H + 456, "⚠ Store this secret securely. It is only shown once.", 11, C.amber)}

    <!-- events section -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 484, W - SIDEBAR_W - 56, 120, C.panel, 10, C.border, 1)}
    ${text(SIDEBAR_W + 64, TOPBAR_H + 516, "Events", 15, C.text, "600")}
    <rect x="${SIDEBAR_W + 64}" y="${TOPBAR_H + 532}" width="${W - SIDEBAR_W - 120}" height="1" fill="${C.border}"/>
    ${[
      { event: "interview.submitted", active: true },
      { event: "webhook.test", active: true },
    ].map((e, i) => {
      const ey = TOPBAR_H + 540 + i * 36;
      return `${text(SIDEBAR_W + 64, ey + 16, e.event, 13, C.text)}
      ${pill(W - 156, ey + 6, 72, 22, C.greenBg, C.green, "enabled", 4)}`;
    }).join("\n")}
  `);
}

function webhookLogs() {
  const logs = [
    { id: "evt_4xKp2mQ", attempt: 1, status: "success", code: 200, time: "142ms", at: "May 3, 2026 2:14 PM" },
    { id: "evt_3wJo1lP", attempt: 3, status: "success", code: 200, time: "891ms", at: "May 1, 2026 4:07 PM" },
    { id: "evt_2vIn0kO", attempt: 1, status: "failed", code: 500, time: "timeout", at: "Apr 28, 2026 9:32 AM" },
    { id: "evt_1uHm9jN", attempt: 2, status: "failed", code: 500, time: "203ms", at: "Apr 28, 2026 9:28 AM" },
    { id: "evt_0tGl8iM", attempt: 1, status: "success", code: 200, time: "178ms", at: "Apr 25, 2026 11:45 AM" },
  ];

  return svg(`
    ${topbar()}
    ${sidebar("Delivery Logs")}

    ${text(SIDEBAR_W + 40, TOPBAR_H + 40, "Webhook Delivery Logs", 22, C.text, "700")}
    ${text(SIDEBAR_W + 40, TOPBAR_H + 62, "Full history of delivery attempts for this package's webhook endpoint.", 13, C.textSub)}

    <!-- stats bar -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 80, W - SIDEBAR_W - 56, 68, C.panel, 10, C.border, 1)}
    ${[
      { label: "Total deliveries", val: "247", color: C.text },
      { label: "Succeeded", val: "239", color: C.green },
      { label: "Failed", val: "8", color: C.red },
      { label: "Success rate", val: "96.8%", color: C.green },
    ].map((s, i) => {
      const sx = SIDEBAR_W + 64 + i * 230;
      return `${text(sx, TOPBAR_H + 108, s.label, 11, C.textMuted, "600")}
      ${text(sx, TOPBAR_H + 132, s.val, 20, s.color, "700")}`;
    }).join("\n")}

    <!-- table -->
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 164, W - SIDEBAR_W - 56, H - TOPBAR_H - 180, C.panel, 10, C.border, 1)}
    ${rect(SIDEBAR_W + 40, TOPBAR_H + 164, W - SIDEBAR_W - 56, 36, "#0D1829", 10)}
    <rect x="${SIDEBAR_W + 40}" y="${TOPBAR_H + 199}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
    ${["Event ID", "Attempt", "Status", "HTTP", "Response time", "Delivered at", ""].map((h, i) => {
      const xs = [SIDEBAR_W + 60, SIDEBAR_W + 220, SIDEBAR_W + 312, SIDEBAR_W + 436, SIDEBAR_W + 548, SIDEBAR_W + 688, W - 96];
      return text(xs[i], TOPBAR_H + 186, h, 11, C.textMuted, "600");
    }).join("\n")}

    ${logs.map((l, i) => {
      const ry = TOPBAR_H + 200 + i * 72;
      const isSuccess = l.status === "success";
      return `${rect(SIDEBAR_W + 40, ry, W - SIDEBAR_W - 56, 72, i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent")}
      <rect x="${SIDEBAR_W + 40}" y="${ry + 71}" width="${W - SIDEBAR_W - 56}" height="1" fill="${C.border}"/>
      ${text(SIDEBAR_W + 60, ry + 38, l.id, 12, C.blueLight)}
      ${text(SIDEBAR_W + 220, ry + 38, `Attempt ${l.attempt}`, 12, l.attempt > 1 ? C.amber : C.textMuted)}
      ${pill(SIDEBAR_W + 312, ry + 26, 76, 22, isSuccess ? C.greenBg : C.redBg, isSuccess ? C.green : C.red, isSuccess ? "✓ Success" : "✕ Failed", 4)}
      ${text(SIDEBAR_W + 436, ry + 38, String(l.code), 13, l.code === 200 ? C.green : C.red, "600")}
      ${text(SIDEBAR_W + 548, ry + 38, l.time, 12, C.textSub)}
      ${text(SIDEBAR_W + 688, ry + 38, l.at, 11, C.textMuted)}
      ${isSuccess ? "" : `${pill(W - 120, ry + 26, 88, 22, "rgba(27,79,216,0.12)", C.blueLight, "Retry now", 4)}`}
      ${text(W - 60, ry + 38, "↕ Inspect", 11, C.blueLight)}`;
    }).join("\n")}
  `);
}

// ─── Generate all files ───────────────────────────────────────────────────────
const screenshots = {
  "dashboard-overview": dashboardOverview,
  "quickstart-upload": quickstartUpload,
  "quickstart-mapper": quickstartMapper,
  "quickstart-interview": quickstartInterview,
  "quickstart-download": quickstartDownload,
  "upload-dialog": uploadDialog,
  "field-editor": fieldEditor,
  "mapper-overview": mapperOverview,
  "esign-field-placed": esignField,
  "textbox-config": textboxConfig,
  "batch-runs-list": batchRunsList,
  "batch-template-preview": batchTemplate,
  "batch-upload-step": batchUpload,
  "batch-progress": batchProgress,
  "batch-errors": batchErrors,
  "batch-runs-dashboard": batchRunsDashboard,
  "interviews-list": interviewsList,
  "create-session-dialog": createSessionDialog,
  "client-interview": clientInterview,
  "esign-capture": esignCapture,
  "api-keys-panel": apiKeysPanel,
  "branding-settings": brandingSettings,
  "channels-config": channelsConfig,
  "field-library-list": fieldLibraryList,
  "add-library-fields": addLibraryFields,
  "google-drive-settings": googleDriveSettings,
  "hubspot-field-mapping": hubspotFieldMapping,
  "webhook-setup": webhookSetup,
  "webhook-logs": webhookLogs,
};

let generated = 0;
for (const [name, fn] of Object.entries(screenshots)) {
  try {
    const content = fn();
    fs.writeFileSync(path.join(OUT, `${name}.svg`), content, "utf8");
    generated++;
    console.log(`  ✓ ${name}.svg`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

console.log(`\nGenerated ${generated}/${Object.keys(screenshots).length} screenshots → ${OUT}`);
