import { useSearch, useLocation } from "wouter";
import { useInternalAuth } from "../../hooks/useInternalAuth";

import { useDealState }      from "./deal-builder/hooks/useDealState";
import { useSpotPricing }    from "./deal-builder/hooks/useSpotPricing";
import { useFedexSearch }    from "./deal-builder/hooks/useFedexSearch";
import { useDealExecution }  from "./deal-builder/hooks/useDealExecution";
import { useInvoicePreview } from "./deal-builder/hooks/useInvoicePreview";
import { useOpsActions }     from "./deal-builder/hooks/useOpsActions";

import { CustomerSection }  from "./deal-builder/sections/CustomerSection";
import { DealTypeSection }  from "./deal-builder/sections/DealTypeSection";
import { DeliverySection }  from "./deal-builder/sections/DeliverySection";
import { SpotSection }      from "./deal-builder/sections/SpotSection";
import { ProductsTable }    from "./deal-builder/sections/ProductsTable";
import { SummarySection }   from "./deal-builder/sections/SummarySection";
import { ExecutionSection } from "./deal-builder/sections/ExecutionSection";
import { OpsActionsSection }from "./deal-builder/sections/OpsActionsSection";

import { parseNum, parseQty } from "./deal-builder/utils";
import type { Customer }      from "./deal-builder/types";

