export interface AssetComparison {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  goldLabel: string;
  otherLabel: string;
  intro: string;
  sections: {
    heading: string;
    content: string;
  }[];
  comparisonTable: {
    attribute: string;
    gold: string;
    other: string;
  }[];
  bottomLine: string;
}

export const COMPARISONS: AssetComparison[] = [
  {
    slug: "gold-vs-etf",
    title: "Physical Gold vs. Gold ETFs",
    metaTitle: "Physical Gold vs. Gold ETFs | West Hills Capital",
    metaDescription:
      "Understand the key differences between owning physical gold and investing in gold ETFs — counterparty risk, costs, liquidity, and IRA eligibility explained plainly.",
    goldLabel: "Physical Gold",
    otherLabel: "Gold ETFs",
    intro:
      "Gold ETFs are a convenient way to track the price of gold in a brokerage account. Physical gold is what you actually own. Both have their place, but they are fundamentally different things — and the difference matters most when financial stress is highest.",
    sections: [
      {
        heading: "What a Gold ETF actually is",
        content:
          "A gold ETF is a fund that holds gold (or gold futures contracts) and issues shares that trade on a stock exchange. The share price tracks the price of gold. You do not own any gold — you own a financial claim on a fund that is supposed to own gold. The most popular ETF, GLD, holds allocated gold bars in a custodial vault. Smaller ETFs may use futures contracts, which means they hold no physical metal at all.",
      },
      {
        heading: "Counterparty risk: the central difference",
        content:
          "When you buy physical gold and take delivery, you eliminate counterparty risk. The gold exists, you have it, and its value does not depend on any company's balance sheet or operational continuity. An ETF introduces at least one counterparty: the fund manager. Depending on the ETF structure, you may also have exposure to the custodian bank, sub-custodians, and the exchange itself. In a normal market, these risks are negligible. In a serious financial disruption — the scenario gold is often held to hedge against — they are not.",
      },
      {
        heading: "Costs compared",
        content:
          "ETFs charge an annual expense ratio (typically 0.25–0.50% for major gold ETFs). Physical gold has no ongoing fee, but you pay a one-time premium over spot at purchase and bear storage and insurance costs if you vault it. For shorter holding periods, ETFs are often cheaper. For long-term holders — 5, 10, 20 years — the recurring ETF fee compounds meaningfully.",
      },
      {
        heading: "IRA eligibility",
        content:
          "Gold ETFs can be held in a standard IRA at any major brokerage. Physical gold can be held in a self-directed IRA with an approved custodian. The physical route requires more setup but gives you direct metal ownership. ETF shares in an IRA give you price exposure without ownership.",
      },
      {
        heading: "Liquidity",
        content:
          "ETF shares are liquid during market hours — you can sell in seconds. Physical gold requires selling to a dealer, which typically takes a phone call and a few days for settlement. For most long-term holders, the difference in liquidity is not practically meaningful.",
      },
    ],
    comparisonTable: [
      { attribute: "Direct metal ownership", gold: "Yes", other: "No" },
      { attribute: "Counterparty risk", gold: "None", other: "Fund manager, custodian bank" },
      { attribute: "Annual fees", gold: "None (storage cost if vaulted)", other: "0.25–0.50% expense ratio" },
      { attribute: "IRA eligible", gold: "Yes (self-directed IRA)", other: "Yes (standard IRA)" },
      { attribute: "Liquidity", gold: "1–3 days to sell", other: "Instantly during market hours" },
      { attribute: "Accessible in crisis", gold: "Yes — you hold it", other: "Depends on market and broker access" },
      { attribute: "Storage required", gold: "Yes (home or vault)", other: "No" },
    ],
    bottomLine:
      "Gold ETFs are a reasonable way to track the gold price in a brokerage account. Physical gold is a way to actually own it. They serve different purposes. If your goal is price exposure in a trading account, an ETF is efficient. If your goal is to hold a tangible asset outside the financial system, physical gold is the appropriate vehicle.",
  },
  {
    slug: "gold-vs-silver",
    title: "Gold vs. Silver: Which Belongs in Your Portfolio?",
    metaTitle: "Gold vs. Silver — Which to Buy | West Hills Capital",
    metaDescription:
      "Compare physical gold and silver on price volatility, premiums, storage, and long-term strategy. A plain-language guide to choosing between the two metals.",
    goldLabel: "Gold",
    otherLabel: "Silver",
    intro:
      "Both metals have served as monetary assets for thousands of years. Both are IRA-eligible in their government-minted bullion form. But they behave differently, store differently, and serve different strategic purposes in a portfolio.",
    sections: [
      {
        heading: "Price per ounce and volatility",
        content:
          "Gold trades at a significant premium to silver — historically between 50:1 and 100:1. That means for the same dollar investment, you are buying far more physical weight in silver. Silver is also more volatile: it tends to rise faster than gold in bull markets and fall harder in corrections. Investors who prioritize price stability within the metals allocation tend to weight gold more heavily.",
      },
      {
        heading: "Storage and shipping considerations",
        content:
          "Silver's lower price per ounce means a meaningful dollar position requires a lot of physical weight. $50,000 in silver at current prices is roughly 1,600 ounces — a heavy box. $50,000 in gold is less than an ounce and a half — fits in your hand. Home storage of silver at scale is impractical. Vault storage is workable. For IRA accounts, the depository handles both, but weight-based fees can apply to silver.",
      },
      {
        heading: "Premiums and liquidity",
        content:
          "Gold premiums over spot are typically 2–5% for standard bullion coins. Silver premiums tend to be higher — often 10–20% over spot — because the cost of minting, shipping, and handling is proportionally larger relative to the metal's lower per-ounce value. This matters on the back end: when you sell, you need the silver price to recover your premium before you profit.",
      },
      {
        heading: "Industrial demand for silver",
        content:
          "Silver has significant industrial uses — electronics, solar panels, medical equipment — that gold largely does not. This adds a demand layer that can drive silver higher in periods of industrial growth, but also exposes it to economic cyclicality in ways gold is not.",
      },
    ],
    comparisonTable: [
      { attribute: "Price per ounce", gold: "~$2,000–$3,000+", other: "~$25–$35" },
      { attribute: "Volatility", gold: "Moderate", other: "High" },
      { attribute: "Storage per $10k", gold: "~3–5 oz, pocket-sized", other: "~300–400 oz, significant weight" },
      { attribute: "Typical bullion premium", gold: "2–5% over spot", other: "10–20% over spot" },
      { attribute: "Industrial demand", gold: "Minimal", other: "Significant (solar, electronics)" },
      { attribute: "IRA eligible", gold: "Yes", other: "Yes" },
      { attribute: "Monetary recognition", gold: "Universal", other: "Broad" },
    ],
    bottomLine:
      "Most long-term precious metals investors hold primarily gold with a smaller silver position. Gold is the core monetary store of value; silver adds volatility exposure with higher upside potential. The right balance depends on your storage capacity, risk tolerance, and objectives — which is why we always start with a conversation before any purchase.",
  },
  {
    slug: "gold-ira-vs-roth-ira",
    title: "Gold IRA vs. Roth IRA: Understanding the Difference",
    metaTitle: "Gold IRA vs. Roth IRA | West Hills Capital",
    metaDescription:
      "Learn how a Precious Metals IRA compares to a standard Roth IRA — tax treatment, asset types, contribution rules, and when each makes sense.",
    goldLabel: "Gold IRA (Self-Directed)",
    otherLabel: "Standard Roth IRA",
    intro:
      "A 'Gold IRA' is not a separate type of account — it is a self-directed IRA that holds physical precious metals instead of (or in addition to) stocks and bonds. A Roth IRA can be set up as either a standard brokerage account or a self-directed account. Understanding the differences helps clarify which structure fits your goals.",
    sections: [
      {
        heading: "What a self-directed IRA actually is",
        content:
          "A self-directed IRA is an IRA where the account holder directs investments into non-standard assets — real estate, private equity, precious metals — that standard brokerages do not support. The custodian is a specialized trust company that handles administrative requirements, not an investment manager. The IRS rules are the same as any IRA; only the asset type differs.",
      },
      {
        heading: "Tax treatment: Traditional vs. Roth",
        content:
          "The traditional vs. Roth distinction applies to self-directed IRAs exactly as it does to standard IRAs. A traditional self-directed (Gold) IRA is funded with pre-tax dollars and distributions are taxed as income. A Roth self-directed IRA is funded with after-tax dollars and qualified distributions are tax-free. If your goal is tax-free growth on gold appreciation, a Roth self-directed IRA is the most advantageous structure — assuming you qualify for Roth contributions.",
      },
      {
        heading: "Contribution limits",
        content:
          "Both types are subject to the same IRS contribution limits. For 2024, the limit is $7,000 per year ($8,000 if age 50+). Roth IRAs also have income phase-out limits. Rollovers from 401(k)s or other IRAs are not subject to annual contribution limits — you can roll any amount in a single year.",
      },
      {
        heading: "Asset types",
        content:
          "A standard Roth IRA at Fidelity, Vanguard, or Schwab holds stocks, bonds, ETFs, and mutual funds. A self-directed Roth IRA at a specialized custodian can hold IRS-approved precious metals (gold, silver, platinum, palladium at required purity levels) alongside — or instead of — traditional securities.",
      },
    ],
    comparisonTable: [
      { attribute: "Account type", gold: "Self-directed IRA (traditional or Roth)", other: "Standard brokerage IRA" },
      { attribute: "Assets held", gold: "Physical gold, silver, other IRA-eligible metals", other: "Stocks, bonds, ETFs, mutual funds" },
      { attribute: "Tax treatment", gold: "Depends on traditional vs. Roth structure", other: "Roth: tax-free qualified distributions" },
      { attribute: "Annual contribution limit", gold: "Same as standard IRA ($7k/$8k)", other: "$7,000/$8,000 (income limits apply)" },
      { attribute: "Custodian type", gold: "Specialized self-directed IRA custodian", other: "Major brokerage (Fidelity, Schwab, etc.)" },
      { attribute: "Setup complexity", gold: "Moderate (custodian setup + rollover)", other: "Low (open online in minutes)" },
      { attribute: "Annual fees", gold: "Custodian fee + depository storage", other: "Often none at major brokerages" },
    ],
    bottomLine:
      "A Gold IRA is not better or worse than a standard Roth IRA — they serve different purposes. If you want tax-advantaged ownership of physical gold, a self-directed IRA (traditional or Roth) is the right vehicle. If you want low-cost exposure to financial markets with tax-free growth, a standard Roth IRA at a major brokerage is simpler and cheaper to maintain.",
  },
  {
    slug: "physical-gold-vs-futures",
    title: "Physical Gold vs. Gold Futures",
    metaTitle: "Physical Gold vs. Gold Futures | West Hills Capital",
    metaDescription:
      "Compare owning physical gold to trading gold futures contracts — risk profiles, leverage, delivery mechanics, and what each is actually designed for.",
    goldLabel: "Physical Gold",
    otherLabel: "Gold Futures",
    intro:
      "Gold futures are financial contracts that set a price for gold to be delivered on a future date. Most futures traders never take delivery — they close positions before expiration. Physical gold is metal you own and hold. These are fundamentally different instruments designed for different purposes.",
    sections: [
      {
        heading: "What gold futures are designed for",
        content:
          "Gold futures were created primarily for commercial hedging — mining companies locking in sale prices, jewelers hedging input costs, and large institutional investors managing risk. They allow price exposure without handling physical metal. For retail investors, futures involve significant leverage (a small price move creates a large gain or loss relative to the margin posted) and require active management of contract expiration.",
      },
      {
        heading: "Leverage and risk",
        content:
          "A standard COMEX gold futures contract controls 100 troy ounces of gold — worth over $200,000 at typical prices. Initial margin requirements are a fraction of that. This means futures expose you to price movements on a much larger position than your capital. Physical gold has no leverage — you own exactly what you paid for.",
      },
      {
        heading: "Delivery and settlement",
        content:
          "Fewer than 1% of gold futures contracts historically result in physical delivery. Most are closed before expiration. When delivery does occur, it is in bar form at an approved COMEX warehouse — not the coin-in-hand format most private investors want. Physical gold buyers get actual metal delivered to their door or vault.",
      },
      {
        heading: "Who futures are appropriate for",
        content:
          "Gold futures are appropriate for sophisticated traders, commercial hedgers, and institutional investors with the capital and expertise to manage leveraged positions. For long-term investors seeking a tangible asset, physical gold is the appropriate vehicle. The two are not comparable in terms of risk profile, purpose, or ownership structure.",
      },
    ],
    comparisonTable: [
      { attribute: "What you own", gold: "Physical metal", other: "Financial contract" },
      { attribute: "Leverage", gold: "None", other: "High (10:1 or more)" },
      { attribute: "Delivery", gold: "To your door or vault", other: "Rare; bars at COMEX warehouse" },
      { attribute: "Ongoing management", gold: "None required", other: "Active (contracts expire)" },
      { attribute: "Counterparty risk", gold: "None", other: "Exchange, clearing house, broker" },
      { attribute: "Suitable for long-term hold", gold: "Yes", other: "No (contracts expire)" },
      { attribute: "IRA eligible", gold: "Yes (self-directed IRA)", other: "No" },
    ],
    bottomLine:
      "Gold futures and physical gold serve entirely different purposes. Futures are speculative trading instruments. Physical gold is a long-term tangible asset. For an investor who wants to own gold — not trade it — there is no reasonable comparison between the two.",
  },
  {
    slug: "gold-vs-real-estate",
    title: "Gold vs. Real Estate as a Wealth Preservation Asset",
    metaTitle: "Gold vs. Real Estate | West Hills Capital",
    metaDescription:
      "Compare physical gold and real estate as long-term wealth preservation strategies — liquidity, maintenance, leverage, inflation protection, and portfolio role.",
    goldLabel: "Physical Gold",
    otherLabel: "Real Estate",
    intro:
      "Both gold and real estate have served as inflation hedges and long-term stores of value for centuries. They behave very differently in a portfolio — and understanding those differences helps clarify when each is appropriate.",
    sections: [
      {
        heading: "Liquidity",
        content:
          "Gold is highly liquid. A phone call converts it to cash in a few business days. Real estate is one of the least liquid assets you can own — closing a property takes weeks or months, and the transaction costs (commissions, title, taxes) typically run 6–10% of the property's value. In a portfolio that includes both, gold provides the liquidity that real estate cannot.",
      },
      {
        heading: "Maintenance and cash flow",
        content:
          "Real estate requires ongoing management — property taxes, maintenance, insurance, vacancies, and tenant issues. Well-selected income properties produce cash flow. Gold requires no management and produces no income. It simply stores value.",
      },
      {
        heading: "Leverage and risk",
        content:
          "Real estate is typically purchased with significant leverage (mortgages). Leverage amplifies both gains and losses — and adds the risk of forced sale in a downturn. Gold is typically purchased without leverage. The risk profile is very different: real estate with a mortgage can result in more than 100% loss of your equity if prices fall enough; gold purchased outright can fall in price but cannot put you into debt.",
      },
      {
        heading: "Inflation protection",
        content:
          "Both gold and real estate have historically provided inflation protection over long periods. Real estate tracks the cost of construction and land. Gold tracks the devaluation of currency. During periods of financial stress, gold tends to be more responsive; during periods of strong economic growth, real estate often outperforms.",
      },
    ],
    comparisonTable: [
      { attribute: "Liquidity", gold: "High (days)", other: "Low (weeks to months)" },
      { attribute: "Income generation", gold: "None", other: "Yes (rental income)" },
      { attribute: "Maintenance required", gold: "None", other: "Significant" },
      { attribute: "Typical purchase leverage", gold: "None", other: "60–80% mortgage" },
      { attribute: "Transaction costs to sell", gold: "~2% (dealer spread)", other: "6–10% (commissions, title, taxes)" },
      { attribute: "IRA eligible", gold: "Yes (self-directed IRA)", other: "Yes (self-directed IRA)" },
      { attribute: "Inflation hedge", gold: "Yes", other: "Yes" },
    ],
    bottomLine:
      "Gold and real estate are not substitutes — they play different roles. Real estate is an operating asset that generates income and requires management. Gold is a passive store of value that requires nothing. Most serious long-term portfolios benefit from both: real estate for income and appreciation, gold for liquidity and monetary insurance.",
  },
  {
    slug: "gold-vs-bonds",
    title: "Gold vs. Bonds: A Plain-Language Comparison",
    metaTitle: "Gold vs. Bonds | West Hills Capital",
    metaDescription:
      "Compare physical gold and bonds as portfolio stabilizers — interest rate sensitivity, default risk, inflation performance, and long-term wealth preservation.",
    goldLabel: "Physical Gold",
    otherLabel: "Bonds",
    intro:
      "Bonds have traditionally been the 'safe' portion of a portfolio — counterbalancing equities with stability and income. Gold serves a different purpose: it is a monetary asset with no issuer and no default risk. Understanding the difference clarifies why some investors hold both, and why gold performs differently under inflationary pressure.",
    sections: [
      {
        heading: "Interest rate sensitivity",
        content:
          "Bonds are directly sensitive to interest rates — when rates rise, existing bond prices fall. Long-duration bonds can lose 20–30% of value in a rapid rate-rising environment, as seen in 2022. Gold does not pay interest and is not sensitive to rate changes in the same mechanical way. Gold typically underperforms in high-real-rate environments and outperforms when real rates are low or negative.",
      },
      {
        heading: "Default and credit risk",
        content:
          "Bonds are obligations of an issuer — a government or corporation. Government bonds carry credit risk (though low for U.S. Treasuries), and corporate bonds carry meaningful risk of default. Gold has no issuer and no default risk. It is not a claim on anything — it is the asset itself.",
      },
      {
        heading: "Inflation performance",
        content:
          "Bonds are generally poor inflation hedges. If inflation runs above the bond's yield, the real return is negative. Gold has historically maintained its purchasing power over long periods and tends to perform well during periods of elevated inflation — particularly when real interest rates are negative.",
      },
      {
        heading: "Income generation",
        content:
          "Bonds pay interest income — a significant advantage for investors who need regular cash flow. Gold produces no income. For income-dependent investors, bonds cannot simply be replaced by gold. For investors who are accumulating rather than distributing, the income comparison matters less.",
      },
    ],
    comparisonTable: [
      { attribute: "Default risk", gold: "None", other: "Yes (varies by issuer)" },
      { attribute: "Income generation", gold: "None", other: "Yes (coupon payments)" },
      { attribute: "Interest rate sensitivity", gold: "Indirect", other: "Direct and significant" },
      { attribute: "Inflation protection", gold: "Strong historically", other: "Weak (real return erodes)" },
      { attribute: "IRA eligible", gold: "Yes (self-directed IRA)", other: "Yes (standard IRA/brokerage)" },
      { attribute: "Counterparty risk", gold: "None", other: "Issuer risk" },
      { attribute: "Liquidity", gold: "High", other: "High (for liquid bonds)" },
    ],
    bottomLine:
      "Gold and bonds occupy different roles in a portfolio. Bonds provide income and stability in deflationary environments. Gold provides monetary insurance and inflation protection in ways bonds cannot. Investors holding both recognize that portfolio resilience requires assets that perform under different conditions — not assets that fail simultaneously.",
  },
  {
    slug: "gold-vs-cash",
    title: "Gold vs. Cash: Storing Wealth Over Time",
    metaTitle: "Gold vs. Cash | West Hills Capital",
    metaDescription:
      "Compare holding physical gold versus cash savings — purchasing power over time, inflation exposure, FDIC limits, and why long-term savers consider both.",
    goldLabel: "Physical Gold",
    otherLabel: "Cash / Savings",
    intro:
      "Cash is liquid, FDIC-insured up to certain limits, and immediately accessible. But cash has a persistent weakness: inflation. Over time, dollars lose purchasing power. Gold has historically maintained purchasing power over long periods. Understanding the trade-offs helps clarify why some investors hold gold alongside — not instead of — their cash reserves.",
    sections: [
      {
        heading: "Purchasing power over time",
        content:
          "A dollar saved in 1971 (when the U.S. left the gold standard) is worth roughly 13 cents in today's purchasing power. An ounce of gold in 1971 cost about $35. Today it costs 60–80 times that — not because gold 'went up,' but because dollars lost value. Gold stores purchasing power; dollars gradually lose it. This does not mean gold replaces cash — it means the two serve different functions over different time horizons.",
      },
      {
        heading: "FDIC insurance limits",
        content:
          "Cash in FDIC-insured accounts is protected up to $250,000 per depositor per institution. For high-net-worth individuals with significant cash reserves, meaningful portions may exceed FDIC coverage. Physical gold held in your possession or at an insured depository has no coverage limit — you own it outright.",
      },
      {
        heading: "Liquidity",
        content:
          "Cash is the most liquid asset. Gold is liquid but requires a dealer transaction — typically settled in a few business days. For day-to-day expenses, cash is the appropriate vehicle. For wealth stored over years or decades, gold's inflation resilience may make it a better vehicle than keeping everything in savings.",
      },
      {
        heading: "Why both matter",
        content:
          "Most serious long-term investors hold meaningful cash reserves (emergency fund, near-term spending, opportunities) and a separate allocation to physical gold (long-term purchasing power preservation, outside-system insurance). The two serve different purposes — holding gold does not mean holding no cash.",
      },
    ],
    comparisonTable: [
      { attribute: "Inflation protection", gold: "Strong historically", other: "Weak (loses purchasing power)" },
      { attribute: "Liquidity", gold: "Days to sell", other: "Immediate" },
      { attribute: "FDIC/government guarantee", gold: "None (you own the asset)", other: "Up to $250k per account" },
      { attribute: "Income generation", gold: "None", other: "Yes (savings/money market rate)" },
      { attribute: "Counterparty risk", gold: "None", other: "Bank solvency (FDIC mitigates)" },
      { attribute: "Long-term purchasing power", gold: "Maintained historically", other: "Erodes with inflation" },
      { attribute: "Storage required", gold: "Yes (home or vault)", other: "No" },
    ],
    bottomLine:
      "Cash and gold are complements, not substitutes. Cash handles liquidity, transactions, and near-term needs. Gold protects long-term purchasing power in a way cash cannot. The investors who benefit most from holding gold are those with adequate cash reserves who are looking for a portion of their savings to maintain real value over 10, 20, or 30-year horizons.",
  },
  {
    slug: "gold-vs-stocks",
    title: "Physical Gold vs. Stocks: A Long-Term Perspective",
    metaTitle: "Physical Gold vs. Stocks | West Hills Capital",
    metaDescription:
      "Compare physical gold and stocks as long-term investments — volatility, correlation, inflation protection, and how gold behaves during equity market downturns.",
    goldLabel: "Physical Gold",
    otherLabel: "Stocks (Equities)",
    intro:
      "Stocks and gold both belong in long-term portfolios — but they serve fundamentally different roles. Stocks are ownership stakes in businesses that can grow earnings and compound value over time. Gold is a monetary asset that preserves purchasing power and behaves differently from equities during financial stress. Understanding the distinction clarifies why serious long-term investors often hold both.",
    sections: [
      {
        heading: "What stocks are (and are not)",
        content:
          "A stock is a fractional ownership claim on a business. Its value depends on the company's ability to generate earnings, grow revenues, and survive competition. Well-run businesses compound value over decades. Poorly run ones go to zero. A diversified stock portfolio — broad index funds — has historically delivered 7–10% annualized real returns over long periods, making equities the most powerful wealth-building vehicle available to most investors.",
      },
      {
        heading: "What gold is (and is not)",
        content:
          "Gold produces no earnings, pays no dividends, and has no balance sheet. It is a monetary commodity — the oldest form of money in human history — whose value is determined by supply, demand, and confidence in paper currencies. Over very long periods, gold has maintained its purchasing power while currencies have lost theirs. Gold does not compound like a business, but it also does not go bankrupt.",
      },
      {
        heading: "Correlation: when they move together and when they do not",
        content:
          "Gold and stocks have a low-to-negative correlation during periods of financial stress. In major equity drawdowns — 2000–2002, 2007–2009, early 2020 — gold has often held its value or risen while stocks fell sharply. This is the primary portfolio argument for holding both: they tend to fail at different times. In strong bull markets for equities, gold frequently underperforms. The combination produces smoother returns over a full market cycle than either alone.",
      },
      {
        heading: "Inflation protection",
        content:
          "Stocks are a partial inflation hedge because businesses can raise prices. But in high-inflation environments — particularly those accompanied by rising interest rates — stock valuations are pressured by the discount rate effect. Gold has historically outperformed during periods of elevated inflation, particularly when real interest rates are negative. The 1970s and 2020–2022 period are the two clearest modern examples.",
      },
      {
        heading: "How much gold belongs in a portfolio?",
        content:
          "There is no universal answer. Academic research on portfolio construction generally supports a 5–20% allocation to gold as an uncorrelated asset that improves risk-adjusted returns. The right number depends on your objectives, time horizon, and existing portfolio composition. The conversation starts with understanding what role you want gold to play.",
      },
    ],
    comparisonTable: [
      { attribute: "What you own", gold: "Monetary commodity", other: "Fractional business ownership" },
      { attribute: "Income generated", gold: "None", other: "Dividends (if paid)" },
      { attribute: "Long-term real return", gold: "Purchasing power preservation", other: "7–10% annualized (broad index)" },
      { attribute: "Correlation to stocks", gold: "Low to negative in crises", other: "—" },
      { attribute: "Inflation protection", gold: "Strong historically", other: "Partial" },
      { attribute: "Default / bankruptcy risk", gold: "None", other: "Yes (individual stocks)" },
      { attribute: "IRA eligible", gold: "Yes (self-directed IRA)", other: "Yes (standard IRA/brokerage)" },
      { attribute: "Volatility", gold: "Moderate", other: "Moderate to high (varies)" },
    ],
    bottomLine:
      "Stocks are the engine of long-term wealth creation. Gold is the ballast that keeps a portfolio stable during market disruptions. Most serious long-term investors hold primarily equities with a meaningful gold allocation — not as a replacement for stocks, but as a counterbalance that performs when equities do not. The question is not stocks or gold. The question is how much of each.",
  },
  {
    slug: "gold-vs-crypto",
    title: "Physical Gold vs. Cryptocurrency",
    metaTitle: "Physical Gold vs. Cryptocurrency | West Hills Capital",
    metaDescription:
      "Compare physical gold and cryptocurrency as store-of-value assets — 5,000-year track record vs. decade-long experiment, volatility, custody risk, and IRA treatment.",
    goldLabel: "Physical Gold",
    otherLabel: "Cryptocurrency",
    intro:
      "Both gold and cryptocurrency are held by some investors as alternatives to traditional currencies. Both are outside the traditional financial system in some sense. But they differ fundamentally in age, volatility, custody risk, and what they actually are. The comparison is worth examining carefully before making either a long-term holding.",
    sections: [
      {
        heading: "Track record: 5,000 years vs. 15 years",
        content:
          "Gold has been recognized as a monetary asset across every major civilization for thousands of years. It survived the Roman Empire's collapse, the fall of Bretton Woods, and every financial crisis of the modern era. Cryptocurrency has existed since 2009. The oldest coins are 15 years old and have been through a handful of market cycles — most of which ended with 70–90% drawdowns from peak to trough. Track record is not the only thing that matters, but a 5,000-year store of value and a 15-year speculative experiment are genuinely different things.",
      },
      {
        heading: "Volatility",
        content:
          "Bitcoin, the most established cryptocurrency, has experienced multiple drawdowns exceeding 70% — the most recent in 2022, when it fell from roughly $69,000 to under $17,000. Gold's largest modern drawdown was approximately 45% (2011–2015). For investors seeking wealth preservation, volatility matters: an asset that falls 70% requires a 233% gain just to recover. Gold is volatile, but it is not in the same category as most cryptocurrencies.",
      },
      {
        heading: "Custody and counterparty risk",
        content:
          "Physical gold stored at home or at a reputable depository has no counterparty risk. Cryptocurrency held at an exchange introduces significant counterparty risk — the exchange can fail, freeze withdrawals, or be hacked. FTX, Celsius, BlockFi, and Mt. Gox are all examples of exchange failures that wiped out customer balances. Cryptocurrency held in a self-custody wallet eliminates exchange risk but introduces the risk of lost keys — a loss that is permanent and unrecoverable.",
      },
      {
        heading: "IRA treatment",
        content:
          "IRS-approved physical gold (American Gold Eagle, Gold Buffalo, and bars meeting .995 purity) can be held in a self-directed IRA. Some self-directed IRA custodians also permit Bitcoin and other cryptocurrencies in IRAs. However, the custody and counterparty considerations for crypto in an IRA are more complex, and regulatory treatment continues to evolve.",
      },
      {
        heading: "The 'digital gold' narrative",
        content:
          "Bitcoin is sometimes described as 'digital gold' based on its fixed supply of 21 million coins. The comparison has intuitive appeal. But during the most significant financial stress test of the crypto era — 2022, when inflation ran hot and risk assets sold off — Bitcoin did not behave like gold. It fell over 60% alongside equities. Gold rose. The correlation data so far does not support the 'store of value in a crisis' narrative for crypto, though the experiment continues.",
      },
    ],
    comparisonTable: [
      { attribute: "Track record", gold: "5,000+ years", other: "~15 years" },
      { attribute: "Worst modern drawdown", gold: "~45% (2011–2015)", other: "70–90%+ (multiple cycles)" },
      { attribute: "Counterparty risk (exchange)", gold: "None", other: "Significant" },
      { attribute: "Lost key / theft risk", gold: "Physical theft only", other: "Permanent if self-custody keys lost" },
      { attribute: "Crisis correlation (2022)", gold: "Positive (held value)", other: "Negative (fell with equities)" },
      { attribute: "IRA eligible", gold: "Yes (self-directed IRA)", other: "Possible (custodian-dependent)" },
      { attribute: "Income generation", gold: "None", other: "None (for most)" },
      { attribute: "Regulatory clarity", gold: "Clear and long-established", other: "Evolving" },
    ],
    bottomLine:
      "Physical gold and cryptocurrency both appeal to investors who want assets outside the traditional banking system. But they are not equivalent. Gold is a proven monetary asset with a multi-millennium track record and modest volatility. Cryptocurrency is a recent technological experiment with high volatility, evolving regulation, and custody risks that gold does not carry. Investors who hold both typically do so for different reasons — gold for long-term wealth preservation, crypto for speculative upside. They should be sized accordingly.",
  },
];

export function getComparisonBySlug(slug: string): AssetComparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
