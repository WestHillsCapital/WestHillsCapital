import type { Customer } from "../types";
import { Field } from "./shared";

interface Props {
  dealType:    "cash" | "ira";
  setDealType: (t: "cash" | "ira") => void;
  iraType:     string;
  setIraType:  (t: string) => void;
  customer:    Customer;
  setCust:     (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  locked:      boolean;
}

export function DealTypeSection({ dealType, setDealType, iraType, setIraType, customer, setCust, locked }: Props) {
  return (
    <section className="bg-[#0d1728] border border-[#1a2640] rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Deal Type</h2>
      <div className="flex rounded overflow-hidden border border-[#243355]">
        {(["cash", "ira"] as const).map((t) => (
          <button
            key={t}
            disabled={locked}
            onClick={() => setDealType(t)}
            className={[
              "flex-1 py-2 text-sm font-medium transition-colors",
              dealType === t
                ? "bg-[#C49A38] text-black"
                : "bg-[#162038] text-gray-400 hover:text-white",
              locked ? "opacity-60 cursor-default" : "",
            ].join(" ")}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {dealType === "ira" && (
        <div className="mt-4 space-y-3">
          <Field
            label="IRA Type (Transfer / Rollover / New)"
            value={iraType}
            onChange={(e) => setIraType(e.target.value)}
            disabled={locked}
          />
          <Field label="Custodian"          value={customer.custodian}        onChange={setCust("custodian")}        disabled={locked} />
          <Field label="IRA Account Number" value={customer.iraAccountNumber} onChange={setCust("iraAccountNumber")} disabled={locked} />
          <p className="text-xs text-[#a8832e]/80 bg-[#C49A38]/10 border border-[#C49A38]/20 rounded px-3 py-2">
            IRA processing is handled manually. Pricing is the same as cash.
          </p>
        </div>
      )}
    </section>
  );
}
