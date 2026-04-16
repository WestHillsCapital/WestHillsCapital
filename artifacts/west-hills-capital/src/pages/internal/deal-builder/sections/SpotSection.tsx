import type { SpotData } from "../types";
import { fmtMoney } from "../utils";

interface Props {
  spotData:      SpotData;
  isFetchingSpot: boolean;
  spotError:     string | null;
  locked:        boolean;
  onGetSpot:     () => void;
}

export function SpotSection({ spotData, isFetchingSpot, spotError, locked, onGetSpot }: Props) {
  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">Live Spot</h2>
        {!locked && (
          <button
            onClick={onGetSpot}
            disabled={isFetchingSpot}
            className="px-4 py-1.5 rounded text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60 transition-colors"
          >
            {isFetchingSpot ? "Fetching…" : "Get Spot Price"}
          </button>
        )}
      </div>

      {spotError && (
        <div className="text-red-400 text-xs mb-3">{spotError}</div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <SpotBox label="Gold Spot (Ask)"   value={spotData.goldSpotAsk} />
        <SpotBox label="Silver Spot (Ask)" value={spotData.silverSpotAsk} />
        <div>
          <div className="text-xs text-[#8A9BB8] mb-1">Spot Timestamp</div>
          <div className="text-sm text-[#374560] font-mono">
            {spotData.spotTimestamp
              ? new Date(spotData.spotTimestamp).toLocaleTimeString()
              : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}

function SpotBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-xs text-[#8A9BB8] mb-1">{label}</div>
      <div className="text-lg font-semibold text-[#C49A38] font-mono">
        {value != null ? fmtMoney(value) : "—"}
      </div>
    </div>
  );
}
