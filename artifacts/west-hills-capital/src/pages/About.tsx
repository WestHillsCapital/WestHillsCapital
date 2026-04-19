import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone } from "lucide-react";

export default function About() {
  return (
    <div className="w-full bg-background min-h-screen pt-16 pb-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-12 text-center">
          About West Hills Capital
        </h1>

        <div className="prose prose-lg prose-slate mx-auto text-foreground/80 leading-relaxed">

          {/* OPENING — speaks to the reader's position */}
          <p className="text-xl text-foreground font-serif mb-12 text-center italic">
            Most people who find their way here have already done the work. They've looked at the history, watched what's happened to purchasing power, and decided they want something real. We're not here to make the case for physical metals — you've already made it yourself.
          </p>

          {/* WHY THIS FIRM EXISTS */}
          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">
            Why This Firm Exists
          </h2>
          <p>
            West Hills Capital has been in operation since June 2011 — founded not because precious metals happened to be in the news, but because of a specific moment where a choice had to be made between what was profitable and what was right. The founder spent years studying monetary systems and working inside the industry before concluding that most of it was structured around commissions, not clients.
          </p>
          <p>
            The proof coin model is the clearest example. Products with premiums of 100% or more over spot, marketed on aesthetics and scarcity, with a resale market that rarely supports what was paid. When clients needed liquidity, those premiums often couldn't be recovered. When that reality became impossible to work around honestly, we stopped working around it and started something different.
          </p>

          {/* WHAT PHYSICAL METALS ACTUALLY ARE */}
          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">
            What Physical Metals Actually Are
          </h2>
          <p>
            Physical gold and silver don't produce yield. They don't pay dividends or compound. What they do — consistently, across every monetary era in recorded history — is preserve purchasing power while paper claims on wealth erode.
          </p>
          <p>
            This is not a forecast. It's an observation. Every period of significant currency expansion has eventually corrected, and the assets that retained value through those corrections were the ones people could hold in their hands. The dollar has lost more than 95% of its purchasing power since 1913. Gold has not.
          </p>
          <p>
            We approach physical metals as a long-term allocation — not a trade, not a speculation, not a hedge built on paper. Something you own. Something that doesn't depend on a counterparty to remain what it is.
          </p>

          {/* WHY SOVEREIGN BULLION ONLY */}
          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">
            Why We Carry Only Three Products
          </h2>
          <p>
            We carry the 1 oz American Gold Eagle, the 1 oz American Gold Buffalo, and the 1 oz American Silver Eagle. These are the most widely recognized, most liquid sovereign bullion coins in the world. The product selection was built around one question: what happens when you need to sell?
          </p>
          <p>
            The resale market for these coins is global, deep, and consistent. Proof coins, limited editions, and numismatic collectibles carry premiums that the resale market rarely supports — if and when you need to convert to cash, that gap matters. We believe the most important thing we can do for a client is ensure that the metals they acquire can be transferred or liquidated at a fair price when the time comes.
          </p>

          {/* HOW WE OPERATE */}
          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">
            How We Operate
          </h2>
          <p>
            Every order is funded with cleared capital. We don't offer leveraged trades, financed purchases, or margin accounts. Every commitment is confirmed verbally, on a live call, at the moment it's made — pricing is locked at that point, and nothing moves before you know exactly what you're buying and exactly what it costs.
          </p>
          <p>
            Our commissions are disclosed and consistent: 2% on gold, 5% on silver. The silver rate reflects real shipping and insurance costs on a heavy, lower-value-per-ounce metal. There are no handling fees, no storage markups, no hidden lines in the pricing. What you're quoted is what you pay.
          </p>
          <p>
            These aren't policies we arrived at arbitrarily. They're the direct result of understanding what goes wrong when trades are structured the other way.
          </p>

          {/* IRA ACCOUNTS */}
          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">
            Physical Metals in an IRA
          </h2>
          <p>
            A significant number of our clients come to physical gold and silver through an IRA rollover or transfer. The process is more accessible than most people expect. Through a self-directed IRA with an approved custodian and depository, you can hold the same coins — American Gold Eagles, Gold Buffalos, American Silver Eagles — as qualified IRA assets. You own them outright. They're held at the depository until you choose to take distributions.
          </p>
          <p>
            There's no tax event when the rollover or transfer is executed correctly, and the process typically takes a few weeks. We walk through every step.
          </p>

          {/* WHAT TO EXPECT */}
          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">
            What to Expect When You Call
          </h2>
          <p>
            The first conversation is exactly that — a conversation. We'll discuss your situation, review your objectives, walk through current pricing, and answer whatever questions you have. If it makes sense to move forward, the commitment happens on the call. If it doesn't, there's no pressure and no follow-up unless you want it.
          </p>
          <p>
            We're not a high-volume order center and we don't have an automated execution system. Every client speaks directly with someone who can answer a real question. We've built the firm around the premise that a purchase of this nature deserves the same care the client brings to making it.
          </p>

          {/* STEWARDSHIP QUOTE — preserved */}
          <div className="my-16 p-8 bg-foreground text-white rounded-2xl text-center">
            <h2 className="text-3xl font-serif font-semibold mb-4 text-white">Stewardship</h2>
            <p className="text-white/80 max-w-xl mx-auto italic text-lg">
              "It is always your money. Now it is your real money."
            </p>
          </div>

          <p className="text-center text-foreground/70">
            We welcome the opportunity to speak with you — on your timeline, without pressure, and with complete transparency on price and process.
          </p>

        </div>
      </div>

      {/* BOTTOM CTA — preserved */}
      <div className="border-t border-border/40 mt-20 py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-serif font-semibold mb-4 text-foreground">
            We welcome the opportunity to speak with you.
          </h2>
          <p className="text-foreground/55 text-base mb-8 leading-relaxed max-w-xl mx-auto">
            Every purchase begins with a private call — no pressure, no automated execution. Just an honest conversation about your objectives.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-11 px-9 group">
                Schedule Your Call
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="tel:8008676768">
              <Button variant="outline" size="lg" className="h-11 px-9 bg-white">
                <Phone className="mr-2 w-4 h-4" />
                (800) 867-6768
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
