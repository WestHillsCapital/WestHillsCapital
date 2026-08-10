import { useState, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useProductPrices, type ProductPrice } from "@/hooks/use-pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  ChevronRight,
  MapPin,
  Search,
  AlertCircle,
  Package,
  Loader2,
  ArrowLeft,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FedExLocation {
  locationId?: string;
  name: string;
  address: {
    streetLines?: string[];
    city: string;
    stateOrProvinceCode: string;
    postalCode: string;
  };
  hoursOfOperation?: string;
  distanceInMiles?: number;
}

interface SessionResult {
  interviewUrl: string;
  sessionToken: string;
  confirmationId: string;
}

type CartMap = Record<string, number>; // productId → quantity (0 = not in cart)

// ── Shipping helpers ──────────────────────────────────────────────────────────
const FLAT_FEE       = 25;
const FREE_GOLD_OZ   = 15;
const FREE_SILVER_OZ = 300;

function parseOz(weight: string): number {
  return parseFloat(weight) || 1;
}

function calcShipping(cart: CartMap, products: ProductPrice[]): number {
  let goldOz = 0;
  let silverOz = 0;
  for (const p of products) {
    const qty = cart[p.id] ?? 0;
    if (qty === 0) continue;
    const oz = parseOz(p.weight) * qty;
    if (p.metal === "gold")   goldOz   += oz;
    if (p.metal === "silver") silverOz += oz;
  }
  if (goldOz   >= FREE_GOLD_OZ)   return 0;
  if (silverOz >= FREE_SILVER_OZ) return 0;
  return FLAT_FEE;
}

function cartSubtotal(cart: CartMap, products: ProductPrice[]): number {
  return products.reduce((sum, p) => sum + p.finalPrice * (cart[p.id] ?? 0), 0);
}

function cartItemCount(cart: CartMap): number {
  return Object.values(cart).reduce((s, q) => s + q, 0);
}

