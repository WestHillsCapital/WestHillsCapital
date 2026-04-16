import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  q: string;
  a: string | React.ReactNode;
}

const SECTIONS: { title: string; items: FAQItem[] }[] = [
  {
    title: "Getting Started",
    items: [
      {
        q: "What does West Hills Capital actually do?",
        a: "We help clients allocate a portion of their savings into physical gold and silver — coins and bars they own outright and can take delivery of or hold in an IRA. We don't sell financial products, manage portfolios, or give investment advice. Our focus is disciplined, transparent execution of physical metal purchases.",
      },
      {
        q: "What happens on the allocation call?",
        a: "We'll review what you're trying to accomplish, walk through current pricing, and answer any questions. We block 45 minutes for every call, though some are shorter and some run longer depending on what you need. There's no pressure and no pitch — if the timing isn't right, we'll tell you.",
      },
      {
        q: "Do I have to commit to anything before the call?",
        a: "No. The call is a conversation. You're under no obligation to purchase. Trades are only executed after you give verbal confirmation on a recorded line and funds have cleared.",
      },
      {
        q: "Is there a minimum order?",
        a: (
          <>
            There's no formal minimum, but shipping and insurance is a flat{" "}
            <strong>$25</strong> on orders below 300 American Silver Eagles or 15 American Gold Eagles/Gold Bars. On very small orders that $25 can represent a meaningful percentage of the total cost — we'll always point that out so you can decide what makes sense.
          </>
        ),
      },
    ],
  },
  {
    title: "Pricing & Commissions",
    items: [
      {
        q: "How is pricing determined?",
        a: "All pricing is based on the live spot price of gold or silver at the time of your trade. We source metal through Dillon Gage, one of the largest wholesale precious metals dealers in the country, and add a flat commission on top of our cost.",
      },
      {
        q: "What commission do you charge?",
        a: (
          <>
            We charge a flat percentage over our cost:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Gold: 2%</strong></li>
              <li><strong>Silver: 5%</strong></li>
            </ul>
            <p className="mt-2">
              That's it. No hidden fees, no "handling" add-ons. The commission is built into the per-unit price we quote you — you'll see the exact per-ounce breakdown before you confirm.
            </p>
          </>
        ),
      },
      {
        q: "Why is silver's commission higher than gold?",
        a: "Silver is priced lower per ounce but is physically heavier and bulkier, so shipping, insurance, and handling costs are proportionally higher relative to the metal's value. The 5% rate on silver reflects those real costs.",
      },
      {
        q: "Does the price change between the call and execution?",
        a: "We lock in pricing at the moment you give verbal confirmation on the call. Between then and when funds clear, spot prices can move — we'll always be transparent about this. We do not trade on your behalf until cleared funds are received.",
      },
    ],
  },
  {
    title: "Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: (
          <>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Wire transfer</strong> — fastest; allows us to lock in pricing and ship the same day funds arrive in most cases</li>
              <li><strong>Personal check</strong> — accepted, but must fully clear before we execute the trade. This typically adds 5–7 business days.</li>
              <li><strong>Cashier's check</strong> — treated as cash; same-day processing</li>
            </ul>
            <p className="mt-3 text-sm text-foreground/60">We do not accept credit cards or ACH transfers at this time.</p>
          </>
        ),
      },
      {
        q: "What are your wire transfer instructions?",
        a: (
          <div className="font-mono text-sm space-y-1">
            <div><span className="text-foreground/50 w-32 inline-block">Bank</span>Commerce Bank</div>
            <div><span className="text-foreground/50 w-32 inline-block">Routing</span>101000019</div>
            <div><span className="text-foreground/50 w-32 inline-block">Account</span>690108249</div>
            <div><span className="text-foreground/50 w-32 inline-block">Payable to</span>West Hills Capital</div>
            <div><span className="text-foreground/50 w-32 inline-block">Address</span>1314 N. Oliver Ave. #8348, Wichita KS 67208</div>
          </div>
        ),
      },
      {
        q: "When will my trade be executed?",
        a: "We place the order with our wholesale dealer once funds are confirmed received. For wire transfers and cashier's checks, that's typically the same business day. Personal checks require full clearance first.",
      },
    ],
  },
  {
    title: "Delivery & Shipping",
    items: [
      {
        q: "How is metal shipped?",
        a: "All shipments go out via FedEx 2-Day, fully insured, signature required at delivery. We do not ship using standard postal services.",
      },
      {
        q: "How long does delivery take?",
        a: "In most cases your package ships within 48 hours of payment clearing. FedEx 2-Day delivery is then generally accurate. During high-volume periods (market volatility, major news events) there can be delays on the supply side — we'll always communicate proactively if that happens.",
      },
      {
        q: "What does shipping cost?",
        a: "Shipping and insurance is a flat $25 for orders under 300 American Silver Eagles or 15 American Gold Eagles/Gold Bars. For larger orders, shipping is included in the price.",
      },
      {
        q: "Can I pick up in person?",
        a: "We can arrange FedEx Hold for pickup at a FedEx location near you if you prefer not to receive at home. Let us know during the call and we'll set that up.",
      },
    ],
  },
  {
    title: "IRA Accounts",
    items: [
      {
        q: "Can I buy gold or silver inside my IRA?",
        a: "Yes. We work with clients on self-directed IRA rollovers that allow physical precious metals to be held as IRA assets. The metal is stored with an approved depository — you own it outright, it just stays at the custodian until you're ready to take distributions.",
      },
      {
        q: "What's the process for an IRA rollover?",
        a: "It starts with the same allocation call. From there we help you work through the IRA custodian and depository setup. Most clients who've done a rollover are surprised by how straightforward it is — it does take a few weeks, but there's no tax event if done correctly.",
      },
      {
        q: "Are there IRA-eligible products?",
        a: "Yes — IRS rules require gold to be .995 fine or better and silver to be .999 fine or better. American Gold Eagles are a notable exception (they're .9167 fine but Congress explicitly approved them). We only recommend IRA-eligible products for IRA purchases.",
      },
    ],
  },
  {
    title: "Products",
    items: [
      {
        q: "Why do you only recommend three products?",
        a: (
          <>
            We focus on <strong>American Gold Eagles</strong>, <strong>American Gold Bars</strong>, and <strong>American Silver Eagles</strong> because they're the most liquid, most recognized, and easiest to resell. Other products — especially proof coins and exotic collectibles — carry large premiums that may never be recovered when you go to sell. We explain this in detail in our Insights section.
          </>
        ),
      },
      {
        q: "What's the difference between a coin and a bar?",
        a: "Gold Eagles are government-minted coins — they carry legal tender status and are universally recognized. Gold bars are refined bullion — they trade closer to spot and are often the better choice for larger allocations where you want maximum metal per dollar.",
      },
      {
        q: "Do you sell numismatic or proof coins?",
        a: "No. We don't recommend or sell proof coins or numismatic collectibles for allocation purposes. The premiums on those products often exceed 100% over spot, and the exit market is much thinner. If you've been pitched those products by another dealer, we're happy to give you an honest comparison.",
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-start gap-4 py-5 group"
        aria-expanded={open}
      >
        <ChevronDown
          className={`w-4 h-4 mt-1 shrink-0 text-primary/60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
        <span className="font-medium text-foreground group-hover:text-primary transition-colors text-[15px] leading-snug">
          {item.q}
        </span>
      </button>
      {open && (
        <div className="pl-8 pb-5 pr-2 text-[15px] text-foreground/70 leading-relaxed">
          {item.a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="w-full bg-background pt-12 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="text-center mb-14">
          <h1 className="text-4xl font-serif font-semibold mb-4">Frequently Asked Questions</h1>
          <p className="text-foreground/60 text-lg">
            Straightforward answers about how we work, what we charge, and what to expect.
          </p>
          <p className="text-sm text-foreground/45 mt-3">
            Still have a question?{" "}
            <a href="tel:8008676768" className="text-primary hover:underline font-medium">
              Call us at (800) 867-6768
            </a>
          </p>
        </div>

        <div className="space-y-12">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-semibold tracking-widest uppercase text-foreground/40 mb-4 px-1">
                {section.title}
              </h2>
              <div className="bg-white rounded-2xl border border-border/40 px-6 divide-y divide-border/30">
                {section.items.map((item) => (
                  <FAQAccordion key={item.q} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center bg-white rounded-2xl border border-border/40 p-8">
          <p className="font-serif text-xl text-foreground mb-2">Ready to talk numbers?</p>
          <p className="text-foreground/60 text-sm mb-6">
            Schedule a no-pressure call and we'll walk through current pricing together.
          </p>
          <a
            href="/schedule"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Schedule Allocation Call
          </a>
        </div>

      </div>
    </div>
  );
}
