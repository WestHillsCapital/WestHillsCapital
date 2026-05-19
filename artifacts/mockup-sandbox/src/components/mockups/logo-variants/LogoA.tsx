export function LogoA() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10 px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">A — Lettermark</p>

      {/* On light */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#0E1D4A] flex items-center justify-center shrink-0">
          <span className="text-[#C49A38] font-black text-xl leading-none" style={{fontFamily:'Georgia,serif'}}>D</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-[#0E1D4A]">
          Docuplete<span className="text-[#C49A38]">.</span>
        </span>
      </div>

      {/* On dark */}
      <div className="flex items-center gap-3 bg-[#0E1D4A] rounded-2xl px-8 py-5">
        <div className="w-9 h-9 rounded-lg bg-[#C49A38] flex items-center justify-center shrink-0">
          <span className="text-[#0E1D4A] font-black text-xl leading-none" style={{fontFamily:'Georgia,serif'}}>D</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Docuplete<span className="text-[#C49A38]">.</span>
        </span>
      </div>
    </div>
  );
}
