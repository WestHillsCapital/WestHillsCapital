import { useState } from "react";

const NAV = "#0F1C3F";
const GOLD = "#C49A38";
const CREAM = "#F8F6F0";
const BORDER = "#DDD5C4";
const MUTED = "#6B7A99";

const packages = [
  { id: 1, name: "Demo — Client Information", status: "Active", pending: 2, total: 8 },
  { id: 2, name: "Onboarding — New Client",   status: "Active", pending: 1, total: 3 },
  { id: 3, name: "Annual Review 2024",        status: "Draft",  pending: 0, total: 0 },
];

const sessions: Record<number, Array<{ name: string; status: string; submitted: string; emailed: boolean }>> = {
  1: [
    { name: "James Smith", status: "Generated", submitted: "Apr 30, 9:14am", emailed: true },
    { name: "Maria Chen",  status: "Pending",   submitted: "—",             emailed: true },
    { name: "Robert Lee",  status: "Pending",   submitted: "—",             emailed: true },
    { name: "David Park",  status: "Generated", submitted: "Apr 29, 2:05pm", emailed: true },
    { name: "Anna Torres", status: "Generated", submitted: "Apr 28, 4:45pm", emailed: true },
  ],
  2: [
    { name: "Linda Brooks", status: "Pending",   submitted: "—", emailed: true },
    { name: "Tom Nguyen",   status: "Generated", submitted: "Apr 27, 11am", emailed: true },
  ],
  3: [],
};

const detailTabs = ["Overview", "Documents", "Sessions", "Batch Runs"] as const;
type DTab = typeof detailTabs[number];

export function MasterDetail() {
  const [selected, setSelected] = useState(1);
  const [dtab, setDtab] = useState<DTab>("Sessions");
  const pkg = packages.find((p) => p.id === selected)!;
  const pkgSessions = sessions[selected] || [];

  return (
    <div className="flex flex-col h-screen font-sans" style={{ background: CREAM }}>

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b bg-white shrink-0" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded" style={{ background: NAV }} />
          <span className="text-sm font-semibold" style={{ color: NAV }}>Docuplete</span>
          <span className="text-xs" style={{ color: MUTED }}>/ West Hills Capital</span>
        </div>
        <div className="flex gap-2">
          <button className="text-xs px-3 py-1.5 rounded border font-medium hover:bg-gray-50" style={{ borderColor: BORDER, color: NAV }}>
            + New Package
          </button>
          <button className="text-xs px-3 py-1.5 rounded font-medium text-white" style={{ background: GOLD }}>
            ↑ Import CSV
          </button>
        </div>
      </header>

      {/* Body — master + detail */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Master panel ─────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col border-r bg-white overflow-hidden" style={{ borderColor: BORDER }}>
          {/* Search */}
          <div className="px-3 py-2.5 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs" style={{ background: CREAM, border: `1px solid ${BORDER}` }}>
              <span style={{ color: MUTED }}>🔍</span>
              <span style={{ color: MUTED }}>Search packages…</span>
            </div>
          </div>

          {/* Package list */}
          <div className="flex-1 overflow-y-auto py-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Packages
            </div>
            {packages.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className="w-full text-left px-3 py-2.5 mx-0 rounded-md transition-colors"
                style={{
                  background: selected === p.id ? `rgba(15,28,63,0.07)` : "transparent",
                  borderLeft: selected === p.id ? `3px solid ${GOLD}` : "3px solid transparent",
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-medium leading-snug truncate" style={{ color: NAV }}>{p.name}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                      {p.total} sessions {p.pending > 0 ? `· ${p.pending} pending` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-0.5 ${p.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {p.status}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Field library link */}
          <div className="border-t px-3 py-3" style={{ borderColor: BORDER }}>
            <button className="w-full text-left text-xs flex items-center gap-2" style={{ color: MUTED }}>
              <span>≡</span> Field Library
            </button>
          </div>
        </aside>

        {/* ── Detail panel ─────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Detail header */}
          <div className="px-6 pt-5 pb-0 border-b bg-white shrink-0" style={{ borderColor: BORDER }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-base font-semibold" style={{ color: NAV }}>{pkg.name}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: MUTED }}>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${pkg.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{pkg.status}</span>
                  <span>{pkg.total} sessions total</span>
                  <span>{pkg.pending} pending</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="text-xs px-3 py-1.5 rounded border font-medium hover:bg-gray-50" style={{ borderColor: BORDER, color: NAV }}>Edit Package</button>
                <button className="text-xs px-3 py-1.5 rounded font-medium text-white" style={{ background: NAV }}>✉ Send Links</button>
              </div>
            </div>

            {/* Detail tabs */}
            <div className="flex">
              {detailTabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setDtab(t)}
                  className="px-4 py-2 text-xs font-medium transition-colors relative"
                  style={{ color: dtab === t ? NAV : MUTED }}
                >
                  {t}
                  {dtab === t && (
                    <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-t-full" style={{ background: GOLD }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Detail content */}
          <div className="flex-1 overflow-y-auto p-6">
            {dtab === "Overview" && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Sessions", value: pkg.total, color: NAV },
                  { label: "Pending",        value: pkg.pending, color: "#D97706" },
                  { label: "Completed",      value: pkg.total - pkg.pending, color: "#059669" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border bg-white p-5" style={{ borderColor: BORDER }}>
                    <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-xs mt-1" style={{ color: MUTED }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {dtab === "Sessions" && (
              <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                  <span className="text-xs font-semibold" style={{ color: NAV }}>All Sessions</span>
                  <button className="text-xs px-2.5 py-1 rounded border" style={{ borderColor: BORDER, color: NAV }}>Export CSV</button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: CREAM }}>
                      {["Client", "Status", "Submitted", "Emailed", "Actions"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 font-semibold" style={{ color: MUTED }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pkgSessions.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: MUTED }}>No sessions yet</td></tr>
                    ) : pkgSessions.map((s, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50" style={{ borderColor: "#EFE8D8" }}>
                        <td className="px-4 py-2.5 font-medium" style={{ color: NAV }}>{s.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.status === "Generated" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: MUTED }}>{s.submitted}</td>
                        <td className="px-4 py-2.5">
                          <span style={{ color: s.emailed ? "#059669" : MUTED }}>{s.emailed ? "✓ Sent" : "—"}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button className="text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: BORDER, color: NAV }}>PDF</button>
                            <button className="text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: BORDER, color: NAV }}>Re-send</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dtab === "Batch Runs" && (
              <div className="space-y-3">
                {[
                  { date: "Apr 30, 2025", total: 14, pending: 6, completed: 8 },
                  { date: "Apr 15, 2025", total: 8,  pending: 0, completed: 8 },
                ].map((run, i) => (
                  <div key={i} className="rounded-xl border bg-white p-4" style={{ borderColor: BORDER }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: NAV }}>{run.date}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${run.pending === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {run.pending === 0 ? "Complete" : `${run.pending} pending`}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs">
                      {[["Total", run.total], ["Pending", run.pending], ["Completed", run.completed]].map(([k, v]) => (
                        <div key={String(k)}><span className="font-bold" style={{ color: NAV }}>{v}</span> <span style={{ color: MUTED }}>{k}</span></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dtab === "Documents" && (
              <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: BORDER }}>
                {["Client Information Form.pdf", "Disclosure Agreement.pdf"].map((doc, i) => (
                  <div key={i} className="flex items-center px-4 py-3 border-b last:border-0 text-xs" style={{ borderColor: "#EFE8D8" }}>
                    <span className="mr-3 text-base">📄</span>
                    <span style={{ color: NAV }}>{doc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
