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
  name:         string;
  locationType: string;
  address:      string;
  city:         string;
  state:        string;
  zip:          string;
  distance:     string;
  phone:        string;
  hours:        string;
}

interface SessionResult {
  confirmationId: string;
  sentTo: string;
}

interface CustomerInfo {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  street:    string;
  city:      string;
  state:     string;
  zip:       string;
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

  // Step 4 — customer info + signing
  const [customer, setCustomer] = useState<CustomerInfo>({
    firstName: "", lastName: "", email: "", phone: "",
    street: "", city: "", state: "", zip: "",
  });
  const [step4View, setStep4View]             = useState<"form" | "review" | "sent">("form");
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionError, setSessionError]       = useState<string | null>(null);
  const [session, setSession]                 = useState<SessionResult | null>(null);

  // ── Scroll to top on every step / sub-view change ──────────────────────────
  const stepTopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stepTopRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [step, step4View]);

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

  // ── Build order prefill ───────────────────────────────────────────────────────
  function buildPrefill() {
    const lineItems = selectedProducts.map(p => ({
      name:      p.name,
      qty:       cart[p.id] ?? 0,
      unitOz:    parseOz(p.weight),
      metal:     p.metal,
      unitPrice: p.finalPrice,
      lineTotal: p.finalPrice * (cart[p.id] ?? 0),
    }));
    const orderSummaryText = lineItems
      .map(li => `${li.qty}× ${li.name} @ ${formatUSD(li.unitPrice)} = ${formatUSD(li.lineTotal)}`)
      .join("\n");
    const totalGoldOz   = lineItems.filter(li => li.metal === "gold").reduce((s, li) => s + li.unitOz * li.qty, 0);
    const totalSilverOz = lineItems.filter(li => li.metal === "silver").reduce((s, li) => s + li.unitOz * li.qty, 0);
    const prefill: Record<string, string> = {
      ORDER_SUMMARY:          orderSummaryText,
      TOTAL_TROY_OZ_GOLD:     totalGoldOz.toFixed(3),
      TOTAL_TROY_OZ_SILVER:   totalSilverOz.toFixed(3),
      PRODUCT_SUBTOTAL:       subtotal.toFixed(2),
      SHIPPING_FEE:           shipping.toFixed(2),
      ESTIMATED_TOTAL:        total.toFixed(2),
      FEDEX_LOCATION_NAME:    selectedLocation?.name ?? "",
      FEDEX_LOCATION_ADDRESS: selectedLocation?.address ?? "",
      FEDEX_LOCATION_CITY:    selectedLocation?.city ?? "",
      FEDEX_LOCATION_STATE:   selectedLocation?.state ?? "",
      FEDEX_LOCATION_ZIP:     selectedLocation?.zip ?? "",
    };
    lineItems.slice(0, 10).forEach((li, i) => {
      const n = i + 1;
      prefill[`LINE_ITEM_${n}_NAME`]  = li.name;
      prefill[`LINE_ITEM_${n}_QTY`]   = String(li.qty);
      prefill[`LINE_ITEM_${n}_PRICE`] = li.unitPrice.toFixed(2);
      prefill[`LINE_ITEM_${n}_TOTAL`] = li.lineTotal.toFixed(2);
    });
    return prefill;
  }

  // ── Send agreement (step 4 → sent) ───────────────────────────────────────────
  async function sendAgreement() {
    if (!customer.email || !customer.firstName) return;
    setCreatingSession(true);
    setSessionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/buy/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefill: buildPrefill(), customer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send agreement");
      setSession(data as SessionResult);
      setStep4View("sent");
    } catch (err: unknown) {
      setSessionError(err instanceof Error ? err.message : "Could not send your agreement.");
    } finally {
      setCreatingSession(false);
    }
  }

  function goBack() {
    setStep(s => (s > 1 ? (s - 1) as typeof step : s));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div ref={stepTopRef} className="w-full min-h-[calc(100vh-200px)] bg-background pt-12 pb-24 overflow-x-hidden">
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

            <Button onClick={() => setStep(2)}
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
                      <div key={p.id} className={`px-4 py-4 transition-colors
                        ${qty > 0 ? "bg-primary/5" : "bg-card hover:bg-muted/30"}`}>
                        {/* Row 1: image + name + [sm: price] + qty stepper */}
                        <div className="flex items-center gap-3">
                          {/* Coin image */}
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt={p.name}
                              className="w-10 h-10 object-contain flex-shrink-0 rounded-full" />
                          )}
                          {/* Name + metal/weight */}
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-foreground text-sm leading-snug">{p.name}</span>
                            <p className="text-xs text-foreground/50 mt-0.5">{p.weight} · {p.metal.charAt(0).toUpperCase() + p.metal.slice(1)}</p>
                          </div>
                          {/* Price — visible only on sm+ next to the stepper */}
                          <div className="hidden sm:block text-right flex-shrink-0 min-w-[80px]">
                            <p className="font-semibold text-foreground">{formatUSD(p.finalPrice)}</p>
                            {qty > 0 && <p className="text-xs text-foreground/45">{formatUSD(lineTotal)}</p>}
                          </div>
                          {/* Qty stepper */}
                          <QtyControl value={qty} onChange={v => setQty(p.id, v)} />
                        </div>
                        {/* Row 2 (mobile only): price below, indented to align with name */}
                        <div className="sm:hidden flex items-baseline justify-between mt-2 pl-[52px]">
                          <span className="text-sm font-semibold text-foreground">
                            {formatUSD(p.finalPrice)}
                            <span className="text-xs font-normal text-foreground/50 ml-1">each</span>
                          </span>
                          {qty > 0 && (
                            <span className="text-xs text-foreground/50 font-medium">{formatUSD(lineTotal)} total</span>
                          )}
                        </div>
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
                        <div key={p.id} className="flex justify-between gap-2 px-4 py-2.5 text-sm">
                          <span className="text-foreground/60 min-w-0 flex-1">{p.name} × {cart[p.id]}</span>
                          <span className="font-medium flex-shrink-0 pl-2">{formatUSD(p.finalPrice * (cart[p.id] ?? 0))}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-foreground/60">
                          Shipping &amp; Insurance
                          {shipping === 0 && <span className="ml-1 text-green-600 font-medium">(included)</span>}
                        </span>
                        <span className="font-medium">{shipping === 0 ? "$0" : formatUSD(shipping)}</span>
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
                onClick={() => setStep(3)}
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
                    const isSelected = selectedLocation === loc;
                    const fullAddress = [loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", ");
                    return (
                      <button
                        key={`${loc.name}-${i}`}
                        type="button"
                        onClick={() => setSelectedLocation(loc)}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all
                          ${isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:border-primary/40 bg-card"}`}
                      >
                        <MapPin className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isSelected ? "text-primary" : "text-foreground/40"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-foreground">{loc.name}</p>
                            {loc.distance && (
                              <span className="text-xs text-foreground/45 whitespace-nowrap flex-shrink-0">{loc.distance}</span>
                            )}
                          </div>
                          {fullAddress && (
                            <p className="text-sm text-foreground/60 mt-0.5">{fullAddress}</p>
                          )}
                          {loc.phone && (
                            <p className="text-xs text-foreground/50 mt-1">{loc.phone}</p>
                          )}
                          {loc.hours && (
                            <p className="text-xs text-foreground/45 mt-0.5 leading-relaxed">{loc.hours}</p>
                          )}
                        </div>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />}
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
                onClick={() => { setStep(4); setStep4View("form"); }}
                disabled={!selectedLocation}
                className="flex-1 h-12 text-base flex items-center gap-2"
              >
                Continue — Your Information
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4a: Customer info form ──────────────────────────────────── */}
        {step === 4 && step4View === "form" && (
          <Card className="p-6 md:p-10 animate-fade-in space-y-6">
            <div>
              <h2 className="text-2xl font-serif font-semibold mb-1">Your Information</h2>
              <p className="text-foreground/60 text-sm">
                This appears on your Purchase Agreement. Please enter your legal name and mailing address.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">First Name</label>
                  <Input value={customer.firstName} onChange={e => setCustomer(c => ({ ...c, firstName: e.target.value }))} placeholder="Jane" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input value={customer.lastName} onChange={e => setCustomer(c => ({ ...c, lastName: e.target.value }))} placeholder="Smith" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={customer.email} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} placeholder="jane@example.com" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone</label>
                  <Input type="tel" value={customer.phone} onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Street Address</label>
                <Input value={customer.street} onChange={e => setCustomer(c => ({ ...c, street: e.target.value }))} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium">City</label>
                  <Input value={customer.city} onChange={e => setCustomer(c => ({ ...c, city: e.target.value }))} placeholder="Los Angeles" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">State</label>
                  <Input value={customer.state} onChange={e => setCustomer(c => ({ ...c, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="CA" maxLength={2} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">ZIP</label>
                  <Input value={customer.zip} onChange={e => setCustomer(c => ({ ...c, zip: e.target.value.replace(/\D/g, "").slice(0, 5) }))} placeholder="90210" maxLength={5} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={() => setStep4View("review")}
                disabled={!customer.firstName || !customer.lastName || !customer.email}
                className="flex-1 h-12 text-base flex items-center gap-2"
              >
                Review My Agreement
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ── STEP 4b: PA review ───────────────────────────────────────────── */}
        {step === 4 && step4View === "review" && (
          <div className="animate-fade-in space-y-6">
            <Card className="p-6 md:p-10">
              <h2 className="text-2xl font-serif font-semibold mb-1">Purchase Agreement</h2>
              <p className="text-foreground/60 text-sm mb-6">
                Review the agreement below. When ready, click <strong>Send for Signature</strong> — we'll
                email you a secure link to verify your identity and sign.
              </p>

              {/* Agreement document */}
              <div className="rounded-xl border border-border bg-white text-foreground text-sm leading-relaxed p-6 md:p-10 space-y-5 font-serif">
                <div className="text-center border-b border-border pb-5">
                  <p className="text-lg font-bold tracking-wide uppercase">Purchase Agreement</p>
                  <p className="text-foreground/50 text-xs mt-1">West Hills Capital LLC</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-foreground/60 border-b border-border pb-4">
                  <span>Date: <strong className="text-foreground">{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</strong></span>
                  <span className="text-right">ID: <strong className="text-foreground">Assigned on signing</strong></span>
                </div>

                <p>
                  This Purchase Agreement ("<strong>Agreement</strong>") is entered into between{" "}
                  <strong>West Hills Capital LLC</strong> ("<strong>Dealer</strong>") and{" "}
                  <strong>{customer.firstName} {customer.lastName}</strong> ("<strong>Buyer</strong>"),
                  located at {customer.street}, {customer.city}, {customer.state} {customer.zip}.
                </p>

                <div>
                  <p className="font-bold mb-2">1. Purchase</p>
                  <p>Buyer agrees to purchase the following from Dealer:</p>
                  <div className="mt-2 border border-border rounded-lg overflow-hidden">
                    {selectedProducts.map(p => (
                      <div key={p.id} className="flex justify-between px-4 py-2 text-xs">
                        <span>{cart[p.id]}× {p.name}</span>
                        <span className="font-semibold">{formatUSD(p.finalPrice * (cart[p.id] ?? 0))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2 text-xs">
                      <span>Shipping &amp; Insurance</span>
                      <span className="font-semibold">{shipping === 0 ? "$0" : formatUSD(shipping)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5 text-sm font-bold">
                      <span>Estimated Total</span>
                      <span>{formatUSD(total)}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-foreground/60">
                    Metals will be shipped via FedEx 2-Day, fully insured, to:
                  </p>
                  {selectedLocation && (
                    <p className="text-xs font-semibold mt-1">
                      {selectedLocation.name} — {selectedLocation.address}, {selectedLocation.city}, {selectedLocation.state} {selectedLocation.zip}
                    </p>
                  )}
                  <p className="text-xs text-foreground/60 mt-1">Adult signature required at pickup.</p>
                </div>

                <div>
                  <p className="font-bold mb-2">2. Payment</p>
                  <p>
                    Payment must be received by wire transfer no later than the <strong>end of the next
                    business day</strong> following execution of this Agreement. Wire instructions will be
                    included in your invoice, delivered by email upon completion of signing.
                  </p>
                </div>

                <div>
                  <p className="font-bold mb-2">3. Cancellation Fee</p>
                  <p>
                    If payment is not received by the deadline, West Hills Capital reserves the right to
                    cancel this order and charge a fee equal to the <strong>greater of $125.00 or the
                    actual market loss</strong> sustained by West Hills Capital as a result of executing
                    and unwinding the corresponding trade with its supplier.
                  </p>
                </div>

                <div>
                  <p className="font-bold mb-2">4. Price</p>
                  <p>
                    The estimated total above reflects live market pricing at the time of this Agreement.
                    Final price is confirmed at trade execution, which occurs upon confirmed receipt of
                    cleared funds. Prices may vary slightly at execution.
                  </p>
                </div>

                <div>
                  <p className="font-bold mb-2">5. Terms</p>
                  <p>
                    This Agreement is subject to West Hills Capital's{" "}
                    <a href="/terms" target="_blank" className="underline text-primary">Terms of Service</a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" className="underline text-primary">Privacy Policy</a>.
                  </p>
                </div>

                <div className="border-t border-border pt-4 text-xs text-foreground/50">
                  By clicking <em>Send for Signature</em>, Buyer acknowledges they have read and agree
                  to this Agreement. Electronic signature will be collected via a secure link sent to{" "}
                  <strong className="text-foreground">{customer.email}</strong>.
                </div>
              </div>
            </Card>

            {sessionError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Could not send your agreement</p>
                  <p className="text-red-700 text-sm mt-0.5">{sessionError}</p>
                  <p className="text-red-600 text-sm mt-1">
                    Please call{" "}
                    <a href="tel:8008676768" className="font-semibold underline">(800) 867-6768</a>.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep4View("form")} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Edit Info
              </Button>
              <Button
                onClick={sendAgreement}
                disabled={creatingSession}
                className="flex-1 h-12 text-base flex items-center gap-2"
              >
                {creatingSession
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : <>Send for Signature <ChevronRight className="w-4 h-4" /></>}
              </Button>
            </div>

            <p className="text-center text-xs text-foreground/40">
              Having trouble?{" "}
              <a href="tel:8008676768" className="underline hover:text-foreground">Call (800) 867-6768</a>{" "}
              and a specialist will assist you.
            </p>
          </div>
        )}

        {/* ── STEP 4c: Sent confirmation ───────────────────────────────────── */}
        {step === 4 && step4View === "sent" && session && (
          <div className="animate-fade-in">
            <Card className="p-8 md:p-12 text-center space-y-5">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-serif font-semibold mb-2">Check Your Inbox</h2>
                <p className="text-foreground/60">
                  We've sent your Purchase Agreement to{" "}
                  <strong className="text-foreground">{session.sentTo}</strong>.
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 border border-border p-5 text-sm text-left space-y-2 max-w-md mx-auto">
                <p className="font-semibold text-foreground mb-1">What happens next</p>
                <p className="text-foreground/65">1. Open the email from West Hills Capital and click the signing link.</p>
                <p className="text-foreground/65">2. Verify your identity — a one-time code will be sent to you.</p>
                <p className="text-foreground/65">3. Review and sign the Purchase Agreement.</p>
                <p className="text-foreground/65">4. Your invoice with wire instructions arrives by email immediately after signing.</p>
                <p className="text-foreground/65">5. Wire funds by end of next business day to lock your price.</p>
              </div>
              <p className="text-xs text-foreground/45">
                Confirmation ID: <strong className="text-foreground">{session.confirmationId}</strong>
              </p>
              <p className="text-xs text-foreground/40 pt-2">
                Questions?{" "}
                <a href="tel:8008676768" className="underline hover:text-foreground">(800) 867-6768</a>
              </p>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
