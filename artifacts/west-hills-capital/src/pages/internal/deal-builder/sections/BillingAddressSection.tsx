import { US_STATES } from "../utils";
import { Field } from "./shared";

interface Props {
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
  locked:          boolean;
}

export function BillingAddressSection({
  billingLine1, billingLine2, billingCity, billingState, billingZip,
  setBillingLine1, setBillingLine2, setBillingCity, setBillingState, setBillingZip,
  locked,
}: Props) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Billing Address</h2>
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
            <Field label="Zip" value={billingZip} onChange={(e) => setBillingZip(e.target.value)} disabled={locked} placeholder="67201" />
          </div>
        </div>
      </div>
    </section>
  );
}
