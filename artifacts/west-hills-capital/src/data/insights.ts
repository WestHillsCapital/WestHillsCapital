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
      "Learn what spot price really means, where it comes from, and why it is only the starting point for physical gold and silver buyers.",
    sections: [
      {
        heading: "What spot price actually is",
        paragraphs: [
          "In plain terms, spot price is the current market price for one ounce of gold or silver, based on large-scale financial trading.",
          "It is the industry's reference point. When you look up the price of gold, that is usually the number you are seeing.",
          "But it is important to understand this clearly: spot price is not what you pay. It is the starting point.",
        ],
      },
      {
        heading: "Where spot price comes from",
        paragraphs: [
          "Spot price is not set by a single company or dealer.",
          "It comes from global markets where metals are traded continuously, primarily through large financial exchanges and over-the-counter markets.",
          "These markets are active nearly around the clock. Prices move based on buying and selling activity, market expectations, and broader financial conditions.",
          "At any given moment, spot price reflects the most recent agreement between buyers and sellers in those markets.",
        ],
      },
      {
        heading: "The part most people never hear",
        paragraphs: [
          "Most spot pricing is influenced by financial contracts, not physical metal changing hands.",
          "That means the price you see is shaped largely by futures markets, institutional trading, and liquidity flows, not just by people buying coins and bars for delivery.",
        ],
      },
      {
        heading: "Why that distinction matters",
        paragraphs: [
          "There are two different realities at work.",
          "One is financial market pricing, which is highly liquid, constantly traded, and driven by large market participants.",
          "The other is the physical market, where actual metal is bought and sold, and where real-world supply, demand, and logistics matter.",
          "These two often move together, but they are not identical.",
        ],
      },
      {
        heading: "Why spot price can feel disconnected",
        paragraphs: [
          "At times, people notice strong demand for physical metals but very little movement in spot price.",
          "Or they see premiums rise while spot stays flat.",
          "That is because spot price reflects financial market activity first, not physical demand alone.",
        ],
      },
      {
        heading: "Spot price is useful, but incomplete",
        paragraphs: [
          "Spot price plays an important role. It provides a common reference, allows pricing comparison, and creates structure across the global market.",
          "But it should not be misunderstood as a perfect measure of physical supply and demand.",
          "It is better described as a highly liquid financial price.",
        ],
      },
      {
        heading: "Why you do not pay spot",
        paragraphs: [
          "When you buy physical gold or silver, you are not buying a number on a screen. You are buying a real product.",
          "That includes refining, minting, shipping, insurance, storage, and handling.",
          "That is why your actual price is spot price plus premium.",
          "Premiums are normal. The key is whether they are fair, transparent, and consistent.",
        ],
      },
      {
        heading: "What this means for buyers",
        paragraphs: [
          "You do not need to predict spot price. You do not need to time every move.",
          "You just need to understand what spot represents, what it does not represent, and how it connects to the price you actually pay.",
          "That alone puts you ahead of most buyers.",
        ],
      },
      {
        heading: "A better way to think about it",
        paragraphs: [
          "Instead of asking what gold is trading at, ask what structure sits behind that price.",
          "Once you understand that, the rest becomes much clearer.",
        ],
      },
      {
        heading: "The connection to other decisions",
        paragraphs: [
          "Spot price is just one part of the equation.",
          "It connects directly to premiums, product choice, and relative value.",
          "Understanding spot helps you understand everything else.",
        ],
      },
      {
        heading: "The takeaway",
        paragraphs: [
          "Spot price matters, but it is not the full picture.",
          "It is a reference point, a financial market price, and a starting line, not the finish line.",
        ],
      },
      {
        heading: "Final thought",
        paragraphs: [
          "The industry often presents spot price as if it tells you everything. It does not.",
          "But once you understand what it is and what it is not, you can make decisions based on clarity instead of assumption.",
          "And in this space, that makes a meaningful difference.",
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
      "Learn why people overpay for gold and silver, where hidden markups come from, and how to avoid costly product and pricing mistakes.",
    sections: [
      {
        heading: "Most people think the biggest risk is timing",
        paragraphs: [
          "A lot of people think the biggest risk in buying gold and silver is buying at the wrong time.",
          "It is not.",
          "The bigger risk is paying far too much and not realizing it until later.",
        ],
      },
      {
        heading: "Why this happens so often",
        paragraphs: [
          "This happens more often than most people think, and usually not because the buyer is careless.",
          "It happens because the precious metals industry can be confusing on purpose.",
          "If you do not understand how pricing works, what products make sense, and where commissions are hiding, it is easy to overpay by thousands or much more.",
        ],
      },
      {
        heading: "Most buyers think they are buying metal",
        paragraphs: [
          "In many cases, they are really buying a sales pitch, a high-commission product, a story, fear, or complexity dressed up as value.",
          "That is where trouble starts.",
          "Because in precious metals, what you buy matters just as much as how much you buy.",
        ],
      },
      {
        heading: "Premiums are normal, but not all premiums are reasonable",
        paragraphs: [
          "No one sells physical gold or silver at the raw market price with no cost built in.",
          "There are real costs involved, including refining, minting, shipping, insurance, handling, and business operations.",
          "That part is normal.",
          "The problem starts when a reasonable premium turns into an excessive markup hidden behind product language, scarcity claims, or emotional sales tactics.",
        ],
      },
      {
        heading: "The biggest reason people overpay: product selection",
        paragraphs: [
          "A buyer calls looking for gold or silver, and instead of simple bullion, they are steered into products with much higher margins.",
          "That may mean proof coins, graded coins, semi-numismatics, common-date so-called rare coins, high-premium fractional pieces, or products bundled with free silver.",
          "The customer thinks they are buying metal.",
          "What they are often really buying is a commission structure.",
        ],
      },
      {
        heading: "Bullion vs. proof: where a lot of damage gets done",
        paragraphs: [
          "If your goal is to own physical metal for wealth preservation, liquidity, and simplicity, bullion usually makes far more sense than proof products.",
          "Why? Because bullion is priced closer to the value of the metal itself.",
          "Proof coins often carry much higher premiums.",
          "That does not automatically make them bad. It just means they are usually better suited for collectors than for people whose priority is getting the most metal for their money.",
        ],
      },
      {
        heading: "Quantity matters more than most people realize",
        paragraphs: [
          "This is one of the simplest ways to think clearly.",
          "If two people spend the same amount of money, but one ends up with significantly more ounces, the difference matters.",
          "Because the more money that goes to markup, the less money goes into metal.",
          "In this business, buyers should always be asking how much of their money is actually going into metal.",
        ],
      },
      {
        heading: "Fractional coins can quietly become very expensive",
        paragraphs: [
          "Fractional gold has a place. Smaller pieces can make sense in certain situations.",
          "But many buyers do not realize how expensive they can become on a per-ounce basis.",
          "A tenth-ounce coin may feel more affordable because the upfront price is lower. But when you compare the implied cost per ounce, the premium is often much higher than on a one-ounce coin.",
          "That means the buyer is paying more for less gold.",
        ],
      },
      {
        heading: "Free silver is usually not free",
        paragraphs: [
          "This is one of the oldest games in the business.",
          "A company offers free silver, no fees, or some kind of bonus metal to make the deal feel generous.",
          "But the cost is usually built in somewhere else: higher markups on the main products, higher overall pricing, or less metal for the same amount of money.",
          "Nothing is free in a transaction built for profit.",
        ],
      },
      {
        heading: "Confusion is profitable",
        paragraphs: [
          "A lot of buyers are not comparing simple bullion pricing against simple bullion pricing.",
          "They are comparing unlike products, incomplete information, or emotionally loaded pitches.",
          "Once the conversation moves away from price, premium, product type, liquidity, and resale reality, and toward fear, rarity, urgency, or exclusivity, the buyer is at a disadvantage.",
        ],
      },
      {
        heading: "The resale question tells you a lot",
        paragraphs: [
          "One of the best questions a buyer can ask is simple: if I bought this today and sold it back today, what would you pay me for it?",
          "That question cuts through a lot of noise.",
          "Because the spread between the buy price and the sell-back price reveals how much room there is between market value and what you are being charged.",
        ],
      },
      {
        heading: "Overpaying is not always obvious at the time",
        paragraphs: [
          "That is part of what makes this industry difficult for new buyers.",
          "A person can complete a purchase feeling good about it. The packaging is sharp. The sales rep is confident. The company sounds established.",
          "Then later, when they go to sell or compare values more carefully, they realize how much of their money went to markup instead of metal.",
        ],
      },
      {
        heading: "What usually makes the most sense",
        paragraphs: [
          "For most buyers focused on wealth preservation, simplicity, and liquidity, straightforward bullion products tend to make the most sense.",
          "That means products with broad recognition, fair premiums, easy resale, and transparent pricing.",
          "The goal is usually not to own the most exciting product. It is to own real metal at a fair price.",
        ],
      },
      {
        heading: "A better way to think about it",
        paragraphs: [
          "When buying gold and silver, the right question is not what sounds impressive.",
          "It is what leaves me with the most real value for the dollars I am spending.",
          "That shift in thinking can save people a lot of money.",
        ],
      },
      {
        heading: "Final thought",
        paragraphs: [
          "Most people who overpay for gold and silver do not do it because they were reckless.",
          "They do it because they were not shown where the costs were hiding.",
          "When you understand the product, the premium, the resale reality, and the incentives behind the sale, you are in a much stronger position.",
          "And in this industry, that difference can mean ending up with more metal, less regret, and a much better outcome over time.",
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
      "Learn the difference between bullion and proof coins, why bullion usually makes more sense for investors, and where buyers often overpay.",
    sections: [
      {
        heading: "The debate sounds bigger than it is",
        paragraphs: [
          "If you spend enough time around precious metals, you will hear the debate: bullion vs. proof coins, what is better?",
          "There are strong opinions on both sides.",
          "But for most buyers, especially those focused on wealth preservation and long-term ownership, the answer is much simpler than it is made out to be.",
          "Bullion is for investing. Proof coins are for collecting.",
        ],
      },
      {
        heading: "A quick breakdown",
        paragraphs: [
          "Proof coins are specially minted with highly polished dies, multiple strikes, mirrored finishes, presentation packaging, and certificates of authenticity.",
          "They are designed to look exceptional, and they are priced accordingly.",
          "Bullion coins are minted for investment purposes. They are widely recognized, efficiently produced, sold in large volumes, and priced closer to the value of the metal.",
          "Most importantly, both bullion and proof coins contain the same amount of precious metal.",
        ],
      },
      {
        heading: "The key question most people never ask",
        paragraphs: [
          "If both coins contain the same amount of gold or silver, why does one cost significantly more?",
          "The answer is premium.",
        ],
      },
      {
        heading: "Understanding premiums",
        paragraphs: [
          "Every physical metal product includes the underlying spot price plus a premium.",
          "Premiums are normal, but not all premiums are equal.",
        ],
      },
      {
        heading: "Why proof coins cost more",
        paragraphs: [
          "Proof coins carry additional value beyond the metal. That includes collectibility, presentation, perceived rarity, and numismatic interest.",
          "For collectors, that can make sense.",
        ],
      },
      {
        heading: "Why that matters for investors",
        paragraphs: [
          "If your goal is preserving purchasing power, owning physical metal, and maintaining liquidity, the premium matters a great deal.",
          "Because higher premiums mean less of your money goes into actual metal.",
        ],
      },
      {
        heading: "The simplest way to think about it",
        paragraphs: [
          "Strip everything else away, and it comes down to this: if you melted both coins down, their value would be the same.",
          "So the real question becomes: why pay more for the same amount of metal?",
        ],
      },
      {
        heading: "Quantity matters",
        paragraphs: [
          "If two people spend the same amount of money, one buying bullion and one buying proof coins, the bullion buyer almost always ends up with more ounces.",
          "And over time, that difference matters.",
          "More metal means more exposure to the underlying asset.",
        ],
      },
      {
        heading: "Where people get into trouble",
        paragraphs: [
          "Most buyers do not seek out proof coins on their own. They get steered into them.",
          "It usually sounds like these are rare, protected, better performers, or what sophisticated investors buy.",
          "But what is often not explained clearly is that these products typically carry much higher commissions.",
          "And that changes the entire equation.",
        ],
      },
      {
        heading: "The numismatic trap",
        paragraphs: [
          "Numismatic coins can have value beyond metal, but that value is subjective, variable, and dependent on collector demand.",
          "Unlike bullion, which tracks the metal price directly.",
          "So while numismatics may appeal to collectors, they introduce uncertainty for investors.",
        ],
      },
      {
        heading: "A simple test",
        paragraphs: [
          "If you want clarity, ask this: if I buy this today and sell it back today, what would you pay me?",
          "That answer will tell you everything you need to know about premium, spread, and real value.",
        ],
      },
      {
        heading: "When proof coins do make sense",
        paragraphs: [
          "There is a place for proof coins.",
          "They can be great for gifts, collecting, commemorating events, and personal enjoyment.",
          "There is nothing wrong with owning them, as long as you understand you are buying a collectible, not just metal.",
        ],
      },
      {
        heading: "When bullion usually makes more sense",
        paragraphs: [
          "For most people focused on retirement, long-term wealth preservation, simplicity, and liquidity, bullion is typically the better fit.",
          "Because it keeps the focus where it belongs: on the metal itself.",
        ],
      },
      {
        heading: "The takeaway",
        paragraphs: [
          "This does not have to be complicated.",
          "Bullion coins are for investing. Proof coins are for collecting.",
          "Once you understand that, most of the noise in the industry becomes easier to see through.",
        ],
      },
      {
        heading: "Final thought",
        paragraphs: [
          "The goal is not to buy what looks impressive. It is to own real metal at a fair price.",
          "And in most cases, that means lower premiums, simpler products, and more ounces.",
          "Because in the end, it is not about how the coin looks. It is about how much metal you actually own.",
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
      "Learn how to choose a gold dealer, understand incentives, and avoid confusing pricing, product steering, and high-margin sales tactics.",
    sections: [
      {
        heading: "Why this matters more than most people realize",
        paragraphs: [
          "Choosing a gold dealer seems simple, until you realize how different the outcomes can be.",
          "Two people can spend the same amount of money and walk away with very different results.",
          "One ends up with straightforward products, fair pricing, and confidence in what they own.",
          "The other ends up with higher markups, unnecessary complexity, and less metal than they expected.",
          "The difference is rarely timing. It is usually who they chose to work with.",
        ],
      },
      {
        heading: "The industry reality",
        paragraphs: [
          "Precious metals is not a standardized market.",
          "There is no single pricing model and no universal structure.",
          "That means the experience you have depends heavily on who you work with.",
          "Some companies prioritize clarity, fair pricing, and simple products.",
          "Others rely on complexity, product steering, and higher-margin items.",
        ],
      },
      {
        heading: "Start with incentives",
        paragraphs: [
          "Every business has incentives.",
          "The key question is how does this company make money?",
          "Because that determines what they recommend, how they price, and how they guide you.",
          "If the model depends on higher-margin products, that will show up in the recommendations, even if not always obviously.",
        ],
      },
      {
        heading: "Celebrity endorsements: follow the incentives, not the face",
        paragraphs: [
          "You will often see well-known personalities promoting gold companies. That can feel reassuring.",
          "Familiar voice, recognizable face, built-in trust.",
          "But it is important to understand how these arrangements typically work: endorsements are paid, marketing budgets fund those endorsements, and those budgets come from the margins on the products being sold.",
          "In simple terms, the cost of the endorsement has to be covered somewhere.",
          "And in many cases, that somewhere is higher product markups, wider spreads, or steering into higher-margin items.",
          "That does not automatically make every company using endorsements a bad choice. But it does mean a recognizable name is not a substitute for clear pricing.",
        ],
      },
      {
        heading: "Why this matters for buyers",
        paragraphs: [
          "People naturally trust voices they recognize. That is human.",
          "But in a financial transaction, trust should come from understanding the product, understanding the pricing, and understanding the structure, not from familiarity.",
          "Even well-known personalities are paid to promote, not responsible for your outcome.",
        ],
      },
      {
        heading: "Watch the product conversation",
        paragraphs: [
          "A good dealer will ask about your goals, explain options clearly, and keep things simple.",
          "A less aligned experience often looks like immediate product pushing, steering into specific coins, or emphasis on special or exclusive offerings.",
          "If the conversation moves quickly toward high-premium products, pay attention.",
        ],
      },
      {
        heading: "Simplicity is a signal",
        paragraphs: [
          "Clear, simple recommendations are often a good sign.",
          "For most buyers, that means widely recognized bullion, standard weights, and transparent pricing.",
          "If things feel overly complex, they usually are.",
        ],
      },
      {
        heading: "Pricing should be understandable",
        paragraphs: [
          "You do not need to know everything, but you should understand what you are paying, what the premium is, and how pricing is structured.",
          "If that is unclear, that alone tells you something.",
        ],
      },
      {
        heading: "Ask the one question",
        paragraphs: [
          "This is the fastest way to understand what you are dealing with: what would you pay me for this today?",
          "That answer tells you more than any presentation ever will.",
        ],
      },
      {
        heading: "Look beyond surface reviews",
        paragraphs: [
          "Reviews can be helpful, but they should be read carefully.",
          "Look for patterns, consistency, and detailed experiences, not just star ratings.",
          "Surface-level feedback does not always tell the full story.",
        ],
      },
      {
        heading: "Pay attention to how they handle questions",
        paragraphs: [
          "A strong sign of a good dealer is clear answers, no pressure, and willingness to explain.",
          "A warning sign is deflection, urgency, or pushing past your questions.",
        ],
      },
      {
        heading: "Understand what you are being sold",
        paragraphs: [
          "Before moving forward, be clear on the type of product, why it is being recommended, and how it fits your goal.",
          "If that remains fuzzy, step back.",
        ],
      },
      {
        heading: "Avoid being rushed",
        paragraphs: [
          "Good decisions do not require pressure.",
          "If you feel rushed, pushed, or nudged toward urgency, take a step back.",
          "Clarity should come before commitment.",
        ],
      },
      {
        heading: "The takeaway",
        paragraphs: [
          "Choosing a gold dealer is not about finding the most visible company or the most recognizable name.",
          "It is about finding one that explains things clearly, prices things fairly, and keeps the focus on the metal, not the pitch.",
          "Because in this industry, confusion is often where the margin lives. Clarity removes it.",
        ],
      },
      {
        heading: "Final thought",
        paragraphs: [
          "You do not need a perfect process. You do not need to predict the market.",
          "You just need to understand what you are buying, what you are paying, and who you are buying it from.",
          "Everything else is secondary.",
          "Because in the end, the quality of your outcome is determined long before the transaction is complete.",
          "It is determined by the structure of the deal and the incentives behind it.",
        ],
      },
    ],
    related: [
      "the-one-question-every-gold-buyer-should-ask",
      "bullion-vs-proof-coins",
      "why-people-overpay-for-gold-and-silver",
    ],
  },

  // ─── ADD NEW ARTICLES BELOW THIS LINE ─────────────────────────────────────
  //
  // Copy the template below, remove the comment markers (/* and */),
  // fill in all fields, and save. The article will appear automatically
  // on /insights and at /insights/<your-slug>. No other files need editing.
  //
  // REQUIRED FIELDS: slug, title, excerpt, group, metaDescription, sections, related
  //
  // GROUP OPTIONS (use the id string exactly):
  //   "understanding-pricing"
  //   "making-smart-decisions"
  //   "ownership-and-practicality"
  //   "choosing-who-to-trust"
  //
  // SLUG RULES: lowercase, hyphens only, no spaces or special characters.
  //   The slug becomes the URL: /insights/<slug>
  //   Must be unique across all articles.
  //
  // RELATED ARTICLES: list up to 3 slugs of existing articles.
  //   Slugs that do not match an existing article are silently ignored.
  //   Order determines display order in the "Continue Reading" section.
  //
  /*
  {
    // URL path: /insights/<slug>
    // Use lowercase letters and hyphens only. Must be unique.
    slug: "your-article-slug-here",

    // Displayed as the card title on /insights and the H1 on the article page.
    title: "Your Article Title Here",

    // 1–2 sentence summary. Shown on the hub card and below the article H1.
    excerpt:
      "A clear, concise summary of what this article covers and why it is useful.",

    // Must exactly match one of the group id strings listed above.
    group: "understanding-pricing",

    // Used for SEO <meta name="description">. Keep under 160 characters.
    metaDescription:
      "A short description for search engines — ideally 120–155 characters.",

    // Article body. Each object is one section (heading + paragraphs).
    // The heading is optional — omit it for the opening section if preferred.
    // Each string in paragraphs[] becomes its own <p> tag.
    sections: [
      {
        heading: "Your First Section Heading",
        paragraphs: [
          "First paragraph of this section. Each string here is one paragraph.",
          "Second paragraph. Add as many as needed.",
        ],
      },
      {
        heading: "Your Second Section Heading",
        paragraphs: [
          "Continue writing body copy here.",
          "Each section can have as many paragraphs as needed.",
        ],
      },
      // Add more sections by copying the { heading, paragraphs } block above.
    ],

    // Up to 3 slugs of other articles to show in "Continue Reading".
    // Must match existing slugs exactly. Leave empty [] if none.
    related: [
      "what-spot-price-really-means",
      "bullion-vs-proof-coins",
    ],
  },
  */
  // ─────────────────────────────────────────────────────────────────────────────
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
