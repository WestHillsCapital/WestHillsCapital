import { logger }           from "./logger";
import { nextBusinessDayFrom } from "./date-utils";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL =
  process.env.FROM_EMAIL ?? "West Hills Capital <noreply@westhillscapital.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

const ALLOCATION_LABELS: Record<string, string> = {
  physical_delivery: "Physical Home/Vault Delivery",
  ira_rollover: "IRA Rollover / Transfer",
  not_sure: "Not sure yet",
};

const RANGE_LABELS: Record<string, string> = {
  under_50k: "Under $50,000",
  "50k_150k": "$50,000 – $150,000",
  "150k_500k": "$150,000 – $500,000",
  "500k_plus": "$500,000+",
};

const TIMELINE_LABELS: Record<string, string> = {
  ready: "Ready to move forward now",
  within_30_days: "Planning within next 30 days",
  researching: "Just researching options",
};

interface EmailAttachment {
  filename: string;
  content:  string;  // base64-encoded
  contentType?: string;
}

interface SendEmailOptions {
  to:           string;
  subject:      string;
  html:         string;
  attachments?: EmailAttachment[];
}

async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    const msg = `[Email] RESEND_API_KEY not configured — ${opts.subject} not sent`;
    logger.warn({ subject: opts.subject, to: opts.to }, msg);
    throw new Error(msg);
  }
  if (!opts.to) {
    const msg = `[Email] No recipient — ${opts.subject} not sent`;
    logger.warn({ subject: opts.subject }, msg);
    throw new Error(msg);
  }

  const payload: Record<string, unknown> = {
    from:    FROM_EMAIL,
    to:      [opts.to],
    subject: opts.subject,
    html:    opts.html,
  };
  if (opts.attachments?.length) {
    payload.attachments = opts.attachments;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, "[Email] Send failed");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
  logger.info({ subject: opts.subject, to: opts.to }, "[Email] Sent");
}

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toCalendarUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildBookingCalendarEvent(params: {
  confirmationId: string;
  firstName: string;
  scheduledTime: string;
  dayLabel: string;
  timeLabel: string;
  phone: string;
}): { attachment: EmailAttachment; googleCalendarUrl: string } {
  const slotStart = new Date(params.scheduledTime);
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
  const title = "West Hills Capital Consultation";
  const location = "West Hills Capital will call you";
  const description = [
    `West Hills Capital consultation for ${params.firstName}.`,
    `Confirmation ID: ${params.confirmationId}`,
    `Appointment: ${params.dayLabel} at ${params.timeLabel}`,
    `We will call you at: ${params.phone}`,
    `West Hills Capital phone: (800) 867-6768`,
    "",
    "This is a consultation only. No obligation or commitment is required.",
  ].join("\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//West Hills Capital//Booking Confirmation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:whc-booking-${escapeCalendarText(params.confirmationId)}@westhillscapital.com`,
    `DTSTAMP:${toCalendarUtc(new Date())}`,
    `DTSTART:${toCalendarUtc(slotStart)}`,
    `DTEND:${toCalendarUtc(slotEnd)}`,
    `SUMMARY:${escapeCalendarText(title)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:West Hills Capital consultation begins in 15 minutes",
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const googleParams = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toCalendarUtc(slotStart)}/${toCalendarUtc(slotEnd)}`,
    details: description,
    location,
  });

  return {
    attachment: {
      filename: `west-hills-capital-consultation-${params.confirmationId}.ics`,
      content: Buffer.from(ics, "utf8").toString("base64"),
      contentType: "text/calendar; charset=utf-8; method=PUBLISH",
    },
    googleCalendarUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
  };
}

// ── Owner notification ────────────────────────────────────────────────────────

