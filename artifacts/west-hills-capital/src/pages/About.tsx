export default function About() {
  return (
    <div className="w-full bg-background min-h-screen pt-16 pb-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        <h1 className="text-4xl lg:text-5xl font-serif font-semibold mb-12 text-center">About West Hills Capital</h1>
        
        <div className="prose prose-lg prose-slate mx-auto text-foreground/80 leading-relaxed">
          <p className="text-xl text-foreground font-serif mb-12 text-center">
            Our firm was built on a singular conviction: the disciplined acquisition of physical precious metals is the most reliable method for preserving multi-generational purchasing power.
          </p>

          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">Led by Experience</h2>
          <p>
            West Hills Capital is not a marketing company masquerading as a financial firm. We are rooted in decades of experience analyzing capital markets, monetary policy, and hard asset execution. We observed an industry saturated with high-pressure sales tactics, leveraged gimmicks, and opaque pricing, and intentionally built the exact opposite.
          </p>

          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">Lessons That Endure</h2>
          <p>
            Markets oscillate between periods of expansion and contraction, but the mathematical reality of fiat currency debasement remains constant. Physical gold and silver are not "get rich quick" trades; they are asymmetric insurance policies against systemic risk. 
          </p>
          <p>
            Because we view metals through this lens, our approach to client allocation is fundamentally different. We prioritize highly liquid sovereign bullion coins, avoid numismatic "collectibles" carrying massive premiums, and execute trades with absolute transparency.
          </p>

          <h2 className="text-2xl font-serif font-semibold text-foreground mt-12 mb-6">Commitment to Discipline</h2>
          <p>
            A serious allocation requires a serious operating framework. 
          </p>
          <ul className="space-y-2 mt-4 mb-8">
            <li><strong>No Leverage:</strong> We do not offer or facilitate financed trades. If you cannot afford the asset outright, you should not be buying it.</li>
            <li><strong>Cleared Funds Only:</strong> We execute physical market orders only after client funds are fully settled. We do not speculate on uncollected capital.</li>
            <li><strong>Verbal Confirmation:</strong> Every significant allocation requires a voice-to-voice confirmation to ensure precise alignment on price and logistics.</li>
          </ul>

          <div className="my-16 p-8 bg-foreground text-white rounded-2xl text-center">
            <h2 className="text-3xl font-serif font-semibold mb-4 text-white">Stewardship</h2>
            <p className="text-white/80 max-w-xl mx-auto italic text-lg">
              "It is always your money. Now it is your real money."
            </p>
          </div>

          <p className="text-center">
            We welcome the opportunity to discuss your allocation strategy.
          </p>
        </div>

      </div>
    </div>
  );
}
