import { useState } from "react";

const NAV = "#0F1C3F";
const GOLD = "#C49A38";
const CREAM = "#F8F6F0";
const BORDER = "#DDD5C4";
const MUTED = "#6B7A99";

const navItems = [
  { id: "packages", label: "Packages", icon: "◻", badge: "3", sub: ["Active", "Archived"] },
  { id: "sessions", label: "Sessions", icon: "💬", badge: "8", sub: ["Interviews", "Batch Runs"] },
  { id: "imports",  label: "Batch Import", icon: "↑", badge: null, sub: ["Import CSV", "Run History"] },
  { id: "library", label: "Field Library", icon: "≡", badge: null, sub: [] },
];

const packages = [
  { name: "Demo — Client Information", status: "Active", sessions: 8, lastRun: "Apr 30" },
  { name: "Onboarding — New Client", status: "Active", sessions: 3, lastRun: "Apr 28" },
  { name: "Annual Review 2024",        status: "Draft",  sessions: 0, lastRun: "—" },
];

export function LeftRailNav() {
  const [active, setActive] = useState("packages");
  const [expanded, setExpanded] = useState<string[]>(["packages", "sessions"]);

  const toggle = (id: string) =>
    setExpanded((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <div className="flex h-screen font-sans" style={{ background: CREAM }}>

      {/* Left rail */}
      <aside className="flex flex-col w-56 shrink-0 border-r" style={{ background: NAV, borderColor: "#1a2f5e" }}>
        {/* Logo */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1a2f5e" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded" style={{ background: GOLD }} />
            <div>
              <div className="text-white text-xs font-semibold leading-tight">West Hills Capital</div>
              <div className="text-[10px]" style={{ color: "#8A9BB8" }}>Docuplete Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map((item) => {
            const isExpanded = expanded.includes(item.id);
            const isActive = active === item.id;
            return (
              <div key={item.id}>
                <button
                  onClick={() => { setActive(item.id); toggle(item.id); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors"
                  style={{
                    background: isActive ? "rgba(196,154,56,0.15)" : "transparent",
                    color: isActive ? GOLD : "#C0CBDA",
                    borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base w-4 text-center">{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: "rgba(196,154,56,0.25)", color: GOLD }}>
                        {item.badge}
                      </span>
                    )}
                    {item.sub.length > 0 && (
                      <span className="text-xs" style={{ color: MUTED }}>{isExpanded ? "▾" : "▸"}</span>
                    )}
                  </span>
                </button>
                {isExpanded && item.sub.map((s) => (
                  <button key={s}
                    className="w-full text-left px-9 py-1.5 text-xs transition-colors"
                    style={{ color: "#8A9BB8" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#C0CBDA")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#8A9BB8")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Bottom user */}
        <div className="px-4 py-3 border-t" style={{ borderColor: "#1a2f5e" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: GOLD }}>A</div>
            <div className="text-xs" style={{ color: "#8A9BB8" }}>Advisor · West Hills</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3.5 border-b bg-white" style={{ borderColor: BORDER }}>
          <div>
            <h1 className="text-sm font-semibold" style={{ color: NAV }}>Packages</h1>
            <p className="text-xs" style={{ color: MUTED }}>3 active packages · last updated today</p>
          </div>
          <button className="px-3 py-1.5 rounded text-xs font-medium text-white" style={{ background: NAV }}>
            + New Package
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {packages.map((pkg) => (
              <div key={pkg.name}
                className="rounded-lg border bg-white p-4 hover:shadow-sm transition-shadow cursor-pointer"
                style={{ borderColor: BORDER }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium" style={{ color: NAV }}>{pkg.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>{pkg.sessions} sessions · Last run {pkg.lastRun}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pkg.status === "Active" ? "text-emerald-700 bg-emerald-50" : "text-gray-500 bg-gray-100"}`}>
                      {pkg.status}
                    </span>
                    <button className="text-xs px-2.5 py-1 rounded border text-[#0F1C3F] hover:bg-[#F8F6F0]" style={{ borderColor: BORDER }}>
                      Open →
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex gap-4">
                  {[["Documents", "2"], ["Fields", "14"], ["Sessions", String(pkg.sessions)]].map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="font-semibold" style={{ color: NAV }}>{v}</span>
                      <span className="ml-1" style={{ color: MUTED }}>{k}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Recent sessions preview */}
          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>Recent Session Activity</h2>
            <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: BORDER }}>
              {[
                { name: "James Smith", pkg: "Demo — Client Information", status: "Generated", time: "2h ago" },
                { name: "Maria Chen",  pkg: "Demo — Client Information", status: "Pending",   time: "5h ago" },
                { name: "Robert Lee",  pkg: "Onboarding — New Client",   status: "Pending",   time: "1d ago" },
              ].map((s, i) => (
                <div key={i} className="flex items-center px-4 py-3 border-b last:border-0 text-xs" style={{ borderColor: "#EFE8D8" }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold mr-3 shrink-0"
                    style={{ background: NAV }}>{s.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: NAV }}>{s.name}</div>
                    <div className="truncate" style={{ color: MUTED }}>{s.pkg}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.status === "Generated" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{s.status}</span>
                    <span style={{ color: MUTED }}>{s.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
