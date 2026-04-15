import type { Customer } from "../types";
import { US_STATES } from "../utils";
import { Field } from "./shared";

interface Props {
  customer:       Customer;
  setCust:        (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  locked:         boolean;
  deliveryMethod: string;
  fedexLocationSelected: boolean;
}

export function CustomerSection({ customer, setCust, locked, deliveryMethod, fedexLocationSelected }: Props) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Customer</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="First Name" value={customer.firstName} onChange={setCust("firstName")} disabled={locked} />
          <Field label="Last Name"  value={customer.lastName}  onChange={setCust("lastName")}  disabled={locked} />
        </div>
        <Field label="Email" value={customer.email} onChange={setCust("email")} type="email" disabled={locked} />
        <Field label="Phone" value={customer.phone} onChange={setCust("phone")} type="tel"   disabled={locked} />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">State</label>
            <select
              value={customer.state}
              onChange={setCust("state")}
              disabled={locked}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white disabled:opacity-60 focus:outline-none focus:border-amber-500"
            >
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              ZIP{deliveryMethod === "fedex_hold" && !fedexLocationSelected && (
                <span className="ml-1 text-amber-500/70">(used for FedEx search)</span>
              )}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={customer.zip}
              onChange={(e) =>
                setCust("zip")({ target: { value: e.target.value.replace(/\D/g, "") } } as React.ChangeEvent<HTMLInputElement>)
              }
              disabled={locked}
              placeholder="ZIP"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white placeholder:text-gray-600 disabled:opacity-60 focus:outline-none focus:border-amber-500"
            />
          </div>
          <Field label="Lead ID" value={customer.leadId} onChange={setCust("leadId")} disabled={locked} />
        </div>
        <Field label="Confirmation ID" value={customer.confirmationId} onChange={setCust("confirmationId")} disabled={locked} />
      </div>
    </section>
  );
}
