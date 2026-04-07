import { useSpotPrices } from "@/hooks/use-pricing";

export function SpotTicker() {
  const { data: spot, isLoading } = useSpotPrices();

  if (isLoading) {
    return (
      <div className="w-full bg-[#1a1f2e] text-white/50 text-xs py-2 px-4 flex items-center justify-center gap-6">
        <span className="animate-pulse">Loading live spot prices...</span>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="w-full bg-[#1a1f2e] text-white/35 text-[11px] py-2 px-4 flex items-center justify-center tracking-wide">
        Live spot pricing temporarily unavailable — contact us for current prices
      </div>
    );
  }

  return (
    <div className="w-full bg-[#1a1f2e] text-white text-xs py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

        <div className="flex items-center gap-5 sm:gap-8">
          <div className="flex items-center gap-2">
            <span className="text-white/45 uppercase tracking-widest font-medium" style={{ fontSize: "10px" }}>Gold Spot</span>
            <span className="font-semibold text-white tabular-nums">
              ${(spot.goldBid ?? spot.gold).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="w-px h-4 bg-white/15" />

          <div className="flex items-center gap-2">
            <span className="text-white/45 uppercase tracking-widest font-medium" style={{ fontSize: "10px" }}>Silver Spot</span>
            <span className="font-semibold text-white tabular-nums">
              ${(spot.silverBid ?? spot.silver).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center text-white/30 text-[10px] tracking-wide">
          Updated {spot.lastUpdated ? new Date(spot.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </div>

      </div>
    </div>
  );
}
