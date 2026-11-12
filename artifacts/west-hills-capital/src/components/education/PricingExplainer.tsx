export function PricingExplainer() {
  return (
    <section aria-labelledby="pricing-explained" className="max-w-5xl mx-auto my-14 rounded-2xl border border-border/40 bg-white p-6 sm:p-8">
      <h2 id="pricing-explained" className="text-2xl font-serif font-semibold mb-4">
        What is the difference between spot price, premium, and commission?
      </h2>
      <p className="text-foreground/70 leading-relaxed mb-6">
        A physical coin&apos;s retail price is not the same as the metal&apos;s spot price.
        Its price includes the metal value and costs associated with supplying and selling
        the coin. A commission calculated on a supplier&apos;s cost is not the same
        percentage as the total premium over spot.
      </p>
      <dl className="grid gap-5 sm:grid-cols-2 text-sm leading-relaxed">
        <div>
          <dt className="font-semibold mb-1">Spot price</dt>
          <dd className="text-foreground/65">A market benchmark for the metal, quoted per troy ounce. It is not a delivered retail coin quote.</dd>
        </div>
        <div>
          <dt className="font-semibold mb-1">Premium over spot</dt>
          <dd className="text-foreground/65">The difference between a coin&apos;s retail price and the spot value of its metal content. Compare coins using their actual fine-metal weight.</dd>
        </div>
        <div>
          <dt className="font-semibold mb-1">Commission over supplier cost</dt>
          <dd className="text-foreground/65">A dealer&apos;s charge calculated on its purchase cost. That supplier cost can already include a premium above spot.</dd>
        </div>
        <div>
          <dt className="font-semibold mb-1">Buy/sell spread</dt>
          <dd className="text-foreground/65">The difference between a dealer&apos;s selling price and its buyback price. A retail purchase price is not a promise of the same resale value.</dd>
        </div>
      </dl>
      <div className="mt-6 rounded-lg bg-muted/40 p-4 text-sm text-foreground/70 leading-relaxed">
        <h3 className="font-semibold text-foreground mb-2">Illustrative calculation — not a quote</h3>
        <p>
          Suppose one fine troy ounce has a spot value of $2,000 and a coin costs the
          dealer $2,100. A 2% commission on that supplier cost is $42, making the
          coin price $2,142. The total premium over spot is $142, or 7.1% — not 2%.
          These hypothetical figures exclude shipping, applicable taxes, and any separate account fees.
        </p>
      </div>
      <h3 className="font-semibold mt-6 mb-2">What should I compare before buying?</h3>
      <p className="text-sm text-foreground/65 leading-relaxed">
        Compare the same product and fine-metal weight, the full purchase cost,
        shipping and insurance, any applicable taxes, and the dealer&apos;s current
        buyback quote. For an IRA, also request the custodian&apos;s and storage
        provider&apos;s fee schedules. Market prices move; confirm the price and
        execution terms for your transaction before committing.
      </p>
      <p className="text-sm text-foreground/60 mt-4">
        Independent reference:{" "}
        <a className="text-primary underline underline-offset-4" href="https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/Metals10Things.html" target="_blank" rel="noopener noreferrer">
          CFTC and FINRA: 10 things to ask before buying physical metals
        </a>.
        {" "}This educational guidance does not imply regulatory endorsement of West Hills Capital.
      </p>
    </section>
  );
}
