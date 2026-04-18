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
          <p className="text-xl text-foreground font-serif mb-12 text-center">
            Our firm was built on a singular conviction: the disciplined acquisition of physical precious metals is among the most reliable methods of preserving long-term purchasing power.
          </p>

          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">Led by Experience</h2>
          <p>
            West Hills Capital was founded by professionals with over a decade of experience in capital markets, monetary policy, and hard asset execution. We built the firm around a simple philosophy: clients deserve complete pricing transparency, no high-pressure tactics, and a straightforward process from first call to final delivery.
          </p>

          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">Lessons That Endure</h2>
          <p>
            Markets move through cycles of expansion and contraction, but the long-term dynamics of currency purchasing power have remained consistent throughout history. Physical gold and silver are not vehicles for speculation — they are enduring stores of value suited to long-term investors who want real assets they can hold, store, or pass forward.
          </p>
          <p>
            Because we approach metals through this lens, we prioritize highly liquid sovereign bullion coins, avoid numismatic products with outsized premiums, and execute every trade with complete transparency on price and structure.
          </p>

          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">Commitment to Discipline</h2>
          <p>
            A serious purchase requires a disciplined operating framework.
          </p>
          <ul className="space-y-2 mt-4 mb-8">
            <li>
              <strong>No Leverage:</strong> We do not offer or facilitate financed trades. Every order is funded with cleared capital.
            </li>
            <li>
              <strong>Cleared Funds Only:</strong> We execute physical market orders only after client funds are fully settled.
            </li>
            <li>
              <strong>Verbal Confirmation:</strong> Every order requires a voice-to-voice confirmation to ensure precise alignment on price and logistics before any trade is initiated.
            </li>
          </ul>

          <div className="my-16 p-8 bg-foreground text-white rounded-2xl text-center">
            <h2 className="text-3xl font-serif font-semibold mb-4 text-white">Stewardship</h2>
            <p className="text-white/80 max-w-xl mx-auto italic text-lg">
              "It is always your money. Now it is your real money."
            </p>
          </div>

          <p className="text-center">
            We welcome the opportunity to discuss your goals.
          </p>
        </div>

      </div>

      {/* BOTTOM CTA */}
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
