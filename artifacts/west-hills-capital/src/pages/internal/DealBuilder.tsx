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

interface FedExLocationResult {
  name:         string;
  locationType: string;
  address:      string;
  city:         string;
  state:        string;
  zip:          string;
  distance:     string;
  phone:        string;
}

interface Customer {
  firstName:        string;
  lastName:         string;
  email:            string;
  phone:            string;
  state:            string;
  zip:              string;
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
    firstName: "", lastName: "", email: "", phone: "", state: "", zip: "",
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
  const [deliveryMethod,      setDeliveryMethod]      = useState<"fedex_hold" | "home_delivery">("fedex_hold");
  const [fedexLocation,       setFedexLocation]       = useState("");
  const [fedexLocationHours,  setFedexLocationHours]  = useState("");
  // Ship-to address (passed to DG ExecuteTrade)
  const [shipToLine1, setShipToLine1] = useState("");
  const [shipToCity,  setShipToCity]  = useState("");
  const [shipToState, setShipToState] = useState("");
  const [shipToZip,   setShipToZip]   = useState("");

  // ── FedEx location search ─────────────────────────────────────────────────
  const [fedexSearchZip,    setFedexSearchZip]    = useState("");
  const [fedexResults,      setFedexResults]      = useState<FedExLocationResult[]>([]);
  const [isFedexSearching,  setIsFedexSearching]  = useState(false);
  const [fedexSearchError,  setFedexSearchError]  = useState<string | null>(null);
  const [fedexLocationSelected, setFedexLocationSelected] = useState(false);

  // When customer zip becomes valid + delivery is FedEx hold, prime the search zip
  useEffect(() => {
    const z = customer.zip.replace(/\D/g, "").slice(0, 5);
    if (z.length === 5 && deliveryMethod === "fedex_hold" && !fedexLocationSelected) {
      setFedexSearchZip(z);
    }
  }, [customer.zip, deliveryMethod, fedexLocationSelected]);

