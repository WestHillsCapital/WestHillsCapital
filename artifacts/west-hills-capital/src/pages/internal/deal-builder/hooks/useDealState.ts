import { useState, useEffect } from "react";
import type { Customer, SpotData, ProductRow, ExecutionResult } from "../types";
import { PRODUCT_DEFS, EMPTY_ROWS } from "../utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function useDealState(
  urlDealId: string,
  urlLeadId: string,
  urlConfirmationId: string,
  getAuthHeaders: () => HeadersInit,
) {
  // ── Customer ────────────────────────────────────────────────────────────
  const [customer, setCustomer] = useState<Customer>({
    firstName: "", lastName: "", email: "", phone: "", state: "", zip: "",
    leadId: urlLeadId, confirmationId: urlConfirmationId,
    custodian: "", depository: "", iraAccountNumber: "",
  });
  const [customerLoaded, setCustomerLoaded] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // ── Deal config ─────────────────────────────────────────────────────────
  const [dealType, setDealType] = useState<"cash" | "ira">("cash");
  const [iraType,  setIraType]  = useState("");

  // ── Pricing ─────────────────────────────────────────────────────────────
  const [spotData, setSpotData] = useState<SpotData>({
    goldSpotAsk: null, silverSpotAsk: null, spotTimestamp: null,
  });
  const [rows, setRows] = useState<ProductRow[]>(EMPTY_ROWS);

  // ── Delivery ─────────────────────────────────────────────────────────────
  const [deliveryMethod,     setDeliveryMethod]     = useState<"fedex_hold" | "home_delivery">("fedex_hold");
  const [fedexLocation,      setFedexLocation]      = useState("");
  const [fedexLocationHours, setFedexLocationHours] = useState("");
  const [shipToLine1,        setShipToLine1]        = useState("");
  const [shipToCity,         setShipToCity]         = useState("");
  const [shipToState,        setShipToState]        = useState("");
  const [shipToZip,          setShipToZip]          = useState("");

  // ── FedEx search state ───────────────────────────────────────────────────
  const [fedexSearchZip,       setFedexSearchZip]       = useState("");
  const [fedexResults,         setFedexResults]         = useState<import("../types").FedExLocationResult[]>([]);
  const [isFedexSearching,     setIsFedexSearching]     = useState(false);
  const [fedexSearchError,     setFedexSearchError]     = useState<string | null>(null);
  const [fedexLocationSelected,setFedexLocationSelected]= useState(false);

  // ── Billing address ──────────────────────────────────────────────────────
  const [billingLine1, setBillingLine1] = useState("");
  const [billingLine2, setBillingLine2] = useState("");
  const [billingCity,  setBillingCity]  = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingZip,   setBillingZip]   = useState("");

  // ── Notes ────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");

  // ── Deal status ──────────────────────────────────────────────────────────
  const [isLocked,          setIsLocked]          = useState(false);
  const [lockedAt,          setLockedAt]          = useState<string | null>(null);
  const [savedDealId,       setSavedDealId]       = useState<number | null>(null);
  const [termsAcknowledged, setTermsAcknowledged] = useState(false);
  const [paymentReceivedAt, setPaymentReceivedAt] = useState<string | null>(null); // legacy
  const [trackingNumber,    setTrackingNumber]    = useState("");
  const [executionResult,   setExecutionResult]   = useState<ExecutionResult | null>(null);

  // ── Fulfillment milestone timestamps ─────────────────────────────────────
  const [wireReceivedAt,                   setWireReceivedAt]                   = useState<string | null>(null);
  const [orderPaidAt,                      setOrderPaidAt]                      = useState<string | null>(null);
  const [shippedAt,                        setShippedAt]                        = useState<string | null>(null);
  const [deliveredAt,                      setDeliveredAt]                      = useState<string | null>(null);
  const [shippingNotificationScheduledAt,  setShippingNotificationScheduledAt]  = useState<string | null>(null);

  // ── Email send timestamps ─────────────────────────────────────────────────
  const [wireConfirmationEmailSentAt, setWireConfirmationEmailSentAt] = useState<string | null>(null);
  const [shippingEmailSentAt,  setShippingEmailSentAt]  = useState<string | null>(null);
  const [deliveryEmailSentAt,  setDeliveryEmailSentAt]  = useState<string | null>(null);
  const [followUp7dSentAt,     setFollowUp7dSentAt]     = useState<string | null>(null);
  const [followUp30dSentAt,    setFollowUp30dSentAt]    = useState<string | null>(null);

  // ── Load saved deal ──────────────────────────────────────────────────────
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
          firstName:        deal.first_name         ?? "",
          lastName:         deal.last_name          ?? "",
          email:            deal.email              ?? "",
          phone:            deal.phone              ?? "",
          state:            deal.state              ?? "",
          zip:              "",
          leadId:           deal.lead_id ? String(deal.lead_id) : "",
          confirmationId:   deal.confirmation_id    ?? "",
          custodian:        deal.custodian          ?? "",
          depository:       deal.depository         ?? "",
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
          const p = (deal.products ?? []).find(
            (p: { productId: string }) => p.productId === def.productId
          );
          return { ...def, qty: p ? String(p.qty) : "", unitPrice: p ? String(p.unitPrice) : "" };
        });
        setRows(savedRows);
        setDeliveryMethod(deal.shipping_method === "home_delivery" ? "home_delivery" : "fedex_hold");
        setFedexLocation(deal.fedex_location       ?? "");
        setFedexLocationHours(deal.fedex_location_hours ?? "");
        if (deal.fedex_location) setFedexLocationSelected(true);
        setShipToLine1(deal.ship_to_line1  ?? "");
        setShipToCity(deal.ship_to_city    ?? "");
        setShipToState(deal.ship_to_state  ?? "");
        setShipToZip(deal.ship_to_zip      ?? "");
        setBillingLine1(deal.billing_line1 ?? "");
        setBillingLine2(deal.billing_line2 ?? "");
        setBillingCity(deal.billing_city   ?? "");
        setBillingState(deal.billing_state ?? "");
        setBillingZip(deal.billing_zip     ?? "");
        setNotes(deal.notes ?? "");
        // API normalises execution_warnings → warnings; fall back to the raw
        // column name in case an older API version is running during a deploy.
        const rawWarnings: unknown = deal.warnings ?? deal.execution_warnings;
        const persistedWarnings: string[] | undefined =
          Array.isArray(rawWarnings) && rawWarnings.length > 0
            ? (rawWarnings as string[])
            : undefined;
        if (deal.invoice_id || deal.invoice_url || deal.recap_email_sent_at || persistedWarnings) {
          setExecutionResult({
            invoiceId:   deal.invoice_id   ?? null,
            invoiceUrl:  deal.invoice_url  ?? null,
            emailSentTo: deal.recap_email_sent_at ? deal.email : null,
            warnings:    persistedWarnings,
          });
        }
        setTermsAcknowledged(true);
        setPaymentReceivedAt(deal.payment_received_at ?? null);
        setTrackingNumber(deal.tracking_number ?? "");
        setIsLocked(true);
        setLockedAt(deal.locked_at ?? null);
        setSavedDealId(deal.id);
        // Fulfillment milestones
        setWireReceivedAt(deal.wire_received_at ?? null);
        setOrderPaidAt(deal.order_paid_at ?? null);
        setShippedAt(deal.shipped_at ?? null);
        setDeliveredAt(deal.delivered_at ?? null);
        setShippingNotificationScheduledAt(deal.shipping_notification_scheduled_at ?? null);
        // Email send timestamps
        setWireConfirmationEmailSentAt(deal.wire_confirmation_email_sent_at ?? null);
        setShippingEmailSentAt(deal.shipping_email_sent_at ?? null);
        setDeliveryEmailSentAt(deal.delivery_email_sent_at ?? null);
        setFollowUp7dSentAt(deal.follow_up_7d_sent_at ?? null);
        setFollowUp30dSentAt(deal.follow_up_30d_sent_at ?? null);
        setCustomerLoaded(true);
      } finally {
        setLoadingCustomer(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDealId]);

  // ── Pre-populate from lead ───────────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlLeadId, urlDealId, customerLoaded]);

  // ── Pre-populate from appointment ────────────────────────────────────────
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConfirmationId, urlDealId, customerLoaded]);

  // ── Auto-fill billing state from customer state ──────────────────────────
  useEffect(() => {
    if (customer.state && !billingState && !isLocked) {
      setBillingState(customer.state);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.state]);

  // ── Prime FedEx search zip from customer zip ─────────────────────────────
  useEffect(() => {
    const z = customer.zip.replace(/\D/g, "").slice(0, 5);
    if (z.length === 5 && deliveryMethod === "fedex_hold" && !fedexLocationSelected) {
      setFedexSearchZip(z);
    }
  }, [customer.zip, deliveryMethod, fedexLocationSelected]);

  return {
    // customer
    customer, setCustomer, customerLoaded, loadingCustomer,
    // deal config
    dealType, setDealType, iraType, setIraType,
    // pricing
    spotData, setSpotData, rows, setRows,
    // delivery
    deliveryMethod, setDeliveryMethod,
    fedexLocation, setFedexLocation,
    fedexLocationHours, setFedexLocationHours,
    shipToLine1, setShipToLine1,
    shipToCity, setShipToCity,
    shipToState, setShipToState,
    shipToZip, setShipToZip,
    // fedex search
    fedexSearchZip, setFedexSearchZip,
    fedexResults, setFedexResults,
    isFedexSearching, setIsFedexSearching,
    fedexSearchError, setFedexSearchError,
    fedexLocationSelected, setFedexLocationSelected,
    // billing
    billingLine1, setBillingLine1,
    billingLine2, setBillingLine2,
    billingCity, setBillingCity,
    billingState, setBillingState,
    billingZip, setBillingZip,
    // notes
    notes, setNotes,
    // deal status
    isLocked, setIsLocked,
    lockedAt, setLockedAt,
    savedDealId, setSavedDealId,
    termsAcknowledged, setTermsAcknowledged,
    paymentReceivedAt, setPaymentReceivedAt,
    trackingNumber, setTrackingNumber,
    executionResult, setExecutionResult,
    // fulfillment milestones
    wireReceivedAt, setWireReceivedAt,
    orderPaidAt, setOrderPaidAt,
    shippedAt, setShippedAt,
    deliveredAt, setDeliveredAt,
    shippingNotificationScheduledAt, setShippingNotificationScheduledAt,
    // email send timestamps
    wireConfirmationEmailSentAt, setWireConfirmationEmailSentAt,
    shippingEmailSentAt, setShippingEmailSentAt,
    deliveryEmailSentAt, setDeliveryEmailSentAt,
    followUp7dSentAt, setFollowUp7dSentAt,
    followUp30dSentAt, setFollowUp30dSentAt,
  };
}

export type DealState = ReturnType<typeof useDealState>;
