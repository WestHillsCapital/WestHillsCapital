import { useEffect, useState, useCallback } from "react";

type ComponentStatus = "operational" | "degraded" | "outage" | "unknown";
type OverallStatus   = "operational" | "degraded" | "outage";

interface StatusComponent {
  id: string;
  name: string;
  description: string;
  status: ComponentStatus;
  checkedAt: string | null;
}

interface IncidentUpdate {
  body: string;
  status: string;
  created_at: string;
}

interface Incident {
  id: number;
  title: string;
  status: string;
  severity: string;
  components: string[];
  body: string;
  updates: IncidentUpdate[];
  created_at: string;
  resolved_at: string | null;
}

const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "Operational",
  degraded:    "Degraded",
  outage:      "Outage",
  unknown:     "Checking…",
};

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  investigating: "Investigating",
  identified:    "Identified",
  monitoring:    "Monitoring",
  resolved:      "Resolved",
};

function statusDot(s: ComponentStatus) {
  const base = "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5";
  if (s === "operational") return <span className={`${base} bg-emerald-400`} />;
  if (s === "degraded")    return <span className={`${base} bg-amber-400`} />;
  if (s === "outage")      return <span className={`${base} bg-red-500`} />;
  return <span className={`${base} bg-zinc-500`} />;
}

