import { useState } from "react";

const NAV = "#0F1C3F";
const GOLD = "#C49A38";
const CREAM = "#F8F6F0";
const BORDER = "#DDD5C4";
const MUTED = "#6B7A99";

const tabs = ["Packages", "Interviews", "Batch Import", "Field Library"] as const;
type Tab = typeof tabs[number];

const packages = [
  { name: "Demo — Client Information", status: "Active", sessions: 8, pending: 2, lastRun: "Apr 30" },
  { name: "Onboarding — New Client",   status: "Active", sessions: 3, pending: 1, lastRun: "Apr 28" },
  { name: "Annual Review 2024",        status: "Draft",  sessions: 0, pending: 0, lastRun: "—" },
];

const recentActivity = [
  { name: "James Smith",  action: "Generated PDF",    pkg: "Demo",       time: "2h ago",  color: "#059669" },
  { name: "Maria Chen",   action: "Link sent",         pkg: "Demo",       time: "5h ago",  color: GOLD },
  { name: "Robert Lee",   action: "Link sent",         pkg: "Onboarding", time: "1d ago",  color: GOLD },
  { name: "CSV Import",   action: "14 links sent",     pkg: "Demo",       time: "1d ago",  color: NAV },
];

export function CommandDeck() {
  const [tab, setTab] = useState<Tab>("Packages");

  return (
    <div className="flex flex-col h-screen font-sans" style={{ background: CREAM }}>

      {/* ── Command deck header ─────────────────────────────────────────── */}
      <header style={{ background: NAV }}>
        {/* Brand row */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded" style={{ background: GOLD }} />
            <span className="text-white text-sm font-semibold tracking-wide">Docuplete · West Hills Capital</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs px-3 py-1.5 rounded-md font-medium text-white border border-white/20 hover:bg-white/10">
              + New Package
            </button>
            <button className="text-xs px-3 py-1.5 rounded-md font-medium text-white border border-white/20 hover:bg-white/10">
              ↑ Import CSV
            </button>
            <button className="text-xs px-3 py-1.5 rounded-md font-medium text-white border border-white/20 hover:bg-white/10">
              ✉ Send Links
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-px mx-6 mb-3 mt-1 rounded-lg overflow-hidden border" style={{ borderColor: "#1a2f5e" }}>
          {[
            { label: "Active Packages", value: "2", sub: "1 draft" },
            { label: "Pending Sessions", value: "3", sub: "awaiting client" },
            { label: "Completed This Month", value: "11", sub: "PDFs generated" },
            { label: "Last Batch Run", value: "Apr 30", sub: "14 links · 8 submitted" },
          ].map((stat) => (
            <div key={stat.label} className="px-4 py-2.5" style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="text-lg font-bold text-white leading-tight">{stat.value}</div>
              <div className="text-[10px] font-medium mt-0.5" style={{ color: GOLD }}>{stat.label}</div>
              <div className="text-[10px]" style={{ color: "#8A9BB8" }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex px-6">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-medium transition-colors relative"
              style={{ color: tab === t ? "white" : "#8A9BB8" }}
            >
              {t}
              {tab === t && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full" style={{ background: GOLD }} />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6">
        {tab === "Packages" && (
          <div className="grid grid-cols-3 gap-4">
            {/* Package cards */}
            {packages.map((pkg) => (
              <div key={pkg.name} className="rounded-xl border bg-white p-5 hover:shadow-md transition-shadow cursor-pointer" style={{ borderColor: BORDER }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold leading-snug" style={{ color: NAV }}>{pkg.name}</div>
                    <div className="text-xs mt-1" style={{ color: MUTED }}>Last run: {pkg.lastRun}</div>
                  </div>
                  <span className={`shrink-0 ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${pkg.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {pkg.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 border-t pt-3" style={{ borderColor: "#EFE8D8" }}>
                  {[["Sessions", pkg.sessions], ["Pending", pkg.pending], ["Fields", 14]].map(([k, v]) => (
                    <div key={String(k)} className="text-center">
                      <div className="text-base font-bold" style={{ color: NAV }}>{v}</div>
                      <div className="text-[10px]" style={{ color: MUTED }}>{k}</div>
                    </div>
                  ))}
                </div>
                <button className="mt-3 w-full text-xs py-1.5 rounded border text-center font-medium hover:bg-gray-50 transition-colors" style={{ borderColor: BORDER, color: NAV }}>
                  Open Package →
                </button>
              </div>
            ))}

            {/* Add package card */}
            <div className="rounded-xl border-2 border-dashed flex items-center justify-center p-8 cursor-pointer hover:bg-white transition-colors" style={{ borderColor: BORDER }}>
              <div className="text-center">
                <div className="text-2xl mb-2">＋</div>
                <div className="text-xs font-medium" style={{ color: MUTED }}>New Package</div>
              </div>
            </div>
          </div>
        )}

        {tab === "Interviews" && (
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: CREAM }}>
                  {["Client", "Package", "Status", "Submitted", "Actions"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: MUTED }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "James Smith",  pkg: "Demo", status: "Generated", submitted: "Apr 30 9:14am" },
                  { name: "Maria Chen",   pkg: "Demo", status: "Pending",   submitted: "—" },
                  { name: "Robert Lee",   pkg: "Onboarding", status: "Pending", submitted: "—" },
                ].map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "#EFE8D8" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: NAV }}>{row.name}</td>
                    <td className="px-4 py-3" style={{ color: MUTED }}>{row.pkg}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${row.status === "Generated" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: MUTED }}>{row.submitted}</td>
                    <td className="px-4 py-3">
                      <button className="text-[10px] px-2 py-1 rounded border" style={{ borderColor: BORDER, color: NAV }}>View PDF</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "Batch Import" && (
          <div className="max-w-2xl mx-auto">
            {/* Recent runs */}
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>Run History</h2>
              {[
                { date: "Apr 30, 2025", pkg: "Demo — Client Information", total: 14, pending: 6, completed: 8 },
                { date: "Apr 15, 2025", pkg: "Demo — Client Information", total: 8,  pending: 0, completed: 8 },
              ].map((run, i) => (
                <div key={i} className="rounded-lg border bg-white p-4 mb-3" style={{ borderColor: BORDER }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: NAV }}>{run.date} · {run.pkg}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                      {run.pending > 0 ? `${run.pending} pending` : "Complete"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    {[["Total", run.total], ["Pending", run.pending], ["Completed", run.completed]].map(([k, v]) => (
                      <div key={String(k)}><span className="font-semibold" style={{ color: NAV }}>{v}</span> <span style={{ color: MUTED }}>{k}</span></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Import form */}
            <div className="rounded-lg border bg-white p-5" style={{ borderColor: BORDER }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: NAV }}>New Import</h2>
              <div className="border-2 border-dashed rounded-lg p-8 text-center" style={{ borderColor: BORDER }}>
                <div className="text-2xl mb-2">📄</div>
                <div className="text-xs font-medium mb-1" style={{ color: NAV }}>Drop a CSV file here</div>
                <div className="text-xs" style={{ color: MUTED }}>or click to browse</div>
              </div>
            </div>
          </div>
        )}

        {tab === "Field Library" && (
          <div className="text-xs text-center py-16" style={{ color: MUTED }}>Field library content…</div>
        )}
      </main>

      {/* ── Activity sidebar strip ──────────────────────────────────────── */}
      <div className="fixed right-0 top-0 bottom-0 w-64 border-l bg-white flex flex-col" style={{ borderColor: BORDER }}>
        <div className="px-4 py-3.5 border-b" style={{ borderColor: BORDER }}>
          <div className="text-xs font-semibold" style={{ color: NAV }}>Recent Activity</div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {recentActivity.map((a, i) => (
            <div key={i} className="px-4 py-2.5 border-b last:border-0" style={{ borderColor: "#EFE8D8" }}>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: a.color }} />
                <div>
                  <div className="text-xs font-medium" style={{ color: NAV }}>{a.name}</div>
                  <div className="text-[10px]" style={{ color: MUTED }}>{a.action} · {a.pkg}</div>
                  <div className="text-[10px]" style={{ color: MUTED }}>{a.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Offset main for activity sidebar */}
      <style>{`main { padding-right: calc(1.5rem + 16rem); }`}</style>
    </div>
  );
}
