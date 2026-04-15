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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left pb-2 text-xs text-gray-500 font-medium">Product</th>
              <th className="text-left pb-2 text-xs text-gray-500 font-medium w-16">Metal</th>
              <th className="text-right pb-2 text-xs text-gray-500 font-medium w-20">Qty</th>
              <th className="text-right pb-2 text-xs text-gray-500 font-medium w-28">Unit Price</th>
              <th className="text-right pb-2 text-xs text-gray-500 font-medium w-28">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const qty = parseQty(row.qty);
              const up  = parseNum(row.unitPrice);
              const lt  = qty > 0 && up > 0 ? qty * up : 0;
              return (
                <tr key={row.productId} className="border-b border-gray-800/40">
                  <td className="py-2.5 pr-4 text-white">{row.productName}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${row.metal === "gold" ? "bg-amber-900/50 text-amber-400" : "bg-gray-700 text-gray-300"}`}>
                      {row.metal}
                    </span>
                  </td>
                  <td className="py-2.5 pr-2">
                    <input
                      type="number"
                      min="0"
                      value={row.qty}
                      onChange={setRow(i, "qty")}
                      disabled={locked}
                      placeholder="0"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    />
                  </td>
                  <td className="py-2.5 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitPrice}
                      onChange={setRow(i, "unitPrice")}
                      disabled={locked}
                      placeholder="0.00"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-right text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    />
                  </td>
                  <td className="py-2.5 text-right text-gray-300 font-mono text-sm">
                    {lt > 0 ? fmtMoney(lt) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(goldOz > 0 || silverOz > 0) && (
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          {goldOz   > 0 && <span>{goldOz} oz gold</span>}
          {silverOz > 0 && <span>{silverOz} oz silver</span>}
          <span className="text-gray-600">·</span>
          <span>Shipping: {shipping > 0 ? "$25 (FedEx)" : "Included ($0)"}</span>
        </div>
      )}
    </section>
  );
}