function formatUSD(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ["Delivery Policy", "Select Metals", "Pickup Location", "Purchase Agreement"];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center mb-10 gap-0">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const active   = idx === step;
        const complete = idx < step;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-sm font-semibold transition-colors
                ${complete ? "border-primary bg-primary text-primary-foreground" :
                  active   ? "border-primary bg-primary/10 text-primary" :
                             "border-muted text-muted-foreground"}`}>
                {complete ? <CheckCircle2 className="w-4 h-4" /> : idx}
              </div>
              <span className={`text-[11px] font-medium hidden sm:block whitespace-nowrap
                ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 md:w-20 h-0.5 mx-1 mb-4 rounded transition-colors
                ${idx < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Quantity stepper ──────────────────────────────────────────────────────────
function QtyControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-7 h-7 rounded border border-border flex items-center justify-center text-base leading-none hover:bg-muted transition-colors font-medium flex-shrink-0"
      >−</button>
      <input
        type="number"
        min={0}
        max={999}
        value={value}
        onFocus={e => e.target.select()}
        onChange={e => {
          const v = parseInt(e.target.value, 10);
          onChange(isNaN(v) || v < 0 ? 0 : v);
        }}
        className="w-12 text-center text-sm font-semibold tabular-nums border border-border rounded px-1 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded border border-border flex items-center justify-center text-base leading-none hover:bg-muted transition-colors font-medium flex-shrink-0"
      >+</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Buy() {
  usePageMeta({
    title: "Buy Precious Metals | West Hills Capital",
    description: "Lock in your purchase online. Select your metals, review live pricing, sign your purchase agreement, and receive your invoice — no call required.",
    canonical: "https://westhillscapital.com/buy",
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 2 — product selection
  const { data: pricingData, isLoading: loadingProducts } = useProductPrices();
  const products: ProductPrice[] = pricingData?.products ?? [];
  const [cart, setCart] = useState<CartMap>({});

  // Reset cart when products change and are non-empty (first load)
  useEffect(() => {
    if (products.length > 0 && Object.keys(cart).length === 0) {
      const initial: CartMap = {};
      products.forEach(p => { initial[p.id] = 0; });
      setCart(initial);
    }
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  function setQty(id: string, qty: number) {
    setCart(c => ({ ...c, [id]: Math.max(0, qty) }));
  }

  // Step 3 — FedEx location
  const [zip, setZip] = useState("");
  const [searching, setSearching] = useState(false);
  const [locations, setLocations] = useState<FedExLocation[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<FedExLocation | null>(null);

  // Step 4 — Docuplete session
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError]       = useState<string | null>(null);
  const [session, setSession]                 = useState<SessionResult | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Derived cart totals ─────────────────────────────────────────────────────
  const selectedProducts = products.filter(p => (cart[p.id] ?? 0) > 0);
  const subtotal  = cartSubtotal(cart, products);
  const shipping  = selectedProducts.length > 0 ? calcShipping(cart, products) : FLAT_FEE;
  const total     = subtotal + shipping;
  const itemCount = cartItemCount(cart);

  // ── FedEx search ─────────────────────────────────────────────────────────────
  async function searchLocations() {
    const code = zip.replace(/\D/g, "").slice(0, 5);
    if (code.length !== 5) { setLocationError("Please enter a valid 5-digit ZIP code."); return; }
    setSearching(true);
    setLocationError(null);
    setLocations([]);
    setSelectedLocation(null);
    try {
      const res = await fetch(`${API_BASE}/api/buy/fedex-locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      if (!data.locations?.length) {
        setLocationError("No FedEx Staffed Locations found near that ZIP code. Try a nearby city.");
      } else {
        setLocations(data.locations);
      }
    } catch (err: unknown) {
      setLocationError(err instanceof Error ? err.message : "Could not search locations.");
    } finally {
      setSearching(false);
    }
  }

  // ── Create Docuplete session ─────────────────────────────────────────────────
  async function createSession() {
    if (selectedProducts.length === 0 || !selectedLocation) return;
    setCreatingSession(true);
    setSessionError(null);

    const addr   = selectedLocation.address;
    const street = addr.streetLines?.[0] ?? "";

    // Build line-item summary for Docuplete prefill
    const lineItems = selectedProducts.map(p => ({
      name:     p.name,
      qty:      cart[p.id],
      unitOz:   parseOz(p.weight),
      metal:    p.metal,
      unitPrice: p.finalPrice,
      lineTotal: p.finalPrice * (cart[p.id] ?? 0),
    }));

    const orderSummaryText = lineItems
      .map(li => `${li.qty}× ${li.name} @ ${formatUSD(li.unitPrice)} = ${formatUSD(li.lineTotal)}`)
      .join("\n");

    const totalGoldOz   = lineItems.filter(li => li.metal === "gold").reduce((s, li) => s + li.unitOz * (li.qty ?? 0), 0);
    const totalSilverOz = lineItems.filter(li => li.metal === "silver").reduce((s, li) => s + li.unitOz * (li.qty ?? 0), 0);

    const prefill: Record<string, string> = {
      ORDER_SUMMARY:          orderSummaryText,
      TOTAL_TROY_OZ_GOLD:     totalGoldOz.toFixed(3),
      TOTAL_TROY_OZ_SILVER:   totalSilverOz.toFixed(3),
      PRODUCT_SUBTOTAL:       subtotal.toFixed(2),
      SHIPPING_FEE:           shipping.toFixed(2),
      ESTIMATED_TOTAL:        total.toFixed(2),
      FEDEX_LOCATION_NAME:    selectedLocation.name,
      FEDEX_LOCATION_ADDRESS: street,
      FEDEX_LOCATION_CITY:    addr.city,
      FEDEX_LOCATION_STATE:   addr.stateOrProvinceCode,
      FEDEX_LOCATION_ZIP:     addr.postalCode,
    };

    // Individual line items for Docuplete fields (up to 10)
    lineItems.slice(0, 10).forEach((li, i) => {
      const n = i + 1;
      prefill[`LINE_ITEM_${n}_NAME`]  = li.name;
      prefill[`LINE_ITEM_${n}_QTY`]   = String(li.qty);
      prefill[`LINE_ITEM_${n}_PRICE`] = li.unitPrice.toFixed(2);
      prefill[`LINE_ITEM_${n}_TOTAL`] = li.lineTotal.toFixed(2);
    });

    try {
      const res = await fetch(`${API_BASE}/api/buy/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefill }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start session");
      setSession(data as SessionResult);
      setStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : "Could not start your purchase session.");
    } finally {
      setCreatingSession(false);
    }
  }

  function goBack() {
    setStep(s => (s > 1 ? (s - 1) as typeof step : s));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-[calc(100vh-200px)] bg-background pt-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-semibold mb-3">Purchase Without a Call</h1>
          <p className="text-foreground/65 text-lg">
            Select your metals, choose a FedEx pickup location, and sign your purchase agreement online.
            Your invoice with wire instructions arrives by email immediately after signing.
          </p>
        </div>

        <StepBar step={step} />

        {/* ── STEP 1: Delivery policy ─────────────────────────────────────── */}
        {step === 1 && (
          <Card className="p-6 md:p-10 animate-fade-in space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-semibold mb-1">How Your Metals Are Delivered</h2>
              <p className="text-foreground/60 text-sm">Please read before continuing.</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <MapPin className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground mb-1">FedEx Staffed Locations Only</p>
                  <p className="text-sm text-foreground/70">
                    West Hills Capital ships exclusively to FedEx Office or FedEx Ship Center locations —
                    never to residential addresses or unmanned drop boxes. This protects your metals from
                    porch theft and ensures a documented, insured chain of custody. Adult signature is
                    required at pickup.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                <Package className="w-5 h-5 text-foreground/50 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground mb-1">Shipping &amp; Insurance</p>
                  <p className="text-sm text-foreground/70">
                    A flat shipping and insurance fee of <strong>{formatUSD(FLAT_FEE)}</strong> applies to
                    orders under <strong>{FREE_GOLD_OZ} troy oz of gold</strong> or{" "}
                    <strong>{FREE_SILVER_OZ} troy oz of silver</strong>. Orders above those thresholds ship
                    at no additional charge. All shipments are sent FedEx 2-Day, fully insured.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                <AlertCircle className="w-5 h-5 text-foreground/50 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground mb-1">Payment Deadline</p>
                  <p className="text-sm text-foreground/70">
                    When you sign your purchase agreement, West Hills Capital locks your price with our
                    supplier immediately. Funds must be received by <strong>end of next business day</strong>.
                    A cancellation fee of <strong>$125 or actual market loss sustained — whichever is
                    greater</strong> — applies if payment is not received.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="w-full h-12 text-base flex items-center gap-2">
              I Understand — Continue
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Card>
        )}

        {/* ── STEP 2: Product selection ────────────────────────────────────── */}
        {step === 2 && (
          <Card className="p-6 md:p-10 animate-fade-in space-y-8">
            <div>
              <h2 className="text-2xl font-serif font-semibold mb-1">Select Your Metals</h2>
              <p className="text-foreground/60 text-sm">Live pricing — add as many products as you'd like.</p>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12 text-foreground/50 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading live prices…
              </div>
            ) : products.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-foreground/50 gap-3">
                <AlertCircle className="w-5 h-5" />
                <span>Live pricing is temporarily unavailable. Please <a href="tel:8008676768" className="underline font-medium">call us</a> to place your order.</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Product list */}
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {products.map(p => {
                    const qty = cart[p.id] ?? 0;
                    const lineTotal = p.finalPrice * qty;
                    return (
                      <div key={p.id} className={`flex items-center gap-4 px-4 py-4 transition-colors
                        ${qty > 0 ? "bg-primary/5" : "bg-card hover:bg-muted/30"}`}>
                        {/* Coin image */}
                        {p.imageUrl && (
                          <img src={p.imageUrl} alt={p.name}
                            className="w-10 h-10 object-contain flex-shrink-0 rounded-full" />
                        )}
                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{p.name}</span>
                            {qty > 0 && (
                              <span className="text-xs bg-primary/15 text-primary font-medium px-2 py-0.5 rounded-full">
                                {qty} selected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-foreground/50 mt-0.5">{p.weight} · {p.metal.charAt(0).toUpperCase() + p.metal.slice(1)}</p>
                        </div>
                        {/* Price */}
                        <div className="text-right flex-shrink-0 min-w-[80px]">
                          <p className="font-semibold text-foreground">{formatUSD(p.finalPrice)}</p>
                          {qty > 0 && (
                            <p className="text-xs text-foreground/45">{formatUSD(lineTotal)}</p>
                          )}
                        </div>
                        {/* Qty stepper */}
                        <QtyControl value={qty} onChange={v => setQty(p.id, v)} />
                      </div>
                    );
                  })}
                </div>

                {/* Order summary */}
                {itemCount > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                      Order Summary
                    </div>
                    <div className="divide-y divide-border">
                      {selectedProducts.map(p => (
                        <div key={p.id} className="flex justify-between px-4 py-2.5 text-sm">
                          <span className="text-foreground/60">{p.name} × {cart[p.id]}</span>
                          <span className="font-medium">{formatUSD(p.finalPrice * (cart[p.id] ?? 0))}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-foreground/60">
                          Shipping &amp; Insurance
                          {shipping === 0 && <span className="ml-1 text-green-600 font-medium">(included)</span>}
                        </span>
                        <span className="font-medium">{shipping === 0 ? "Included" : formatUSD(shipping)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-3 bg-primary/5">
                        <span className="font-semibold text-foreground">Estimated Total</span>
                        <span className="font-bold text-lg text-foreground">{formatUSD(total)}</span>
                      </div>
                    </div>
                    <p className="px-4 py-2 text-xs text-foreground/40 border-t border-border">
                      Final price confirmed at trade execution after payment clears.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={() => { setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={itemCount === 0}
                className="flex-1 h-12 text-base flex items-center gap-2"
              >
                Continue — Choose Pickup Location
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 3: FedEx location ───────────────────────────────────────── */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <Card className="p-6 md:p-8">
              <h2 className="text-2xl font-serif font-semibold mb-1">Choose Your FedEx Pickup Location</h2>
              <p className="text-foreground/60 text-sm mb-6">
                Enter your ZIP code to find the nearest FedEx Office or Ship Center where your metals will be held for pickup.
              </p>

              <div className="flex gap-3 mb-4">
                <Input
                  placeholder="ZIP code"
                  value={zip}
                  maxLength={5}
                  onChange={e => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  onKeyDown={e => e.key === "Enter" && searchLocations()}
                  className="max-w-[140px]"
                />
                <Button onClick={searchLocations} disabled={searching} className="flex items-center gap-2">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {searching ? "Searching…" : "Search"}
                </Button>
              </div>

              {locationError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{locationError}</p>
                </div>
              )}

              {locations.length > 0 && (
                <div className="space-y-3">
                  {locations.map((loc, i) => {
                    const addr = loc.address;
                    const street = addr.streetLines?.[0] ?? "";
                    const isSelected = selectedLocation === loc;
                    return (
                      <button
                        key={loc.locationId ?? i}
                        type="button"
                        onClick={() => setSelectedLocation(loc)}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all
                          ${isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:border-primary/40 bg-card"}`}
                      >
                        <MapPin className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelected ? "text-primary" : "text-foreground/40"}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{loc.name}</p>
                          <p className="text-sm text-foreground/60">{[street, addr.city, addr.stateOrProvinceCode, addr.postalCode].filter(Boolean).join(", ")}</p>
                          {loc.hoursOfOperation && (
                            <p className="text-xs text-foreground/45 mt-1">{loc.hoursOfOperation}</p>
                          )}
                          {loc.distanceInMiles != null && (
                            <p className="text-xs text-foreground/45 mt-0.5">{loc.distanceInMiles.toFixed(1)} mi away</p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 ml-auto mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {sessionError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Could not start your session</p>
                  <p className="text-red-700 text-sm mt-0.5">{sessionError}</p>
                  <p className="text-red-600 text-sm mt-1">
                    Please call us at{" "}
                    <a href="tel:8008676768" className="font-semibold underline">(800) 867-6768</a>.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={createSession}
                disabled={!selectedLocation || creatingSession}
                className="flex-1 h-12 text-base flex items-center gap-2"
              >
                {creatingSession
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting your session…</>
                  : <>Continue — Review &amp; Sign Agreement <ChevronRight className="w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Docuplete embed ──────────────────────────────────────── */}
        {step === 4 && session && (
          <div className="animate-fade-in space-y-4">
            <Card className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-serif font-semibold">Purchase Agreement</h2>
                  <p className="text-foreground/55 text-sm">
                    Confirmation ID: <strong className="text-foreground">{session.confirmationId}</strong>
                  </p>
                </div>
              </div>

              {/* Order recap before signing */}
              {selectedProducts.length > 0 && selectedLocation && (
                <div className="rounded-lg bg-muted/40 border border-border/50 p-4 mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-foreground/50 text-xs mb-0.5">Items</p>
                      <p className="font-medium text-foreground">{itemCount} unit{itemCount !== 1 ? "s" : ""}</p>
                    </div>
                    <div>
                      <p className="text-foreground/50 text-xs mb-0.5">Estimated Total</p>
                      <p className="font-medium text-foreground">{formatUSD(total)}</p>
                    </div>
                    <div>
                      <p className="text-foreground/50 text-xs mb-0.5">Pickup</p>
                      <p className="font-medium text-foreground truncate">{selectedLocation.name}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-border/50 border-t border-border/50 pt-2">
                    {selectedProducts.map(p => (
                      <p key={p.id} className="text-xs text-foreground/60 py-1">
                        {cart[p.id]}× {p.name} — {formatUSD(p.finalPrice * (cart[p.id] ?? 0))}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-foreground/60 mb-4">
                Complete the form below to sign your Purchase Agreement. Your identity will be verified
                and your agreement generated automatically. You will receive your invoice with wire
                instructions by email immediately after signing.
              </p>
            </Card>

            <div className="rounded-xl overflow-hidden border border-border shadow-sm">
              <iframe
                ref={iframeRef}
                src={`${session.interviewUrl}?embed=1`}
                className="w-full border-0"
                style={{ height: "780px" }}
                allow="camera; microphone"
                title="Purchase Agreement"
              />
            </div>

            <p className="text-center text-xs text-foreground/40">
              Having trouble?{" "}
              <a href="tel:8008676768" className="underline hover:text-foreground">
                Call (800) 867-6768
              </a>{" "}
              and a specialist will assist you.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
