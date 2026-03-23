import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Scale, Banknote, History, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const principles = [
    "Transparent spreads with no hidden fees",
    "No leverage or margin accounts",
    "No speculative positioning",
    "Direct wholesale execution",
    "Clear documentation and confirmation",
    "Reliable buyback support"
  ];

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* HERO SECTION */}
      <section className="relative pt-24 pb-32 lg:pt-36 lg:pb-48 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
            alt="Elegant background" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-semibold text-foreground leading-[1.1] mb-8">
                Physical Gold and Silver <br/>
                <span className="text-primary italic">— As True as Time.</span>
              </h1>
              <p className="text-lg sm:text-xl text-foreground/70 mb-10 max-w-2xl leading-relaxed">
                Transparent pricing. Disciplined execution. Guided allocation support for long-term investors seeking the enduring stability of physical metals.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/schedule">
                  <Button size="lg" className="w-full sm:w-auto h-14 text-base group">
                    Schedule Allocation Call
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 text-base bg-white/50 backdrop-blur-sm">
                    View Live Pricing
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* GROUNDED APPROACH SECTION */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-6">A Grounded Approach</h2>
            <p className="text-foreground/70 text-lg">
              We reject the hype and fear-driven marketing common in the precious metals industry. Our focus is purely on the disciplined acquisition of physical assets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Scale className="w-8 h-8 text-primary" />,
                title: "Transparent Execution",
                desc: "We operate on clear, straightforward spreads above spot price. You know exactly what you are paying and what you are receiving."
              },
              {
                icon: <Banknote className="w-8 h-8 text-primary" />,
                title: "Physical Delivery & IRA",
                desc: "Whether taking direct delivery to your home or vault, or allocating through an IRA rollover, we guide the process with precision."
              },
              {
                icon: <History className="w-8 h-8 text-primary" />,
                title: "Long-Term Perspective",
                desc: "We view gold and silver not as speculative trades, but as foundational elements of a truly diversified, multi-generational portfolio."
              }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl bg-background border border-border/50 hover:shadow-lg transition-shadow duration-300 group">
                <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-foreground/70 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* OPERATING PRINCIPLES */}
      <section className="py-24 bg-foreground text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-5xl font-serif font-semibold mb-8 text-white">Our Operating Principles</h2>
              <p className="text-white/70 text-lg mb-8 leading-relaxed">
                Trust is not granted; it is earned through consistent, transparent behavior. West Hills Capital enforces strict operational rules to protect our clients.
              </p>
              <ul className="space-y-4">
                {principles.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/90">
                    <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                    <span className="text-lg">{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-12">
                <Link href="/about">
                  <Button variant="outline" className="text-white border-white/20 hover:bg-white/10 hover:text-white h-12 px-8">
                    Read Our Story
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl relative">
                <img 
                  src={`${import.meta.env.BASE_URL}images/vault-interior.png`} 
                  alt="Secure vault" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground to-transparent opacity-60" />
                <div className="absolute bottom-8 left-8 right-8">
                  <div className="glass-panel p-6 rounded-xl border-white/10 bg-black/40">
                    <ShieldCheck className="w-10 h-10 text-primary mb-4" />
                    <h3 className="text-white font-serif text-xl mb-2">Commitment to Stewardship</h3>
                    <p className="text-white/70 text-sm">We treat every allocation discussion with the gravity and respect your capital demands.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-24 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-6">Ready to secure your allocation?</h2>
          <p className="text-foreground/70 text-lg mb-10">
            Every transaction begins with a private, 1-on-1 allocation call to discuss your objectives, confirm pricing, and establish logistics. No automated execution, no pressure.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/schedule">
              <Button size="lg" className="h-14 px-10 text-base shadow-xl">
                Schedule Your Call
              </Button>
            </Link>
            <a href="tel:8008676768">
              <Button variant="outline" size="lg" className="h-14 px-10 text-base bg-white">
                Call 800-867-6768
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
