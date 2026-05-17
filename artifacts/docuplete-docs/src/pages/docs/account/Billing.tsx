export default function Billing() {
  return (
    <div className="docs-content">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-[#5B8DEF] mb-2">Account & Settings</div>
        <h1>Seats & Billing</h1>
        <p className="text-lg text-white/55 mt-2">Manage your plan, seats, and billing settings.</p>
      </div>

      <h2>Viewing your current plan</h2>
      <p>Go to <strong>Settings → Billing</strong> to see:</p>
      <ul>
        <li>Your current plan and billing cycle (monthly or annual)</li>
        <li>Seats used vs. seats included</li>
        <li>Sessions or generations used this period vs. your quota</li>
        <li>Next billing date and estimated amount (including any accrued overage)</li>
        <li>Payment method on file</li>
      </ul>

      <h2>Session packs</h2>
      <p>On Starter and Pro, you can purchase additional session packs from <strong>Settings → Billing → Buy Sessions</strong>. Packs add sessions to your balance on top of your monthly plan quota. Pack credits are drawn down before plan quota, oldest-expiry first, and all pack credits expire one year from purchase.</p>
      <p>Packs are available in five sizes, on monthly subscription, annual subscription (20% off), or as a one-off purchase:</p>

      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Pack size</th>
              <th>Monthly</th>
              <th>Annual (per mo)</th>
              <th>Annual (total)</th>
              <th>One-off</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>50 sessions</td><td>$25/mo</td><td>$20/mo</td><td>$240</td><td>$25</td></tr>
            <tr><td>100 sessions</td><td>$45/mo</td><td>$36/mo</td><td>$432</td><td>$45</td></tr>
            <tr><td>300 sessions</td><td>$120/mo</td><td>$96/mo</td><td>$1,152</td><td>$120</td></tr>
            <tr><td>500 sessions</td><td>$185/mo</td><td>$148/mo</td><td>$1,776</td><td>$185</td></tr>
            <tr><td>1,000 sessions</td><td>$349/mo</td><td>$279/mo</td><td>$3,348</td><td>$349</td></tr>
          </tbody>
        </table>
      </div>

      <p><strong>Monthly subscription:</strong> sessions are deposited at the start of each billing cycle and expire one year from each deposit date.</p>
      <p><strong>Annual subscription:</strong> the full year's sessions (12× the pack size) are deposited upfront at purchase. Annual packs are 20% cheaper than paying month-to-month.</p>
      <p><strong>One-off purchase:</strong> sessions are deposited immediately and expire one year from purchase. Use this when you have a one-time volume spike and don't want an ongoing subscription.</p>

      <h2>Overage</h2>
      <p>When you exceed both your plan quota and any purchased pack credits, overage is billed automatically at the end of your billing period.</p>
      <ul>
        <li><strong>Starter &amp; Pro:</strong> $0.50 per additional submitted session.</li>
        <li><strong>Developer:</strong> $75 per 100 additional generations, billed in full blocks of 100. If you go over by 60, you are charged for one full block of 100.</li>
        <li><strong>Enterprise:</strong> Sessions and generations are unlimited — no overage applies.</li>
      </ul>
      <p>If you're regularly hitting your quota, a recurring session pack is more cost-effective than overage — and upgrading your plan may be more cost-effective still. See <strong>Settings → Billing → Upgrade Plan</strong> to compare.</p>

      <h2>Adding or removing seats</h2>
      <p>Seats can be adjusted at any time from <strong>Settings → Billing → Manage Seats</strong>. Adding seats is immediate — billing is prorated to the end of the current billing cycle. Removing seats takes effect at the start of the next billing cycle.</p>
      <p>You cannot reduce seats below the number of active users in your organization. Deactivate users first if you need to reduce seat count.</p>
      <p>Developer plan seats are org-wide — all members of your organization can have a seat at no additional per-seat cost.</p>

      <h2>Upgrading your plan</h2>
      <ol>
        <li>Go to <strong>Settings → Billing → Upgrade Plan</strong>.</li>
        <li>Select the new plan.</li>
        <li>Confirm. The upgrade takes effect immediately.</li>
        <li>You're billed a prorated amount for the remaining days in your current billing period.</li>
      </ol>

      <h2>Downgrading your plan</h2>
      <p>Downgrades take effect at the end of the current billing period. During the period, you retain access to your current plan's features. At the start of the next period, access is adjusted to the new plan's limits.</p>

      <div className="callout callout-warning">
        <strong>Feature access on downgrade:</strong> If you're on Enterprise and downgrade to Pro, webhook configurations are preserved but become inactive. They'll reactivate if you re-upgrade to Enterprise.
      </div>

      <h2>Invoices</h2>
      <p>Invoices are available at <strong>Settings → Billing → Invoice History</strong>. Each invoice is downloadable as a PDF. You can also configure an invoice email address (separate from your account email) to receive invoice copies.</p>

      <h2>Canceling</h2>
      <p>To cancel your subscription, go to <strong>Settings → Billing → Cancel Plan</strong>. Your account transitions to a free read-only state at the end of the current billing period. Existing data — sessions, generated PDFs, packages — is retained for 90 days after cancellation, after which it is permanently deleted.</p>
    </div>
  );
}
