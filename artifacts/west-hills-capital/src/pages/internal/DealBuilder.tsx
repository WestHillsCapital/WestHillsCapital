import { useSearch, useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { useInternalAuth } from "../../hooks/useInternalAuth";
import { getCachedOrg } from "../../hooks/useOrgSettings";
import { formatOrgDate } from "../../lib/orgDateFormat";

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
import { FulfillmentSection } from "./deal-builder/sections/FulfillmentSection";
import { DocuFillPackagesSection } from "./deal-builder/sections/DocuFillPackagesSection";
import { DocuFillInterviewPanel } from "./deal-builder/components/DocuFillInterviewPanel";

import { parseNum, parseQty } from "./deal-builder/utils";
import type { Customer }      from "./deal-builder/types";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export default function DealBuilder() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { getAuthHeaders } = useInternalAuth();

  const params            = new URLSearchParams(search);
  const urlLeadId         = params.get("leadId")         ?? "";
  const urlConfirmationId = params.get("confirmationId") ?? "";
  const urlDealId         = params.get("dealId")         ?? "";

  // ── Dry-run detection ─────────────────────────────────────────────────────
  const [isDryRun, setIsDryRun] = useState(false);
  useEffect(() => {
    fetch("/api/healthz")
      .then((r) => r.json())
      .then((d) => { if (d?.dryRun) setIsDryRun(true); })
      .catch(() => {});
  }, []);

  // ── All form state ────────────────────────────────────────────────────────
  const s = useDealState(urlDealId, urlLeadId, urlConfirmationId, getAuthHeaders);

  // ── DocuFill package selection (lifted from DocuFillPackagesSection) ──────
  const [docufillPackageId,        setDocufillPackageId]        = useState("");
  const [docufillTransactionScope, setDocufillTransactionScope] = useState("ira_transfer");

  const handlePackageChange = useCallback((id: string) => setDocufillPackageId(id), []);
  const handleTransactionScopeChange = useCallback((scope: string) => setDocufillTransactionScope(scope), []);

  // ── Restore DocuFill session when reopening a locked deal via URL ─────────
  const [restoredSessionToken, setRestoredSessionToken] = useState<string | null>(null);
  useEffect(() => {
    if (!urlDealId || !s.savedDealId || s.dealType !== "ira" || restoredSessionToken) return;
    fetch(`${API_BASE}/api/internal/docufill/sessions?dealId=${s.savedDealId}`, {
      headers: { ...getAuthHeaders() },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { token?: string }) => {
        if (data.token) setRestoredSessionToken(data.token);
      })
      .catch(() => {});
  }, [urlDealId, s.savedDealId, s.dealType, restoredSessionToken, getAuthHeaders]);

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

  const { lockDeal, isSaving, executionStep, saveError, docufillSessionToken } = useDealExecution(
    getAuthHeaders,
    s,
    subtotal,
    shipping,
    total,
    s.dealType === "ira" && docufillPackageId
      ? { packageId: docufillPackageId, transactionScope: docufillTransactionScope }
      : null,
  );

  const { handlePreviewInvoice, isGeneratingPreview } = useInvoicePreview(
    getAuthHeaders, s, subtotal, shipping, total,
  );

  const {
    markWireReceived,
    resendWireEmail,
    markOrderPaid,
    saveTrackingNumber,
    markDelivered,
    isMarkingWire,
    isResendingWireEmail,
    isMarkingDGPaid,
    isSavingTracking,
    isMarkingDelivered,
    opsActionError,
  } = useOpsActions(
    getAuthHeaders,
    s.savedDealId,
    s.setPaymentReceivedAt,
    s.setWireReceivedAt,
    s.setWireConfirmationEmailSentAt,
    s.setOrderPaidAt,
    s.setShippedAt,
    s.setDeliveredAt,
    s.setShippingNotificationScheduledAt,
  );

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
      {isDryRun && (
        <div className="mb-4 flex items-center gap-2.5 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-2.5 text-sm font-medium">
          <span className="text-base">⚠</span>
          <span><strong>Dry Run Mode</strong> — trades will be simulated. No real Dillon Gage order will be placed. All other systems (database, PDF, Sheets, email) run normally.</span>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-[#0F1C3F]">Deal Builder</h1>
            {s.isLocked && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-900 text-green-300 font-medium whitespace-nowrap">
                LOCKED — Deal #{s.savedDealId}
              </span>
            )}
          </div>
          {s.isLocked && s.lockedAt && (
            <p className="text-sm text-[#8A9BB8] mt-1">
              {s.executionResult ? "Executed" : "Locked"} {formatOrgDate(s.lockedAt, getCachedOrg(), true)}
              {s.executionResult && !s.executionResult.warnings?.length && " · Deals ledger updated"}
              {s.executionResult?.warnings?.length ? ` · ${s.executionResult.warnings.length} warning${s.executionResult.warnings.length > 1 ? "s" : ""} — see below` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => navigate("/internal/prospecting-pipeline")}
            className="text-xs sm:text-sm text-[#6B7A99] hover:text-[#0F1C3F] transition-colors px-2 sm:px-3 py-1.5"
          >
            ← Prospecting Pipeline
          </button>
          <button
            onClick={() => navigate("/internal/scheduled-calls")}
            className="text-xs sm:text-sm text-[#6B7A99] hover:text-[#0F1C3F] transition-colors px-2 sm:px-3 py-1.5"
          >
            Scheduled Calls
          </button>
        </div>
      </div>

      {s.loadingCustomer && (
        <div className="text-[#6B7A99] text-sm mb-4">Loading customer data…</div>
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

          {s.dealType === "ira" && (
            <DocuFillPackagesSection
              customer={s.customer}
              setCustomer={s.setCustomer}
              savedDealId={s.savedDealId}
              locked={s.isLocked}
              getAuthHeaders={getAuthHeaders}
              packageId={docufillPackageId}
              onPackageChange={handlePackageChange}
              transactionScope={docufillTransactionScope}
              onTransactionScopeChange={handleTransactionScopeChange}
            />
          )}

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

          {/* Notes — bottom of left column */}
          <section className="px-1">
            <h2 className="text-xs font-medium text-[#9AAAC0] uppercase tracking-wider mb-1.5">Notes</h2>
            <textarea
              value={s.notes}
              onChange={(e) => s.setNotes(e.target.value)}
              disabled={s.isLocked}
              rows={2}
              placeholder="Internal notes…"
              className="w-full bg-white/60 border border-[#DDD5C4] rounded px-3 py-2 text-xs text-[#6B7A99] placeholder-gray-700 focus:outline-none focus:border-[#D4C9B5] disabled:opacity-60 resize-none"
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
            <FulfillmentSection
              orderPlacedAt={s.lockedAt}
              wireReceivedAt={s.wireReceivedAt}
              orderPaidAt={s.orderPaidAt}
              trackingNumber={s.trackingNumber}
              setTrackingNumber={s.setTrackingNumber}
              shippingNotificationScheduledAt={s.shippingNotificationScheduledAt}
              shippedAt={s.shippedAt}
              deliveredAt={s.deliveredAt}
              isMarkingWire={isMarkingWire}
              isResendingWireEmail={isResendingWireEmail}
              isMarkingDGPaid={isMarkingDGPaid}
              isSavingTracking={isSavingTracking}
              isMarkingDelivered={isMarkingDelivered}
              opsActionError={opsActionError}
              onMarkWireReceived={markWireReceived}
              onResendWireEmail={resendWireEmail}
              onMarkOrderPaid={markOrderPaid}
              onSaveTracking={() => saveTrackingNumber(s.trackingNumber)}
              onMarkDelivered={markDelivered}
              wireConfirmationEmailSentAt={s.wireConfirmationEmailSentAt}
              shippingEmailSentAt={s.shippingEmailSentAt}
              deliveryEmailSentAt={s.deliveryEmailSentAt}
              followUp7dSentAt={s.followUp7dSentAt}
              followUp30dSentAt={s.followUp30dSentAt}
            />
          )}
        </div>
      </div>

      {/* ── IRA Paperwork Interview — appears inline after lock / on reload ── */}
      {(docufillSessionToken ?? restoredSessionToken) && (
        <DocuFillInterviewPanel
          token={(docufillSessionToken ?? restoredSessionToken)!}
          getAuthHeaders={getAuthHeaders}
        />
      )}

    </div>
  );
}
