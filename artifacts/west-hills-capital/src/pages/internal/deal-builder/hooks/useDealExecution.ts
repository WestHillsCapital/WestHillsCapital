import { useState, useCallback } from "react";
import type { DealState } from "./useDealState";
import { parseNum, parseQty } from "../utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export const EXECUTION_STEPS = [
  "Saving deal…",
  "Locking DG prices…",
  "Executing trade…",
  "Generating invoice PDF…",
  "Sending client recap email…",
  "Saving to Drive…",
];

interface DocuFillParams {
  packageId: string;
  transactionScope: string;
}

export function useDealExecution(
  getAuthHeaders: () => HeadersInit,
  s: DealState,
  subtotal: number,
  shipping: number,
  total: number,
  docufillParams: DocuFillParams | null = null,
) {
  const [isSaving,              setIsSaving]              = useState(false);
  const [executionStep,         setExecutionStep]         = useState(0);
  const [saveError,             setSaveError]             = useState<string | null>(null);
  const [docufillSessionToken,  setDocufillSessionToken]  = useState<string | null>(null);

  const lockDeal = useCallback(async () => {
    setSaveError(null);

    if (!s.customer.firstName || !s.customer.lastName || !s.customer.email) {
      setSaveError("First name, last name, and email are required.");
      return;
    }

    const activeProducts = s.rows
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

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    [1600, 3200, 5000, 7000, 9500].forEach((ms, i) => {
      stepTimers.push(setTimeout(() => setExecutionStep(i + 1), ms));
    });

    try {
      const res = await fetch(`${API_BASE}/api/deals`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          leadId:             s.customer.leadId ? parseInt(s.customer.leadId) : null,
          confirmationId:     s.customer.confirmationId || null,
          dealType:           s.dealType,
          iraType:            s.dealType === "ira" ? s.iraType || null : null,
          firstName:          s.customer.firstName,
          lastName:           s.customer.lastName,
          email:              s.customer.email,
          phone:              s.customer.phone    || null,
          state:              s.customer.state    || null,
          custodian:          s.dealType === "ira" ? s.customer.custodian        || null : null,
          custodianId:        s.dealType === "ira" ? s.customer.custodianId      || null : null,
          depository:         s.dealType === "ira" ? s.customer.depository       || null : null,
          depositoryId:       s.dealType === "ira" ? s.customer.depositoryId     || null : null,
          iraAccountNumber:   s.dealType === "ira" ? s.customer.iraAccountNumber || null : null,
          goldSpotAsk:        s.spotData.goldSpotAsk,
          silverSpotAsk:      s.spotData.silverSpotAsk,
          spotTimestamp:      s.spotData.spotTimestamp,
          products:           activeProducts,
          subtotal,
          shipping,
          total,
          balanceDue:         total,
          shippingMethod:     s.deliveryMethod,
          fedexLocation:      s.fedexLocation      || null,
          fedexLocationHours: s.fedexLocationHours || null,
          shipToLine1:        s.shipToLine1        || null,
          shipToCity:         s.shipToCity         || null,
          shipToState:        s.shipToState        || null,
          shipToZip:          s.shipToZip          || null,
          billingLine1:       s.billingLine1       || null,
          billingLine2:       s.billingLine2       || null,
          billingCity:        s.billingCity        || null,
          billingState:       s.billingState       || null,
          billingZip:         s.billingZip         || null,
          termsProvided:      true,
          termsVersion:       "v1.0",
          confirmationMethod: "verbal_recorded_call",
          notes:              s.notes              || null,
        }),
      });

      stepTimers.forEach(clearTimeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        throw new Error(err.error ?? "Failed to save deal");
      }

      const data = await res.json();
      const { dealId, lockedAt, invoiceId, invoiceUrl, emailSentTo, warnings } = data;

      s.setIsLocked(true);
      s.setLockedAt(lockedAt ?? new Date().toISOString());
      s.setSavedDealId(dealId);
      s.setExecutionResult({ invoiceId, invoiceUrl, emailSentTo, warnings });

      try {
        window.history.replaceState(null, "", window.location.pathname + `?dealId=${dealId}`);
      } catch { /* ignore — some mobile browsers restrict this */ }

      // ── Auto-create DocuFill session if a package was selected ───────────
      if (docufillParams?.packageId) {
        try {
          const sessionRes = await fetch(`${API_BASE}/api/internal/docufill/sessions`, {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({
              packageId:       Number(docufillParams.packageId),
              transactionScope: docufillParams.transactionScope,
              custodianId:     s.customer.custodianId ? Number(s.customer.custodianId) : null,
              depositoryId:    s.customer.depositoryId ? Number(s.customer.depositoryId) : null,
              dealId,
              source:          "deal_builder",
              prefill: {
                firstName:       s.customer.firstName,
                lastName:        s.customer.lastName,
                email:           s.customer.email,
                phone:           s.customer.phone,
                state:           s.customer.state,
                custodian:       s.customer.custodian,
                custodianId:     s.customer.custodianId,
                depository:      s.customer.depository,
                depositoryId:    s.customer.depositoryId,
                iraAccountNumber: s.customer.iraAccountNumber,
                dealId,
              },
            }),
          });
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            if (sessionData.token) setDocufillSessionToken(sessionData.token);
          }
          // Session creation failure is non-fatal — deal is already locked
        } catch { /* session creation failure is non-fatal */ }
      }

      setTimeout(() => {
        const el = document.getElementById("deal-execution-result");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } catch (err) {
      stepTimers.forEach(clearTimeout);
      setSaveError(err instanceof Error ? err.message : "Failed to lock & execute deal.");
    } finally {
      setIsSaving(false);
      setExecutionStep(0);
    }
  }, [getAuthHeaders, s, subtotal, shipping, total, docufillParams]);

  return { lockDeal, isSaving, executionStep, saveError, docufillSessionToken };
}
