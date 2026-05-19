export function LargerHero() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1224]">
      <div className="text-center px-6">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/80 mb-8">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80] inline-block" style={{animation: 'pulse 2s infinite'}} />
          14-day free trial · No credit card required
        </div>
        <h1 className="font-bold leading-tight tracking-tight mb-6 text-white">
          <span className="text-5xl md:text-6xl">Cut Cost. Save Time.</span>
          <br />
          <span className="text-6xl md:text-7xl">Get It Right.</span>
        </h1>
        <p className="text-lg text-white/70 max-w-2xl mx-auto mb-3">
          Upload your PDFs, send one link, and get documents back filled, signed, and tracked — without the follow-ups.
        </p>
        <p className="text-base text-white/45 max-w-xl mx-auto mb-10">
          No chasing. No confusion. No delays.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button className="px-8 py-3 rounded-full font-semibold text-white text-base" style={{background: 'linear-gradient(135deg, #3b6fd4, #5B8DEF)'}}>
            Start your free trial →
          </button>
          <button className="px-8 py-3 rounded-full font-semibold text-white text-base border border-white/20 bg-white/5">
            See how it works
          </button>
        </div>
        <p className="text-xs text-white/30 mt-4">No credit card required · Cancel anytime</p>
      </div>
    </div>
  );
}
