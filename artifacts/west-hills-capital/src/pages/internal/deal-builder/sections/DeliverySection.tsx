import type { FedExLocationResult } from "../types";
import { US_STATES } from "../utils";
import { Field } from "./shared";

interface Props {
  locked:               boolean;
  deliveryMethod:       "fedex_hold" | "home_delivery";
  setDeliveryMethod:    (m: "fedex_hold" | "home_delivery") => void;
  // FedEx search
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
  // Selected location
  fedexLocation:        string;
  setFedexLocation:     (s: string) => void;
  fedexLocationHours:   string;
  setFedexLocationHours:(s: string) => void;
  // Ship-to address
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
  shipToLine1, setShipToLine1, shipToCity, setShipToCity, shipToState, setShipToState, shipToZip, setShipToZip,
}: Props) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Delivery</h2>

      {/* Method toggle */}
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

      {/* FedEx hold picker */}
      {deliveryMethod === "fedex_hold" && (
        <div className="mb-3 space-y-2">
          {fedexLocationSelected && fedexLocation ? (
            <>
              {/* Selected location display */}
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
              {/* Location hours */}
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
                    onKeyDown={(e) => e.key === "Enter" && onSearch()}
                    placeholder="ZIP code to search"
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={() => onSearch()}
                  disabled={isFedexSearching}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded disabled:opacity-50 flex-shrink-0"
                >
                  {isFedexSearching ? "Searching…" : "Search"}
                </button>
              </div>

              {fedexSearchError && <p className="text-xs text-red-400">{fedexSearchError}</p>}

              {fedexResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">Select a location:</p>
                  {fedexResults.map((loc, i) => (
                    <button
                      key={i}
                      onClick={() => onSelectLocation(loc)}
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
                          {loc.distance && <span className="text-xs text-amber-400">{loc.distance}</span>}
                          <span className="text-[10px] text-gray-600 mt-0.5">
                            {loc.locationType === "FEDEX_OFFICE"
                              ? "FedEx Office"
                              : loc.locationType === "SHIP_CENTER"
                              ? "Ship Center"
                              : loc.locationType}
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
            <div className="bg-gray-800/40 border border-gray-700 rounded p-2">
              <p className="text-xs text-gray-400">{fedexLocation || "—"}</p>
            </div>
          )}
        </div>
      )}

      {/* Structured ship-to address */}
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
            <Field label="City" value={shipToCity} onChange={(e) => setShipToCity(e.target.value)} disabled={locked} placeholder="Wichita" />
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
            <Field label="Zip" value={shipToZip} onChange={(e) => setShipToZip(e.target.value)} disabled={locked} placeholder="67201" />
          </div>
        </div>
      </div>
    </section>
  );
}
