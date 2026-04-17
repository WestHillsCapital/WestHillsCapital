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
  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const invoiceId = deal.invoiceId ?? `WHC-${deal.id}`;

  // Next-business-day deadline from the lock timestamp
  const lockedDate  = new Date(deal.lockedAt);
  const deadlineStr = nextBusinessDayFrom(lockedDate);

  // ── Order Summary bullets ────────────────────────────────────────────────
  const li = (text: string) =>
    `<li style="margin-bottom:4px;color:#374151;">${text}</li>`;

  const productBullets = deal.products
    .filter((p) => p.qty > 0)
    .map((p) => li(`<strong>Metal Purchased:</strong> ${p.qty} x ${p.productName}`))
    .join("");

  const spotLines: string[] = [];
  if (deal.goldSpotAsk)   spotLines.push(`&nbsp;&nbsp;&ndash; Gold: $${deal.goldSpotAsk.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  if (deal.silverSpotAsk) spotLines.push(`&nbsp;&nbsp;&ndash; Silver: $${deal.silverSpotAsk.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const spotBullet = spotLines.length
    ? li(`<strong>Spot Price at Lock:</strong><br>${spotLines.join("<br>")}`)
    : "";

  const summaryBullets =
    productBullets +
    spotBullet +
    li(`<strong>Subtotal:</strong> ${usd(deal.subtotal)}`) +
    li(`<strong>Shipping:</strong> ${usd(deal.shipping)}`) +
    li(`<strong>Total Due:</strong> ${usd(deal.total)}`);

  // ── Shipping Address block ───────────────────────────────────────────────
  const isFedexHold = deal.shippingMethod === "fedex_hold";
  let shippingAddrHtml: string;

  if (isFedexHold && deal.fedexLocation) {
    const fullName   = `${deal.firstName.trim()} ${deal.lastName.trim()}`;
    const addrLine   = [deal.shipToLine1, [deal.shipToCity, deal.shipToState].filter(Boolean).join(", ") + (deal.shipToZip ? ` ${deal.shipToZip}` : "")].filter(Boolean).join(", ");
    const mapsUrl    = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${deal.fedexLocation} ${addrLine}`)}`;
    const hoursBlock = deal.fedexLocationHours
      ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;"><strong>Store Hours:</strong><br>${deal.fedexLocationHours.replace(/\n/g, "<br>")}</p>`
      : "";
    shippingAddrHtml = `
      <p style="margin:0 0 4px;color:#374151;line-height:1.6;">
        <strong>${deal.fedexLocation}</strong><br>
        FBO ${fullName}<br>
        ${deal.shipToLine1 ?? ""}<br>
        ${[deal.shipToCity, deal.shipToState].filter(Boolean).join(", ")}${deal.shipToZip ? ` ${deal.shipToZip}` : ""}
      </p>
      ${hoursBlock}
      <p style="margin:10px 0 0;">
        <a href="${mapsUrl}" style="font-size:13px;color:#C49A38;font-family:Georgia,serif;">Get Directions &rarr;</a>
      </p>`;
  } else {
    const addrParts: string[] = [];
    if (deal.shipToLine1) addrParts.push(deal.shipToLine1);
    const cityLine = [deal.shipToCity, deal.shipToState].filter(Boolean).join(", ") +
      (deal.shipToZip ? ` ${deal.shipToZip}` : "");
    if (cityLine.trim()) addrParts.push(cityLine.trim());
    shippingAddrHtml = addrParts.length
      ? `<p style="margin:0;color:#374151;line-height:1.6;">${addrParts.join("<br>")}</p>`
      : `<p style="margin:0;color:#9ca3af;font-style:italic;">Address on file</p>`;
  }

  await sendEmail({
    to:      deal.email,
    subject: "Your West Hills Capital Order Confirmation",
    attachments: [{
      filename: `${invoiceId}.pdf`,
      content:  pdfBuffer.toString("base64"),
    }],
    html: whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${deal.firstName.trim()},</p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        I&rsquo;m glad we were able to get everything squared away today&mdash;thank you again for trusting us with your purchase.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">Here&rsquo;s a clear recap for your records:</p>

      <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#0F1C3F;">Order Summary</p>
      <ul style="margin:0 0 24px 18px;padding:0;font-size:15px;line-height:1.7;">
        ${summaryBullets}
      </ul>

      <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#0F1C3F;">Next Steps</p>
      <ul style="margin:0 0 24px 18px;padding:0;font-size:15px;line-height:1.7;">
        ${li("Your invoice is attached, which includes bank wire instructions")}
        ${li(`Payment must be received by the close of business on the next business day (<strong>${deadlineStr}</strong>) to secure this pricing`)}
        ${li("If payment is not received in time, the trade may be cancelled and any market loss may be subject to an offset fee")}
        ${li("If you anticipate any delay, just let me know and we can coordinate")}
        ${li("Once payment is received and cleared, we will secure and ship your metals")}
        ${li("We will monitor the shipment and coordinate delivery with you as it gets close")}
      </ul>

      <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#0F1C3F;">Shipping Address</p>
      <div style="margin:0 0 24px;padding:14px 16px;background:#ffffff;border:1px solid #d4b896;border-radius:6px;font-size:14px;">
        ${shippingAddrHtml}
      </div>

      <p style="margin:0 0 12px;font-size:15px;color:#374151;">
        You don&rsquo;t need to worry about a thing from here&mdash;we&rsquo;ll handle the logistics and keep you updated every step of the way.
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;">
        Once your order ships, I&rsquo;ll personally follow up with tracking and delivery timing.
      </p>
      <p style="margin:0 0 28px;font-size:15px;color:#374151;">
        If you need anything at all in the meantime, just reach out.
      </p>

      <p style="margin:0 0 4px;font-size:15px;color:#374151;">My very best,</p>
      <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#1a1a1a;">Joe</p>
      <p style="margin:0 0 0;font-size:13px;color:#9ca3af;">West Hills Capital &nbsp;|&nbsp; (800) 867-6768</p>

      <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;border-top:1px solid #d4b896;padding-top:14px;line-height:1.6;">
        This transaction is subject to West Hills Capital&rsquo;s Terms of Service: westhillscapital.com/terms
      </p>
    `),
  });
}

// ── Shared HTML helpers ───────────────────────────────────────────────────────

function whcEmailWrapper(body: string): string {
  return `
    <div style="font-family:Georgia,serif;max-width:620px;margin:auto;background:#F5F0E8;">
      <div style="background:#0F1C3F;padding:18px 24px;">
        <span style="font-family:Georgia,serif;font-size:18px;color:#C49A38;letter-spacing:.04em;font-weight:bold;">
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
  await sendEmail({
    to:      params.email,
    subject: "We received your wire — your metals are being prepared",
    html:    whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${params.firstName},</p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        Great news &mdash; your wire has arrived. I wanted to reach out right away so you know things are moving.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        We&rsquo;re coordinating with our dealer now to secure your metals and get your order on its way. Once the package ships,
        I&rsquo;ll send over your FedEx tracking information so you can follow along every step of the way.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        In the meantime, if you have any questions or just want to check in, don&rsquo;t hesitate to reach out.
        I&rsquo;m here to make sure this goes smoothly for you.
      </p>

      <p style="margin:0 0 28px;font-size:15px;color:#374151;">
        We appreciate your trust &mdash; you made a sound decision, and we take that responsibility seriously.
      </p>

      ${joeSig()}
    `),
  });
}

// ── Email 2 — Shipping Notification ───────────────────────────────────────────

export async function sendShippingNotificationEmail(params: {
  firstName:      string;
  email:          string;
  trackingNumber: string;
}): Promise<void> {
  const trackingUrl = `https://www.fedex.com/apps/fedextrack/?tracknumbers=${encodeURIComponent(params.trackingNumber)}`;

  await sendEmail({
    to:      params.email,
    subject: "Your metals are on the way — FedEx tracking inside",
    html:    whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${params.firstName},</p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        Your package is in transit &mdash; I&rsquo;m glad we&rsquo;re at this step. Your metals have been fully allocated,
        packaged, and handed off to FedEx for delivery.
      </p>

      <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#1a1a1a;">Your FedEx Tracking</p>
      <div style="margin:0 0 24px;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
        <p style="margin:0 0 8px;font-size:14px;color:#374151;">
          Tracking Number: <strong style="font-family:monospace;">${params.trackingNumber}</strong>
        </p>
        <a href="${trackingUrl}"
           style="display:inline-block;padding:8px 16px;background:#0F1C3F;color:#ffffff;text-decoration:none;border-radius:4px;font-size:14px;font-family:Georgia,serif;">
          Track Your Package &rarr;
        </a>
      </div>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        FedEx typically delivers insured shipments like yours with signature required. Please make sure someone is available
        to receive the package, or confirm with us if you&rsquo;re picking up at a FedEx location.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        When your package arrives, take a moment to inspect the exterior before signing. If anything looks off &mdash; any
        damage or tampering &mdash; please call me right away at <strong>(800) 867-6768</strong> before opening it.
      </p>

      <p style="margin:0 0 28px;font-size:15px;color:#374151;">
        I&rsquo;ll follow up once we see delivery confirmed. We&rsquo;re almost there.
      </p>

      ${joeSig()}
    `),
  });
}

// ── Email 3 — Delivery Confirmation ───────────────────────────────────────────

export async function sendDeliveryConfirmationEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {
  await sendEmail({
    to:      params.email,
    subject: "Your metals have been delivered — how is everything looking?",
    html:    whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${params.firstName},</p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        We&rsquo;re showing your package as delivered &mdash; congratulations on completing your allocation.
        I hope everything arrived in perfect condition.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        Once you&rsquo;ve had a chance to open the package, please take a moment to verify that the contents match
        your order confirmation. Everything should be exactly as specified.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        If anything at all seems off &mdash; a discrepancy in quantity, condition, or anything unexpected &mdash;
        please call me immediately at <strong>(800) 867-6768</strong>. We will make it right, no questions asked.
      </p>

      <p style="margin:0 0 28px;font-size:15px;color:#374151;">
        It&rsquo;s been a genuine pleasure working with you on this. Your metals are now a real, tangible part of
        your financial foundation &mdash; and that&rsquo;s something worth feeling good about.
      </p>

      ${joeSig()}
    `),
  });
}

// ── Email 4 — 7-Day Follow-Up ─────────────────────────────────────────────────

export async function sendFollowUp7DayEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {
  await sendEmail({
    to:      params.email,
    subject: "Quick check-in — how are your metals?",
    html:    whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${params.firstName},</p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        It&rsquo;s been about a week since your metals arrived, and I just wanted to check in personally.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        I hope everything is settled in nicely &mdash; whether that&rsquo;s a home safe, a private vault, or somewhere
        else entirely. If you have any questions about storage, insurance, or just want to talk through your allocation
        strategy, I&rsquo;m always happy to spend some time on that.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        Markets keep moving, and so do people&rsquo;s situations. If anything has changed in your financial picture
        since we last spoke, this is a good time to revisit where you stand.
      </p>

      <p style="margin:0 0 28px;font-size:15px;color:#374151;">
        Also &mdash; if you know anyone who&rsquo;s been asking about protecting their savings with physical metals,
        I&rsquo;d be glad to have that conversation with them. A personal introduction means a lot in this business.
      </p>

      ${joeSig()}
    `),
  });
}

// ── Email 5 — 30-Day Follow-Up ────────────────────────────────────────────────

export async function sendFollowUp30DayEmail(params: {
  firstName: string;
  email:     string;
}): Promise<void> {
  await sendEmail({
    to:      params.email,
    subject: "One month in — let\u2019s catch up",
    html:    whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hi ${params.firstName},</p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        It&rsquo;s been a month since your metals were delivered, and I wanted to reach out with a proper check-in.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        A lot can happen in thirty days &mdash; markets shift, headlines change, and allocation strategies that
        felt complete often reveal new opportunities on reflection. If you&rsquo;ve been thinking about adding to
        your position or adjusting your mix between gold and silver, now&rsquo;s a good time to have that conversation.
      </p>

      <p style="margin:0 0 16px;font-size:15px;color:#374151;">
        My direct line is <strong>(800) 867-6768</strong> &mdash; feel free to call anytime. No pressure, no agenda.
        Just a conversation between two people who take this stuff seriously.
      </p>

      <p style="margin:0 0 28px;font-size:15px;color:#374151;">
        And if you&rsquo;ve had a good experience working with us, I&rsquo;d genuinely appreciate an introduction
        to anyone in your circle who might benefit from the same kind of straightforward guidance. Referrals are how
        we grow, and I promise to take good care of anyone you send our way.
      </p>

      ${joeSig()}
    `),
  });
}

// ── Prospect confirmation ─────────────────────────────────────────────────────

export async function sendBookingConfirmation(params: {
  to: string;
  firstName: string;
  confirmationId: string;
  dayLabel: string;
  timeLabel: string;
  phone: string;
  state: string;
  allocationType: string;
  allocationRange: string;
  timeline: string;
}): Promise<void> {
  await sendEmail({
    to:      params.to,
    subject: `Your Allocation Call is Confirmed — ${params.dayLabel}`,
    html:    whcEmailWrapper(`
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">Dear ${params.firstName.trim()},</p>

      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
        Your allocation discussion with West Hills Capital has been confirmed.
        We look forward to speaking with you.
      </p>

      <div style="margin:0 0 20px;padding:18px;background:#ffffff;border:1px solid #d4b896;border-radius:6px;">
        <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Appointment</p>
        <p style="margin:0 0 4px;font-size:18px;font-weight:bold;color:#0F1C3F;">${params.dayLabel}</p>
        <p style="margin:0 0 14px;font-size:15px;color:#374151;">${params.timeLabel}</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Confirmation ID: <strong style="color:#1a1a1a;font-family:monospace;">${params.confirmationId}</strong>
        </p>
      </div>

      <div style="margin:0 0 24px;padding:14px 18px;background:#C49A38;border-radius:6px;">
        <p style="margin:0;font-size:14px;color:#0F1C3F;font-weight:bold;">
          We will call you from (800) 867-6768 at your scheduled time. Save this number.
        </p>
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;">Your Submission Summary</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;margin:0 0 24px;">
        <tr><td style="padding:6px 0;color:#9ca3af;width:130px;border-bottom:1px solid #e5e7eb;">Structure</td><td style="padding:6px 0;color:#374151;border-bottom:1px solid #e5e7eb;">${ALLOCATION_LABELS[params.allocationType] ?? params.allocationType}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Allocation</td><td style="padding:6px 0;color:#374151;border-bottom:1px solid #e5e7eb;">${RANGE_LABELS[params.allocationRange] ?? params.allocationRange}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;border-bottom:1px solid #e5e7eb;">Timeline</td><td style="padding:6px 0;color:#374151;border-bottom:1px solid #e5e7eb;">${TIMELINE_LABELS[params.timeline] ?? params.timeline}</td></tr>
        <tr><td style="padding:6px 0;color:#9ca3af;">State</td><td style="padding:6px 0;color:#374151;">${params.state}</td></tr>
      </table>

      <p style="margin:0 0 24px;font-size:15px;color:#374151;">
        During the call we will review your intended allocation, confirm current pricing, and discuss execution steps.
      </p>

      <p style="margin:0;font-size:12px;color:#9ca3af;border-top:1px solid #d4b896;padding-top:16px;line-height:1.7;">
        <strong>Important:</strong> Trades are executed only after verbal confirmation and receipt of cleared funds.
        This call is a consultation only &mdash; no commitment is required.
      </p>
    `),
  });
}
