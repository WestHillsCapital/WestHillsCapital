export interface InsightGroup {
  id: string;
  title: string;
  description: string;
}

export interface InsightSection {
  heading?: string;
  paragraphs: string[];
}

export interface InsightArticle {
  slug: string;
  title: string;
  excerpt: string;
  group: string;
  metaDescription: string;
  sections: InsightSection[];
  related: string[];
}

export const INSIGHT_GROUPS: InsightGroup[] = [
  {
    id: "understanding-pricing",
    title: "Understanding Pricing",
    description:
      "How gold and silver are priced, where premiums come from, and how buyers end up overpaying.",
  },
  {
    id: "making-smart-decisions",
    title: "Making Smart Decisions",
    description:
      "Product choice, relative value, and how to think clearly about long-term allocation.",
  },
  {
    id: "ownership-and-practicality",
    title: "Ownership and Practical Reality",
    description:
      "What ownership looks like after purchase — storage, logistics, and IRA structure.",
  },
  {
    id: "choosing-who-to-trust",
    title: "Choosing Who to Trust",
    description:
      "How to evaluate dealers, understand incentives, and protect yourself from costly decisions.",
  },
];

export const INSIGHTS: InsightArticle[] = [
  // ─── Group 1: Understanding Pricing ──────────────────────────────────────────
  {
    slug: "what-spot-price-really-means",
    title: "What Spot Price Really Means",
    excerpt:
      "Learn what spot price actually is, where it comes from, and why it does not tell the whole story for physical gold and silver buyers.",
    group: "understanding-pricing",
    metaDescription:
      "Understand what gold and silver spot price really means, where it comes from, and why it is only the starting point for physical metal buyers.",
    sections: [
      {
        heading: "Spot Price Is a Starting Point, Not a Final Price",
        paragraphs: [
          "When people talk about the \"price of gold,\" they usually mean the spot price — a number that represents the current market price for one troy ounce of gold for immediate delivery in the wholesale market. It is quoted in real time during trading hours and serves as the global benchmark for gold and silver.",
          "Understanding what spot price is — and what it is not — is one of the most useful things a buyer can know before entering the market.",
        ],
      },
      {
        heading: "Where the Spot Price Comes From",
        paragraphs: [
          "Spot prices are derived primarily from futures markets, most notably the COMEX division of the New York Mercantile Exchange. Prices are also influenced by the London Bullion Market Association (LBMA), which publishes reference prices twice daily for gold and once daily for silver.",
          "These prices reflect large-volume institutional trading of standardized contracts — not the purchase of physical coins from a dealer. They represent the cost of a contract for delivery, not the cost of a packaged, minted, and shipped coin.",
        ],
      },
      {
        heading: "What Spot Price Does Not Include",
        paragraphs: [
          "Spot price does not include the premium charged by the mint to produce a coin, the fabrication cost, the dealer's spread, shipping, or insurance. For physical gold and silver, all of those costs sit on top of spot.",
          "The gap between spot and what you actually pay is called the \"over-spot premium\" or simply the premium. It varies by product, market conditions, and dealer. A 1 oz gold bullion coin might trade at 3–6% over spot under normal conditions. A silver coin often trades at 15–25% or more over spot due to its lower per-ounce value.",
        ],
      },
      {
        heading: "How to Use Spot Price as a Buyer",
        paragraphs: [
          "Spot price is a useful benchmark for comparison. It tells you roughly what the underlying metal is worth and gives you a basis for evaluating how much any particular dealer or product is adding on top.",
          "When comparing dealers, ask about the all-in price per ounce for the same product and calculate how much over spot you are being asked to pay. That number tells you far more than the spot price alone.",
          "Spot price is not a price you will ever pay — it is the floor from which every physical transaction is priced. Understanding that distinction is the first step to buying intelligently.",
        ],
      },
    ],
    related: [
      "why-people-overpay-for-gold-and-silver",
      "bullion-vs-proof-coins",
      "what-the-gold-to-silver-ratio-actually-means",
    ],
  },

  {
    slug: "why-people-overpay-for-gold-and-silver",
    title: "Why People Overpay for Gold and Silver",
    excerpt:
      "A practical look at where buyers lose money, how hidden markups work, and how to avoid paying too much for the wrong products.",
    group: "understanding-pricing",
    metaDescription:
      "Learn the most common reasons gold and silver buyers overpay — from hidden premiums to misleading promotions — and how to protect yourself.",
    sections: [
      {
        heading: "The Most Expensive Mistakes Are Usually Invisible",
        paragraphs: [
          "Most buyers who overpay for gold and silver do not realize they have done so at the time of purchase. The signs only become clear later — when they try to sell, when they compare prices, or when someone they trust walks them through the numbers.",
          "Understanding the most common ways buyers overpay is one of the most practical things you can do before making a purchase.",
        ],
      },
      {
        heading: "Paying for Numismatic or Collectible Value",
        paragraphs: [
          "The single most common way buyers overpay is by purchasing \"numismatic\" or \"collector\" coins when they intend to buy metal. Numismatic coins are graded, certified, and sold at prices far above their melt value. If the premium on a coin is 40%, 60%, or 100% above spot, you are essentially paying for rarity and condition — not for gold.",
          "Bullion coins — like the American Eagle or Buffalo — carry much lower premiums and are valued primarily for their metal content. For buyers focused on wealth preservation rather than coin collecting, bullion is almost always the better choice.",
        ],
      },
      {
        heading: "Stacked Premiums and Confusing Pricing",
        paragraphs: [
          "Some dealers layer multiple fees on top of each other without making each one clear. You might see a \"fair\" spot price quoted, but then pay a separate handling fee, a shipping fee, an insurance surcharge, and a credit card fee — each of which adds to the total.",
          "The only number that matters is the all-in price per ounce. Get that number, calculate the premium over spot yourself, and compare it across at least two sources.",
        ],
      },
      {
        heading: "Urgency and Pressure",
        paragraphs: [
          "Pricing in precious metals changes constantly, so a degree of time-sensitivity is real. But dealers who use urgency as a pressure tactic — \"prices are about to spike,\" \"this is a limited window,\" \"you need to decide today\" — are often using that framing to discourage careful evaluation.",
          "A trustworthy dealer will give you time to think, answer your questions clearly, and welcome comparison. If the pressure to buy is coming from outside you, it is usually worth pausing.",
        ],
      },
      {
        heading: "Promotions That Seem Like Deals",
        paragraphs: [
          "\"Free silver with every purchase\" and similar promotions are common in the industry. In most cases, the cost of the silver is embedded in the price of the gold you are buying. The deal is not free — it has simply been bundled in a way that is hard to evaluate on its own.",
          "The best way to evaluate any promotion is to ask: what is the all-in price per ounce of each metal I am receiving, and how does that compare to what I would pay purchasing each separately?",
        ],
      },
    ],
    related: [
      "what-spot-price-really-means",
      "bullion-vs-proof-coins",
      "why-free-silver-is-never-free",
      "what-happens-after-you-buy-gold",
    ],
  },

  {
    slug: "why-free-silver-is-never-free",
    title: "Why \"Free Silver\" Is Never Free",
    excerpt:
      "Understand how \"free silver\" promotions are usually priced into the deal and what they really cost buyers.",
    group: "understanding-pricing",
    metaDescription:
      "Free silver promotions are a common tactic in the precious metals industry. Here is how to evaluate them and what they actually cost.",
    sections: [
      {
        heading: "The Promotion Sounds Better Than It Is",
        paragraphs: [
          "\"Buy one ounce of gold and receive free silver\" is a common promotional offer in the precious metals industry. It sounds like a genuine bonus. In practice, it rarely is.",
          "The silver is not free. Its cost has simply been moved from a visible line item into the price of the gold. You are paying for it — you just cannot see where.",
        ],
      },
      {
        heading: "How the Pricing Usually Works",
        paragraphs: [
          "Dealers who run these promotions typically price their gold at a higher premium than they otherwise would. If a dealer's normal gold price carries a 4% premium over spot, a \"free silver\" promotion might carry a 7–10% premium instead. The difference covers — and usually exceeds — the cost of the silver being offered.",
          "Because buyers often do not calculate premiums carefully, and because the silver feels like a bonus, the mental framing works. The total cost looks appealing even when the per-ounce economics are worse than a straightforward purchase.",
        ],
      },
      {
        heading: "How to Evaluate Any Promotion",
        paragraphs: [
          "The evaluation is straightforward if you are willing to do the math. Calculate the total cost you are being asked to pay. Subtract the fair market value of the silver being offered (quantity × current spot, plus a reasonable premium). Divide the remainder by the number of gold ounces you are receiving. Compare that price to what you would pay for gold alone from the same or a competing dealer.",
          "If the effective price per gold ounce is higher with the promotion than without it, the silver was not free.",
        ],
      },
      {
        heading: "Simpler Alternatives",
        paragraphs: [
          "If you want both gold and silver, buy both separately at transparent prices. Ask each dealer for their all-in price per ounce for each metal. Compare. Combine the purchases you want at the best available prices.",
          "This approach is simpler, more transparent, and usually more economical than a bundled promotion. The metal you want is the same — the framing is just cleaner.",
        ],
      },
    ],
    related: [
      "why-people-overpay-for-gold-and-silver",
      "bullion-vs-proof-coins",
      "what-spot-price-really-means",
    ],
  },

  // ─── Group 2: Making Smart Decisions ─────────────────────────────────────────
  {
    slug: "bullion-vs-proof-coins",
    title: "Bullion vs. Proof Coins: What Most Buyers Get Wrong",
    excerpt:
      "A clear explanation of why bullion usually makes more sense for investors, while proof coins are generally better suited for collectors.",
    group: "making-smart-decisions",
    metaDescription:
      "Bullion and proof coins look similar but serve different purposes. Understand the difference before you buy.",
    sections: [
      {
        heading: "Two Products, Two Very Different Price Structures",
        paragraphs: [
          "Gold and silver coins generally fall into two categories: bullion coins and proof coins. They often feature the same designs and carry the same government guarantees of weight and purity. But their price structures and the markets they are designed for are quite different.",
          "Knowing which is which — and which is right for your purpose — can make a meaningful difference in what you pay and what you get back when you sell.",
        ],
      },
      {
        heading: "What Bullion Coins Are",
        paragraphs: [
          "Bullion coins are struck in large quantities for investment purposes. Their value is tied primarily to their metal content — the weight of gold or silver they contain. Premiums over spot are typically modest: 3–6% for gold, 15–25% for silver under normal market conditions.",
          "They are widely traded, recognized by dealers globally, and straightforward to price and sell. Common examples include the American Gold Eagle, the Gold Buffalo, and the American Silver Eagle.",
        ],
      },
      {
        heading: "What Proof Coins Are",
        paragraphs: [
          "Proof coins are struck using a different, more labor-intensive process that produces a mirror-like finish and sharper detail. They are typically sold in limited editions, presented in display cases with certificates of authenticity, and graded by independent agencies.",
          "Because of their collectible nature, proof coins carry much higher premiums — often 50–100% above spot or more. That premium reflects craftsmanship, rarity, and collector demand, not metal value.",
        ],
      },
      {
        heading: "Which Is Right for Most Investors",
        paragraphs: [
          "If your goal is to hold physical metal as a store of value, hedge, or IRA asset, bullion coins almost always make more sense. The lower premium means you are closer to the underlying metal's value on day one, and the liquid secondary market means you can sell efficiently without relying on a collector's market.",
          "Proof coins can be excellent for collectors who understand and value their numismatic premium. They are a poor choice for buyers who believe they are simply buying metal at a modest premium and who expect to sell at or near spot when they choose to exit.",
        ],
      },
      {
        heading: "A Simple Question to Ask Before You Buy",
        paragraphs: [
          "Before purchasing any coin, ask: \"What would this dealer pay me if I wanted to sell this coin back today?\" For bullion, that answer should be close to current spot. For a proof coin with a 60% numismatic premium, the buyback price is almost certainly far below what you paid.",
          "The spread between your purchase price and your potential sell price is a real cost. Minimizing it — by choosing bullion — is one of the most effective things a buyer can do.",
        ],
      },
    ],
    related: [
      "why-people-overpay-for-gold-and-silver",
      "what-spot-price-really-means",
      "how-to-choose-a-gold-dealer-without-getting-burned",
    ],
  },

  {
    slug: "what-the-gold-to-silver-ratio-actually-means",
    title: "What the Gold-to-Silver Ratio Actually Means",
    excerpt:
      "A simple explanation of what the gold-to-silver ratio measures, what it can tell you, and what it cannot.",
    group: "making-smart-decisions",
    metaDescription:
      "The gold-to-silver ratio is widely discussed but frequently misunderstood. Here is what it actually measures and how to think about it.",
    sections: [
      {
        heading: "A Simple Measure of Relative Value",
        paragraphs: [
          "The gold-to-silver ratio tells you how many ounces of silver it takes to buy one ounce of gold at current prices. If gold is $3,000 per ounce and silver is $30 per ounce, the ratio is 100:1.",
          "It is one of the oldest pricing relationships tracked in the precious metals market and is referenced frequently by analysts and investors as a measure of relative value between the two metals.",
        ],
      },
      {
        heading: "What the Historical Range Looks Like",
        paragraphs: [
          "Over the last 50 years, the ratio has ranged from roughly 15:1 at its low (around 1980, during silver's historic spike) to above 120:1 at its high (during the early months of the COVID-19 pandemic in 2020). The long-term average since the 1970s has been approximately 55–75:1.",
          "When the ratio is significantly above historical norms, silver is relatively inexpensive compared to gold. When it is significantly below, silver is relatively expensive.",
        ],
      },
      {
        heading: "What It Can Suggest",
        paragraphs: [
          "At extreme ratio levels, some investors choose to shift allocation between the two metals. A ratio well above 90 might suggest silver is historically cheap relative to gold, which could make silver a more attractive entry point for new metal purchases.",
          "This is not a timing signal. It does not predict what either metal will do in dollar terms. It simply describes a relationship between the two prices at a given moment.",
        ],
      },
      {
        heading: "What It Cannot Tell You",
        paragraphs: [
          "The ratio cannot tell you whether metals will rise or fall in price. It cannot tell you when to buy or sell. An extreme ratio can persist for months or years before reverting. Investors who have made large allocation decisions based solely on the ratio have sometimes waited a very long time — or lost money in dollar terms — even when the ratio eventually moved in the direction they expected.",
          "Think of it as one useful data point among several, not as a predictive tool.",
        ],
      },
    ],
    related: [
      "when-does-it-actually-make-sense-to-adjust-between-gold-and-silver",
      "why-pricing-everything-in-dollars-can-be-misleading",
      "what-spot-price-really-means",
    ],
  },

  {
    slug: "when-does-it-actually-make-sense-to-adjust-between-gold-and-silver",
    title: "When Does It Actually Make Sense to Adjust Between Gold and Silver?",
    excerpt:
      "A grounded look at when small, thoughtful allocation adjustments may make sense — and when they do not.",
    group: "making-smart-decisions",
    metaDescription:
      "Thinking about shifting between gold and silver? Here is an honest, grounded framework for when it makes sense and when it does not.",
    sections: [
      {
        heading: "The Question Most People Ask Too Often",
        paragraphs: [
          "\"Should I be in more gold or more silver right now?\" is a question many precious metals buyers return to frequently. Sometimes the ratio shifts. A market commentator flags something. A headline creates urgency. The impulse to act feels rational.",
          "In most cases, the best answer is to do nothing — or at minimum, to think carefully before acting.",
        ],
      },
      {
        heading: "When a Small Adjustment May Make Sense",
        paragraphs: [
          "There are circumstances where thoughtfully adjusting between gold and silver is reasonable. If you are making a new purchase and the gold-to-silver ratio is at a historical extreme, that information can inform which metal you add to your existing position — all else being equal.",
          "If your existing allocation has drifted significantly from your original intent — for example, a large silver position has grown disproportionately because of price movement — rebalancing to your target may make sense.",
          "If your storage or liquidity needs have changed — silver is more difficult to store and less efficient per dollar — shifting toward gold can reflect a practical change in circumstances, not speculation.",
        ],
      },
      {
        heading: "When It Usually Does Not Make Sense",
        paragraphs: [
          "Adjusting based on short-term price movements is almost always a mistake. Precious metals are long-term holdings. Reacting to a week or month of relative performance introduces transaction costs and the risk of poor timing without a clear strategic reason.",
          "Adjusting based on predictions about where the ratio \"should\" go is similarly problematic. The ratio can stay at extremes far longer than most investors expect. Acting on a prediction is different from acting on a changed circumstance.",
        ],
      },
      {
        heading: "A Simple Framework",
        paragraphs: [
          "Before making any change, ask three questions: Has my financial situation or time horizon changed? Has my allocation drifted from my original intent? Is there a practical reason — storage, liquidity, IRA structure — driving this decision?",
          "If none of those questions has a clear \"yes,\" the adjustment is probably not about strategy. It is about the discomfort of watching prices move. That discomfort is normal, but it is not a good reason to trade.",
        ],
      },
    ],
    related: [
      "what-the-gold-to-silver-ratio-actually-means",
      "gold-vs-silver-storage-transport-and-real-world-practicality",
      "why-pricing-everything-in-dollars-can-be-misleading",
    ],
  },

  {
    slug: "why-pricing-everything-in-dollars-can-be-misleading",
    title: "Why Pricing Everything in Dollars Can Be Misleading",
    excerpt:
      "Why comparing assets only in dollars can hide important relationships, and how relative pricing can offer better perspective.",
    group: "making-smart-decisions",
    metaDescription:
      "Dollar-denominated pricing can obscure what is really happening with gold and silver. Here is a clearer way to think about value.",
    sections: [
      {
        heading: "The Dollar Is Not a Fixed Measuring Stick",
        paragraphs: [
          "When we say gold costs $4,000 per ounce, we are measuring gold in dollars. That seems straightforward — but the dollar itself is not a fixed unit. Its purchasing power changes over time, sometimes rapidly.",
          "When the dollar weakens, gold often rises in dollar terms — not because gold has become more valuable, but because the measuring stick has shrunk. A price chart that shows only the dollar price of gold can mislead buyers into thinking something fundamental has changed when, in some cases, only the currency has moved.",
        ],
      },
      {
        heading: "Gold Priced in Other Currencies",
        paragraphs: [
          "Gold reached all-time highs in euros, British pounds, and Japanese yen before it did so in U.S. dollars. In many currencies, gold's purchasing power had been rising steadily for years before American buyers noticed what the dollar price was doing.",
          "Looking at gold across multiple currencies can give a clearer sense of whether metal prices are genuinely rising in real terms or whether currency movement is doing most of the work.",
        ],
      },
      {
        heading: "The Gold-to-Oil and Gold-to-Housing Relationships",
        paragraphs: [
          "Another way to see through the dollar is to price assets relative to each other. How many ounces of gold does it take to buy a median home? How many barrels of oil does one ounce of gold purchase? These relationships strip the dollar out entirely and show relative purchasing power directly.",
          "Over very long periods, gold has maintained relatively stable purchasing power against real goods — housing, energy, food — even as its dollar price has swung dramatically. This is part of what makes it useful as a long-term store of value.",
        ],
      },
      {
        heading: "What This Means Practically",
        paragraphs: [
          "Practically, this does not change how you buy or sell physical metal. Transactions are in dollars and will remain so. But understanding that the dollar price of gold reflects both the value of gold and the state of the dollar helps you interpret market moves more clearly.",
          "When you see gold's dollar price rise sharply, ask: is this gold getting more valuable, the dollar getting less valuable, or both? The answer shapes how you think about it — and what you should do, if anything.",
        ],
      },
    ],
    related: [
      "what-the-gold-to-silver-ratio-actually-means",
      "when-does-it-actually-make-sense-to-adjust-between-gold-and-silver",
      "what-spot-price-really-means",
    ],
  },

  // ─── Group 3: Ownership and Practical Reality ─────────────────────────────────
  {
    slug: "what-happens-after-you-buy-gold",
    title: "What Happens After You Buy Gold",
    excerpt:
      "A practical overview of what ownership looks like after purchase, including storage, liquidity, insurance, and planning.",
    group: "ownership-and-practicality",
    metaDescription:
      "Gold ownership does not end at purchase. Here is a practical guide to what happens next — storage, insurance, liquidity, and long-term planning.",
    sections: [
      {
        heading: "Ownership Is More Than Possession",
        paragraphs: [
          "Buying physical gold is the beginning of a relationship with the metal, not the end of the decision process. What you do with it after purchase — where you store it, how you insure it, how you plan to use or liquidate it — matters as much as the purchase itself.",
          "Most buyers think carefully about price. Fewer think carefully about what comes next.",
        ],
      },
      {
        heading: "Storage Options",
        paragraphs: [
          "Physical gold can be stored at home, in a bank safe deposit box, or in a professional third-party depository. Each option has different implications for cost, accessibility, and risk.",
          "Home storage gives you immediate access but creates insurance and security challenges. A bank safe deposit box is inexpensive but may not be fully insured by the bank and is not accessible outside banking hours. A professional depository — typically used for IRA-held metals or larger positions — offers institutional-grade security and insurance but involves ongoing fees and reduced direct access.",
        ],
      },
      {
        heading: "Insurance",
        paragraphs: [
          "Standard homeowner's and renter's insurance policies have low limits for precious metals — often $1,000–$2,500. If you are storing significant value at home, a rider or separate precious metals policy is worth considering.",
          "Depository storage typically includes full insurance as part of the storage fee. If you store at home or in a bank box, verify your coverage carefully.",
        ],
      },
      {
        heading: "Liquidity — Selling When You Want To",
        paragraphs: [
          "Physical gold is liquid relative to most tangible assets, but it is not as liquid as a stock or ETF. To sell, you need to identify a buyer — typically a dealer — who will quote you a buyback price, arrange for the physical transfer of the metal, and process payment.",
          "This process can take a few days. If you need funds quickly, the timeline matters. Planning for eventual liquidity before you need it — knowing which dealer you would call and what their process looks like — is worth doing early.",
        ],
      },
      {
        heading: "Estate and Long-Term Planning",
        paragraphs: [
          "Physical gold does not appear in brokerage statements. It does not have automatic beneficiary designations. If something happens to you, your heirs need to know it exists, where it is, and how to access it.",
          "Make sure the location and access details are documented somewhere trusted — whether in a will, a letter of instruction, or another secure document. This is a small step that matters significantly to the people who come after you.",
        ],
      },
    ],
    related: [
      "gold-vs-silver-storage-transport-and-real-world-practicality",
      "gold-ira-what-actually-happens-step-by-step",
      "why-people-overpay-for-gold-and-silver",
    ],
  },

  {
    slug: "gold-vs-silver-storage-transport-and-real-world-practicality",
    title: "Gold vs. Silver: Storage, Transport, and Real-World Practicality",
    excerpt:
      "A practical comparison of what it is actually like to own, store, move, and manage gold versus silver.",
    group: "ownership-and-practicality",
    metaDescription:
      "Gold and silver look similar on a pricing chart but feel very different to own. Here is an honest comparison of the practical realities of each.",
    sections: [
      {
        heading: "The Same Dollar Amount Feels Very Different",
        paragraphs: [
          "One hundred thousand dollars in gold weighs roughly 22 ounces — less than two pounds. One hundred thousand dollars in silver, at current prices, might weigh 200 pounds or more. The physical reality of owning silver at scale is something many buyers do not fully consider before they purchase.",
          "This does not make silver a poor choice — but it does mean the practical experience of ownership is meaningfully different depending on which metal you hold.",
        ],
      },
      {
        heading: "Storage: Size and Cost",
        paragraphs: [
          "Gold is the most efficient store of value per unit of space and weight. A modest safe can hold a significant dollar value. Silver requires considerably more physical space for the same dollar amount, which means more storage volume, heavier safes, and higher costs if you use a depository.",
          "For IRA-held metals, depositories typically charge storage fees based on value, weight, or both. Silver's weight disadvantage can translate directly into higher ongoing fees per dollar of value held.",
        ],
      },
      {
        heading: "Transport and Shipping",
        paragraphs: [
          "Moving gold is straightforward because of its density. Moving silver at scale is physically demanding and can involve significant shipping costs and insurance premiums due to its weight.",
          "If you anticipate ever needing to move your metals — whether relocating, consolidating with a depository, or liquidating — the transport picture matters. Gold is far easier to move confidentially and efficiently.",
        ],
      },
      {
        heading: "Liquidity and Dealer Markets",
        paragraphs: [
          "Both gold and silver are widely tradeable. Standard bullion coins in either metal are recognized by dealers globally and can be sold without difficulty.",
          "The process is largely the same: contact a dealer, get a quote, arrange for transfer or shipment, receive payment. Silver transactions at scale may involve more physical coordination due to weight and volume.",
        ],
      },
      {
        heading: "Which Is Right for You",
        paragraphs: [
          "For most buyers focused on wealth preservation and IRA allocation, gold is the more practical primary holding. Silver makes sense for buyers who want more leverage to metal price movements, have straightforward storage arrangements, or want a portion of their allocation in a lower per-unit metal.",
          "The right split depends on your circumstances, not on a general rule. Thinking through the practical realities of storage and liquidity before you buy is always worthwhile.",
        ],
      },
    ],
    related: [
      "what-happens-after-you-buy-gold",
      "when-does-it-actually-make-sense-to-adjust-between-gold-and-silver",
      "why-people-overpay-for-gold-and-silver",
    ],
  },

  {
    slug: "gold-ira-what-actually-happens-step-by-step",
    title: "Gold IRA: What Actually Happens Step-by-Step",
    excerpt:
      "A straightforward explanation of the self-directed IRA process, from rollover to storage.",
    group: "ownership-and-practicality",
    metaDescription:
      "Confused about how a gold IRA actually works? Here is a clear, step-by-step explanation of the process from account opening to physical storage.",
    sections: [
      {
        heading: "What a Gold IRA Actually Is",
        paragraphs: [
          "A \"gold IRA\" is a self-directed Individual Retirement Account that holds physical precious metals rather than — or in addition to — stocks, bonds, and mutual funds. The tax treatment is the same as a traditional or Roth IRA. The difference is that a specialized custodian holds the account, and the physical metal is stored at an IRS-approved depository.",
          "You do not take direct possession of the metals while they are in an IRA. The structure exists to maintain the tax-advantaged status of the account.",
        ],
      },
      {
        heading: "Step 1: Open a Self-Directed IRA",
        paragraphs: [
          "Standard IRA custodians — brokerages, banks — do not hold physical metals. To hold gold or silver in an IRA, you need a self-directed IRA custodian that specializes in alternative assets. Your dealer can typically recommend custodians they work with regularly.",
          "Opening the account involves the same documentation as any IRA: identity verification, beneficiary designations, and account agreements.",
        ],
      },
      {
        heading: "Step 2: Fund the Account",
        paragraphs: [
          "Most people fund a gold IRA through a rollover from an existing 401(k), 403(b), or traditional IRA. This is typically a tax-free transfer when handled correctly — the custodian handles the movement of funds directly between institutions.",
          "You can also make a new contribution, subject to annual IRS contribution limits. For most buyers doing rollovers, the process takes one to three weeks from start to funded account.",
        ],
      },
      {
        heading: "Step 3: Purchase the Metals",
        paragraphs: [
          "Once the account is funded, you direct the custodian to purchase specific IRS-approved metals from an approved dealer. Not all metals are eligible — the IRS requires a minimum purity of .995 for gold (.999 for silver), which American Eagles, Buffalos, and most major bullion coins meet.",
          "The purchase is made in your name through the custodian. You confirm the product, the quantity, and the price. The metals are then shipped directly to the depository.",
        ],
      },
      {
        heading: "Step 4: Ongoing Storage and Reporting",
        paragraphs: [
          "Your metals are held in an IRS-approved depository — a facility with institutional-grade security and insurance. You receive statements from the custodian showing the value and composition of your account.",
          "Annual fees typically include custodian administration fees and depository storage fees. These vary by custodian and depository. Transparency on fees is something worth asking about before you open an account — some custodians have complicated fee structures that are not obvious at the outset.",
        ],
      },
      {
        heading: "Taking Distributions",
        paragraphs: [
          "When you take a distribution from a traditional gold IRA, you pay ordinary income tax — the same as you would on a traditional IRA or 401(k) distribution. You can take the distribution as cash (the metals are sold) or as physical metal (shipped to you), depending on your custodian's policies.",
          "The rules around required minimum distributions (RMDs) apply the same way they do to any traditional IRA. Planning for how and when you will take distributions is worth discussing with a tax advisor.",
        ],
      },
    ],
    related: [
      "what-happens-after-you-buy-gold",
      "why-people-overpay-for-gold-and-silver",
      "bullion-vs-proof-coins",
    ],
  },

  // ─── Group 4: Choosing Who to Trust ──────────────────────────────────────────
  {
    slug: "the-one-question-every-gold-buyer-should-ask",
    title: "The One Question Every Gold Buyer Should Ask",
    excerpt:
      "The single most useful question a buyer can ask to understand real cost, spread, and transparency.",
    group: "choosing-who-to-trust",
    metaDescription:
      "Before buying gold or silver from any dealer, there is one question that reveals more than any other. Here is what it is and why it matters.",
    sections: [
      {
        heading: "Most Buyers Ask the Wrong Question First",
        paragraphs: [
          "The first question most buyers ask when considering a dealer is: \"What is your price for one ounce of gold?\" That is a reasonable starting point, but it does not tell you very much on its own.",
          "The question that tells you far more — and that many buyers never think to ask — is this: \"What would you pay me if I wanted to sell this back to you today?\"",
        ],
      },
      {
        heading: "Why This Question Is So Useful",
        paragraphs: [
          "The gap between what a dealer charges to sell and what they will pay to buy is called the spread. A dealer with a tight spread — say, 2–3% — is operating transparently and efficiently. A dealer with a wide spread — 10%, 20%, or more — is extracting far more value from each transaction.",
          "If a dealer sells you gold at $4,500 per ounce but will only buy it back at $3,800, you have effectively paid a 15% entry cost. That cost is real, it is permanent until the spread closes, and it is not visible in the buy price alone.",
        ],
      },
      {
        heading: "What a Good Answer Looks Like",
        paragraphs: [
          "A trustworthy dealer will give you a clear, specific buyback price without hesitation. They will tell you what they pay for the specific product they are selling you, and it will be close to current spot — typically 0–3% below spot for standard bullion coins.",
          "If a dealer is reluctant to give you a buyback price, cannot tell you clearly what it would be, or suggests that selling back is complicated or unusual, that is worth noting.",
        ],
      },
      {
        heading: "Ask It Before You Buy",
        paragraphs: [
          "This question is most useful before you commit to a purchase. Ask it early in the conversation. A dealer who gives you a clear, competitive buyback price is telling you something important about how they operate. A dealer who deflects or complicates the question is telling you something important too.",
          "Transparency on buyback pricing is one of the clearest signals of a dealer who is actually aligned with their customers' interests.",
        ],
      },
    ],
    related: [
      "why-people-overpay-for-gold-and-silver",
      "bullion-vs-proof-coins",
      "how-to-choose-a-gold-dealer-without-getting-burned",
    ],
  },

  {
    slug: "how-to-choose-a-gold-dealer-without-getting-burned",
    title: "How to Choose a Gold Dealer (Without Getting Burned)",
    excerpt:
      "A trust-focused guide to understanding incentives, evaluating dealers, and avoiding confusing or high-margin sales tactics.",
    group: "choosing-who-to-trust",
    metaDescription:
      "Choosing the right gold dealer protects your investment from the start. Here is a practical, clear-eyed guide to evaluating dealers and avoiding costly mistakes.",
    sections: [
      {
        heading: "The Industry Has a Wide Range",
        paragraphs: [
          "The precious metals industry ranges from highly transparent, low-margin operations to high-pressure sales environments built around generating maximum revenue per customer. Both present themselves as trustworthy. The difference is not always obvious from the outside.",
          "Knowing what to look for — and what to avoid — makes it substantially easier to find a dealer who is actually working in your interest.",
        ],
      },
      {
        heading: "Look for Transparent, All-In Pricing",
        paragraphs: [
          "A good dealer makes it easy to understand exactly what you are paying. They will tell you the spot price, the premium over spot, the total per-ounce price, and any other fees — clearly, before you commit.",
          "If you have to work hard to figure out what something actually costs, that difficulty is usually deliberate. Complexity in pricing almost always serves the seller.",
        ],
      },
      {
        heading: "Clear Buyback Pricing Is Non-Negotiable",
        paragraphs: [
          "Ask every dealer what they would pay you if you wanted to sell back the product they are selling you — today, at this moment. A reputable dealer will give you a specific, competitive answer. They will quote you a price close to spot without hesitation.",
          "A wide or unclear buyback spread is the single most common way buyers get trapped in unfavorable positions. If a dealer will not commit to a buyback price, or the spread is large, your effective cost of entry is much higher than the purchase price suggests.",
        ],
      },
      {
        heading: "Red Flags Worth Noting",
        paragraphs: [
          "Urgency and pressure: Any dealer who creates a sense of crisis to speed your decision is using a tactic, not giving you information. Good pricing and good advice do not require urgency.",
          "Excessive promotions: \"Free silver,\" bonus coins, and complicated bundle deals are almost always priced into the purchase. If it is hard to evaluate what you are actually getting, that difficulty is by design.",
          "Numismatic products positioned as investments: Collectible or graded coins are sold at very high premiums and bought back at much lower ones. If a dealer is steering you toward numismatics without fully explaining the premium structure, that is a concern.",
        ],
      },
      {
        heading: "What Good Dealers Have in Common",
        paragraphs: [
          "They are easy to reach and easy to talk to. They explain pricing clearly without being asked. They answer the buyback question directly. They do not rush you. They are willing to compare their pricing to competitors. They confirm trades verbally before execution and do not execute without cleared funds.",
          "Trust is built through clarity and consistency. A dealer who is transparent when it is not in their short-term interest to be is one worth working with.",
        ],
      },
    ],
    related: [
      "the-one-question-every-gold-buyer-should-ask",
      "bullion-vs-proof-coins",
      "why-people-overpay-for-gold-and-silver",
    ],
  },
];

export function getArticleBySlug(slug: string): InsightArticle | undefined {
  return INSIGHTS.find((a) => a.slug === slug);
}

export function getRelatedArticles(slugs: string[]): InsightArticle[] {
  return slugs
    .map((s) => INSIGHTS.find((a) => a.slug === s))
    .filter((a): a is InsightArticle => a !== undefined);
}

export function getArticlesByGroup(groupId: string): InsightArticle[] {
  return INSIGHTS.filter((a) => a.group === groupId);
}