export async function sendBookingNotification(params: {
  confirmationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  state: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
  dayLabel: string;
  timeLabel: string;
}): Promise<void> {
  if (!ADMIN_EMAIL) {
    logger.warn("[Email] ADMIN_EMAIL not set — owner notification skipped");
    return;
  }

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New Booking: ${params.firstName} ${params.lastName} — ${params.dayLabel} ${params.timeLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="margin-top:0;color:#1a1a1a;">New Allocation Call Booked</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:160px;">Confirmation ID</td><td style="padding:6px 0;font-weight:600;">${params.confirmationId}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Appointment</td><td style="padding:6px 0;font-weight:600;">${params.dayLabel} at ${params.timeLabel}</td></tr>
          <tr><td colspan="2" style="padding:8px 0 4px;"><hr style="border:none;border-top:1px solid #e5e7eb;"></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Name</td><td style="padding:6px 0;">${params.firstName} ${params.lastName}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;"><a href="mailto:${params.email}">${params.email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="padding:6px 0;"><a href="tel:${params.phone}">${params.phone}</a></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">State</td><td style="padding:6px 0;">${params.state}</td></tr>
          <tr><td colspan="2" style="padding:8px 0 4px;"><hr style="border:none;border-top:1px solid #e5e7eb;"></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Structure</td><td style="padding:6px 0;">${ALLOCATION_LABELS[params.allocationType] ?? params.allocationType}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Allocation</td><td style="padding:6px 0;">${RANGE_LABELS[params.allocationRange] ?? params.allocationRange}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Timeline</td><td style="padding:6px 0;">${TIMELINE_LABELS[params.timeline] ?? params.timeline}</td></tr>
        </table>
      </div>
    `,
  });
}

// ── Deal-lock admin notification ──────────────────────────────────────────────

export async function sendDealLockNotification(params: {
  dealId:         number;
  dealType:       string;
  firstName:      string;
  lastName:       string;
  email:          string;
  phone?:         string | null;
  state?:         string | null;
  total:          number;
  products:       { productName: string; qty: number; unitPrice: number; lineTotal: number }[];
  goldSpotAsk?:   number | null;
  silverSpotAsk?: number | null;
  lockedAt:       string;
  confirmationId?: string | null;
}): Promise<void> {
  if (!ADMIN_EMAIL) {
    logger.warn("[Email] ADMIN_EMAIL not set — deal-lock notification skipped");
    return;
  }

  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const productRows = params.products
    .map(
      (p) =>
        `<tr>
           <td style="padding:5px 8px;color:#374151;">${p.productName}</td>
           <td style="padding:5px 8px;text-align:center;">${p.qty}</td>
           <td style="padding:5px 8px;text-align:right;">${usd(p.unitPrice)}</td>
           <td style="padding:5px 8px;text-align:right;font-weight:600;">${usd(p.lineTotal)}</td>
         </tr>`,
    )
    .join("");

  const dealTypeLabel = params.dealType === "ira" ? "IRA / Retirement" : "Cash / Direct";
  const lockedDate    = new Date(params.lockedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone:  "America/Los_Angeles",
  });

  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `Deal Locked — ${params.firstName} ${params.lastName} · ${usd(params.total)}`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="margin-top:0;color:#1a1a1a;">Deal Locked</h2>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:14px;color:#15803d;">
            <strong>Deal #${params.dealId}</strong> &nbsp;·&nbsp; ${dealTypeLabel} &nbsp;·&nbsp; Locked ${lockedDate} PT
          </p>
        </div>

        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px;">
          <tr><td style="padding:5px 0;color:#6b7280;width:160px;">Client</td>
              <td style="padding:5px 0;font-weight:600;">${params.firstName} ${params.lastName}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">Email</td>
              <td style="padding:5px 0;"><a href="mailto:${params.email}">${params.email}</a></td></tr>
          ${params.phone ? `<tr><td style="padding:5px 0;color:#6b7280;">Phone</td><td style="padding:5px 0;"><a href="tel:${params.phone}">${params.phone}</a></td></tr>` : ""}
          ${params.state ? `<tr><td style="padding:5px 0;color:#6b7280;">State</td><td style="padding:5px 0;">${params.state}</td></tr>` : ""}
          ${params.confirmationId ? `<tr><td style="padding:5px 0;color:#6b7280;">Conf. ID</td><td style="padding:5px 0;font-family:monospace;font-size:12px;">${params.confirmationId}</td></tr>` : ""}
        </table>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 8px;text-align:left;color:#6b7280;font-weight:500;">Product</th>
              <th style="padding:6px 8px;text-align:center;color:#6b7280;font-weight:500;">Qty</th>
              <th style="padding:6px 8px;text-align:right;color:#6b7280;font-weight:500;">Unit</th>
              <th style="padding:6px 8px;text-align:right;color:#6b7280;font-weight:500;">Total</th>
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
          <tfoot>
            <tr style="border-top:2px solid #e5e7eb;">
              <td colspan="3" style="padding:8px 8px;text-align:right;font-weight:600;color:#1a1a1a;">Deal Total</td>
              <td style="padding:8px 8px;text-align:right;font-weight:700;font-size:16px;color:#1a1a1a;">${usd(params.total)}</td>
            </tr>
          </tfoot>
        </table>

        ${
          params.goldSpotAsk || params.silverSpotAsk
            ? `<p style="margin-top:16px;font-size:12px;color:#9ca3af;">
                Spot at lock:
                ${params.goldSpotAsk ? `Gold ask ${usd(params.goldSpotAsk)}` : ""}
                ${params.goldSpotAsk && params.silverSpotAsk ? " &nbsp;·&nbsp; " : ""}
                ${params.silverSpotAsk ? `Silver ask ${usd(params.silverSpotAsk)}` : ""}
               </p>`
            : ""
        }

        <p style="font-size:12px;color:#9ca3af;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px;">
          West Hills Capital &nbsp;|&nbsp; (800) 867-6768
        </p>
      </div>
    `,
  });
}