export default function DealBuilder() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { getAuthHeaders } = useInternalAuth();

  const params            = new URLSearchParams(search);
  const urlLeadId         = params.get("leadId")         ?? "";
  const urlConfirmationId = params.get("confirmationId") ?? "";
  const urlDealId         = params.get("dealId")         ?? "";

  // ── All form state ────────────────────────────────────────────────────────
  const s = useDealState(urlDealId, urlLeadId, urlConfirmationId, getAuthHeaders);

  // ── Computed totals ───────────────────────────────────────────────────────
  const rowTotals = s.rows.map((r) => {
    const qty = parseQty(r.qty);
    const up  = parseNum(r.unitPrice);
    return qty > 0 && up > 0 ? qty * up : 0;
  });
  const subtotal = rowTotals.reduce((a, b) => a + b, 0);
  const goldOz   = s.rows.filter((r) => r.metal === "gold").reduce((a, r) => a + parseQty(r.qty), 0);
  const silverOz = s.rows.filter((r) => r.metal === "silver").reduce((a, r) => a + parseQty(r.qty), 0);
  const shipping = goldOz < 15 && silverOz < 300 ? 25 : 0;
  const total    = subtotal + shipping;

  // ── Action hooks ──────────────────────────────────────────────────────────
  const { getSpotPrice, isFetchingSpot, spotError } = useSpotPricing(
    urlDealId, s.setSpotData, s.setRows,
  );

  const { searchFedexLocations, selectFedexLocation } = useFedexSearch({
    fedexSearchZip:            s.fedexSearchZip,
    deliveryMethod:            s.deliveryMethod,
    fedexLocationSelected:     s.fedexLocationSelected,
    isFedexSearching:          s.isFedexSearching,
    getAuthHeaders,
    setFedexResults:           s.setFedexResults,
    setFedexSearchError:       s.setFedexSearchError,
    setIsFedexSearching:       s.setIsFedexSearching,
    setFedexLocation:          s.setFedexLocation,
    setFedexLocationHours:     s.setFedexLocationHours,
    setFedexLocationSelected:  s.setFedexLocationSelected,
    setShipToLine1:            s.setShipToLine1,
    setShipToCity:             s.setShipToCity,
    setShipToState:            s.setShipToState,
    setShipToZip:              s.setShipToZip,
  });

  const { lockDeal, isSaving, executionStep, saveError } = useDealExecution(
    getAuthHeaders, s, subtotal, shipping, total,
  );

  const { handlePreviewInvoice, isGeneratingPreview } = useInvoicePreview(
    getAuthHeaders, s, subtotal, shipping, total,
  );

  const { markPaymentReceived, saveTrackingNumber, isMarkingPayment, isSavingTracking, opsActionError } =
    useOpsActions(getAuthHeaders, s.savedDealId, s.setPaymentReceivedAt);

  // ── Field helpers ─────────────────────────────────────────────────────────
  const setCust = (field: keyof Customer) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      s.setCustomer((c) => ({ ...c, [field]: e.target.value }));

  const setRow = (i: number, field: "qty" | "unitPrice") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      s.setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
    };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">Deal Builder</h1>
            {s.isLocked && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-900 text-green-300 font-medium">
                LOCKED — Deal #{s.savedDealId}
              </span>
            )}
          </div>
          {s.isLocked && s.lockedAt && (
            <p className="text-sm text-gray-500 mt-1">
              {s.executionResult ? "Executed" : "Locked"} {new Date(s.lockedAt).toLocaleString()} · Deals ledger updated
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

      {s.loadingCustomer && (
        <div className="text-gray-400 text-sm mb-4">Loading customer data…</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left column: identity / setup / logistics ────────────── */}
        <div className="space-y-5">

          {/* Combined Customer + Billing Address */}
          <CustomerSection
            customer={s.customer}
            setCust={setCust}
            locked={s.isLocked}
            deliveryMethod={s.deliveryMethod}
            fedexLocationSelected={s.fedexLocationSelected}
            billingLine1={s.billingLine1}   setBillingLine1={s.setBillingLine1}
            billingLine2={s.billingLine2}   setBillingLine2={s.setBillingLine2}
            billingCity={s.billingCity}     setBillingCity={s.setBillingCity}
            billingState={s.billingState}   setBillingState={s.setBillingState}
            billingZip={s.billingZip}       setBillingZip={s.setBillingZip}
          />

          {/* Deal Type */}
          <DealTypeSection
            dealType={s.dealType}     setDealType={s.setDealType}
            iraType={s.iraType}       setIraType={s.setIraType}
            customer={s.customer}     setCust={setCust}
            locked={s.isLocked}
          />

          {/* Delivery — CASH deals only */}
          {s.dealType === "cash" && (
            <DeliverySection
              locked={s.isLocked}
              deliveryMethod={s.deliveryMethod}     setDeliveryMethod={s.setDeliveryMethod}
              fedexSearchZip={s.fedexSearchZip}     setFedexSearchZip={s.setFedexSearchZip}
              fedexResults={s.fedexResults}
              isFedexSearching={s.isFedexSearching}
              fedexSearchError={s.fedexSearchError}
              fedexLocationSelected={s.fedexLocationSelected}
              setFedexLocationSelected={s.setFedexLocationSelected}
              setFedexResults={s.setFedexResults}
              onSearch={searchFedexLocations}
              onSelectLocation={selectFedexLocation}
              fedexLocation={s.fedexLocation}         setFedexLocation={s.setFedexLocation}
              fedexLocationHours={s.fedexLocationHours} setFedexLocationHours={s.setFedexLocationHours}
              shipToLine1={s.shipToLine1}   setShipToLine1={s.setShipToLine1}
              shipToCity={s.shipToCity}     setShipToCity={s.setShipToCity}
              shipToState={s.shipToState}   setShipToState={s.setShipToState}
              shipToZip={s.shipToZip}       setShipToZip={s.setShipToZip}
            />
          )}

          {/*
           * IRA deals — Depository section placeholder
           * When dealType === "ira", this area will render a depository
           * section once that feature is built. For now, nothing is shown.
           */}

          {/* Notes — bottom of left column */}
          <section className="px-1">
            <h2 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1.5">Notes</h2>
            <textarea
              value={s.notes}
              onChange={(e) => s.setNotes(e.target.value)}
              disabled={s.isLocked}
              rows={2}
              placeholder="Internal notes…"
              className="w-full bg-gray-900/60 border border-gray-800 rounded px-3 py-2 text-xs text-gray-400 placeholder-gray-700 focus:outline-none focus:border-gray-600 disabled:opacity-60 resize-none"
            />
          </section>
        </div>

        {/* ── Right column: pricing / products / execute ───────────── */}
        <div className="space-y-5">
          <SpotSection
            spotData={s.spotData}
            isFetchingSpot={isFetchingSpot}
            spotError={spotError}
            locked={s.isLocked}
            onGetSpot={getSpotPrice}
          />
          <ProductsTable
            rows={s.rows}
            setRow={setRow}
            locked={s.isLocked}
            goldOz={goldOz}
            silverOz={silverOz}
            shipping={shipping}
          />
          {/* Summary + Execution — unified final block */}
          <div className="space-y-1.5">
          <SummarySection
            subtotal={subtotal}
            shipping={shipping}
            total={total}
            goldOz={goldOz}
            silverOz={silverOz}
          />
          <ExecutionSection
            locked={s.isLocked}
            termsAcknowledged={s.termsAcknowledged}
            setTermsAcknowledged={s.setTermsAcknowledged}
            isSaving={isSaving}
            executionStep={executionStep}
            saveError={saveError}
            total={total}
            onLock={lockDeal}
            onPreview={handlePreviewInvoice}
            isGeneratingPreview={isGeneratingPreview}
            savedDealId={s.savedDealId}
            lockedAt={s.lockedAt}
            executionResult={s.executionResult}
          />

          </div>{/* end Summary+Execution block */}

          {s.isLocked && s.savedDealId && (
            <OpsActionsSection
              paymentReceivedAt={s.paymentReceivedAt}
              trackingNumber={s.trackingNumber}
              setTrackingNumber={s.setTrackingNumber}
              isMarkingPayment={isMarkingPayment}
              isSavingTracking={isSavingTracking}
              opsActionError={opsActionError}
              onMarkPayment={markPaymentReceived}
              onSaveTracking={() => saveTrackingNumber(s.trackingNumber)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
