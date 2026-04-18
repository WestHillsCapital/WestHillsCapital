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

  const summaryRow = (label: string, value: string, last = false) => `
    <tr>
      <td style="padding:11px 0;font-size:13px;color:${MUTED};font-family:Georgia,serif;vertical-align:top;width:130px;${last ? "" : `border-bottom:1px solid ${FAINT};`}">${label}</td>
      <td style="padding:11px 0;font-size:13px;color:${BODY};font-family:Georgia,serif;vertical-align:top;font-weight:500;${last ? "" : `border-bottom:1px solid ${FAINT};`}">${value}</td>
    </tr>`;

  const expectItem = (text: string) => `
    <tr>
      <td style="padding:0 0 9px 0;vertical-align:top;width:16px;">
        <span style="display:inline-block;width:4px;height:4px;background:${GOLD};border-radius:50%;margin-top:8px;"></span>
      </td>
      <td style="padding:0 0 9px 12px;font-size:13px;color:${BODY};font-family:Georgia,serif;line-height:1.6;">${text}</td>
    </tr>`;

  // Single master gutter — every row uses this on left and right
  const G = "40px";

  await sendEmail({
    to:      params.to,
    subject: `Your Allocation Discussion Is Confirmed — ${params.dayLabel}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appointment Confirmed — West Hills Capital</title>
</head>
<body style="margin:0;padding:0;background:#ECE8DC;font-family:Georgia,serif;">

<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ECE8DC;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <!-- ═══ CARD — single 600px column, every row padded ${G} L/R ═══ -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;width:100%;background:#ffffff;border-radius:3px;overflow:hidden;">

        <!-- ─── HEADER: logo, ivory bg ─── -->
        <tr>
          <td bgcolor="${IVORY}" style="background:${IVORY};padding:26px ${G} 22px;">
            <img src="${LOGO_URL}" alt="West Hills Capital" width="200"
                 style="display:block;max-width:200px;height:auto;border:0;">
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
            <p style="margin:0 0 11px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:${NAVY};line-height:1.3;">
              Your allocation discussion is confirmed.
            </p>
            <p style="margin:0;font-family:Georgia,serif;font-size:14px;color:${MUTED};line-height:1.65;">
              We look forward to speaking with you at the scheduled time below.
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
                  <p style="margin:0;font-size:9px;font-family:Georgia,serif;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">
                    Appointment
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 22px 8px;">
                  <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:27px;font-weight:bold;color:${NAVY};line-height:1.15;letter-spacing:-.01em;">
                    ${params.dayLabel}
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:16px;color:${MUTED};line-height:1.4;">
                    ${params.timeLabel}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 22px 20px;">
                  <p style="margin:0;font-size:11px;font-family:Georgia,serif;color:${MUTED};">
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
                  <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:11px;color:${MUTED};letter-spacing:.08em;text-transform:uppercase;">
                    We will call you from
                  </p>
                  <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:21px;font-weight:bold;color:${NAVY};letter-spacing:.01em;">
                    (800) 867-6768
                  </p>
                  <p style="margin:0;font-family:Georgia,serif;font-size:12px;color:${MUTED};">
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
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:10px;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">
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
            <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:10px;color:${GOLD};letter-spacing:.16em;text-transform:uppercase;font-weight:bold;">
              What to Expect
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              ${expectItem("Review your intended allocation size and structure")}
              ${expectItem("Walk through current live pricing on gold and silver")}
              ${expectItem("Confirm delivery or storage preference")}
              ${expectItem("Lock your trade on the call if you decide to proceed — no commitment required")}
            </table>
          </td>
        </tr>

        <!-- ─── SIGNOFF, white bg ─── -->
        <tr>
          <td style="background:#ffffff;padding:24px ${G} 28px;">
            <p style="margin:0 0 16px;font-family:Georgia,serif;font-size:14px;color:${BODY};line-height:1.7;">
              Please don&rsquo;t hesitate to reach out if you have any questions before the call.
            </p>
            <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:14px;font-weight:bold;color:${NAVY};">Joe Unger</p>
            <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:13px;color:${MUTED};">West Hills Capital</p>
            <p style="margin:0;font-family:Georgia,serif;font-size:13px;color:${MUTED};">(800) 867-6768</p>
          </td>
        </tr>

        <!-- ─── COMPLIANCE NOTE, white bg ─── -->
        <tr>
          <td style="background:#ffffff;padding:0 ${G} 26px;">
            <div style="height:1px;background:${FAINT};margin-bottom:16px;"></div>
            <p style="margin:0;font-family:Georgia,serif;font-size:11px;color:${DIM};line-height:1.75;">
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
            <p style="margin:0;font-family:Georgia,serif;font-size:11px;color:${MUTED};line-height:1.8;letter-spacing:.02em;">
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
