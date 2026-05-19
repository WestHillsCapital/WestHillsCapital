export function LogoC() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10 px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">C — Seal / Stamp</p>

      {/* On light */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 shrink-0 relative">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="20" cy="20" r="19" fill="#0E1D4A" />
            <circle cx="20" cy="20" r="14" fill="none" stroke="#C49A38" strokeWidth="1.5" strokeDasharray="2 2" />
            <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#C49A38" fontSize="14" fontWeight="900" fontFamily="Georgia,serif">D</text>
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-[#0E1D4A]">
          Docuplete<span className="text-[#C49A38]">.</span>
        </span>
      </div>

      {/* Icon alone — zoomed in */}
      <div className="w-20 h-20">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <circle cx="20" cy="20" r="19" fill="#0E1D4A" />
          <circle cx="20" cy="20" r="14" fill="none" stroke="#C49A38" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#C49A38" fontSize="14" fontWeight="900" fontFamily="Georgia,serif">D</text>
        </svg>
      </div>

      {/* On dark */}
      <div className="flex items-center gap-3 bg-[#0E1D4A] rounded-2xl px-8 py-5">
        <div className="w-10 h-10 shrink-0">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <circle cx="20" cy="20" r="19" fill="#C49A38" />
            <circle cx="20" cy="20" r="14" fill="none" stroke="white" strokeWidth="1.5" strokeDasharray="2 2" />
            <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="900" fontFamily="Georgia,serif">D</text>
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight text-white">
          Docuplete<span className="text-[#C49A38]">.</span>
        </span>
      </div>
    </div>
  );
}
