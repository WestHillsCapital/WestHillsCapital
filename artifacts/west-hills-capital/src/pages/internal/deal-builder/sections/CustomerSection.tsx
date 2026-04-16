import type { Customer } from "../types";
import { US_STATES } from "../utils";
import { Field } from "./shared";

interface Props {
  customer:       Customer;
  setCust:        (field: keyof Customer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  locked:         boolean;
  deliveryMethod: string;
  fedexLocationSelected: boolean;
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
  const showFedexHint = deliveryMethod === "fedex_hold" && !fedexLocationSelected;

  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setBillingState(e.target.value);
    setCust("state")(e);
  }

  function handleZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/\D/g, "");
    setBillingZip(cleaned);
    setCust("zip")({ ...e, target: { ...e.target, value: cleaned } } as React.ChangeEvent<HTMLInputElement>);
  }

  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-4">
      <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider mb-3">Customer</h2>

      <div className="space-y-2">

        {/* Row 1: First Name | Last Name */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="First Name" value={customer.firstName} onChange={setCust("firstName")} disabled={locked} />
          <Field label="Last Name"  value={customer.lastName}  onChange={setCust("lastName")}  disabled={locked} />
        </div>

        {/* Row 2: Email | Phone */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Email" value={customer.email} onChange={setCust("email")} type="email" disabled={locked} />
          <Field label="Phone" value={customer.phone} onChange={setCust("phone")} type="tel"   disabled={locked} />
        </div>

        {/* Row 3: Street Address | Apt / Suite */}
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Street Address"
            value={billingLine1}
            onChange={(e) => setBillingLine1(e.target.value)}
            disabled={locked}
            placeholder="123 Main St"
          />
          <Field
            label="Apt / Suite"
            value={billingLine2}
            onChange={(e) => setBillingLine2(e.target.value)}
            disabled={locked}
            placeholder="optional"
          />
        </div>

        {/* Row 4: City | State | ZIP */}
        <div className="grid grid-cols-5 gap-2">
          {/* City — wider */}
          <div className="col-span-2">
            <Field
              label="City"
              value={billingCity}
              onChange={(e) => setBillingCity(e.target.value)}
              disabled={locked}
              placeholder="Wichita"
            />
          </div>

          {/* State */}
          <div className="col-span-2">
            <label className="block text-xs text-[#6B7A99] mb-1">State</label>
            <select
              value={billingState}
              onChange={handleStateChange}
              disabled={locked}
              className="w-full bg-white border border-[#D4C9B5] rounded px-2 py-1.5 text-sm text-[#0F1C3F] disabled:opacity-60 focus:outline-none focus:border-[#C49A38]"
            >
              <option value="">—</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* ZIP */}
          <div className="col-span-1">
            <label className="block text-xs text-[#6B7A99] mb-1 truncate">
              ZIP{showFedexHint && <span className="text-[#C49A38]/70">*</span>}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={billingZip}
              onChange={handleZipChange}
              disabled={locked}
              placeholder="67201"
              className="w-full bg-white border border-[#D4C9B5] rounded px-2 py-1.5 text-sm text-[#0F1C3F] placeholder:text-[#9AAAC0] disabled:opacity-60 focus:outline-none focus:border-[#C49A38]"
            />
          </div>
        </div>

        {/* Row 5: Lead ID | Confirmation ID */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Lead ID"          value={customer.leadId}         onChange={setCust("leadId")}         disabled={locked} />
          <Field label="Confirmation ID"  value={customer.confirmationId} onChange={setCust("confirmationId")} disabled={locked} />
        </div>

      </div>
    </section>
  );
}