// ── Deal recap — client-facing invoice email ──────────────────────────────────

export async function sendDealRecapEmail(
  deal: {
    id:                  number;
    firstName:           string;
    lastName:            string;
    email:               string;
    products:            { productName: string; qty: number; unitPrice: number; lineTotal: number }[];
    subtotal:            number;
    shipping:            number;
    total:               number;
    invoiceId?:          string;
    lockedAt:            string;
    goldSpotAsk?:        number | null;
    silverSpotAsk?:      number | null;
    shippingMethod?:     string;
    fedexLocation?:      string | null;
    fedexLocationHours?: string | null;
    shipToName?:         string | null;
    shipToLine1?:        string | null;
    shipToCity?:         string | null;
    shipToState?:        string | null;
    shipToZip?:          string | null;
  },
  pdfBuffer: Buffer,
): Promise<void> {

  // ── Design tokens — matches booking confirmation ───────────────────────
  const G      = "40px";
  const NAVY   = "#0F1C3F";
  const IVORY  = "#F5F1E8";
  const GOLD   = "#C49A38";
  const LGOLD  = "#DDD0B0";
  const MUTED  = "#7A7060";
  const DIM    = "#5C5248";
  const BODY   = "#2D2A25";
  const FAINT  = "#D8CEBC";
  const CBACK  = "#F9F6EE";
  const LOGO_URL = `${process.env.FRONTEND_URL ?? "https://westhillscapital.com"}/images/logo.png`;

  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const invoiceId  = deal.invoiceId ?? `WHC-${deal.id}`;
  const lockedDate = new Date(deal.lockedAt);
  const deadlineStr = nextBusinessDayFrom(lockedDate);

  // ── Product rows for the order card ────────────────────────────────────
  const productRows = deal.products
    .filter((p) => p.qty > 0)
    .map((p) => `
      <tr>
        <td style="padding:0 0 8px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${BODY};line-height:1.5;">
          ${p.qty} &times; ${p.productName}
        </td>
        <td style="padding:0 0 8px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${BODY};text-align:right;white-space:nowrap;">
          ${usd(p.lineTotal)}
        </td>
      </tr>`)
    .join("");

  // ── Spot price footer for the order card ───────────────────────────────
  const spotParts: string[] = [];
  if (deal.goldSpotAsk)   spotParts.push(`Gold spot: ${usd(deal.goldSpotAsk)}`);
  if (deal.silverSpotAsk) spotParts.push(`Silver: ${usd(deal.silverSpotAsk)}`);
  const spotText = spotParts.join(" &nbsp;&middot;&nbsp; ");

  // ── Shipping address rows (bare-row treatment) ─────────────────────────
  const isFedexHold = deal.shippingMethod === "fedex_hold";
  let shipRows: string;

  if (isFedexHold && deal.fedexLocation) {
    const fullName = `${deal.firstName.trim()} ${deal.lastName.trim()}`;
    const addrLine = [deal.shipToLine1, [deal.shipToCity, deal.shipToState].filter(Boolean).join(", ") + (deal.shipToZip ? ` ${deal.shipToZip}` : "")].filter(Boolean).join(", ");
    const mapsUrl  = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${deal.fedexLocation} ${addrLine}`)}`;
    const hoursRow = deal.fedexLocationHours ? `
      <tr>
        <td style="padding:10px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;border-top:1px solid ${FAINT};">Hours</td>
        <td style="padding:10px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;border-top:1px solid ${FAINT};">${deal.fedexLocationHours.replace(/\n/g, "<br>")}</td>
      </tr>` : "";
    shipRows = `
      <tr>
        <td style="padding:10px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;border-bottom:1px solid ${FAINT};">Location</td>
        <td style="padding:10px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;font-weight:500;border-bottom:1px solid ${FAINT};">
          ${deal.fedexLocation}<br>
          <span style="font-weight:normal;color:${MUTED};">FBO ${fullName}</span><br>
          <a href="${mapsUrl}" style="font-size:12px;color:${GOLD};text-decoration:none;">Get Directions &rarr;</a>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;border-bottom:1px solid ${FAINT};">Address</td>
        <td style="padding:10px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;font-weight:500;border-bottom:1px solid ${FAINT};">
          ${deal.shipToLine1 ?? ""}<br>
          ${[deal.shipToCity, deal.shipToState].filter(Boolean).join(", ")}${deal.shipToZip ? ` ${deal.shipToZip}` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;">Method</td>
        <td style="padding:10px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;font-weight:500;">FedEx Hold for Pickup</td>
      </tr>
      ${hoursRow}`;
  } else {
    const nameLine  = deal.shipToName ?? `${deal.firstName.trim()} ${deal.lastName.trim()}`;
    const addrParts: string[] = [];
    if (deal.shipToLine1) addrParts.push(deal.shipToLine1);
    const cityLine = [deal.shipToCity, deal.shipToState].filter(Boolean).join(", ") +
      (deal.shipToZip ? ` ${deal.shipToZip}` : "");
    if (cityLine.trim()) addrParts.push(cityLine.trim());
    const addrStr = addrParts.length
      ? addrParts.join("<br>")
      : `<span style="color:${MUTED};font-style:italic;">Address on file</span>`;
    shipRows = `
      <tr>
        <td style="padding:10px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;border-bottom:1px solid ${FAINT};">Name</td>
        <td style="padding:10px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;font-weight:500;border-bottom:1px solid ${FAINT};">${nameLine}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;">Address</td>
        <td style="padding:10px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;font-weight:500;">${addrStr}</td>
      </tr>`;
  }

  // ── Full HTML ──────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER: logo, ivory bg ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE, ivory bg ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0 0 11px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">Your order is confirmed.</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${MUTED};line-height:1.65;">
              Thank you for trusting us with your purchase. Your invoice is attached &mdash; please review the wire instructions inside.
            </p>
          </td>
        </tr>

        <!-- ─── ORDER CARD: hero surface ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:${CBACK};border:1px solid ${LGOLD};border-top:3px solid ${NAVY};border-radius:0 0 3px 3px;">

              <!-- card label row -->
              <tr>
                <td style="padding:9px 22px 8px;border-bottom:1px solid ${LGOLD};">
                  <p style="margin:0;font-size:9px;font-family:'DM Sans',Arial,sans-serif;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">Order Confirmed</p>
                </td>
              </tr>

              <!-- products + totals -->
              <tr>
                <td style="padding:20px 22px 0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${productRows}
                    <tr><td colspan="2" style="border-top:1px solid ${LGOLD};padding:0;"></td></tr>
                    <tr>
                      <td style="padding:10px 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">Subtotal</td>
                      <td style="padding:10px 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};text-align:right;">${usd(deal.subtotal)}</td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">Shipping</td>
                      <td style="padding:0 0 10px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};text-align:right;">${usd(deal.shipping)}</td>
                    </tr>
                    <tr><td colspan="2" style="border-top:1px solid ${LGOLD};padding:0;"></td></tr>
                    <tr>
                      <td style="padding:14px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:bold;color:${NAVY};">Total Due</td>
                      <td style="padding:14px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};text-align:right;letter-spacing:-.01em;">${usd(deal.total)}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- invoice + spot price footer -->
              <tr>
                <td style="padding:14px 22px 18px;border-top:1px solid ${LGOLD};margin-top:14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};">
                        Invoice&nbsp;<span style="font-family:'Courier New',monospace;letter-spacing:.04em;color:${DIM};">${invoiceId}</span>
                      </td>
                      ${spotText ? `<td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};text-align:right;">${spotText}</td>` : ""}
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ─── PAYMENT DEADLINE: thin rules, centered ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:22px 0;">
                  <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};letter-spacing:.08em;text-transform:uppercase;">Payment due by</p>
                  <p style="margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:bold;color:${NAVY};letter-spacing:.01em;">${deadlineStr}</p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">Wire instructions are included in the attached invoice</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── SHIP TO: bare rows on white ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 0;">
            <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">Ship To</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${shipRows}
            </table>
          </td>
        </tr>

        <!-- ─── NEXT STEPS: bullets ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 0;">
            <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">Next Steps</p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:0 0 9px 0;vertical-align:top;width:16px;"><span style="display:inline-block;width:4px;height:4px;background:${GOLD};border-radius:50%;margin-top:8px;"></span></td>
                <td style="padding:0 0 9px 12px;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">Once payment clears, we will secure your metals and prepare your shipment</td>
              </tr>
              <tr>
                <td style="padding:0 0 9px 0;vertical-align:top;width:16px;"><span style="display:inline-block;width:4px;height:4px;background:${GOLD};border-radius:50%;margin-top:8px;"></span></td>
                <td style="padding:0 0 9px 12px;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">I will personally follow up with your FedEx tracking number once the order ships</td>
              </tr>
              <tr>
                <td style="padding:0 0 9px 0;vertical-align:top;width:16px;"><span style="display:inline-block;width:4px;height:4px;background:${GOLD};border-radius:50%;margin-top:8px;"></span></td>
                <td style="padding:0 0 9px 12px;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">If payment may be delayed, please reach out and we will coordinate</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── SIGNOFF ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 16px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.7;">
              Please don&rsquo;t hesitate to reach out if you have any questions &mdash; it is a pleasure to work with you.
            </p>
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── COMPLIANCE ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G} 26px;">
            <div style="height:1px;background:${FAINT};margin-bottom:16px;"></div>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${DIM};line-height:1.75;">
              Payment must be received by the close of business on the date shown above to secure this pricing. If payment is not received in time, the trade may be cancelled and any market loss may be subject to an offset fee. This transaction is subject to West Hills Capital&rsquo;s Terms of Service: westhillscapital.com/terms
            </p>
          </td>
        </tr>

        <!-- ─── FOOTER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;

  await sendEmail({
    to:      deal.email,
    subject: "Your West Hills Capital Order Confirmation",
    attachments: [{
      filename: `${invoiceId}.pdf`,
      content:  pdfBuffer.toString("base64"),
    }],
    html,
  });
}

