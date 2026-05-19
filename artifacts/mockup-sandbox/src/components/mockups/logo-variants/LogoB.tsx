export function LogoB() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-10 px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">B — Wordmark Only</p>

      {/* On light */}
      <div>
        <span className="text-2xl font-black tracking-tight text-[#0E1D4A]">docu</span><span className="text-2xl font-black tracking-tight text-[#C49A38]">plete</span>
      </div>

      {/* Variant: with subtle underline accent */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl font-bold tracking-tight text-[#0E1D4A]">Docuplete</span>
        <div className="h-[3px] w-full rounded-full bg-[#C49A38]" />
      </div>

      {/* On dark */}
      <div className="bg-[#0E1D4A] rounded-2xl px-8 py-5 flex flex-col items-center gap-3">
        <div>
          <span className="text-2xl font-black tracking-tight text-white">docu</span><span className="text-2xl font-black tracking-tight text-[#C49A38]">plete</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold tracking-tight text-white">Docuplete</span>
          <div className="h-[3px] w-full rounded-full bg-[#C49A38]" />
        </div>
      </div>
    </div>
  );
}
