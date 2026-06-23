import { getCachedOrg } from "@/hooks/useOrgSettings";
import { formatOrgDate } from "@/lib/orgDateFormat";

interface Props {
  paymentReceivedAt:  string | null;
  trackingNumber:     string;
  setTrackingNumber:  (s: string) => void;
  isMarkingPayment:   boolean;
  isSavingTracking:   boolean;
  opsActionError:     string | null;
  onMarkPayment:      () => void;
  onSaveTracking:     () => void;
}

export function OpsActionsSection({
  paymentReceivedAt, trackingNumber, setTrackingNumber,
  isMarkingPayment, isSavingTracking, opsActionError,
  onMarkPayment, onSaveTracking,
}: Props) {
  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider mb-4">Ops Actions</h2>

      {opsActionError && (
        <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
          {opsActionError}
        </div>
      )}

      <div className="space-y-4">
        {/* Payment */}
        <div>
          <div className="text-xs text-[#8A9BB8] mb-2">Payment</div>
          {paymentReceivedAt ? (
            <div className="text-xs text-green-400 bg-green-900/20 border border-green-800/30 rounded px-3 py-2">
              ✓ Payment received — {formatOrgDate(paymentReceivedAt, getCachedOrg(), true)}
            </div>
          ) : (
            <button
              onClick={onMarkPayment}
              disabled={isMarkingPayment}
              className="w-full py-2 rounded text-sm font-medium bg-white hover:bg-green-900/40 border border-[#D4C9B5] hover:border-green-700 text-[#374560] hover:text-green-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isMarkingPayment ? "Marking…" : "Mark Payment Received"}
            </button>
          )}
        </div>

        {/* Tracking */}
        <div>
          <div className="text-xs text-[#8A9BB8] mb-2">Tracking Number</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 7489 3401 0947 2804"
              className="flex-1 bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] placeholder-[#B0C0D8] focus:outline-none focus:border-[#C49A38]"
            />
            <button
              onClick={onSaveTracking}
              disabled={isSavingTracking || !trackingNumber.trim()}
              className="px-3 py-1.5 rounded text-sm font-medium bg-[#EDE8DF] hover:bg-[#EDE8DF] text-[#374560] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSavingTracking ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
