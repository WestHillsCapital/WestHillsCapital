import { useState, useEffect, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { useInternalAuth } from "../../hooks/useInternalAuth";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProductRow {
  productId:   string;
  productName: string;
  metal:       "gold" | "silver";
  qty:         string;
  unitPrice:   string;
}

interface SpotData {
  goldSpotAsk:    number | null;
  silverSpotAsk:  number | null;
  spotTimestamp:  string | null;
}

interface Customer {
  firstName:        string;
  lastName:         string;
  email:            string;
  phone:            string;
  state:            string;
  leadId:           string;
  confirmationId:   string;
  custodian:        string;
  iraAccountNumber: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_DEFS: Pick<ProductRow, "productId" | "productName" | "metal">[] = [
  { productId: "gold-american-eagle-1oz",   productName: "1 oz Gold Eagle",   metal: "gold"   },
  { productId: "gold-american-buffalo-1oz", productName: "1 oz Gold Buffalo",  metal: "gold"   },
  { productId: "silver-american-eagle-1oz", productName: "1 oz Silver Eagle",  metal: "silver" },
];

const EMPTY_ROWS: ProductRow[] = PRODUCT_DEFS.map((d) => ({
  ...d, qty: "", unitPrice: "",
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function parseQty(s: string): number {
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DealBuilder() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const { getAuthHeaders } = useInternalAuth();

  const urlLeadId         = params.get("leadId") ?? "";
  const urlConfirmationId = params.get("confirmationId") ?? "";
  const urlDealId         = params.get("dealId") ?? "";

  // ── Customer fields ──────────────────────────────────────────────────────
  const [customer, setCustomer] = useState<Customer>({
    firstName: "", lastName: "", email: "", phone: "", state: "",
    leadId: urlLeadId, confirmationId: urlConfirmationId,
    custodian: "", iraAccountNumber: "",
  });
  const [customerLoaded, setCustomerLoaded] = useState(false);

  // ── Deal configuration ───────────────────────────────────────────────────
  const [dealType, setDealType] = useState<"cash" | "ira">("cash");
  const [iraType,  setIraType]  = useState("");

  // ── Pricing ──────────────────────────────────────────────────────────────
  const [spotData, setSpotData] = useState<SpotData>({
    goldSpotAsk: null, silverSpotAsk: null, spotTimestamp: null,
  });
  const [rows, setRows] = useState<ProductRow[]>(EMPTY_ROWS);

  // ── Delivery ──────────────────────────────────────────────────────────────
  const [deliveryMethod, setDeliveryMethod] = useState<"fedex_hold" | "home_delivery">("fedex_hold");
  const [fedexLocation,  setFedexLocation]  = useState("");

  // ── Notes ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── Deal state ───────────────────────────────────────────────────────────
  const [isLocked,    setIsLocked]    = useState(false);
  const [lockedAt,    setLockedAt]    = useState<string | null>(null);
  const [savedDealId, setSavedDealId] = useState<number | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isFetchingSpot, setIsFetchingSpot] = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [spotError,      setSpotError]      = useState<string | null>(null);
  const [saveError,      setSaveError]      = useState<string | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // ── Load saved deal (read-only view when ?dealId=X) ──────────────────────
  useEffect(() => {
    if (!urlDealId) return;
    (async () => {
      setLoadingCustomer(true);
      try {
        const res = await fetch(`${API_BASE}/api/deals/${urlDealId}`, {
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) return;
        const { deal } = await res.json();
        setCustomer({
          firstName:        deal.first_name ?? "",
          lastName:         deal.last_name  ?? "",
          email:            deal.email      ?? "",
          phone:            deal.phone      ?? "",
          state:            deal.state      ?? "",
          leadId:           deal.lead_id    ? String(deal.lead_id) : "",
          confirmationId:   deal.confirmation_id ?? "",
          custodian:        deal.custodian        ?? "",
          iraAccountNumber: deal.ira_account_number ?? "",
        });
        setDealType(deal.deal_type === "ira" ? "ira" : "cash");
        setIraType(deal.ira_type ?? "");
        setSpotData({
          goldSpotAsk:   deal.gold_spot_ask   ?? null,
          silverSpotAsk: deal.silver_spot_ask ?? null,
          spotTimestamp: deal.spot_timestamp  ?? null,
        });
        const savedRows: ProductRow[] = PRODUCT_DEFS.map((def) => {
          const p = (deal.products ?? []).find((p: { productId: string }) => p.productId === def.productId);
          return {
            ...def,
            qty:       p ? String(p.qty)       : "",
            unitPrice: p ? String(p.unitPrice) : "",
          };
        });
        setRows(savedRows);
        setDeliveryMethod(deal.shipping_method === "home_delivery" ? "home_delivery" : "fedex_hold");
        setFedexLocation(deal.fedex_location ?? "");
        setNotes(deal.notes ?? "");
        setIsLocked(true);
        setLockedAt(deal.locked_at ?? null);
        setSavedDealId(deal.id);
        setCustomerLoaded(true);
      } finally {
        setLoadingCustomer(false);
      }
    })();
  }, [urlDealId]);

  // ── Pre-populate from lead ──────────────────────────────────────────────
  useEffect(() => {
    if (!urlLeadId || urlDealId || customerLoaded) return;
    (async () => {
      setLoadingCustomer(true);
      try {
        const res = await fetch(`${API_BASE}/api/internal/leads`, {
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) return;
        const { leads } = await res.json();
        const lead = leads.find((l: { id: number }) => String(l.id) === urlLeadId);
        if (lead) {
          setCustomer((c) => ({
            ...c,
            firstName:      lead.first_name ?? "",
            lastName:       lead.last_name  ?? "",
            email:          lead.email      ?? "",
            phone:          lead.phone      ?? "",
            state:          lead.state      ?? "",
            leadId:         String(lead.id),
            confirmationId: lead.linked_confirmation_id ?? c.confirmationId,
          }));
          setCustomerLoaded(true);
        }
      } finally {
        setLoadingCustomer(false);
      }
    })();
  }, [urlLeadId, urlDealId, customerLoaded]);

  // ── Pre-populate from appointment ──────────────────────────────────────
  useEffect(() => {
    if (!urlConfirmationId || urlDealId || customerLoaded) return;
    (async () => {
      setLoadingCustomer(true);
      try {
        const res = await fetch(`${API_BASE}/api/internal/appointments`, {
          headers: { ...getAuthHeaders() },
        });
        if (!res.ok) return;
        const { appointments } = await res.json();
        const appt = appointments.find(
          (a: { confirmation_id: string }) => a.confirmation_id === urlConfirmationId
        );
        if (appt) {
          setCustomer((c) => ({
            ...c,
            firstName:      appt.first_name ?? "",
            lastName:       appt.last_name  ?? "",
            email:          appt.email      ?? "",
            phone:          appt.phone      ?? "",
            state:          appt.state      ?? "",
            leadId:         appt.lead_id ? String(appt.lead_id) : c.leadId,
            confirmationId: appt.confirmation_id ?? "",
          }));
          setCustomerLoaded(true);
        }
      } finally {
        setLoadingCustomer(false);
      }
    })();
  }, [urlConfirmationId, urlDealId, customerLoaded]);

  // ── Auto-fetch spot prices on mount (skip for locked/read-only deals) ───
  useEffect(() => {
    if (!urlDealId) {
      getSpotPrice();
    }
    // Run once on mount — getSpotPrice is stable (useCallback with no deps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Computed totals ──────────────────────────────────────────────────────
  const rowTotals = rows.map((r) => {
    const qty = parseQty(r.qty);
    const up  = parseNum(r.unitPrice);
    return qty > 0 && up > 0 ? qty * up : 0;
  });

  const subtotal  = rowTotals.reduce((a, b) => a + b, 0);
  const goldOz    = rows
    .filter((r) => r.metal === "gold")
    .reduce((a, r) => a + parseQty(r.qty), 0);
  const silverOz  = rows
    .filter((r) => r.metal === "silver")
    .reduce((a, r) => a + parseQty(r.qty), 0);
  const shipping  = goldOz < 15 && silverOz < 300 ? 25 : 0;
  const total     = subtotal + shipping;

  // ── Get Spot Price ───────────────────────────────────────────────────────
  const getSpotPrice = useCallback(async () => {
    setIsFetchingSpot(true);
    setSpotError(null);
    try {
      const [spotRes, prodRes] = await Promise.all([
        fetch(`${API_BASE}/api/pricing/spot`),
        fetch(`${API_BASE}/api/pricing/products`),
      ]);

      if (!spotRes.ok || !prodRes.ok) throw new Error("Pricing API unavailable");

      const spotJson = await spotRes.json();
      const prodJson = await prodRes.json();

      const nowIso = new Date().toISOString();
      setSpotData({
        goldSpotAsk:   spotJson.goldAsk   ?? spotJson.gold   ?? null,
        silverSpotAsk: spotJson.silverAsk ?? spotJson.silver ?? null,
        spotTimestamp: nowIso,
      });

      // Map product finalPrice to each row
      const priceMap: Record<string, number> = {};
      for (const p of prodJson.products ?? []) {
        priceMap[p.id] = p.finalPrice;
      }

      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          unitPrice: priceMap[r.productId] != null
            ? String(priceMap[r.productId])
            : r.unitPrice,
        }))
      );
    } catch {
      setSpotError("Could not fetch live pricing. Check API connection.");
    } finally {
      setIsFetchingSpot(false);
    }
  }, []);

  // ── Lock Deal ─────────────────────────────────────────────────────────────
  const lockDeal = useCallback(async () => {
    setSaveError(null);

    if (!customer.firstName || !customer.lastName || !customer.email) {
      setSaveError("First name, last name, and email are required.");
      return;
    }

    const activeProducts = rows
      .filter((r) => parseQty(r.qty) > 0 && parseNum(r.unitPrice) > 0)
      .map((r) => ({
        productId:   r.productId,
        productName: r.productName,
        metal:       r.metal,
        qty:         parseQty(r.qty),
        unitPrice:   parseNum(r.unitPrice),
        lineTotal:   parseQty(r.qty) * parseNum(r.unitPrice),
      }));

    if (activeProducts.length === 0) {
      setSaveError("Add at least one product with qty and unit price before locking.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          leadId:           customer.leadId ? parseInt(customer.leadId) : null,
          confirmationId:   customer.confirmationId || null,
          dealType,
          iraType:          dealType === "ira" ? iraType || null : null,
          firstName:        customer.firstName,
          lastName:         customer.lastName,
          email:            customer.email,
          phone:            customer.phone || null,
          state:            customer.state || null,
          custodian:        dealType === "ira" ? customer.custodian || null : null,
          iraAccountNumber: dealType === "ira" ? customer.iraAccountNumber || null : null,
          goldSpotAsk:      spotData.goldSpotAsk,
          silverSpotAsk:    spotData.silverSpotAsk,
          spotTimestamp:    spotData.spotTimestamp,
          products:         activeProducts,
          subtotal,
          shipping,
          total,
          balanceDue:       total,
          shippingMethod:   deliveryMethod,
          fedexLocation:    fedexLocation || null,
          notes:            notes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to save deal");
      }

      const { dealId, lockedAt: la } = await res.json();
      setIsLocked(true);
      setLockedAt(la ?? new Date().toISOString());
      setSavedDealId(dealId);

      // Update URL to reflect the saved deal without navigating away
      const newSearch = `?dealId=${dealId}`;
      window.history.replaceState(null, "", window.location.pathname + newSearch);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to lock deal.");
    } finally {
      setIsSaving(false);
    }
  }, [customer, dealType, iraType, spotData, rows, subtotal, shipping, total, deliveryMethod, fedexLocation, notes]);

  // ── Field helper ─────────────────────────────────────────────────────────
  const setCust = (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCustomer((c) => ({ ...c, [field]: e.target.value }));

  const setRow = (i: number, field: "qty" | "unitPrice") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const locked = isLocked;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">Deal Builder</h1>
            {locked && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-900 text-green-300 font-medium">
                LOCKED — Deal #{savedDealId}
              </span>
            )}
          </div>
          {locked && lockedAt && (
            <p className="text-sm text-gray-500 mt-1">
              Locked {new Date(lockedAt).toLocaleString()} · Deal Builder sheet and Deals ledger updated
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/internal/leads")}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
          >
            ← Leads
          </button>
          <button
            onClick={() => navigate("/internal/appointments")}
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5"
          >
            Appointments
          </button>
        </div>
      </div>

      {loadingCustomer && (
        <div className="text-gray-400 text-sm mb-4">Loading customer data…</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN: Customer + Config ──────────────────────────── */}
        <div className="lg:col-span-1 space-y-5">

          {/* Customer panel */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Customer</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="First Name" value={customer.firstName} onChange={setCust("firstName")} disabled={locked} />
                <Field label="Last Name"  value={customer.lastName}  onChange={setCust("lastName")}  disabled={locked} />
              </div>
              <Field label="Email"   value={customer.email}  onChange={setCust("email")}  type="email" disabled={locked} />
              <Field label="Phone"   value={customer.phone}  onChange={setCust("phone")}  type="tel"   disabled={locked} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">State</label>
                  <select
                    value={customer.state}
                    onChange={setCust("state")}
                    disabled={locked}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white disabled:opacity-60 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <Field label="Lead ID" value={customer.leadId} onChange={setCust("leadId")} disabled={locked} />
              </div>
              <Field label="Confirmation ID" value={customer.confirmationId} onChange={setCust("confirmationId")} disabled={locked} />
            </div>
          </section>

          {/* Deal type */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Deal Type</h2>
            <div className="flex rounded overflow-hidden border border-gray-700">
              {(["cash", "ira"] as const).map((t) => (
                <button
                  key={t}
                  disabled={locked}
                  onClick={() => setDealType(t)}
                  className={[
                    "flex-1 py-2 text-sm font-medium transition-colors",
                    dealType === t
                      ? "bg-amber-500 text-black"
                      : "bg-gray-800 text-gray-400 hover:text-white",
                    locked ? "opacity-60 cursor-default" : "",
                  ].join(" ")}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {dealType === "ira" && (
              <div className="mt-4 space-y-3">
                <Field label="IRA Type (Transfer / Rollover / New)" value={iraType} onChange={(e) => setIraType(e.target.value)} disabled={locked} />
                <Field label="Custodian" value={customer.custodian} onChange={setCust("custodian")} disabled={locked} />
                <Field label="IRA Account Number" value={customer.iraAccountNumber} onChange={setCust("iraAccountNumber")} disabled={locked} />
                <p className="text-xs text-amber-600/80 bg-amber-900/20 border border-amber-800/30 rounded px-3 py-2">
                  IRA processing is handled manually. Pricing is the same as cash.
                </p>
              </div>
            )}
          </section>

          {/* Delivery */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Delivery</h2>
            <div className="flex rounded overflow-hidden border border-gray-700 mb-3">
              {(["fedex_hold", "home_delivery"] as const).map((m) => (
                <button
                  key={m}
                  disabled={locked}
                  onClick={() => setDeliveryMethod(m)}
                  className={[
                    "flex-1 py-2 text-xs font-medium transition-colors",
                    deliveryMethod === m
                      ? "bg-amber-500 text-black"
                      : "bg-gray-800 text-gray-400 hover:text-white",
                    locked ? "opacity-60 cursor-default" : "",
                  ].join(" ")}
                >
                  {m === "fedex_hold" ? "FedEx Hold" : "Home Delivery"}
                </button>
              ))}
            </div>
            {deliveryMethod === "fedex_hold" && (
              <Field
                label="FedEx Hold Location"
                value={fedexLocation}
                onChange={(e) => setFedexLocation(e.target.value)}
                disabled={locked}
                placeholder="e.g. FedEx Ship Center, 123 Main St"
              />
            )}
          </section>

          {/* Notes */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={locked}
              rows={3}
              placeholder="Internal notes for this deal…"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 disabled:opacity-60 resize-none"
            />
          </section>
        </div>

        {/* ── RIGHT COLUMN: Pricing + Products + Summary ──────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Spot prices */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Live Spot</h2>
              {!locked && (
                <button
                  onClick={getSpotPrice}
                  disabled={isFetchingSpot}
                  className="px-4 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-colors"
                >
                  {isFetchingSpot ? "Fetching…" : "Get Spot Price"}
                </button>
              )}
            </div>

            {spotError && (
              <div className="text-red-400 text-xs mb-3">{spotError}</div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <SpotBox label="Gold Spot (Ask)" value={spotData.goldSpotAsk} />
              <SpotBox label="Silver Spot (Ask)" value={spotData.silverSpotAsk} />
              <div>
                <div className="text-xs text-gray-500 mb-1">Spot Timestamp</div>
                <div className="text-sm text-gray-300 font-mono">
                  {spotData.spotTimestamp
                    ? new Date(spotData.spotTimestamp).toLocaleTimeString()
                    : "—"}
                </div>
              </div>
            </div>
          </section>

          {/* Product rows */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Products</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left pb-2 text-xs text-gray-500 font-medium">Product</th>
                    <th className="text-left pb-2 text-xs text-gray-500 font-medium w-16">Metal</th>
                    <th className="text-right pb-2 text-xs text-gray-500 font-medium w-20">Qty</th>
                    <th className="text-right pb-2 text-xs text-gray-500 font-medium w-28">Unit Price</th>
                    <th className="text-right pb-2 text-xs text-gray-500 font-medium w-28">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const qty = parseQty(row.qty);
                    const up  = parseNum(row.unitPrice);
                    const lt  = qty > 0 && up > 0 ? qty * up : 0;
                    return (
                      <tr key={row.productId} className="border-b border-gray-800/40">
                        <td className="py-2.5 pr-4 text-white">{row.productName}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${row.metal === "gold" ? "bg-amber-900/50 text-amber-400" : "bg-gray-700 text-gray-300"}`}>
                            {row.metal}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            value={row.qty}
                            onChange={setRow(i, "qty")}
                            disabled={locked}
                            placeholder="0"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={setRow(i, "unitPrice")}
                            disabled={locked}
                            placeholder="0.00"
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                          />
                        </td>
                        <td className="py-2.5 text-right text-gray-300 font-mono text-sm">
                          {lt > 0 ? fmtMoney(lt) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(goldOz > 0 || silverOz > 0) && (
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                {goldOz > 0   && <span>{goldOz} oz gold</span>}
                {silverOz > 0 && <span>{silverOz} oz silver</span>}
                <span className="text-gray-600">·</span>
                <span>
                  Shipping: {goldOz < 15 && silverOz < 300 ? "$25 (FedEx)" : "Included ($0)"}
                </span>
              </div>
            )}
          </section>

          {/* Deal summary */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Summary</h2>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Subtotal" value={subtotal > 0 ? fmtMoney(subtotal) : "—"} />
              <SummaryRow label={`Shipping (${goldOz < 15 && silverOz < 300 ? "FedEx" : "Included"})`} value={shipping > 0 ? fmtMoney(shipping) : "$0.00"} />
              <div className="border-t border-gray-800 pt-2 mt-2">
                <SummaryRow label="Total" value={total > 0 ? fmtMoney(total) : "—"} highlight />
                <SummaryRow label="Balance Due" value={total > 0 ? fmtMoney(total) : "—"} />
              </div>
            </div>
          </section>

          {/* Lock Deal */}
          {!locked && (
            <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              {saveError && (
                <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
                  {saveError}
                </div>
              )}
              <button
                onClick={lockDeal}
                disabled={isSaving || total === 0}
                className="w-full py-3 rounded font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Locking Deal…" : "Lock Deal"}
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Locking freezes pricing, saves the deal, and updates your Google Sheets.
              </p>
            </section>
          )}

          {locked && (
            <section className="bg-green-900/20 border border-green-800/40 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <div className="text-green-400 text-xl mt-0.5">✓</div>
                <div>
                  <div className="text-green-300 font-semibold text-sm">Deal #{savedDealId} Locked</div>
                  <div className="text-green-400/70 text-xs mt-1">
                    All pricing is frozen. The Deal Builder sheet has been populated and the Deals ledger has been updated.
                    The Invoice tab in your Deal Builder sheet will auto-generate from the populated data.
                  </div>
                  {lockedAt && (
                    <div className="text-gray-500 text-xs mt-2">
                      Locked: {new Date(lockedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label:       string;
  value:       string;
  onChange:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?:   boolean;
  type?:       string;
  placeholder?: string;
}

function Field({ label, value, onChange, disabled, type = "text", placeholder }: FieldProps) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 disabled:opacity-60"
      />
    </div>
  );
}

function SpotBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-amber-400 font-mono">
        {value != null ? fmtMoney(value) : "—"}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={highlight ? "text-white font-medium" : "text-gray-400"}>{label}</span>
      <span className={`font-mono ${highlight ? "text-white font-semibold text-base" : "text-gray-300"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── US States ────────────────────────────────────────────────────────────────

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];
