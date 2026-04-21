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
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider mb-4">Deal Type</h2>
      <div className="flex rounded overflow-hidden border border-[#D4C9B5]">
        {(["cash", "ira"] as const).map((t) => (
          <button
            key={t}
            disabled={locked}
            onClick={() => setDealType(t)}
            className={[
              "flex-1 py-2 text-sm font-medium transition-colors",
              dealType === t
                ? "bg-[#C49A38] text-black"
                : "bg-white text-[#6B7A99] hover:text-[#0F1C3F]",
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
          <Field label="IRA Account Number" value={customer.iraAccountNumber} onChange={setCust("iraAccountNumber")} disabled={locked} />
          <p className="text-xs text-[#a8832e]/80 bg-[#C49A38]/10 border border-[#C49A38]/20 rounded px-3 py-2">
            Custodian, depository, and paperwork package are handled in the DocuFill section below.
          </p>
        </div>
      )}
    </section>
  );
}