  // ── Billing address ───────────────────────────────────────────────────────
  const [billingLine1, setBillingLine1] = useState("");
  const [billingLine2, setBillingLine2] = useState("");
  const [billingCity,  setBillingCity]  = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZip,   setBillingZip]   = useState("");

  // Pre-fill billing state from customer state when billing state is empty
  useEffect(() => {
    if (customer.state && !billingState && !isLocked) {
      setBillingState(customer.state);
    }
  // Run only when customer.state changes (e.g. pre-populated from lead/appointment)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.state]);

  // ── Notes ──────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── Deal state ───────────────────────────────────────────────────────────
  const [isLocked,          setIsLocked]          = useState(false);
  const [lockedAt,          setLockedAt]          = useState<string | null>(null);
  const [savedDealId,       setSavedDealId]       = useState<number | null>(null);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [paymentReceivedAt, setPaymentReceivedAt] = useState<string | null>(null);
  const [trackingNumber,    setTrackingNumber]    = useState("");
  const [executionResult, setExecutionResult] = useState<{
    invoiceId:    string | null;
    invoiceUrl:   string | null;
    emailSentTo:  string | null;
    warnings?:    string[];
  } | null>(null);
  // Ops action states
  const [isMarkingPayment,   setIsMarkingPayment]   = useState(false);
  const [isSavingTracking,   setIsSavingTracking]   = useState(false);
  const [opsActionError,     setOpsActionError]     = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [isFetchingSpot,     setIsFetchingSpot]     = useState(false);
  const [isSaving,           setIsSaving]           = useState(false);
  const [executionStep,      setExecutionStep]      = useState(0);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [spotError,          setSpotError]          = useState<string | null>(null);
  const [saveError,          setSaveError]          = useState<string | null>(null);
  const [loadingCustomer,    setLoadingCustomer]    = useState(false);

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
        setFedexLocationHours(deal.fedex_location_hours ?? "");
        if (deal.fedex_location) setFedexLocationSelected(true);
        setShipToLine1(deal.ship_to_line1 ?? "");
        setShipToCity(deal.ship_to_city   ?? "");
        setShipToState(deal.ship_to_state ?? "");
        setShipToZip(deal.ship_to_zip     ?? "");
        setBillingLine1(deal.billing_line1 ?? "");
        setBillingLine2(deal.billing_line2 ?? "");
        setBillingCity(deal.billing_city   ?? "");
        setBillingState(deal.billing_state ?? "");
        setBillingZip(deal.billing_zip     ?? "");
        setNotes(deal.notes ?? "");
        if (deal.invoice_id || deal.invoice_url || deal.recap_email_sent_at) {
          setExecutionResult({
            invoiceId:   deal.invoice_id   ?? null,
            invoiceUrl:  deal.invoice_url  ?? null,
            emailSentTo: deal.recap_email_sent_at ? deal.email : null,
          });
        }
        setTermsAcknowledged(true);
        setPaymentReceivedAt(deal.payment_received_at ?? null);
        setTrackingNumber(deal.tracking_number ?? "");
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

  // ── FedEx location search ─────────────────────────────────────────────────
  // Accepts an optional zipOverride so the auto-trigger can pass the zip
  // directly without relying on a pending state update.
  const searchFedexLocations = useCallback(async (zipOverride?: string) => {
    const zip = (zipOverride ?? fedexSearchZip).replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) {
      setFedexSearchError("Enter a valid 5-digit ZIP code.");
      return;
    }
    setIsFedexSearching(true);
    setFedexSearchError(null);
    setFedexResults([]);
    try {
      const res = await fetch(`${API_BASE}/api/fedex/locations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ postalCode: zip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Location search failed");
      setFedexResults(data.locations ?? []);
      if ((data.locations ?? []).length === 0) {
        setFedexSearchError("No FedEx Office or Ship Center locations found near that ZIP.");
      }
    } catch (err) {
      setFedexSearchError(err instanceof Error ? err.message : "Location search unavailable.");
    } finally {
      setIsFedexSearching(false);
    }
  }, [fedexSearchZip, getAuthHeaders]);

  // Auto-fire search whenever fedexSearchZip becomes a valid 5-digit code
  // (catches both auto-population from customer.zip and manual entry)
  useEffect(() => {
    const z = fedexSearchZip.replace(/\D/g, "").slice(0, 5);
    if (z.length !== 5 || deliveryMethod !== "fedex_hold" || fedexLocationSelected || isFedexSearching) return;
    void searchFedexLocations(z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fedexSearchZip]);

  const selectFedexLocation = useCallback((loc: FedExLocationResult) => {
    setFedexLocation(loc.name);
    setShipToLine1(loc.address);
    setShipToCity(loc.city);
    setShipToState(loc.state);
    setShipToZip(loc.zip);
    setFedexResults([]);
    setFedexLocationSelected(true);
  }, []);

  // ── Lock & Execute ────────────────────────────────────────────────────────
  const EXECUTION_STEPS = [
    "Saving deal…",
    "Locking DG prices…",
    "Executing trade…",
    "Generating invoice PDF…",
    "Sending client recap email…",
    "Saving to Drive…",
  ];

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
    setExecutionStep(0);

    // Advance progress steps on a timer while request is in-flight
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    [1600, 3200, 5000, 7000, 9500].forEach((ms, i) => {
      stepTimers.push(setTimeout(() => setExecutionStep(i + 1), ms));
    });

    try {
      const res = await fetch(`${API_BASE}/api/deals`, {
        method:  "POST",
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
          shippingMethod:     deliveryMethod,
          fedexLocation:      fedexLocation      || null,
          fedexLocationHours: fedexLocationHours || null,
          shipToLine1:        shipToLine1 || null,
          shipToCity:       shipToCity  || null,
          shipToState:      shipToState || null,
          shipToZip:        shipToZip   || null,
          billingLine1:     billingLine1 || null,
          billingLine2:     billingLine2 || null,
          billingCity:      billingCity  || null,
          billingState:     billingState || null,
          billingZip:       billingZip   || null,
          termsProvided:    true,
          termsVersion:     "v1.0",
          confirmationMethod: "verbal_recorded_call",
          notes:            notes || null,
        }),
      });

      stepTimers.forEach(clearTimeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to save deal");
      }

      const data = await res.json();
      const { dealId, lockedAt: la, invoiceId, invoiceUrl, emailSentTo, warnings } = data;

      setIsLocked(true);
      setLockedAt(la ?? new Date().toISOString());
      setSavedDealId(dealId);
      setExecutionResult({ invoiceId, invoiceUrl, emailSentTo, warnings });

      const newSearch = `?dealId=${dealId}`;
      window.history.replaceState(null, "", window.location.pathname + newSearch);
    } catch (err) {
      stepTimers.forEach(clearTimeout);
      setSaveError(err instanceof Error ? err.message : "Failed to lock & execute deal.");
    } finally {
      setIsSaving(false);
      setExecutionStep(0);
    }
  }, [customer, dealType, iraType, spotData, rows, subtotal, shipping, total,
      deliveryMethod, fedexLocation, fedexLocationHours, shipToLine1, shipToCity, shipToState, shipToZip,
      billingLine1, billingLine2, billingCity, billingState, billingZip, notes]);

  // ── Preview Invoice PDF ───────────────────────────────────────────────────
  const handlePreviewInvoice = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const activeProducts = rows
        .filter((r) => parseQty(r.qty) > 0 && parseNum(r.unitPrice) > 0)
        .map((r) => ({
          productName: r.productName,
          qty:         parseQty(r.qty),
          unitPrice:   parseNum(r.unitPrice),
          lineTotal:   parseQty(r.qty) * parseNum(r.unitPrice),
        }));

      const res = await fetch(`${API_BASE}/api/deals/preview-invoice`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({
          firstName:     customer.firstName || "Preview",
          lastName:      customer.lastName  || "Client",
          email:         customer.email,
          phone:         customer.phone     || undefined,
          state:         customer.state     || undefined,
          dealType,
          shippingMethod:     deliveryMethod,
          fedexLocation:      fedexLocation      || undefined,
          fedexLocationHours: fedexLocationHours || undefined,
          shipToLine1:        shipToLine1        || undefined,
          shipToCity:     shipToCity        || undefined,
          shipToState:    shipToState       || undefined,
          shipToZip:      shipToZip         || undefined,
          billingLine1:   billingLine1      || undefined,
          billingLine2:   billingLine2      || undefined,
          billingCity:    billingCity       || undefined,
          billingState:   billingState      || undefined,
          billingZip:     billingZip        || undefined,
          products:       activeProducts,
          subtotal,
          shipping,
          total,
          goldSpotAsk:   spotData.goldSpotAsk   ?? undefined,
          silverSpotAsk: spotData.silverSpotAsk ?? undefined,
        }),
      });

      if (!res.ok) throw new Error("Server error generating preview");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `WHC-PREVIEW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not generate preview PDF.");
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [customer, dealType, deliveryMethod, fedexLocation, fedexLocationHours,
      shipToLine1, shipToCity, shipToState, shipToZip,
      billingLine1, billingLine2, billingCity, billingState, billingZip,
      rows, subtotal, shipping, total, spotData, getAuthHeaders]);

  // ── Ops actions (payment + tracking) ─────────────────────────────────────
  const markPaymentReceived = useCallback(async () => {
    if (!savedDealId) return;
    setIsMarkingPayment(true);
    setOpsActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${savedDealId}/payment`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to mark payment");
      }
      const data = await res.json();
      setPaymentReceivedAt(data.paymentReceivedAt ?? new Date().toISOString());
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not mark payment received.");
    } finally {
      setIsMarkingPayment(false);
    }
  }, [savedDealId, getAuthHeaders]);

  const saveTrackingNumber = useCallback(async () => {
    if (!savedDealId || !trackingNumber.trim()) return;
    setIsSavingTracking(true);
    setOpsActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/deals/${savedDealId}/tracking`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body:    JSON.stringify({ trackingNumber: trackingNumber.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to save tracking number");
      }
    } catch (err) {
      setOpsActionError(err instanceof Error ? err.message : "Could not save tracking number.");
    } finally {
      setIsSavingTracking(false);
    }
  }, [savedDealId, trackingNumber, getAuthHeaders]);

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
              {executionResult ? "Executed" : "Locked"} {new Date(lockedAt).toLocaleString()} · Deals ledger updated
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
              <div className="grid grid-cols-3 gap-2">
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
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    ZIP{deliveryMethod === "fedex_hold" && !fedexLocationSelected && (
                      <span className="ml-1 text-amber-500/70">(used for FedEx search)</span>
                    )}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={customer.zip}
                    onChange={(e) => setCust("zip")({ target: { value: e.target.value.replace(/\D/g, "") } } as React.ChangeEvent<HTMLInputElement>)}
                    disabled={locked}
                    placeholder="ZIP"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-gray-600 disabled:opacity-60 focus:outline-none focus:border-amber-500"
                  />
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
              <div className="mb-3 space-y-2">
                {/* Selected location display */}
                {fedexLocationSelected && fedexLocation ? (
                  <>
                    <div className="flex items-start justify-between bg-gray-800/60 border border-amber-500/30 rounded p-3">
                      <div>
                        <p className="text-xs font-semibold text-amber-400 mb-0.5">{fedexLocation}</p>
                        {shipToLine1 && (
                          <p className="text-xs text-gray-400">
                            {shipToLine1}{shipToCity ? `, ${shipToCity}` : ""}{shipToState ? `, ${shipToState}` : ""} {shipToZip}
                          </p>
                        )}
                      </div>
                      {!locked && (
                        <button
                          onClick={() => { setFedexLocationSelected(false); setFedexResults([]); }}
                          className="text-xs text-gray-500 hover:text-white ml-3 flex-shrink-0"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    {/* Location hours input */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Location Hours</label>
                      {locked ? (
                        <p className="text-xs text-gray-300">{fedexLocationHours || "—"}</p>
                      ) : (
                        <input
                          type="text"
                          value={fedexLocationHours}
                          onChange={(e) => setFedexLocationHours(e.target.value)}
                          placeholder="e.g. Mon–Fri 8am–8pm, Sat–Sun 9am–6pm"
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500"
                        />
                      )}
                    </div>
                  </>
                ) : !locked ? (
                  <>
                    {/* ZIP search */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={5}
                          value={fedexSearchZip}
                          onChange={(e) => setFedexSearchZip(e.target.value.replace(/\D/g, ""))}
                          onKeyDown={(e) => e.key === "Enter" && searchFedexLocations()}
                          placeholder="ZIP code to search"
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <button
                        onClick={searchFedexLocations}
                        disabled={isFedexSearching}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded disabled:opacity-50 flex-shrink-0"
                      >
                        {isFedexSearching ? "Searching…" : "Search"}
                      </button>
                    </div>

                    {/* Error */}
                    {fedexSearchError && (
                      <p className="text-xs text-red-400">{fedexSearchError}</p>
                    )}

                    {/* Results */}
                    {fedexResults.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-gray-500">Select a location:</p>
                        {fedexResults.map((loc, i) => (
                          <button
                            key={i}
                            onClick={() => selectFedexLocation(loc)}
                            className="w-full text-left bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-500/40 rounded p-3 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{loc.name}</p>
                                <p className="text-xs text-gray-400">
                                  {loc.address}{loc.city ? `, ${loc.city}` : ""}{loc.state ? `, ${loc.state}` : ""} {loc.zip}
                                </p>
                                {loc.phone && <p className="text-xs text-gray-500">{loc.phone}</p>}
                              </div>
                              <div className="flex flex-col items-end flex-shrink-0">
                                {loc.distance && (
                                  <span className="text-xs text-amber-400">{loc.distance}</span>
                                )}
                                <span className="text-[10px] text-gray-600 mt-0.5">
                                  {loc.locationType === "FEDEX_OFFICE" ? "FedEx Office" : loc.locationType === "SHIP_CENTER" ? "Ship Center" : loc.locationType}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Manual fallback */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Or enter location name manually</label>
                      <Field
                        label=""
                        value={fedexLocation}
                        onChange={(e) => setFedexLocation(e.target.value)}
                        disabled={locked}
                        placeholder="e.g. FedEx Ship Center at Target"
                      />
                    </div>
                  </>
                ) : (
                  /* Locked state — show stored location name */
                  <div className="bg-gray-800/40 border border-gray-700 rounded p-2">
                    <p className="text-xs text-gray-400">{fedexLocation || "—"}</p>
                  </div>
                )}
              </div>
            )}

            {/* Structured delivery address — required for trade execution */}
            <div className="border border-gray-700/50 rounded p-3 space-y-2 mt-2">
              <p className="text-xs text-gray-500 mb-2">
                {deliveryMethod === "fedex_hold"
                  ? "FedEx Hold Location Address (for trade execution)"
                  : "Home Delivery Address"}
              </p>
              <Field
                label="Street Address"
                value={shipToLine1}
                onChange={(e) => setShipToLine1(e.target.value)}
                disabled={locked}
                placeholder="123 Main St"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Field
                    label="City"
                    value={shipToCity}
                    onChange={(e) => setShipToCity(e.target.value)}
                    disabled={locked}
                    placeholder="Wichita"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">State</label>
                  <select
                    value={shipToState}
                    onChange={(e) => setShipToState(e.target.value)}
                    disabled={locked}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white disabled:opacity-60 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Field
                    label="Zip"
                    value={shipToZip}
                    onChange={(e) => setShipToZip(e.target.value)}
                    disabled={locked}
                    placeholder="67201"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Billing Address */}
          <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Billing Address</h2>
            <div className="space-y-2">
              <Field
                label="Street Address"
                value={billingLine1}
                onChange={(e) => setBillingLine1(e.target.value)}
                disabled={locked}
                placeholder="123 Main St"
              />
              <Field
                label="Apt / Suite (optional)"
                value={billingLine2}
                onChange={(e) => setBillingLine2(e.target.value)}
                disabled={locked}
                placeholder="Apt 4B"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <Field
                    label="City"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    disabled={locked}
                    placeholder="Wichita"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">State</label>
                  <select
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                    disabled={locked}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white disabled:opacity-60 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <Field
                    label="Zip"
                    value={billingZip}
                    onChange={(e) => setBillingZip(e.target.value)}
                    disabled={locked}
                    placeholder="67201"
                  />
                </div>
              </div>
            </div>
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

          {/* Lock & Execute */}
          {!locked && (
            <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              {saveError && (
                <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
                  {saveError}
                </div>
              )}

              {isSaving ? (
                <div className="space-y-2">
                  {EXECUTION_STEPS.map((step, i) => {
                    const done    = i < executionStep;
                    const current = i === executionStep;
                    return (
                      <div key={step} className={`flex items-center gap-3 text-sm transition-opacity ${i > executionStep ? "opacity-30" : ""}`}>
                        <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs flex-shrink-0">
                          {done
                            ? <span className="text-green-400">✓</span>
                            : current
                              ? <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                              : <span className="text-gray-700">○</span>
                          }
                        </span>
                        <span className={done ? "text-green-400" : current ? "text-amber-300" : "text-gray-600"}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-3 mb-4 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={termsAcknowledged}
                      onChange={(e) => setTermsAcknowledged(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500 flex-shrink-0"
                    />
                    <span className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                      I confirm this trade was executed verbally on a recorded line and that West Hills Capital's{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms of Service
                      </a>{" "}
                      were provided or referenced in the client's transaction materials.
                    </span>
                  </label>
                  {!termsAcknowledged && (
                    <p className="text-xs text-amber-600 mb-3 text-center">
                      Terms acknowledgment required before execution
                    </p>
                  )}
                  <button
                    onClick={lockDeal}
                    disabled={isSaving || total === 0 || !termsAcknowledged}
                    className="w-full py-3 rounded font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Lock &amp; Execute
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Freezes pricing · places DG order · generates PDF invoice · emails client
                  </p>
                  <div className="border-t border-gray-800 mt-4 pt-4">
                    <button
                      onClick={handlePreviewInvoice}
                      disabled={isGeneratingPreview}
                      className="w-full py-2 rounded text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGeneratingPreview ? "Generating PDF…" : "Preview Invoice PDF"}
                    </button>
                    <p className="text-xs text-gray-600 mt-1.5 text-center">
                      Downloads the invoice using current form data — no trade executed
                    </p>
                  </div>
                </>
              )}
            </section>
          )}

          {locked && (
            <section className={`rounded-lg p-5 ${executionResult ? "bg-green-900/20 border border-green-800/40" : "bg-gray-900 border border-gray-800"}`}>
              <div className="flex items-start gap-3">
                <div className={`text-xl mt-0.5 ${executionResult ? "text-green-400" : "text-amber-400"}`}>✓</div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${executionResult ? "text-green-300" : "text-amber-300"}`}>
                    Deal #{savedDealId} — {executionResult ? "Executed" : "Locked"}
                  </div>
                  {lockedAt && (
                    <div className="text-gray-500 text-xs mt-1">
                      {new Date(lockedAt).toLocaleString()}
                    </div>
                  )}

                  {executionResult && (
                    <div className="mt-3 space-y-1.5 text-xs">
                      {executionResult.invoiceId && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-24 flex-shrink-0">Invoice #</span>
                          <span className="text-white font-mono">{executionResult.invoiceId}</span>
                        </div>
                      )}
                      {executionResult.invoiceUrl && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-24 flex-shrink-0">Drive</span>
                          <a
                            href={executionResult.invoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:underline truncate"
                          >
                            View PDF ↗
                          </a>
                        </div>
                      )}
                      {executionResult.emailSentTo && (
                        <div className="flex gap-2">
                          <span className="text-gray-500 w-24 flex-shrink-0">Email sent</span>
                          <span className="text-green-400">{executionResult.emailSentTo}</span>
                        </div>
                      )}
                      {executionResult.warnings && executionResult.warnings.length > 0 && (
                        <div className="mt-2 text-amber-400 bg-amber-900/20 rounded px-2 py-1.5">
                          <div className="font-medium mb-1">Partial completion:</div>
                          {executionResult.warnings.map((w, i) => (
                            <div key={i}>· {w}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Ops: Payment & Tracking — visible only on locked deals */}
          {locked && savedDealId && (
            <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Ops Actions</h2>

              {opsActionError && (
                <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
                  {opsActionError}
                </div>
              )}

              <div className="space-y-4">
                {/* Payment */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">Payment</div>
                  {paymentReceivedAt ? (
                    <div className="text-xs text-green-400 bg-green-900/20 border border-green-800/30 rounded px-3 py-2">
                      ✓ Payment received — {new Date(paymentReceivedAt).toLocaleString()}
                    </div>
                  ) : (
                    <button
                      onClick={markPaymentReceived}
                      disabled={isMarkingPayment}
                      className="w-full py-2 rounded text-sm font-medium bg-gray-800 hover:bg-green-900/40 border border-gray-700 hover:border-green-700 text-gray-300 hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isMarkingPayment ? "Marking…" : "Mark Payment Received"}
                    </button>
                  )}
                </div>

                {/* Tracking */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">Tracking Number</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="e.g. 7489 3401 0947 2804"
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={saveTrackingNumber}
                      disabled={isSavingTracking || !trackingNumber.trim()}
                      className="px-3 py-1.5 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSavingTracking ? "Saving…" : "Save"}
                    </button>
                  </div>
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
