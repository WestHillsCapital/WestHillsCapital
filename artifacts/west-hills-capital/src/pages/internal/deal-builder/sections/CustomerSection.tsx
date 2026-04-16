import type { Customer } from "../types";
import { US_STATES } from "../utils";
import { Field } from "./shared";

interface Props {
  customer:       Customer;
  setCust:        (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  locked:         boolean;
  deliveryMethod: string;
  fedexLocationSelected: boolean;
  // Billing address
  billingLine1:    string;
  billingLine2:    string;
  billingCity:     string;
  billingState:    string;
  billingZip:      string;
  setBillingLine1: (s: string) => void;
  setBillingLine2: (s: string) => void;
  setBillingCity:  (s: string) => void;
  setBillingState: (s: string) => void;
  setBillingZip:   (s: string) => void;
}

export function CustomerSection({
  customer, setCust, locked, deliveryMethod, fedexLocationSelected,
  billingLine1, billingLine2, billingCity, billingState, billingZip,
  setBillingLine1, setBillingLine2, setBillingCity, setBillingState, setBillingZip,
}: Props) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      {/* ── Customer ───────────────────────────────────────────────── */}
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
                <span className="ml-1 text-amber-500/70">(FedEx search)</span>
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

      {/* ── Billing Address ────────────────────────────────────────── */}
      <div className="border-t border-gray-800 mt-5 pt-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Billing Address</h3>
        <div className="space-y-2">
          <Field
            label="Street Address"
            value={billingLine1}
            onChange={(e) => setBillingLine1(e.target.value)}
            disabled={locked}
            placeholder="123 Main St"
          />
          <Field
            label="Apt / Suite (optional)"
            value={billingLine2}
            onChange={(e) => setBillingLine2(e.target.value)}
            disabled={locked}
            placeholder="Apt 4B"
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Field label="City" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} disabled={locked} placeholder="Wichita" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">State</label>
              <select
                value={billingState}
                onChange={(e) => setBillingState(e.target.value)}
                disabled={locked}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white disabled:opacity-60 focus:outline-none focus:border-amber-500"
              >
                <option value="">—</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Field label="ZIP" value={billingZip} onChange={(e) => setBillingZip(e.target.value)} disabled={locked} placeholder="67201" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
