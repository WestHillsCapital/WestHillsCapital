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

      <h2>Overage</h2>
      <p>When you exceed your monthly session or generation quota, overage is calculated automatically and added to your next invoice — there are no pre-purchased add-on packs and nothing to configure.</p>
      <ul>
        <li><strong>Starter &amp; Pro:</strong> $0.50 per additional submitted session beyond your included quota.</li>
        <li><strong>Developer:</strong> $75 per 100 additional generations, billed in full blocks. If you go over by 60 generations, you are charged for one full block of 100. There is no fractional block charge.</li>
        <li><strong>Enterprise:</strong> Sessions and generations are unlimited — no overage applies.</li>
      </ul>
      <p>If you find yourself regularly hitting your quota, upgrading your plan is more cost-effective than paying overage month over month. See <strong>Settings → Billing → Upgrade Plan</strong> to compare options.</p>

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