// ── Shared HTML helpers ───────────────────────────────────────────────────────

function whcEmailWrapper(body: string): string {
  return `
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:620px;margin:auto;background:#F5F0E8;">
      <div style="background:#0F1C3F;padding:18px 24px;">
        <span style="font-family:'DM Sans',Arial,sans-serif;font-size:18px;color:#C49A38;letter-spacing:.04em;font-weight:bold;">
          West Hills Capital
        </span>
      </div>
      <div style="padding:32px 24px;color:#1a1a1a;">
        ${body}
      </div>
      <div style="padding:16px 24px;background:#0F1C3F;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
          West Hills Capital &nbsp;|&nbsp; (800) 867-6768 &nbsp;|&nbsp; westhillscapital.com
        </p>
      </div>
    </div>
  `;
}

function joeSig(): string {
  return `
    <p style="margin:0 0 4px;font-size:15px;color:#374151;">My very best,</p>
    <p style="margin:0 0 28px;font-size:15px;font-weight:bold;color:#1a1a1a;">Joe</p>
    <p style="margin:0 0 4px;font-size:13px;color:#9ca3af;">West Hills Capital &nbsp;|&nbsp; (800) 867-6768</p>
  `;
}

// ── Email 1 — Wire Received Confirmation ──────────────────────────────────────

