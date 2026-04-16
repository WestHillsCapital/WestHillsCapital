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
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-mono text-gray-400">{subtotal > 0 ? fmtMoney(subtotal) : "—"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">
            Shipping{" "}
            <span className="text-gray-600 text-xs">
              ({goldOz < 15 && silverOz < 300 ? "FedEx" : "Included"})
            </span>
          </span>
          <span className="font-mono text-gray-400">{shipping > 0 ? fmtMoney(shipping) : "$0.00"}</span>
        </div>
      </div>

      {/* Total Due — dominant */}
      <div className="border-t border-gray-700 mt-4 pt-4">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-semibold text-white">Total Due</span>
          <span className={`font-mono font-bold text-2xl ${total > 0 ? "text-amber-400" : "text-gray-600"}`}>
            {total > 0 ? fmtMoney(total) : "—"}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-gray-600">Balance Due</span>
          <span className="font-mono text-xs text-gray-500">{total > 0 ? fmtMoney(total) : "—"}</span>
        </div>
      </div>
    </section>
  );
}
