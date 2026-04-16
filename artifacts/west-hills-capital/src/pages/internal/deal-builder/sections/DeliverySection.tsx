import type { FedExLocationResult } from "../types";
import { US_STATES } from "../utils";
import { Field } from "./shared";

interface Props {
  locked:               boolean;
  deliveryMethod:       "fedex_hold" | "home_delivery";
  setDeliveryMethod:    (m: "fedex_hold" | "home_delivery") => void;
  fedexSearchZip:       string;
  setFedexSearchZip:    (s: string) => void;
  fedexResults:         FedExLocationResult[];
  isFedexSearching:     boolean;
  fedexSearchError:     string | null;
  fedexLocationSelected: boolean;
  setFedexLocationSelected: (b: boolean) => void;
  setFedexResults:      (r: FedExLocationResult[]) => void;
  onSearch:             (zipOverride?: string) => void;
  onSelectLocation:     (loc: FedExLocationResult) => void;
  fedexLocation:        string;
  setFedexLocation:     (s: string) => void;
  fedexLocationHours:   string;
  setFedexLocationHours:(s: string) => void;
  shipToLine1:          string;
  setShipToLine1:       (s: string) => void;
  shipToCity:           string;
  setShipToCity:        (s: string) => void;
  shipToState:          string;
  setShipToState:       (s: string) => void;
  shipToZip:            string;
  setShipToZip:         (s: string) => void;
}

export function DeliverySection({
  locked, deliveryMethod, setDeliveryMethod,
  fedexSearchZip, setFedexSearchZip, fedexResults, isFedexSearching, fedexSearchError,
  fedexLocationSelected, setFedexLocationSelected, setFedexResults,
  onSearch, onSelectLocation,
  fedexLocation, setFedexLocation, fedexLocationHours, setFedexLocationHours,
  shipToLine1, setShipToLine1, shipToCity, setShipToCity,
  shipToState, setShipToState, shipToZip, setShipToZip,
}: Props) {
  const isFedex = deliveryMethod === "fedex_hold";

  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-4">

      {/* Header + method toggle */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery</h2>
        <div className="flex items-center gap-1">
          {/* FedEx Hold — primary */}
          <button
            disabled={locked}
            onClick={() => setDeliveryMethod("fedex_hold")}
            className={[
              "px-3 py-1 rounded text-xs font-medium transition-colors",
              isFedex
                ? "bg-amber-500 text-black"
                : "bg-gray-800 border border-amber-700/40 text-amber-500/60 hover:text-amber-400",
              locked ? "opacity-60 cursor-default" : "",
            ].join(" ")}
          >
            FedEx Hold
          </button>
          {/* Alternate — secondary, subdued */}
          <button
            disabled={locked}
            onClick={() => setDeliveryMethod("home_delivery")}
            className={[
              "px-3 py-1 rounded text-xs font-medium transition-colors",
              !isFedex
                ? "bg-gray-700 text-white"
                : "text-gray-600 hover:text-gray-400",
              locked ? "opacity-60 cursor-default" : "",
            ].join(" ")}
          >
            Alternate Address
          </button>
        </div>
      </div>

      {/* ── FedEx Hold ──────────────────────────────────────────────────── */}
      {isFedex && (
        <div className="space-y-3">
          {fedexLocationSelected && fedexLocation ? (
            <>
              {/* Selected location card */}
              <div className="bg-gray-800/70 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Location type badge + name */}
                    <p className="text-sm font-semibold text-amber-400 leading-snug">{fedexLocation}</p>
                    {shipToLine1 && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {shipToLine1}
                        {shipToCity ? `, ${shipToCity}` : ""}
                        {shipToState ? `, ${shipToState}` : ""}
                        {shipToZip ? ` ${shipToZip}` : ""}
                      </p>
                    )}
                    {/* Hours */}
                    <p className="text-xs text-gray-500 mt-1">
                      {fedexLocationHours || "Hours unavailable"}
                    </p>
                  </div>
                  {!locked && (
                    <button
                      onClick={() => { setFedexLocationSelected(false); setFedexResults([]); }}
                      className="text-xs text-gray-600 hover:text-white flex-shrink-0 mt-0.5"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              {/* Editable hours override */}
              {!locked && (
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Override hours (optional)</label>
                  <input
                    type="text"
                    value={fedexLocationHours}
                    onChange={(e) => setFedexLocationHours(e.target.value)}
                    placeholder="e.g. Mon–Fri 8am–8pm · Sat–Sun 9am–6pm"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 placeholder:text-gray-700 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </>
          ) : !locked ? (
            <>
              {/* ZIP search */}
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={fedexSearchZip}
                  onChange={(e) => setFedexSearchZip(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                  placeholder="ZIP code to search"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => onSearch()}
                  disabled={isFedexSearching}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium rounded disabled:opacity-50 flex-shrink-0"
                >
                  {isFedexSearching ? "Searching…" : "Search"}
                </button>
              </div>

              {fedexSearchError && <p className="text-xs text-red-400">{fedexSearchError}</p>}

              {/* Results list */}
              {fedexResults.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-600">
                    {fedexResults.length} location{fedexResults.length !== 1 ? "s" : ""} — select one:
                  </p>
                  <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5">
                    {fedexResults.map((loc, i) => (
                      <button
                        key={i}
                        onClick={() => onSelectLocation(loc)}
                        className="w-full text-left bg-gray-800 hover:bg-gray-700/80 border border-gray-700 hover:border-amber-500/50 rounded p-3 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{loc.name}</p>
                            <p className="text-xs text-gray-400">
                              {loc.address}{loc.city ? `, ${loc.city}` : ""}{loc.state ? `, ${loc.state}` : ""} {loc.zip}
                            </p>
                            {loc.hours && (
                              <p className="text-[11px] text-gray-600 mt-0.5">{loc.hours}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                            {loc.distance && <span className="text-xs text-amber-400 font-medium">{loc.distance}</span>}
                            <span className="text-[10px] text-gray-600">
                              {loc.locationType === "FEDEX_OFFICE"
                                ? "FedEx Office"
                                : loc.locationType === "FEDEX_SHIP_CENTER" || loc.locationType === "SHIP_CENTER"
                                ? "Ship Center"
                                : loc.locationType}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual name fallback */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">Or enter location manually</label>
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
            <div className="bg-gray-800/40 border border-gray-700 rounded p-2">
              <p className="text-xs text-gray-400">{fedexLocation || "—"}</p>
              {fedexLocationHours && <p className="text-xs text-gray-600 mt-0.5">{fedexLocationHours}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── Alternate Address ───────────────────────────────────────────── */}
      {!isFedex && (
        <div className="space-y-2">
          <Field
            label="Street Address"
            value={shipToLine1}
            onChange={(e) => setShipToLine1(e.target.value)}
            disabled={locked}
            placeholder="123 Main St"
          />
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2">
              <Field label="City" value={shipToCity} onChange={(e) => setShipToCity(e.target.value)} disabled={locked} placeholder="City" />
            </div>
            <div className="col-span-2">
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
            <div className="col-span-1">
              <Field label="ZIP" value={shipToZip} onChange={(e) => setShipToZip(e.target.value)} disabled={locked} placeholder="67201" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