export async function sendWireConfirmationEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {

  const G       = "40px";
  const NAVY    = "#0F1C3F";
  const IVORY   = "#F5F1E8";
  const GOLD    = "#C49A38";
  const MUTED   = "#7A7060";
  const DIM     = "#5C5248";
  const BODY    = "#2D2A25";
  const FAINT   = "#D8CEBC";
  const LOGO_URL = `${process.env.FRONTEND_URL ?? "https://westhillscapital.com"}/images/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wire Received — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0 0 11px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">Your wire has arrived.</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${MUTED};line-height:1.65;">
              We wanted to reach out right away so you know things are moving.
            </p>
          </td>
        </tr>

        <!-- ─── STATUS CALLOUT: centered between thin rules ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:22px 0;">
                  <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};letter-spacing:.08em;text-transform:uppercase;">Status</p>
                  <p style="margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:bold;color:${NAVY};letter-spacing:.01em;">Wire Received &mdash; Your Order Is Being Prepared</p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">We will follow up with your FedEx tracking once the order ships</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── BODY COPY ─── -->
        <tr>
          <td style="background:#ffffff;padding:28px ${G} 0;">
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              We are coordinating the details of securing your metals and getting them on the way to you.
              Once the package ships, I will personally send over your FedEx tracking information.
            </p>
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              In the meantime, if you have any questions or just want to check in, don&rsquo;t hesitate to reach out.
              I am here to make sure this goes smoothly for you.
            </p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              We appreciate your trust &mdash; you made a sound decision, and we take that responsibility seriously.
            </p>
          </td>
        </tr>

        <!-- ─── SIGNOFF ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── FOOTER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;

  await sendEmail({
    to:      params.email,
    subject: "We received your wire — your metals are being prepared",
    html,
  });
}

// ── Email 2 — Shipping Notification ───────────────────────────────────────────

export async function sendShippingNotificationEmail(params: {
  firstName:          string;
  email:              string;
  trackingNumber:     string;
  estimatedDelivery?: string;
}): Promise<void> {

  const G       = "40px";
  const NAVY    = "#0F1C3F";
  const IVORY   = "#F5F1E8";
  const GOLD    = "#C49A38";
  const LGOLD   = "#DDD0B0";
  const MUTED   = "#7A7060";
  const DIM     = "#5C5248";
  const BODY    = "#2D2A25";
  const FAINT   = "#D8CEBC";
  const CBACK   = "#F9F6EE";
  const LOGO_URL = `${process.env.FRONTEND_URL ?? "https://westhillscapital.com"}/images/logo.png`;

  const trackingUrl = `https://www.fedex.com/apps/fedextrack/?tracknumbers=${encodeURIComponent(params.trackingNumber)}`;

  const deliveryCallout = params.estimatedDelivery ? `
        <!-- ─── ESTIMATED DELIVERY CALLOUT ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:22px 0;">
                  <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};letter-spacing:.08em;text-transform:uppercase;">Expected Delivery</p>
                  <p style="margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:bold;color:${NAVY};letter-spacing:.01em;">${params.estimatedDelivery}</p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">Package held at your FedEx location for up to five days if needed</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Package Is On the Way — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0 0 11px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">Your package is on the way.</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${MUTED};line-height:1.65;">
              Your metals have been fully allocated, packaged, and handed off to FedEx for delivery.
            </p>
          </td>
        </tr>

        <!-- ─── TRACKING CARD: hero surface ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:${CBACK};border:1px solid ${LGOLD};border-top:3px solid ${NAVY};border-radius:0 0 3px 3px;">
              <tr>
                <td style="padding:9px 22px 8px;border-bottom:1px solid ${LGOLD};">
                  <p style="margin:0;font-size:9px;font-family:'DM Sans',Arial,sans-serif;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">Your FedEx Tracking</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 22px 8px;">
                  <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};letter-spacing:.04em;text-transform:uppercase;">Tracking Number</p>
                  <p style="margin:0;font-family:'Courier New',monospace;font-size:18px;font-weight:bold;color:${NAVY};letter-spacing:.06em;">${params.trackingNumber}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 22px 20px;border-top:1px solid ${LGOLD};">
                  <a href="${trackingUrl}"
                     style="font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${GOLD};text-decoration:none;letter-spacing:.02em;">
                    Track Your Package &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${deliveryCallout}

        <!-- ─── BODY COPY ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 0;">
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              If for any reason you need additional time before pickup, please let me know as soon as possible
              so we can make sure everything is timed appropriately.
            </p>
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              When you pick it up, please take a quick look at the outside of the package before signing.
              If anything looks unusual, please call me right away at (800) 867-6768.
            </p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              I will be tracking the package all the way through to your signature. Congrats &mdash; it&rsquo;s almost here!
            </p>
          </td>
        </tr>

        <!-- ─── SIGNOFF ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── FOOTER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;

  await sendEmail({
    to:      params.email,
    subject: "Your metals are on the way — FedEx tracking inside",
    html,
  });
}

// ── Email 3 — Delivery Confirmation ───────────────────────────────────────────

export async function sendDeliveryConfirmationEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {

  const G       = "40px";
  const NAVY    = "#0F1C3F";
  const IVORY   = "#F5F1E8";
  const MUTED   = "#7A7060";
  const BODY    = "#2D2A25";
  const FAINT   = "#D8CEBC";
  const LOGO_URL = `${process.env.FRONTEND_URL ?? "https://westhillscapital.com"}/images/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivered — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0 0 11px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">Your metals have been delivered.</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${MUTED};line-height:1.65;">
              Congratulations — your order is complete.
            </p>
          </td>
        </tr>

        <!-- ─── STATUS CALLOUT ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:22px 0;">
                  <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};letter-spacing:.08em;text-transform:uppercase;">Status</p>
                  <p style="margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:bold;color:${NAVY};letter-spacing:.01em;">Delivery Confirmed</p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">Please look everything over and reach out if you need anything</p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── BODY COPY ─── -->
        <tr>
          <td style="background:#ffffff;padding:28px ${G} 0;">
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              There is something different about this part. What took years of work and discipline to build is now
              sitting in your hands in a form you can actually see and feel. I am really happy for you and hope
              receiving it has been a wonderful experience.
            </p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              It has been a real pleasure working with you on this. Please do not hesitate to call me at
              (800) 867-6768 if I can help in any way.
            </p>
          </td>
        </tr>

        <!-- ─── SIGNOFF ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── FOOTER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;

  await sendEmail({
    to:      params.email,
    subject: "Your metals have been delivered — how is everything looking?",
    html,
  });
}

