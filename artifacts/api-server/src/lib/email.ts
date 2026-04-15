import { logger } from "./logger";

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
    logger.warn(
      { subject: opts.subject, to: opts.to },
      "[Email] RESEND_API_KEY not configured — email skipped"
    );
    return;
  }
  if (!opts.to) {
    logger.warn({ subject: opts.subject }, "[Email] No recipient — email skipped");
    return;
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
  } else {
    logger.info({ subject: opts.subject, to: opts.to }, "[Email] Sent");
  }
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

const WIRE = {
  bank:        "Commerce Bank",
  bankAddress: "1551 Waterfront, Wichita, KS 67206",
  routing:     "101000019",
  accountName: "West Hills Capital",
  accountAddr: "1314 N. Oliver Ave. #8348, Wichita, KS 67208",
  accountNum:  "690108249",
};

export async function sendDealRecapEmail(
  deal: {
    id:           number;
    firstName:    string;
    lastName:     string;
    email:        string;
    dealType:     string;
    products:     { productName: string; qty: number; unitPrice: number; lineTotal: number }[];
    subtotal:     number;
    shipping:     number;
    total:        number;
    invoiceId?:   string;
    lockedAt:     string;
    billingLine1?: string;
    billingLine2?: string;
    billingCity?:  string;
    billingState?: string;
    billingZip?:   string;
  },
  pdfBuffer:   Buffer,
): Promise<void> {
  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const invoiceId  = deal.invoiceId ?? `WHC-${deal.id}`;
  const refLast    = deal.lastName.replace(/\s+/g, "").toUpperCase().slice(0, 10);
  const wireRef    = `${refLast}-WHC${deal.id}`;

  // Build billing address lines for the email (omit gracefully if blank)
  const billingLines: string[] = [];
  if (deal.billingLine1) billingLines.push(deal.billingLine1);
  if (deal.billingLine2) billingLines.push(deal.billingLine2);
  if (deal.billingCity || deal.billingState || deal.billingZip) {
    const cityLine = [deal.billingCity, deal.billingState].filter(Boolean).join(", ") +
      (deal.billingZip ? ` ${deal.billingZip}` : "");
    billingLines.push(cityLine.trim());
  }
  const billingAddrHtml = billingLines.length > 0
    ? `<div style="margin-top:6px;font-size:13px;color:#374151;">${billingLines.map((l) => `<div>${l}</div>`).join("")}</div>`
    : "";

  const productRows = deal.products
    .filter((p) => p.qty > 0 && p.unitPrice > 0)
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151;">${p.productName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${p.qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${usd(p.unitPrice)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${usd(p.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const wRow = (label: string, val: string) =>
    `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;width:140px;">${label}</td><td style="padding:4px 0;font-size:13px;font-weight:600;">${val}</td></tr>`;

  await sendEmail({
    to:      deal.email,
    subject: `Your West Hills Capital Invoice — ${invoiceId}`,
    attachments: [{
      filename: `${invoiceId}.pdf`,
      content:  pdfBuffer.toString("base64"),
    }],
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">

        <h2 style="margin-top:0;color:#1a1a1a;">Your Precious Metals Allocation</h2>
        <p style="color:#374151;">Dear ${deal.firstName},</p>
        <p style="color:#374151;">
          Thank you for your business. Your invoice is attached to this email.
          Please review the details below and wire your payment to the account shown.
        </p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:14px 18px;margin:20px 0;">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Invoice #</div>
              <div style="font-weight:600;color:#1a1a1a;font-size:15px;">${invoiceId}</div>
              ${billingAddrHtml
                ? `<div style="margin-top:10px;">
                     <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Bill To</div>
                     <div style="font-size:13px;font-weight:600;color:#1a1a1a;">${deal.firstName} ${deal.lastName}</div>
                     ${billingAddrHtml}
                   </div>`
                : ""}
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;">Total Due</div>
              <div style="font-weight:700;color:#1a1a1a;font-size:18px;">${usd(deal.total)}</div>
            </div>
          </div>
        </div>

        <h3 style="color:#1a1a1a;margin-bottom:6px;">Order Summary</h3>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:7px 8px;text-align:left;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Product</th>
              <th style="padding:7px 8px;text-align:center;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Qty</th>
              <th style="padding:7px 8px;text-align:right;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Unit</th>
              <th style="padding:7px 8px;text-align:right;color:#6b7280;font-weight:500;border-bottom:2px solid #e5e7eb;">Total</th>
            </tr>
          </thead>
          <tbody>${productRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding:8px 8px;text-align:right;color:#6b7280;">Subtotal</td>
              <td style="padding:8px 8px;text-align:right;">${usd(deal.subtotal)}</td>
            </tr>
            <tr>
              <td colspan="3" style="padding:4px 8px;text-align:right;color:#6b7280;">Shipping</td>
              <td style="padding:4px 8px;text-align:right;">${usd(deal.shipping)}</td>
            </tr>
            <tr style="border-top:2px solid #1a1a1a;">
              <td colspan="3" style="padding:8px 8px;text-align:right;font-weight:700;color:#1a1a1a;">Total Due</td>
              <td style="padding:8px 8px;text-align:right;font-weight:700;font-size:16px;color:#1a1a1a;">${usd(deal.total)}</td>
            </tr>
          </tfoot>
        </table>

        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:16px 18px;margin:20px 0;">
          <h3 style="margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#92400e;">Wire Payment Instructions</h3>
          <table style="border-collapse:collapse;width:100%;">
            ${wRow("Bank", WIRE.bank)}
            ${wRow("Bank Address", WIRE.bankAddress)}
            ${wRow("Routing #", WIRE.routing)}
            ${wRow("Account Name", WIRE.accountName)}
            ${wRow("Account Addr", WIRE.accountAddr)}
            ${wRow("Account #", WIRE.accountNum)}
            ${wRow("Reference", wireRef)}
          </table>
          <p style="margin:12px 0 0;font-size:12px;color:#92400e;font-style:italic;">
            Wire must be received in full before metals are released for shipment.
          </p>
        </div>

        <p style="color:#374151;font-size:14px;">
          If you have any questions, please call us at <strong>(800) 867-6768</strong>.
        </p>

        <p style="color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:20px;">
          West Hills Capital &nbsp;|&nbsp; (800) 867-6768 &nbsp;|&nbsp; westhillscapital.com<br>
          Physical Precious Metals Allocation — Wichita, Kansas
        </p>
      </div>
    `,
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
    to: params.to,
    subject: `Your Allocation Call is Confirmed — ${params.dayLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="margin-top:0;color:#1a1a1a;">Your Allocation Discussion is Confirmed</h2>
        <p style="color:#374151;">Dear ${params.firstName},</p>
        <p style="color:#374151;">Your allocation discussion with West Hills Capital has been scheduled. A calendar invitation has been sent to your email address.</p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Appointment</p>
          <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a1a1a;">${params.dayLabel}</p>
          <p style="margin:0 0 12px;font-size:16px;color:#374151;">${params.timeLabel}</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">Confirmation ID: <strong style="color:#1a1a1a;">${params.confirmationId}</strong></p>
        </div>

        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;margin:16px 0;">
          <p style="margin:0;font-size:14px;color:#92400e;">
            We will call you from <strong>(800) 867-6768</strong> at your scheduled time. Save this number.
          </p>
        </div>

        <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0;">
          <tr><td colspan="2" style="padding:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Your submission summary</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;width:130px;">Structure</td><td style="padding:5px 0;">${ALLOCATION_LABELS[params.allocationType] ?? params.allocationType}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">Allocation</td><td style="padding:5px 0;">${RANGE_LABELS[params.allocationRange] ?? params.allocationRange}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">Timeline</td><td style="padding:5px 0;">${TIMELINE_LABELS[params.timeline] ?? params.timeline}</td></tr>
          <tr><td style="padding:5px 0;color:#6b7280;">State</td><td style="padding:5px 0;">${params.state}</td></tr>
        </table>

        <p style="color:#374151;font-size:14px;">During the call we will review your intended allocation, confirm current pricing, and discuss execution steps.</p>

        <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:20px;">
          <strong>Important:</strong> Trades are executed only after verbal confirmation and receipt of cleared funds.
          This call is a consultation only — no commitment is required.
          <br><br>
          West Hills Capital &nbsp;|&nbsp; (800) 867-6768
        </p>
      </div>
    `,
  });
}
