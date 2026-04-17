import { useState } from "react";

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StepProps {
  num:      number;
  label:    string;
  note?:    string;
  done:     boolean;
  active:   boolean;
  children?: React.ReactNode;
}

function Step({ num, label, note, done, active, children }: StepProps) {
  const circleClass = done
    ? "bg-green-700 border-green-600 text-green-100"
    : active
    ? "bg-[#C49A38] border-[#C49A38] text-white"
    : "bg-[#1A2840] border-[#2A3A58] text-[#5A6A88]";

  const labelClass = done
    ? "text-green-400"
    : active
    ? "text-[#C49A38]"
    : "text-[#5A6A88]";

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${circleClass}`}>
          {done ? "✓" : num}
        </div>
        {num < 5 && <div className="w-px flex-1 min-h-[12px] bg-[#2A3A58] mt-1" />}
      </div>
      {/* Content column */}
      <div className="pb-4 min-w-0 flex-1">
        <div className={`text-sm font-medium ${labelClass}`}>{label}</div>
        {note && <div className="text-xs text-[#5A6A88] mt-0.5">{note}</div>}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}

function DoneChip({ ts }: { ts: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-900/25 border border-green-800/40 rounded-full px-2.5 py-1">
      <span>✓</span>
      <span>{fmtDate(ts)}</span>
    </div>
  );
}

function ActionBtn({
  label, loadingLabel, onClick, disabled, loading, variant = "default",
}: {
  label: string; loadingLabel: string; onClick: () => void;
  disabled: boolean; loading: boolean; variant?: "default" | "gold";
}) {
  const base = "px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const style = variant === "gold"
    ? "bg-[#C49A38] hover:bg-[#B08828] text-white"
    : "bg-white hover:bg-[#F0EDE6] border border-[#D4C9B5] text-[#374560] hover:border-[#C49A38]";
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`${base} ${style}`}>
      {loading ? loadingLabel : label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orderPlacedAt?:                     string | null;
  wireReceivedAt:                     string | null;
  orderPaidAt:                        string | null;
  trackingNumber:                     string;
  setTrackingNumber:                  (v: string) => void;
  shippingNotificationScheduledAt:    string | null;
  shippedAt:                          string | null;
  deliveredAt:                        string | null;
  isMarkingWire:                      boolean;
  isMarkingDGPaid:                    boolean;
  isSavingTracking:                   boolean;
  isMarkingDelivered:                 boolean;
  opsActionError:                     string | null;
  onMarkWireReceived:                 () => void;
  onMarkOrderPaid:                    () => void;
  onSaveTracking:                     () => void;
  onMarkDelivered:                    () => void;
}

export function FulfillmentSection({
  orderPlacedAt,
  wireReceivedAt,
  orderPaidAt,
  trackingNumber,
  setTrackingNumber,
  shippingNotificationScheduledAt,
  shippedAt,
  deliveredAt,
  isMarkingWire,
  isMarkingDGPaid,
  isSavingTracking,
  isMarkingDelivered,
  opsActionError,
  onMarkWireReceived,
  onMarkOrderPaid,
  onSaveTracking,
  onMarkDelivered,
}: Props) {
  const [trackingInput, setTrackingInputLocal] = useState(trackingNumber);

  // Sync if parent updates (e.g. on deal load)
  const effectiveTracking = trackingInput || trackingNumber;

  const step1done = Boolean(orderPlacedAt);
  const step2done = Boolean(wireReceivedAt);
  const step3done = Boolean(orderPaidAt);
  const step4done = Boolean(trackingNumber);
  const step5done = Boolean(deliveredAt);

  // Badge: current highest completed stage
  const currentStatus = step5done
    ? "Delivered"
    : shippedAt
    ? "Shipped"
    : step4done
    ? "Label Created"
    : step3done
    ? "Paid to DG"
    : step2done
    ? "Wire Received"
    : "Awaiting Wire";

  const statusColor = step5done
    ? "bg-blue-900/40 text-blue-300 border-blue-700/40"
    : shippedAt
    ? "bg-purple-900/40 text-purple-300 border-purple-700/40"
    : step4done
    ? "bg-amber-900/40 text-amber-300 border-amber-700/40"
    : step3done
    ? "bg-teal-900/40 text-teal-300 border-teal-700/40"
    : step2done
    ? "bg-green-900/40 text-green-300 border-green-700/40"
    : "bg-[#1A2840] text-[#5A6A88] border-[#2A3A58]";

  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">Fulfillment</h2>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColor}`}>
          {currentStatus}
        </span>
      </div>

      {/* Error */}
      {opsActionError && (
        <div className="mb-4 text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
          {opsActionError}
        </div>
      )}

      {/* Steps */}
      <div>
        {/* Step 1: Metal Ordered */}
        <Step
          num={1}
          label="Metal Ordered"
          note={orderPlacedAt ? `Executed ${fmtDate(orderPlacedAt)}` : "Auto-set at execution"}
          done={step1done}
          active={!step1done}
        />

        {/* Step 2: Wire Received */}
        <Step
          num={2}
          label="Wire Received"
          note="Customer's wire arrives in WHC account"
          done={step2done}
          active={step1done && !step2done}
        >
          {step2done ? (
            <DoneChip ts={wireReceivedAt!} />
          ) : step1done ? (
            <ActionBtn
              label="Mark Wire Received"
              loadingLabel="Marking…"
              onClick={onMarkWireReceived}
              disabled={false}
              loading={isMarkingWire}
            />
          ) : null}
        </Step>

        {/* Step 3: DG Paid */}
        <Step
          num={3}
          label="Dillon Gage Paid"
          note="Joe pays DG via ACH on Fiztrade"
          done={step3done}
          active={step2done && !step3done}
        >
          {step3done ? (
            <DoneChip ts={orderPaidAt!} />
          ) : step2done ? (
            <ActionBtn
              label="Mark DG Paid"
              loadingLabel="Marking…"
              onClick={onMarkOrderPaid}
              disabled={false}
              loading={isMarkingDGPaid}
              variant="gold"
            />
          ) : null}
        </Step>

        {/* Step 4: Label Created / Shipped */}
        <Step
          num={4}
          label={shippedAt ? "Shipped" : "Label Created"}
          note={
            shippedAt
              ? "Shipping notification sent to customer"
              : shippingNotificationScheduledAt && !shippedAt
              ? `Shipping email queued — sends ${fmtDate(shippingNotificationScheduledAt)}`
              : "Enter FedEx tracking # from DG; shipping email auto-fires 24h later"
          }
          done={step4done}
          active={step3done && !step4done}
        >
          {step4done ? (
            <div className="space-y-1.5">
              <DoneChip ts={shippedAt ?? shippingNotificationScheduledAt ?? ""} />
              <div className="text-xs text-[#8A9BB8] font-mono">{trackingNumber}</div>
            </div>
          ) : step3done ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={effectiveTracking}
                onChange={(e) => {
                  setTrackingInputLocal(e.target.value);
                  setTrackingNumber(e.target.value);
                }}
                placeholder="e.g. 7489 3401 0947 2804"
                className="flex-1 min-w-0 bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-xs text-[#0F1C3F] placeholder-[#B0C0D8] focus:outline-none focus:border-[#C49A38]"
              />
              <ActionBtn
                label="Save"
                loadingLabel="Saving…"
                onClick={onSaveTracking}
                disabled={!effectiveTracking.trim()}
                loading={isSavingTracking}
              />
            </div>
          ) : null}
        </Step>

        {/* Step 5: Delivered */}
        <Step
          num={5}
          label="Delivered"
          note="Customer has received and verified their package"
          done={step5done}
          active={step4done && !step5done}
        >
          {step5done ? (
            <DoneChip ts={deliveredAt!} />
          ) : step4done ? (
            <ActionBtn
              label="Mark Delivered"
              loadingLabel="Marking…"
              onClick={onMarkDelivered}
              disabled={false}
              loading={isMarkingDelivered}
            />
          ) : null}
        </Step>
      </div>

      {/* Footer note when delivered */}
      {step5done && (
        <div className="mt-1 pt-3 border-t border-[#EDE8DF] text-xs text-[#9AAAC0]">
          7-day and 30-day follow-up emails will send automatically.
        </div>
      )}
    </section>
  );
}
