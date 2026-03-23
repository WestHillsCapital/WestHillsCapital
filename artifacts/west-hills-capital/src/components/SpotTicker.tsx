import { useSpotPrices } from "@/hooks/use-pricing";
import { format } from "date-fns";

export function SpotTicker() {
  const { data: spotPrices, isLoading } = useSpotPrices();

  if (isLoading || !spotPrices) {
    return (
      <div className="w-full bg-foreground text-primary py-2 text-xs font-medium tracking-wide border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center animate-pulse">
          <div className="flex gap-6">
            <span>GOLD: ---</span>
            <span>SILVER: ---</span>
          </div>
          <span className="hidden sm:inline">LOADING MARKET DATA...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-foreground text-white py-2 text-xs font-medium tracking-wider border-b border-white/10 relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex gap-6 lg:gap-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <span className="flex items-center gap-2">
            <span className="text-primary/80">GOLD SPOT:</span>
            <span className="text-primary font-semibold">${spotPrices.gold.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="text-primary/80">SILVER SPOT:</span>
            <span className="text-primary font-semibold">${spotPrices.silver.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </span>
        </div>
        <div className="hidden sm:flex text-white/50 text-[10px] items-center gap-2">
          <span>LAST UPDATED: {format(new Date(spotPrices.lastUpdated), "HH:mm:ss a 'CT'")}</span>
          <span className="h-1 w-1 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
        </div>
      </div>
    </div>
  );
}
