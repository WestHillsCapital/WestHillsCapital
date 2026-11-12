const ROLLOVER_SOURCE = "https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions";
const METALS_SOURCE = "https://www.irs.gov/retirement-plans/investments-in-collectibles-in-individually-directed-qualified-plan-accounts";
const RISK_SOURCE = "https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/Metals10Things.html";

export function IraEssentials() {
  return (
    <section aria-labelledby="ira-essentials" className="py-14 border-b border-border/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">
        <div>
          <h2 id="ira-essentials" className="text-2xl lg:text-3xl font-serif font-semibold mb-4">
            What is a self-directed precious-metals IRA?
          </h2>
          <p className="text-foreground/70 leading-relaxed">
            A self-directed precious-metals IRA is an individual retirement account
            that can hold eligible physical metals under IRA rules. West Hills
            Capital acts as the metals dealer. The IRA custodian administers the
            account, and the depository stores the metal under the custodial arrangement.
            These are distinct roles, not a single investment-management service.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3">How does a transfer differ from a rollover?</h3>
          <dl className="space-y-3 text-sm text-foreground/70 leading-relaxed">
            <div><dt className="font-semibold text-foreground">Trustee-to-trustee IRA transfer</dt><dd>Funds move directly between the financial institutions. The IRS explains that its one-IRA-rollover-per-year limit does not apply to these transfers.</dd></div>
            <div><dt className="font-semibold text-foreground">Direct rollover from an employer plan</dt><dd>The plan pays the receiving IRA or eligible plan directly. Ask your plan administrator whether your distribution is eligible and how to arrange it.</dd></div>
            <div><dt className="font-semibold text-foreground">Distribution paid to you</dt><dd>A rollover generally must be completed within 60 days. Withholding and other restrictions can apply; missing a requirement can create taxes or penalties.</dd></div>
          </dl>
          <p className="text-sm text-foreground/60 mt-3">
            Tax treatment depends on the accounts and transaction, including any Roth
            conversion. Confirm the approach with your plan administrator, custodian,
            and qualified tax adviser. See the{" "}
            <a href={ROLLOVER_SOURCE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">IRS rollover and transfer rules</a>.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3">Which metals and storage arrangements qualify?</h3>
          <p className="text-sm text-foreground/70 leading-relaxed">
            IRA rules generally restrict collectibles, with exceptions for certain
            coins and qualifying bullion. Buying an eligible coin alone does not
            make every account or storage arrangement compliant. Arrange custody
            through the IRA custodian rather than assuming personal home storage
            qualifies, and confirm the specific product and custody requirements
            before purchasing. Read the{" "}
            <a href={METALS_SOURCE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">IRS guidance on metals and collectible exceptions</a>.
          </p>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-3">What costs and risks should I review?</h3>
          <p className="text-sm text-foreground/70 leading-relaxed">
            Request written details of the metal price and premium, dealer charges,
            custodian setup and administration, storage, insurance, and any
            transaction or distribution fees. Ask how storage is allocated or
            segregated under the provider&apos;s agreement. Metals can lose value;
            spreads and ongoing costs affect the proceeds available when you sell.
            Neither an IRA nor physical ownership guarantees a return.
          </p>
          <p className="text-sm text-foreground/60 mt-3">
            Independent consumer guidance:{" "}
            <a href={RISK_SOURCE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">CFTC and FINRA precious-metals buying checklist</a>.
            {" "}These references are educational, not regulatory endorsements or personal tax, legal, or investment advice.
          </p>
        </div>
      </div>
    </section>
  );
}