// ── Email 4 — 7-Day Follow-Up ─────────────────────────────────────────────────

export async function sendFollowUp7DayEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {

  const G       = "40px";
  const NAVY    = "#0F1C3F";
  const IVORY   = "#F5F1E8";
  const MUTED   = "#7A7060";
  const BODY    = "#2D2A25";
  const FAINT   = "#D8CEBC";
  const LOGO_URL = `${process.env.FRONTEND_URL ?? "https://westhillscapital.com"}/images/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quick Check-In — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">Just checking in.</p>
          </td>
        </tr>

        <!-- ─── BODY COPY ─── -->
        <tr>
          <td style="background:#ffffff;padding:28px ${G} 0;">
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              It has been about a week since your metals arrived, and I wanted to check in with you.
            </p>
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              I hope everything has settled in well. If you have any questions about your purchase, or just want to
              visit about the weather in Wichita, I am always happy to spend some time with you on that too.
            </p>
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              Markets move, and life does too. If you think of something you did not ask, or something new has
              landed on your radar, let me know. I am here to help.
            </p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              And if you know someone who has been thinking about physical metals and would value a straightforward
              conversation, I would be glad to speak with them. Personal introductions mean a great deal in this business.
            </p>
          </td>
        </tr>

        <!-- ─── SIGNOFF ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── FOOTER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;

  await sendEmail({
    to:      params.email,
    subject: "Quick check-in",
    html,
  });
}

// ── Email 5 — 30-Day Follow-Up ────────────────────────────────────────────────

export async function sendFollowUp30DayEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {

  const G       = "40px";
  const NAVY    = "#0F1C3F";
  const IVORY   = "#F5F1E8";
  const MUTED   = "#7A7060";
  const BODY    = "#2D2A25";
  const FAINT   = "#D8CEBC";
  const LOGO_URL = `${process.env.FRONTEND_URL ?? "https://westhillscapital.com"}/images/logo.png`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>One Month In — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">One month in.</p>
          </td>
        </tr>

        <!-- ─── BODY COPY ─── -->
        <tr>
          <td style="background:#ffffff;padding:28px ${G} 0;">
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              Hard to believe it has been a month since your metals arrived. I hope the experience has been exactly
              what you were hoping for.
            </p>
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              This is usually the point where clients either feel very settled in their decision, or start thinking
              about what is next. Either is completely natural, and I am happy to talk through wherever you are.
            </p>
            <p style="margin:0 0 14px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              A few things worth knowing: we do work with clients on building out their position over time, incremental
              purchases, and storage options if any of those are on your mind. No pressure at all &mdash; just want
              you to know those conversations are always available.
            </p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.75;">
              And as always, if you know someone who might benefit from a straightforward conversation about
              physical metals, I would be glad to be introduced.
            </p>
          </td>
        </tr>

        <!-- ─── SIGNOFF ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── FOOTER ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>`;

  await sendEmail({
    to:      params.email,
    subject: "One month in — a quick note from West Hills Capital",
    html,
  });
}

