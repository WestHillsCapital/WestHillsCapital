import { useSpotPrices } from "@/hooks/use-pricing";
import { TrendingUp, TrendingDown, Minus, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export function SpotTicker() {
  const { data: spot, isLoading } = useSpotPrices();

  if (isLoading) {
    return (
      <div className="w-full bg-[#1a1f2e] text-white/60 text-xs py-2 px-4 flex items-center justify-center gap-6">
        <span className="animate-pulse">Loading live spot prices...</span>
      </div>
    );
  }

  if (!spot) return null;

  const goldUp = (spot.goldChange ?? 0) >= 0;
  const silverUp = (spot.silverChange ?? 0) >= 0;
  const goldFlat = spot.goldChange === 0 || spot.goldChange === undefined;
  const silverFlat = spot.silverChange === 0 || spot.silverChange === undefined;

  const ChangeIcon = ({ up, flat }: { up: boolean; flat: boolean }) => {
    if (flat) return <Minus className="w-3 h-3" />;
    if (up) return <TrendingUp className="w-3 h-3" />;
    return <TrendingDown className="w-3 h-3" />;
  };

  const changeColor = (up: boolean, flat: boolean) =>
    flat ? "text-white/50" : up ? "text-emerald-400" : "text-red-400";

  return (
    <div className="w-full bg-[#1a1f2e] text-white text-xs py-2 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

        <div className="flex items-center gap-1.5 text-white/50">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          <span className="hidden sm:inline tracking-wide">Live Spot · Dillon Gage</span>
          <span className="sm:hidden tracking-wide">Live Spot</span>
        </div>

        <div className="flex items-center gap-5 sm:gap-8">
          {/* Gold */}
          <div className="flex items-center gap-2">
            <span className="text-white/50 uppercase tracking-widest font-medium" style={{ fontSize: "10px" }}>Gold</span>
            <span className="font-semibold text-white tabular-nums">
              ${spot.gold.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            {spot.goldChange !== undefined && (
              <span className={cn("flex items-center gap-0.5 tabular-nums", changeColor(goldUp, goldFlat))}>
                <ChangeIcon up={goldUp} flat={goldFlat} />
                {goldFlat ? "—" : `${goldUp ? "+" : ""}${spot.goldChange.toFixed(2)} (${goldUp ? "+" : ""}${spot.goldChangePercent?.toFixed(2)}%)`}
              </span>
            )}
          </div>

          <div className="w-px h-4 bg-white/15" />

          {/* Silver */}
          <div className="flex items-center gap-2">
            <span className="text-white/50 uppercase tracking-widest font-medium" style={{ fontSize: "10px" }}>Silver</span>
            <span className="font-semibold text-white tabular-nums">
              ${spot.silver.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            {spot.silverChange !== undefined && (
              <span className={cn("flex items-center gap-0.5 tabular-nums", changeColor(silverUp, silverFlat))}>
                <ChangeIcon up={silverUp} flat={silverFlat} />
                {silverFlat ? "—" : `${silverUp ? "+" : ""}${spot.silverChange.toFixed(2)} (${silverUp ? "+" : ""}${spot.silverChangePercent?.toFixed(2)}%)`}
              </span>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center text-white/30 text-[10px] tracking-wide">
          Updated {spot.lastUpdated ? new Date(spot.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </div>

      </div>
    </div>
  );
}
