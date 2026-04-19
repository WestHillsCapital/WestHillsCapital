import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

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
        a: "We help clients allocate a portion of their savings into physical gold and silver — coins they own outright and can take delivery of or hold in an IRA. We don't sell financial products, manage portfolios, or give investment advice. Our focus is disciplined, transparent execution of physical metal purchases.",
      },
      {
        q: "What happens on the first call?",
        a: "We'll discuss your situation, walk through current pricing, and answer any questions. If it makes sense to move forward, the commitment happens on the call itself — that's why a phone call is necessary rather than an online order. We block 45 minutes, though calls can be more concise or run longer depending on what you need. We never rush anyone.",
      },
      {
        q: "How does the commitment work?",
        a: "When you say yes, you own the metal at that price and owe West Hills Capital for it. We handle the execution on your behalf and you wire payment — most clients send it the same day, and we extend grace through the following business day. It's a straightforward purchase: you know exactly what you're buying, exactly what it costs, and we take care of the rest.",
      },
      {
        q: "Is there a minimum order?",
        a: (
          <>
            There's no formal minimum, but shipping and insurance is a flat{" "}
            <strong>$25</strong> on orders below 300 American Silver Eagles or 15 American Gold Eagles or Gold Buffalos. On very small orders that $25 can represent a meaningful percentage of the total cost — we'll always point that out so you can decide what makes sense.
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
        a: "All pricing is based on the live spot price of gold or silver at the time of your trade. We source metal through our wholesale supplier and add a flat commission on top of our cost. You'll always see the per-unit breakdown before you commit.",
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
              No hidden fees, no "handling" add-ons. The commission is built into the per-unit price we quote you on the call.
            </p>
          </>
        ),
      },
      {
        q: "Why is silver's commission higher than gold?",
        a: "Silver is priced lower per ounce but is physically heavier and bulkier, so shipping, insurance, and handling costs are proportionally higher relative to the metal's value. The 5% rate on silver reflects those real costs.",
      },
      {
        q: "When is pricing locked in?",
        a: "Pricing is locked at the moment of your verbal commitment on the call. Spot prices move continuously, so locking in requires a live conversation — it's one of the reasons we don't take orders online.",
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
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Wire transfer</strong> — the safest way to transact. Money moves over federally insured lines and before you leave the bank counter or hang up with your banker, you know it arrived and was received. Most clients send same day, with grace through the following business day.</li>
              <li><strong>Cashier's check</strong> — treated the same as cash; same-day processing when received</li>
              <li><strong>Personal check</strong> — accepted, but must fully clear before your order ships. This typically adds several business days.</li>
            </ul>
            <p className="mt-3 text-sm text-foreground/60">We do not accept credit cards or ACH transfers.</p>
          </>
        ),
      },
      {
        q: "How do I get wire transfer instructions?",
        a: "Complete wire instructions are provided as part of every transaction — you'll receive them directly from us after your commitment is made on the call. We do not publish banking details publicly.",
      },
      {
        q: "When does my order ship?",
        a: "Your trade is committed on the call. Once payment is received and cleared, your order typically ships within 48 hours via FedEx 2-Day. High-volume periods can introduce delays on the supply side — we'll always let you know if that's the case.",
      },
    ],
  },
  {
    title: "Delivery & Shipping",
    items: [
      {
        q: "How is metal shipped?",
        a: "All shipments go out via FedEx 2-Day, fully insured, with adult signature required at delivery. We do not ship using standard postal services.",
      },
      {
        q: "How long does delivery take?",
        a: "In most cases your package ships within 48 hours of payment clearing. FedEx 2-Day delivery estimates are generally accurate. During high-volume periods there can be delays on the supply side — we'll communicate proactively if that happens.",
      },
      {
        q: "What does shipping cost?",
        a: "Shipping and insurance is a flat $25 for orders under 300 American Silver Eagles or 15 American Gold Eagles or Gold Buffalos. For larger orders, shipping is included.",
      },
      {
        q: "Do you recommend shipping to my home or to a FedEx location?",
        a: (
          <>
            We recommend directing your shipment to a <strong>FedEx Office or Ship Center</strong> rather than a residential address. Even with signature required, home deliveries can occasionally be left on a porch or at a neighbor's — that's not a risk worth taking with physical metals. Picking up directly at a FedEx location eliminates that entirely. Just let us know on the call and we'll route the shipment to the nearest FedEx Office or Ship Center to you.
          </>
        ),
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
        a: "It starts with the same call. From there we help you work through the custodian and depository setup. Most clients are surprised by how straightforward it is — it does take a few weeks, but there's no tax event if done correctly.",
      },
      {
        q: "Are the products IRA-eligible?",
        a: "Yes. IRS rules require gold to be .995 fine or better and silver .999 fine or better. American Gold Eagles are a notable exception — they're .9167 fine, but Congress explicitly approved them for IRA inclusion. All three products we carry are IRA-eligible.",
      },
    ],
  },
  {
    title: "Products",
    items: [
      {
        q: "Why do you focus on only three products?",
        a: (
          <>
            We carry the <strong>1 oz American Gold Eagle</strong>, the <strong>1 oz American Gold Buffalo</strong>, and the <strong>1 oz American Silver Eagle</strong>. These are the most liquid, most widely recognized bullion coins in the world — and the easiest to resell when the time comes. Other products, especially proof coins and collectibles, carry premiums that often can't be recovered on the back end. We explain the reasoning in detail in our{" "}
            <a href="/insights" className="text-primary hover:underline">Insights section</a>.
          </>
        ),
      },
      {
        q: "What's the difference between a Gold Eagle and a Gold Buffalo?",
        a: "Both are 1 oz, government-minted U.S. coins. The Gold Eagle (.9167 fine, alloyed with silver and copper for durability) has been in continuous production since 1986 and is the most recognized gold coin in the world. The Gold Buffalo (.9999 fine) is pure 24-karat gold, minted since 2006. Both are IRA-eligible and highly liquid. The choice often comes down to buyer preference — we'll walk through the trade-offs on the call.",
      },
      {
        q: "Do you sell numismatic or proof coins?",
        a: "No. We don't recommend or sell proof coins or numismatic collectibles as a long-term holding. The premiums on those products often exceed 100% over spot, and the resale market is much thinner. If you've been pitched those products by another dealer, we're happy to give you an honest side-by-side comparison.",
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
  usePageMeta({
    title: "FAQ | West Hills Capital Physical Gold & Silver",
    description: "Common questions about buying physical gold and silver through West Hills Capital — pricing, commissions, delivery, IRA rollovers, and how the purchase process works.",
    ogTitle: "FAQ | West Hills Capital Physical Gold & Silver",
    ogDescription: "Answers on pricing, commissions, delivery, IRA rollovers, and how purchases work at West Hills Capital. Call (800) 867-6768.",
    ogImage: "https://westhillscapital.com/opengraph.jpg",
    canonical: "https://westhillscapital.com/faq",
  });

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
            Schedule a call and we'll walk through current pricing together.
          </p>
          <a
            href="/schedule"
            className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
          >
            Schedule Your Call
          </a>
        </div>

      </div>
    </div>
  );
}
