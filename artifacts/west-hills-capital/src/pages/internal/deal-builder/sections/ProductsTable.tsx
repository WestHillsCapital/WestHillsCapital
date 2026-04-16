import type { ProductRow } from "../types";
import { parseNum, parseQty, fmtMoney } from "../utils";

interface Props {
  rows:      ProductRow[];
  setRow:    (i: number, field: "qty" | "unitPrice") => (e: React.ChangeEvent<HTMLInputElement>) => void;
  locked:    boolean;
  goldOz:    number;
  silverOz:  number;
  shipping:  number;
}

export function ProductsTable({ rows, setRow, locked, goldOz, silverOz, shipping }: Props) {
  return (
    <section className="bg-[#0d1728] border border-[#1a2640] rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Products</h2>

      <div className="overflow-x-auto">
      <div className="min-w-[440px] space-y-1">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_52px_80px_110px_110px] gap-2 pb-2 border-b border-[#1a2640]">
          <span className="text-xs font-medium text-gray-500">Product</span>
          <span className="text-xs font-medium text-gray-500 text-center">Metal</span>
          <span className="text-xs font-medium text-gray-500 text-right">Qty</span>
          <span className="text-xs font-medium text-gray-500 text-right">Unit Price</span>
          <span className="text-xs font-medium text-gray-500 text-right">Line Total</span>
        </div>

        {/* Product rows */}
        {rows.map((row, i) => {
          const qty = parseQty(row.qty);
          const up  = parseNum(row.unitPrice);
          const lt  = qty > 0 && up > 0 ? qty * up : 0;
          return (
            <div
              key={row.productId}
              className="grid grid-cols-[1fr_52px_80px_110px_110px] gap-2 items-center py-2.5 border-b border-[#1a2640]/40 last:border-0"
            >
              {/* Product name */}
              <span className="text-sm text-white leading-tight">{row.productName}</span>

              {/* Metal badge */}
              <span className="flex justify-center">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  row.metal === "gold"
                    ? "bg-[#C49A38]/20 text-[#C49A38]"
                    : "bg-[#1e2d4a] text-gray-300"
                }`}>
                  {row.metal === "gold" ? "AU" : "AG"}
                </span>
              </span>

              {/* Qty input */}
              <input
                type="number"
                min="0"
                value={row.qty}
                onChange={setRow(i, "qty")}
                disabled={locked}
                placeholder="0"
                className="w-full bg-[#162038] border border-[#243355] rounded px-2 py-2 text-sm text-right text-white focus:outline-none focus:border-[#C49A38] focus:ring-1 focus:ring-[#C49A38]/30 disabled:opacity-60"
              />

              {/* Unit price — formatted display when locked, input when editable */}
              {locked ? (
                <span className="text-right font-mono text-sm text-gray-300 pr-0.5">
                  {up > 0 ? fmtMoney(up) : "—"}
                </span>
              ) : (
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none select-none">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.unitPrice}
                    onChange={setRow(i, "unitPrice")}
                    placeholder="0.00"
                    className="w-full bg-[#162038] border border-[#243355] rounded pl-5 pr-2 py-2 text-sm text-right text-white focus:outline-none focus:border-[#C49A38] focus:ring-1 focus:ring-[#C49A38]/30"
                  />
                </div>
              )}

              {/* Line total */}
              <span className={`text-right font-mono text-sm ${
                lt > 0 ? "text-white font-semibold" : "text-gray-600"
              }`}>
                {lt > 0 ? fmtMoney(lt) : "—"}
              </span>
            </div>
          );
        })}
      </div>
      </div>

      {(goldOz > 0 || silverOz > 0) && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
          {goldOz   > 0 && <span>{goldOz} oz gold</span>}
          {silverOz > 0 && <span>{silverOz} oz silver</span>}
          <span className="text-gray-700">·</span>
          <span>Shipping: {shipping > 0 ? "$25 (FedEx)" : "Included ($0)"}</span>
        </div>
      )}
    </section>
  );
}
