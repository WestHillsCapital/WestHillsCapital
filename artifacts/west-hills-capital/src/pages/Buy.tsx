import { useState, useEffect, useRef } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useProductPrices } from "@/hooks/use-pricing";
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

// ── Shipping helpers ──────────────────────────────────────────────────────────
const FREE_GOLD_OZ   = 15;
const FREE_SILVER_OZ = 300;
const FLAT_FEE       = 35;

function calcShipping(metal: string, totalOz: number): number {
  if (metal === "gold"   && totalOz >= FREE_GOLD_OZ)   return 0;
  if (metal === "silver" && totalOz >= FREE_SILVER_OZ) return 0;
  return FLAT_FEE;
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

// ── Main component ────────────────────────────────────────────────────────────
export default function Buy() {
  usePageMeta({
    title: "Buy Precious Metals | West Hills Capital",
    description: "Lock in your purchase online. Select your metals, review live pricing, sign your purchase agreement, and receive your invoice — no call required.",
    canonical: "https://westhillscapital.com/buy",
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 2 — product selection
  const { data: products, isLoading: loadingProducts } = useProductPrices();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

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

  // Auto-select first product once loaded
  useEffect(() => {
    if (products?.prices?.length && !selectedCode) {
      setSelectedCode(products.prices[0].code);
    }
  }, [products, selectedCode]);

  // ── Derived pricing ─────────────────────────────────────────────────────────
  const selectedProduct = products?.prices?.find(p => p.code === selectedCode);
  const unitPrice   = selectedProduct?.finalPrice ?? 0;
  const unitOz      = selectedProduct?.unitOz ?? 1;
  const metal       = selectedProduct?.metal ?? "gold";
  const totalOz     = unitOz * quantity;
  const subtotal    = unitPrice * quantity;
  const shipping    = selectedProduct ? calcShipping(metal, totalOz) : FLAT_FEE;
  const total       = subtotal + shipping;

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
    if (!selectedProduct || !selectedLocation) return;
    setCreatingSession(true);
    setSessionError(null);

    const addr = selectedLocation.address;
    const street = addr.streetLines?.[0] ?? "";

    const prefill: Record<string, string> = {
      PRODUCT_NAME:           selectedProduct.name,
      QUANTITY:               String(quantity),
      UNIT_WEIGHT:            String(unitOz),
      METAL_TYPE:             metal.charAt(0).toUpperCase() + metal.slice(1),
      TOTAL_TROY_OZ:          totalOz.toFixed(3),
      PER_UNIT_PRICE:         unitPrice.toFixed(2),
      SPOT_PRICE_AT_SUBMISSION: String(unitPrice),
      PRODUCT_SUBTOTAL:       subtotal.toFixed(2),
      SHIPPING_FEE:           shipping.toFixed(2),
      ESTIMATED_TOTAL:        total.toFixed(2),
      FEDEX_LOCATION_NAME:    selectedLocation.name,
      FEDEX_LOCATION_ADDRESS: street,
      FEDEX_LOCATION_CITY:    addr.city,
      FEDEX_LOCATION_STATE:   addr.stateOrProvinceCode,
      FEDEX_LOCATION_ZIP:     addr.postalCode,
    };

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
              <p className="text-foreground/60 text-sm">Live pricing — refreshes every 5 seconds.</p>
            </div>

            {loadingProducts ? (
              <div className="flex items-center justify-center py-12 text-foreground/50 gap-3">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading live prices…
              </div>
            ) : (
              <div className="space-y-6">
                {/* Product picker */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Product</label>
                  <div className="grid grid-cols-1 gap-3">
                    {products?.prices?.map(p => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => setSelectedCode(p.code)}
                        className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all
                          ${selectedCode === p.code
                            ? "border-primary bg-primary/5"
                            : "border-border/60 hover:border-primary/40 bg-card"}`}
                      >
                        <div>
                          <p className="font-semibold text-foreground">{p.name}</p>
                          <p className="text-sm text-foreground/55">{p.unitOz} troy oz · {p.metal.charAt(0).toUpperCase() + p.metal.slice(1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-lg text-foreground">{formatUSD(p.finalPrice)}</p>
                          <p className="text-xs text-foreground/45">per unit</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-xl font-medium hover:bg-muted transition-colors"
                    >−</button>
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center text-lg font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(q => q + 1)}
                      className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-xl font-medium hover:bg-muted transition-colors"
                    >+</button>
                    <span className="text-sm text-foreground/55">{totalOz.toFixed(totalOz % 1 === 0 ? 0 : 3)} troy oz total</span>
                  </div>
                </div>

                {/* Order summary */}
                {selectedProduct && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="bg-muted/40 px-4 py-2 text-xs font-semibold text-foreground/50 uppercase tracking-wider">
                      Order Summary
                    </div>
                    <div className="divide-y divide-border">
                      <div className="flex justify-between px-4 py-3 text-sm">
                        <span className="text-foreground/60">{selectedProduct.name} × {quantity}</span>
                        <span className="font-medium">{formatUSD(subtotal)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-3 text-sm">
                        <span className="text-foreground/60">
                          Shipping &amp; Insurance
                          {shipping === 0 && <span className="ml-1 text-green-600 font-medium">(complimentary)</span>}
                        </span>
                        <span className="font-medium">{shipping === 0 ? "Free" : formatUSD(shipping)}</span>
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
                disabled={!selectedProduct || quantity < 1}
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
              {selectedProduct && selectedLocation && (
                <div className="rounded-lg bg-muted/40 border border-border/50 p-4 mb-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-foreground/50 text-xs mb-0.5">Product</p>
                    <p className="font-medium text-foreground">{selectedProduct.name}</p>
                  </div>
                  <div>
                    <p className="text-foreground/50 text-xs mb-0.5">Quantity</p>
                    <p className="font-medium text-foreground">{quantity}</p>
                  </div>
                  <div>
                    <p className="text-foreground/50 text-xs mb-0.5">Total</p>
                    <p className="font-medium text-foreground">{formatUSD(total)}</p>
                  </div>
                  <div>
                    <p className="text-foreground/50 text-xs mb-0.5">Pickup</p>
                    <p className="font-medium text-foreground truncate">{selectedLocation.name}</p>
                  </div>
                </div>
              )}

              <p className="text-sm text-foreground/60 mb-4">
                Complete the form below to sign your Purchase Agreement.
                Your identity will be verified and your agreement generated automatically.
                You will receive your invoice with wire instructions by email immediately after signing.
              </p>
            </Card>

            {/* Docuplete iframe — fills the rest of the viewport */}
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
              </a>
              {" "}and a specialist will assist you.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