function severityBadge(severity: string) {
  const map: Record<string, string> = {
    minor:    "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    major:    "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    critical: "bg-red-500/15 text-red-300 border border-red-500/30",
  };
  const cls = map[severity] ?? map.minor;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function incidentStatusBadge(s: string) {
  const map: Record<string, string> = {
    investigating: "bg-amber-500/15 text-amber-300",
    identified:    "bg-blue-500/15 text-blue-300",
    monitoring:    "bg-indigo-500/15 text-indigo-300",
    resolved:      "bg-emerald-500/15 text-emerald-300",
  };
  const cls = map[s] ?? map.investigating;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {INCIDENT_STATUS_LABEL[s] ?? s}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function StatusPage() {
  const [overall, setOverall]       = useState<OverallStatus | null>(null);
  const [components, setComponents] = useState<StatusComponent[]>([]);
  const [incidents, setIncidents]   = useState<Incident[]>([]);
  const [checkedAt, setCheckedAt]   = useState<string | null>(null);
  const [error, setError]           = useState(false);
  const [, setTick]                 = useState(0);

  const load = useCallback(async () => {
    try {
      const [statusRes, incRes] = await Promise.all([
        fetch("/api/v1/status"),
        fetch("/api/v1/status/incidents"),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json() as {
          status: OverallStatus;
          components: StatusComponent[];
          checkedAt: string;
        };
        setOverall(data.status);
        setComponents(data.components);
        setCheckedAt(data.checkedAt);
        setError(false);
      }
      if (incRes.ok) {
        const data = await incRes.json() as { incidents: Incident[] };
        setIncidents(data.incidents);
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(tick);
  }, []);

  const activeIncidents = incidents.filter((i) => i.resolved_at === null);
  const pastIncidents   = incidents.filter((i) => i.resolved_at !== null).slice(0, 10);

  const overallBg =
    overall === "operational" ? "from-emerald-950/60 to-zinc-900" :
    overall === "degraded"    ? "from-amber-950/60 to-zinc-900"   :
    overall === "outage"      ? "from-red-950/60 to-zinc-900"     :
    "from-zinc-900 to-zinc-900";

  const overallText =
    overall === "operational" ? "All Systems Operational" :
    overall === "degraded"    ? "Partial System Degradation" :
    overall === "outage"      ? "Service Outage" :
    "Checking Status…";

  const overallTextColor =
    overall === "operational" ? "text-emerald-300" :
    overall === "degraded"    ? "text-amber-300"   :
    overall === "outage"      ? "text-red-300"      :
    "text-zinc-400";

  const overallIcon =
    overall === "operational" ? "✓" :
    overall === "degraded"    ? "!" :
    overall === "outage"      ? "✕" : "·";

  const overallIconBg =
    overall === "operational" ? "bg-emerald-500/20 text-emerald-300" :
    overall === "degraded"    ? "bg-amber-500/20 text-amber-300"     :
    overall === "outage"      ? "bg-red-500/20 text-red-300"         :
    "bg-zinc-700/50 text-zinc-400";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800/60 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-[#5B8DEF]/20 flex items-center justify-center">
              <span className="text-[#5B8DEF] font-bold text-sm">D</span>
            </div>
            <span className="font-semibold text-zinc-100">Docuplete Status</span>
          </div>
          <a
            href="https://docuplete.com"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            docuplete.com →
          </a>
        </div>
      </header>

      {/* Hero status banner */}
      <div className={`bg-gradient-to-b ${overallBg} border-b border-zinc-800/60`}>
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${overallIconBg}`}
            >
              {overallIcon}
            </div>
            <div>
              <h1 className={`text-2xl font-semibold ${overallTextColor}`}>{overallText}</h1>
              {checkedAt && (
                <p className="text-sm text-zinc-500 mt-0.5">
                  Updated {timeAgo(checkedAt)}
                  {" · "}
                  <span className="text-zinc-600">{fmtDate(checkedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            Could not reach the status API. This page will retry automatically.
          </div>
        )}

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              Active Incidents
            </h2>
            <div className="space-y-4">
              {activeIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-100">{inc.title}</h3>
                        {incidentStatusBadge(inc.status)}
                        {severityBadge(inc.severity)}
                      </div>
                      {inc.components.length > 0 && (
                        <p className="text-xs text-zinc-500">
                          Affected: {inc.components.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500 whitespace-nowrap">
                      {timeAgo(inc.created_at)}
                    </span>
                  </div>
                  {inc.body && (
                    <p className="text-sm text-zinc-300 leading-relaxed">{inc.body}</p>
                  )}
                  {inc.updates.length > 1 && (
                    <div className="border-t border-zinc-800/60 pt-3 space-y-3">
                      {[...inc.updates].reverse().slice(0, 5).map((u, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="text-zinc-600 whitespace-nowrap text-xs mt-0.5">
                            {timeAgo(u.created_at)}
                          </span>
                          <div>
                            {incidentStatusBadge(u.status)}
                            <span className="ml-2 text-zinc-400">{u.body}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Component status */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
            Components
          </h2>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 divide-y divide-zinc-800/60 overflow-hidden">
            {components.length === 0
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-5 py-4 flex items-center justify-between animate-pulse">
                    <div className="h-4 w-40 bg-zinc-800 rounded" />
                    <div className="h-4 w-20 bg-zinc-800 rounded" />
                  </div>
                ))
              : components.map((c) => (
                  <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {statusDot(c.status)}
                      <div>
                        <span className="font-medium text-zinc-100 text-sm">{c.name}</span>
                        <p className="text-xs text-zinc-500 mt-0.5">{c.description}</p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-medium whitespace-nowrap ${
                        c.status === "operational" ? "text-emerald-400" :
                        c.status === "degraded"    ? "text-amber-400"   :
                        c.status === "outage"      ? "text-red-400"     :
                        "text-zinc-500"
                      }`}
                    >
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                ))}
          </div>
        </section>

        {/* Past incidents */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">
            Incident History
          </h2>
          {pastIncidents.length === 0 ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-5 py-8 text-center text-sm text-zinc-500">
              No incidents in the last 30 days.
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 divide-y divide-zinc-800/60 overflow-hidden">
              {pastIncidents.map((inc) => (
                <div key={inc.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-zinc-200">{inc.title}</span>
                      {incidentStatusBadge(inc.status)}
                      {severityBadge(inc.severity)}
                    </div>
                    {inc.components.length > 0 && (
                      <p className="text-xs text-zinc-600">
                        {inc.components.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-zinc-500">{fmtDate(inc.created_at)}</p>
                    {inc.resolved_at && (
                      <p className="text-xs text-zinc-600">
                        Resolved {timeAgo(inc.resolved_at)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Subscribe callout */}
        <section className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-5 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">Subscribe to updates</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Get notified via email when an incident is posted or resolved.
            </p>
          </div>
          <a
            href="mailto:status@docuplete.com?subject=Subscribe to Docuplete Status Updates"
            className="flex-shrink-0 text-xs font-medium bg-[#5B8DEF]/15 hover:bg-[#5B8DEF]/25 text-[#5B8DEF] border border-[#5B8DEF]/30 rounded-lg px-4 py-2 transition-colors"
          >
            Subscribe →
          </a>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 mt-10 px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} Docuplete. All rights reserved.</span>
          <a href="https://docuplete.com/privacy" className="hover:text-zinc-400 transition-colors">
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
