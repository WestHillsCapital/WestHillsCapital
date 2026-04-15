import { fmtMoney } from "../utils";

interface Props {
  subtotal: number;
  shipping: number;
  total:    number;
  goldOz:   number;
  silverOz: number;
}

export function SummarySection({ subtotal, shipping, total, goldOz, silverOz }: Props) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Summary</h2>
      <div className="space-y-2 text-sm">
        <SummaryRow label="Subtotal" value={subtotal > 0 ? fmtMoney(subtotal) : "—"} />
        <SummaryRow
          label={`Shipping (${goldOz < 15 && silverOz < 300 ? "FedEx" : "Included"})`}
          value={shipping > 0 ? fmtMoney(shipping) : "$0.00"}
        />
        <div className="border-t border-gray-800 pt-2 mt-2">
          <SummaryRow label="Total"       value={total > 0 ? fmtMoney(total) : "—"} highlight />
          <SummaryRow label="Balance Due" value={total > 0 ? fmtMoney(total) : "—"} />
        </div>
      </div>
    </section>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={highlight ? "text-white font-medium" : "text-gray-400"}>{label}</span>
      <span className={`font-mono ${highlight ? "text-white font-semibold text-base" : "text-gray-300"}`}>
        {value}
      </span>
    </div>
  );
}