// ── Prospect confirmation ─────────────────────────────────────────────────────

export async function sendBookingConfirmation(params: {
  to: string;
  firstName: string;
  confirmationId: string;
  dayLabel: string;
  timeLabel: string;
  scheduledTime: string;
  phone: string;
  state: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
}): Promise<void> {
  // Logo hosted on Vercel — falls back gracefully if not yet deployed
  const SITE_URL = (process.env.FRONTEND_URL ?? "https://www.westhillscapital.com").replace(/\/$/, "");
  const LOGO_URL = `${SITE_URL}/images/logo.png`;

  // Brand palette
  const NAVY   = "#0F1C3F";
  const IVORY  = "#F5F1E8";   // slightly warmer/richer ivory for header & footer
  const GOLD   = "#C49A38";
  const LGOLD  = "#DDD0B0";   // richer gold for card borders (more distinct)
  const MUTED  = "#7A7060";   // muted warm-gray for secondary labels
  const DIM    = "#5C5248";   // slightly darker for compliance text legibility
  const BODY   = "#2D2A25";   // near-black for primary body text
  const FAINT  = "#D8CEBC";   // divider line
  const CBACK  = "#F9F6EE";   // card interior background — lighter warm off-white

  const calendarEvent = buildBookingCalendarEvent({
    confirmationId: params.confirmationId,
    firstName: params.firstName,
    scheduledTime: params.scheduledTime,
    dayLabel: params.dayLabel,
    timeLabel: params.timeLabel,
    phone: params.phone,
  });

  const summaryRow = (label: string, value: string, last = false) => `
    <tr>
      <td style="padding:11px 0;font-size:13px;color:${MUTED};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;width:130px;${last ? "" : `border-bottom:1px solid ${FAINT};`}">${label}</td>
      <td style="padding:11px 0;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;vertical-align:top;font-weight:500;${last ? "" : `border-bottom:1px solid ${FAINT};`}">${value}</td>
    </tr>`;

  const expectItem = (text: string) => `
    <tr>
      <td style="padding:0 0 9px 0;vertical-align:top;width:16px;">
        <span style="display:inline-block;width:4px;height:4px;background:${GOLD};border-radius:50%;margin-top:8px;"></span>
      </td>
      <td style="padding:0 0 9px 12px;font-size:13px;color:${BODY};font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">${text}</td>
    </tr>`;

  // Single master gutter — every row uses this on left and right
  const G = "40px";

  await sendEmail({
    to:      params.to,
    subject: `We have your West Hills Capital call reserved — ${params.dayLabel}`,
    attachments: [calendarEvent.attachment],
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed — West Hills Capital</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:'DM Sans',Arial,sans-serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- ═══ CARD — single 600px column, every row padded ${G} L/R ═══ -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER: logo centered, ivory bg ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="230"
                 style="display:block;margin:0 auto;max-width:230px;height:auto;border:0;">
          </td>
        </tr>

        <!-- Inset divider — same ${G} sides as every other row ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:0 ${G};">
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── HEADLINE, ivory bg ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:34px ${G} 30px;">
            <p style="margin:0 0 11px;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">
              We have your consultation reserved.
            </p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${MUTED};line-height:1.65;">
              Thank you, ${params.firstName}. We look forward to speaking with you at the scheduled time below.
            </p>
          </td>
        </tr>

        <!-- ─── APPOINTMENT CARD, white bg ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                   style="background:${CBACK};border:1px solid ${LGOLD};border-top:3px solid ${NAVY};border-radius:0 0 3px 3px;">
              <tr>
                <td style="padding:9px 22px 8px;border-bottom:1px solid ${LGOLD};">
                  <p style="margin:0;font-size:9px;font-family:'DM Sans',Arial,sans-serif;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">
                    Save this call to your calendar
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 22px 8px;">
                  <p style="margin:0 0 6px;font-family:'Playfair Display',Georgia,serif;font-size:27px;font-weight:bold;color:${NAVY};line-height:1.15;letter-spacing:-.01em;">
                    ${params.dayLabel}
                  </p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:16px;color:${MUTED};line-height:1.4;">
                    ${params.timeLabel}
                  </p>
                  <p style="margin:14px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${BODY};line-height:1.6;">
                    Please add this appointment to your calendar so the call is easy to find when the time arrives.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 22px 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
                    <tr>
                      <td bgcolor="${NAVY}" style="border-radius:3px;">
                        <a href="${calendarEvent.googleCalendarUrl}" style="display:inline-block;padding:11px 16px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;text-decoration:none;">
                          Save this call to your calendar
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0 0 12px;font-size:12px;font-family:'DM Sans',Arial,sans-serif;color:${MUTED};line-height:1.55;">
                    We also attached a calendar file you can open in Apple Calendar, Outlook, Gmail, or most calendar apps. It includes a 15-minute reminder where supported.
                  </p>
                  <p style="margin:0;font-size:11px;font-family:'DM Sans',Arial,sans-serif;color:${MUTED};">
                    Confirmation&nbsp;
                    <span style="font-family:'Courier New',monospace;letter-spacing:.04em;color:${DIM};">${params.confirmationId}</span>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ─── PHONE CALLOUT: thin rules + centered text, no box ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G} 0;">
            <div style="height:1px;background:${FAINT};"></div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:22px 0;">
                  <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};letter-spacing:.08em;text-transform:uppercase;">
                    We will call you from
                  </p>
                  <p style="margin:0 0 4px;font-family:'Playfair Display',Georgia,serif;font-size:21px;font-weight:bold;color:${NAVY};letter-spacing:.01em;">
                    (800) 867-6768
                  </p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:${MUTED};">
                    at your scheduled time &mdash; please save this number
                  </p>
                </td>
              </tr>
            </table>
            <div style="height:1px;background:${FAINT};"></div>
          </td>
        </tr>

        <!-- ─── SUBMISSION SUMMARY: bare rows on white, no card ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 0;">
            <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">
              Your Submission
            </p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${summaryRow("Structure",  ALLOCATION_LABELS[params.allocationType] ?? params.allocationType)}
              ${summaryRow("Allocation", RANGE_LABELS[params.allocationRange]     ?? params.allocationRange)}
              ${summaryRow("Timeline",   TIMELINE_LABELS[params.timeline]         ?? params.timeline)}
              ${summaryRow("State",      params.state, true)}
            </table>
          </td>
        </tr>

        <!-- ─── WHAT TO EXPECT: label + bullets, no container ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 0;">
            <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">
              What to Expect
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              ${expectItem("Review your goals and the size of your purchase")}
              ${expectItem("Walk through current live pricing on gold and silver")}
              ${expectItem("Confirm delivery or storage preference")}
              ${expectItem("Lock your trade on the call if you decide to proceed — no commitment required")}
            </table>
          </td>
        </tr>

        <!-- ─── SIGNOFF, white bg ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 16px;font-family:'DM Sans',Arial,sans-serif;font-size:14px;color:${BODY};line-height:1.7;">
              Please don&rsquo;t hesitate to reach out if you have any questions before the call.
            </p>
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── COMPLIANCE NOTE, white bg ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G} 26px;">
            <div style="height:1px;background:${FAINT};margin-bottom:16px;"></div>
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${DIM};line-height:1.75;">
              <strong style="color:${BODY};font-weight:bold;">Important:</strong>
              Trades are executed only after verbal confirmation on a recorded call and receipt of cleared funds.
              This appointment is a consultation only &mdash; no obligation or commitment is required.
            </p>
          </td>
        </tr>

        <!-- ─── FOOTER, ivory bg ─── -->
        <tr>
          <td align="center" bgcolor="${IVORY}"
              style="background:${IVORY};padding:16px ${G};border-top:1px solid ${FAINT};">
            <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
              West Hills Capital &nbsp;&middot;&nbsp; (800) 867-6768 &nbsp;&middot;&nbsp; westhillscapital.com
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td>
  </tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->

</body>
</html>
    `,
  });
}
