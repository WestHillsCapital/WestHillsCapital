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
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Products</h2>

      <div className="space-y-1">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_52px_88px_100px_100px] gap-2 pb-2 border-b border-gray-800">
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
              className="grid grid-cols-[1fr_52px_88px_100px_100px] gap-2 items-center py-2.5 border-b border-gray-800/40 last:border-0"
            >
              {/* Product name */}
              <span className="text-sm text-white leading-tight">{row.productName}</span>

              {/* Metal badge */}
              <span className="flex justify-center">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  row.metal === "gold"
                    ? "bg-amber-900/50 text-amber-400"
                    : "bg-gray-700 text-gray-300"
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
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-right text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 disabled:opacity-60"
              />

              {/* Unit price input */}
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.unitPrice}
                onChange={setRow(i, "unitPrice")}
                disabled={locked}
                placeholder="0.00"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-2 text-sm text-right text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 disabled:opacity-60"
              />

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

      {(goldOz > 0 || silverOz > 0) && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
          {goldOz   > 0 && <span>{goldOz} oz gold</span>}
          {silverOz > 0 && <span>{silverOz} oz silver</span>}
          <span className="text-gray-700">·</span>
          <span>Shipping: {shipping > 0 ? "$25 (FedEx)" : "Included ($0)"}</span>
        </div>
      )}
    </section>
  );
}
