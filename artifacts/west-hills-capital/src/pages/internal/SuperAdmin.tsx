import { useEffect, useRef, useState } from "react";
import { useInternalAuth } from "@/hooks/useInternalAuth";

const API_BASE   = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const ADMIN_BASE = `${API_BASE}/api/internal/settings/admin`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface AccountRow {
  id:                     number;
  name:                   string;
  slug:                   string;
  plan_tier:              string;
  subscription_status:    string | null;
  billing_period_start:   string | null;
  seat_limit:             number;
  seat_count:             number;
  submission_count:       number;
  package_count:          number;
  last_activity_at:       string | null;
  created_at:             string;
  stripe_customer_id:     string | null;
  stripe_subscription_id: string | null;
  churn_risk:             boolean;
  mrr_cents:              number | null;
  trial_end:              string | null;
}

interface Note {
  id:         number;
  note:       string;
  created_by: string;
  created_at: string;
}

interface AccountDetail {
  monthly_usage: { month: string; count: number }[];
  team_members: {
    id: number; email: string; role: string; status: string;
    display_name: string | null; last_seen_at: string | null;
  }[];
  stripe_subscription: {
    plan_name: string; amount: number | null; currency: string | null;
    interval: string | null; current_period_end: string | null; status: string | null;
  } | null;
  invoices: {
    id: string; status: string | null; amount_due: number; amount_paid: number;
    currency: string; created: string; invoice_pdf: string | null;
    hosted_invoice_url: string | null; number: string | null;
  }[];
  adoption: {
    active_api_keys: number; webhook_count: number;
    has_custom_domain: boolean; has_slack: boolean;
  };
  notes: Note[];
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function planBadge(tier: string) {
  const map: Record<string, { label: string; cls: string }> = {
    free:       { label: "Free",       cls: "bg-gray-100 text-gray-500 border-gray-200" },
    pro:        { label: "Pro",        cls: "bg-blue-50 text-blue-700 border-blue-200" },
    enterprise: { label: "Enterprise", cls: "bg-[#C49A38]/10 text-[#C49A38] border-[#C49A38]/30" },
  };
  const { label, cls } = map[tier] ?? { label: tier, cls: "bg-gray-100 text-gray-400 border-gray-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function statusBadge(status: string | null) {
  if (!status) return <span className="text-[10px] text-gray-300">—</span>;
  const map: Record<string, string> = {
    active:   "bg-green-50 text-green-700 border-green-200",
    trialing: "bg-sky-50 text-sky-700 border-sky-200",
    manual:   "bg-purple-50 text-purple-700 border-purple-200",
    canceled: "bg-red-50 text-red-600 border-red-200",
    past_due: "bg-orange-50 text-orange-700 border-orange-200",
    void:     "bg-gray-100 text-gray-400 border-gray-200",
    draft:    "bg-yellow-50 text-yellow-700 border-yellow-200",
    paid:     "bg-green-50 text-green-700 border-green-200",
    open:     "bg-blue-50 text-blue-700 border-blue-200",
    uncollectible: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function relativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(cents: number | null, currency = "usd"): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────

function UsageChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d) => {
        const pct = Math.round((d.count / max) * 100);
        const label = months[parseInt(d.month.slice(5), 10) - 1] ?? d.month.slice(5);
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col justify-end" style={{ height: 44 }}>
              <div
                className="w-full rounded-sm bg-[#C49A38]/60"
                style={{ height: `${Math.max(pct, 3)}%` }}
                title={`${d.count} submissions`}
              />
            </div>
            <span className="text-[9px] text-gray-400">{label}</span>
            <span className="text-[9px] font-medium text-gray-600">{d.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Plan override form ─────────────────────────────────────────────────────────

function PlanOverrideForm({
  account, getAuthHeaders, onSaved,
}: {
  account: AccountRow;
  getAuthHeaders: () => HeadersInit;
  onSaved: (updated: Partial<AccountRow>) => void;
}) {
  const [tier,   setTier]   = useState(account.plan_tier);
  const [seats,  setSeats]  = useState(String(account.seat_limit));
  const [status, setStatus] = useState(account.subscription_status ?? "");
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState<string | null>(null);
  const [saved,  setSaved]  = useState(false);

  async function handleSave() {
    setSaving(true); setErr(null); setSaved(false);
    try {
      const res = await fetch(`${ADMIN_BASE}/accounts/${account.id}`, {
        method:  "PATCH",
        headers: { ...(getAuthHeaders() as Record<string, string>), "Content-Type": "application/json" },
        body:    JSON.stringify({ plan_tier: tier, seat_limit: parseInt(seats, 10), subscription_status: status || null }),
      });
      const data = await res.json() as { account?: Partial<AccountRow>; error?: string };
      if (!res.ok) { setErr(data.error ?? "Failed to save"); return; }
      setSaved(true);
      onSaved(data.account ?? {});
      setTimeout(() => setSaved(false), 2500);
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  const dirty = tier !== account.plan_tier
    || seats !== String(account.seat_limit)
    || (status || null) !== account.subscription_status;

  return (
    <div className="rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold text-gray-700">Plan override</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Plan tier",
            node: (
              <select value={tier} onChange={(e) => setTier(e.target.value)} className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#C49A38]/50 w-full">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            ),
          },
          {
            label: "Seat limit",
            node: (
              <input type="number" min={1} max={10000} value={seats} onChange={(e) => setSeats(e.target.value)}
                className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#C49A38]/50 w-full" />
            ),
          },
          {
            label: "Sub. status",
            node: (
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs rounded border border-gray-200 px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#C49A38]/50 w-full">
                <option value="">— none —</option>
                <option value="active">active</option>
                <option value="trialing">trialing</option>
                <option value="manual">manual</option>
                <option value="canceled">canceled</option>
                <option value="past_due">past_due</option>
              </select>
            ),
          },
        ].map(({ label, node }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400">{label}</label>
            {node}
          </div>
        ))}
      </div>
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <button type="button" disabled={saving || !dirty} onClick={() => { void handleSave(); }}
        className="self-start rounded-lg bg-[#0F1C3F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a2d5a] disabled:opacity-40 transition-colors">
        {saving ? "Saving…" : saved ? "Saved ✓" : "Apply override"}
      </button>
    </div>
  );
}

// ── Notes section ──────────────────────────────────────────────────────────────

function NotesSection({
  accountId, initialNotes, getAuthHeaders,
}: {
  accountId: number;
  initialNotes: Note[];
  getAuthHeaders: () => HeadersInit;
}) {
  const [notes,   setNotes]   = useState<Note[]>(initialNotes);
  const [text,    setText]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const textareaRef           = useRef<HTMLTextAreaElement>(null);

  async function addNote() {
    if (!text.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`${ADMIN_BASE}/accounts/${accountId}/notes`, {
        method:  "POST",
        headers: { ...(getAuthHeaders() as Record<string, string>), "Content-Type": "application/json" },
        body:    JSON.stringify({ note: text.trim() }),
      });
      const data = await res.json() as { note?: Note; error?: string };
      if (!res.ok) { setErr(data.error ?? "Failed to save"); return; }
      setNotes((prev) => [data.note!, ...prev]);
      setText("");
    } catch { setErr("Network error"); }
    finally { setSaving(false); }
  }

  async function deleteNote(id: number) {
    try {
      await fetch(`${ADMIN_BASE}/accounts/${accountId}/notes/${id}`, {
        method: "DELETE", headers: getAuthHeaders(),
      });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch { /* silent */ }
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2">Internal notes</p>
      <div className="flex flex-col gap-2 mb-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { void addNote(); } }}
          placeholder="Add a note… (⌘↵ to save)"
          rows={2}
          className="w-full text-xs rounded-lg border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-[#C49A38]/50 text-gray-800 placeholder:text-gray-400"
        />
        {err && <p className="text-[10px] text-red-600">{err}</p>}
        <button type="button" disabled={saving || !text.trim()} onClick={() => { void addNote(); }}
          className="self-start rounded-lg bg-[#0F1C3F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a2d5a] disabled:opacity-40 transition-colors">
          {saving ? "Saving…" : "Add note"}
        </button>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 group relative">
              <p className="text-xs text-gray-800 whitespace-pre-wrap">{n.note}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                {n.created_by} · {relativeDate(n.created_at)}
              </p>
              <button
                onClick={() => { void deleteNote(n.id); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-[10px]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-xs text-gray-400 italic">No notes yet.</p>
      )}
    </div>
  );
}

// ── Adoption flags ─────────────────────────────────────────────────────────────

function AdoptionFlags({ adoption }: { adoption: AccountDetail["adoption"] }) {
  const flags = [
    { label: "API keys",      active: adoption.active_api_keys > 0, detail: adoption.active_api_keys > 0 ? `${adoption.active_api_keys} active` : "None" },
    { label: "Webhooks",      active: adoption.webhook_count > 0,   detail: adoption.webhook_count > 0 ? `${adoption.webhook_count} deliveries` : "None" },
    { label: "Custom domain", active: adoption.has_custom_domain,   detail: adoption.has_custom_domain ? "Configured" : "Not set" },
    { label: "Slack",         active: adoption.has_slack,           detail: adoption.has_slack ? "Connected" : "Not set" },
  ];
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2">Feature adoption</p>
      <div className="grid grid-cols-2 gap-2">
        {flags.map(({ label, active, detail }) => (
          <div key={label} className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${active ? "border-green-200 bg-green-50" : "border-gray-100 bg-gray-50"}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-green-500" : "bg-gray-300"}`} />
            <div>
              <p className="text-[11px] font-medium text-gray-700">{label}</p>
              <p className="text-[10px] text-gray-400">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Invoice history ────────────────────────────────────────────────────────────

function InvoiceHistory({ invoices }: { invoices: AccountDetail["invoices"] }) {
  if (invoices.length === 0) return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2">Invoice history</p>
      <p className="text-xs text-gray-400 italic">No invoices found.</p>
    </div>
  );

  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2">Invoice history</p>
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {invoices.map((inv) => {
          const isPaid = inv.status === "paid" || inv.amount_paid >= inv.amount_due;
          return (
            <div key={inv.id} className="px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-medium text-gray-800">
                    {formatMoney(inv.amount_due, inv.currency)}
                  </p>
                  {statusBadge(inv.status)}
                </div>
                <p className="text-[10px] text-gray-400">
                  {inv.number ? `#${inv.number} · ` : ""}{formatDate(inv.created)}
                  {!isPaid && inv.amount_paid > 0 && (
                    <span className="ml-1 text-orange-500">({formatMoney(inv.amount_paid, inv.currency)} paid)</span>
                  )}
                </p>
              </div>
              {(inv.hosted_invoice_url || inv.invoice_pdf) && (
                <a
                  href={inv.hosted_invoice_url ?? inv.invoice_pdf ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] text-blue-600 hover:underline"
                >
                  View ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Account detail panel ───────────────────────────────────────────────────────

function DetailPanel({
  account, getAuthHeaders, onClose, onAccountUpdated,
}: {
  account: AccountRow;
  getAuthHeaders: () => HeadersInit;
  onClose: () => void;
  onAccountUpdated: (id: number, patch: Partial<AccountRow>) => void;
}) {
  const [detail,  setDetail]  = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null); setDetail(null);
    fetch(`${ADMIN_BASE}/accounts/${account.id}`, { headers: getAuthHeaders() })
      .then(async (r) => {
        const data = await r.json() as AccountDetail & { error?: string };
        if (!r.ok) { setError(data.error ?? "Failed to load"); return; }
        setDetail(data);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [account.id]);

  const trialDays = daysUntil(account.trial_end);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-200 overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start gap-3 z-10">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{account.name}</p>
            <p className="text-[11px] text-gray-400 font-mono">{account.slug}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {planBadge(account.plan_tier)}
            {account.churn_risk && (
              <span className="text-[10px] text-red-600 font-medium bg-red-50 border border-red-200 rounded-full px-2 py-0.5">At risk</span>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 px-5 py-4 flex flex-col gap-5">

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Seats",       value: `${account.seat_count} / ${account.seat_limit}` },
              { label: "Submissions", value: account.submission_count },
              { label: "Packages",    value: account.package_count },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-center">
                <p className="text-base font-semibold text-gray-900">{value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Meta row */}
          <div className="text-xs text-gray-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Status</span>
              <div className="flex items-center gap-1.5">
                {statusBadge(account.subscription_status)}
                {trialDays !== null && trialDays >= 0 && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${trialDays <= 3 ? "bg-red-50 text-red-600 border-red-200" : "bg-sky-50 text-sky-700 border-sky-200"}`}>
                    {trialDays}d left
                  </span>
                )}
                {trialDays !== null && trialDays < 0 && (
                  <span className="text-[10px] text-red-500">Trial ended</span>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span>MRR</span>
              <span className="font-medium text-gray-800">{formatMoney(account.mrr_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-gray-700">{formatDate(account.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Last activity</span>
              <span className="text-gray-700">{relativeDate(account.last_activity_at)}</span>
            </div>
            {account.stripe_customer_id && (
              <div className="flex justify-between">
                <span>Stripe customer</span>
                <a href={`https://dashboard.stripe.com/customers/${account.stripe_customer_id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono text-[10px]">
                  {account.stripe_customer_id.slice(0, 18)}… ↗
                </a>
              </div>
            )}
          </div>

          {/* Plan override */}
          <PlanOverrideForm
            account={account}
            getAuthHeaders={getAuthHeaders}
            onSaved={(patch) => onAccountUpdated(account.id, patch)}
          />

          {/* Loading / error */}
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-[#C49A38] rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-xs text-red-600 text-center py-4">{error}</p>}

          {detail && (
            <>
              {/* Adoption flags */}
              <AdoptionFlags adoption={detail.adoption} />

              {/* 6-month usage chart */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Submissions — last 6 months</p>
                <UsageChart data={detail.monthly_usage} />
              </div>

              {/* Stripe subscription */}
              {detail.stripe_subscription && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Stripe subscription</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Plan</span>
                      <span className="text-gray-800 font-medium">{detail.stripe_subscription.plan_name}</span>
                    </div>
                    {detail.stripe_subscription.amount !== null && (
                      <div className="flex justify-between">
                        <span>Amount</span>
                        <span className="text-gray-800">
                          {formatMoney(detail.stripe_subscription.amount, detail.stripe_subscription.currency ?? "usd")}
                          {detail.stripe_subscription.interval ? ` / ${detail.stripe_subscription.interval}` : ""}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Status</span>
                      {statusBadge(detail.stripe_subscription.status)}
                    </div>
                    {detail.stripe_subscription.current_period_end && (
                      <div className="flex justify-between">
                        <span>Renews / ends</span>
                        <span className="text-gray-800">{formatDate(detail.stripe_subscription.current_period_end)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Invoice history */}
              <InvoiceHistory invoices={detail.invoices} />

              {/* Team members */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Team ({detail.team_members.length})</p>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {detail.team_members.map((m) => (
                    <div key={m.id} className="px-3 py-2.5 flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#C49A38]/15 flex items-center justify-center shrink-0 text-[10px] font-semibold text-[#C49A38]">
                        {(m.display_name ?? m.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800 truncate">{m.display_name ?? m.email}</p>
                        {m.display_name && <p className="text-[10px] text-gray-400 truncate">{m.email}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className={`text-[9px] font-medium rounded-full px-1.5 py-0.5 ${m.role === "admin" ? "bg-[#0F1C3F]/10 text-[#0F1C3F]" : "bg-gray-100 text-gray-500"}`}>
                          {m.role}
                        </span>
                        {m.status !== "active" && <span className="text-[9px] text-orange-500">{m.status}</span>}
                      </div>
                    </div>
                  ))}
                  {detail.team_members.length === 0 && <p className="px-3 py-3 text-xs text-gray-400">No members yet</p>}
                </div>
              </div>

              {/* Internal notes */}
              <NotesSection
                accountId={account.id}
                initialNotes={detail.notes}
                getAuthHeaders={getAuthHeaders}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const { getAuthHeaders } = useInternalAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [selected, setSelected] = useState<AccountRow | null>(null);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    fetch(`${ADMIN_BASE}/accounts`, { headers: getAuthHeaders() })
      .then(async (r) => {
        const data = await r.json() as { accounts?: AccountRow[]; error?: string };
        if (!r.ok) { setError(data.error ?? "Failed to load"); return; }
        setAccounts(data.accounts ?? []);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  function handleAccountUpdated(id: number, patch: Partial<AccountRow>) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    setSelected((prev) => prev?.id === id ? { ...prev, ...patch } : prev);
  }

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    return !q || a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q);
  });

  const totalMrr     = accounts.reduce((s, a) => s + (a.mrr_cents ?? 0), 0);
  const atRiskCount  = accounts.filter((a) => a.churn_risk).length;
  const trialCount   = accounts.filter((a) => a.subscription_status === "trialing").length;

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[#0F1C3F]">Super Admin</h1>
          <p className="text-sm text-[#8A9BB8] mt-0.5">All Docuplete accounts — internal use only</p>
        </div>
        <input
          type="search"
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#C49A38]/50 w-52"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total accounts",    value: accounts.length },
          { label: "MRR",              value: formatMoney(totalMrr > 0 ? totalMrr : null) },
          { label: "At-risk accounts",  value: atRiskCount,  danger: atRiskCount > 0 },
          { label: "Active trials",     value: trialCount },
        ].map(({ label, value, danger }) => (
          <div key={label} className={`rounded-xl border bg-white px-5 py-4 ${danger ? "border-red-200" : "border-gray-200"}`}>
            <p className={`text-2xl font-semibold ${danger ? "text-red-600" : "text-[#0F1C3F]"}`}>{value}</p>
            <p className="text-xs text-[#8A9BB8] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Error / loading */}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-200 border-t-[#C49A38] rounded-full animate-spin" />
        </div>
      )}

      {/* Accounts table */}
      {!loading && !error && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Account", "Plan", "MRR", "Status", "Seats", "Submissions", "Last active", "Created"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => {
                const trialDays = daysUntil(a.trial_end);
                const showTrial = a.subscription_status === "trialing" && trialDays !== null && trialDays >= 0;
                return (
                  <tr key={a.id} onClick={() => setSelected(a)} className="hover:bg-[#C49A38]/5 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.churn_risk && (
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Churn risk: paid account with no recent submissions" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-[#C49A38] transition-colors">{a.name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{a.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{planBadge(a.plan_tier)}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">
                      {a.mrr_cents ? formatMoney(a.mrr_cents) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusBadge(a.subscription_status)}
                        {showTrial && (
                          <span className={`text-[9px] font-medium rounded-full px-1.5 py-0.5 border ${trialDays! <= 3 ? "bg-red-50 text-red-600 border-red-200" : "bg-sky-50 text-sky-600 border-sky-200"}`}>
                            {trialDays}d
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${a.seat_count >= a.seat_limit ? "text-orange-600 font-medium" : "text-gray-700"}`}>
                        {a.seat_count} / {a.seat_limit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{a.submission_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{relativeDate(a.last_activity_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(a.created_at)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                    {search ? "No accounts match your search." : "No accounts found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          account={selected}
          getAuthHeaders={getAuthHeaders}
          onClose={() => setSelected(null)}
          onAccountUpdated={handleAccountUpdated}
        />
      )}
    </div>
  );
}
