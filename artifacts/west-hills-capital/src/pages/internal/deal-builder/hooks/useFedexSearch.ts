import { useCallback, useEffect } from "react";
import type { FedExLocationResult } from "../types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface FedexSearchParams {
  fedexSearchZip:         string;
  deliveryMethod:         string;
  fedexLocationSelected:  boolean;
  isFedexSearching:       boolean;
  getAuthHeaders:         () => HeadersInit;
  setFedexResults:        (r: FedExLocationResult[]) => void;
  setFedexSearchError:    (e: string | null) => void;
  setIsFedexSearching:    (b: boolean) => void;
  setFedexLocation:       (s: string) => void;
  setFedexLocationSelected: (b: boolean) => void;
  setShipToLine1:         (s: string) => void;
  setShipToCity:          (s: string) => void;
  setShipToState:         (s: string) => void;
  setShipToZip:           (s: string) => void;
}

export function useFedexSearch({
  fedexSearchZip,
  deliveryMethod,
  fedexLocationSelected,
  isFedexSearching,
  getAuthHeaders,
  setFedexResults,
  setFedexSearchError,
  setIsFedexSearching,
  setFedexLocation,
  setFedexLocationSelected,
  setShipToLine1,
  setShipToCity,
  setShipToState,
  setShipToZip,
}: FedexSearchParams) {
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
  }, [fedexSearchZip, getAuthHeaders, setFedexResults, setFedexSearchError, setIsFedexSearching]);

  const selectFedexLocation = useCallback((loc: FedExLocationResult) => {
    setFedexLocation(loc.name);
    setShipToLine1(loc.address);
    setShipToCity(loc.city);
    setShipToState(loc.state);
    setShipToZip(loc.zip);
    setFedexResults([]);
    setFedexLocationSelected(true);
  }, [setFedexLocation, setShipToLine1, setShipToCity, setShipToState, setShipToZip,
      setFedexResults, setFedexLocationSelected]);

  // Auto-fire search when fedexSearchZip becomes a valid 5-digit code
  useEffect(() => {
    const z = fedexSearchZip.replace(/\D/g, "").slice(0, 5);
    if (z.length !== 5 || deliveryMethod !== "fedex_hold" || fedexLocationSelected || isFedexSearching) return;
    void searchFedexLocations(z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fedexSearchZip]);

  return { searchFedexLocations, selectFedexLocation };
}
