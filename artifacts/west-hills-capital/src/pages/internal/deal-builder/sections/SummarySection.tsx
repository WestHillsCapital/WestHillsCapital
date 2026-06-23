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
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider mb-4">Summary</h2>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[#8A9BB8]">Subtotal</span>
          <span className="font-mono text-[#6B7A99]">{subtotal > 0 ? fmtMoney(subtotal) : "—"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#8A9BB8]">
            Shipping{" "}
            <span className="text-[#9AAAC0] text-xs">
              ({goldOz < 15 && silverOz < 300 ? "FedEx" : "Included"})
            </span>
          </span>
          <span className="font-mono text-[#6B7A99]">{shipping > 0 ? fmtMoney(shipping) : "$0.00"}</span>
        </div>
      </div>

      {/* Total Due — dominant */}
      <div className="border-t border-[#D4C9B5] mt-4 pt-4">
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-semibold text-[#0F1C3F]">Total Due</span>
          <span className={`font-mono font-bold text-2xl ${total > 0 ? "text-[#C49A38]" : "text-[#9AAAC0]"}`}>
            {total > 0 ? fmtMoney(total) : "—"}
          </span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-[#9AAAC0]">Balance Due</span>
          <span className="font-mono text-xs text-[#8A9BB8]">{total > 0 ? fmtMoney(total) : "—"}</span>
        </div>
      </div>
    </section>
  );
}
