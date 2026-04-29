import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import type { Customer } from "../types";
import {
  DOCUFILL_TRANSACTION_TYPES,
  getMatchingDocuFillPackages,
  getDocuFillTransactionLabel,
  resolveDocuFillSelections,
  type DocuFillEntity,
  type DocuFillPackage,
} from "../utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

type DocuFillTransactionType = {
  scope: string;
  label: string;
  active: boolean;
};

interface Props {
  customer: Customer;
  setCustomer: Dispatch<SetStateAction<Customer>>;
  savedDealId: number | null;
  locked: boolean;
  getAuthHeaders: () => HeadersInit;
  packageId: string;
  onPackageChange: (id: string) => void;
  transactionScope: string;
  onTransactionScopeChange: (scope: string) => void;
}

export function DocuFillPackagesSection({
  customer,
  setCustomer,
  savedDealId,
  locked,
  getAuthHeaders,
  packageId,
  onPackageChange,
  transactionScope,
  onTransactionScopeChange,
}: Props) {
  const [, navigate] = useLocation();
  const [custodians, setCustodians] = useState<DocuFillEntity[]>([]);
  const [depositories, setDepositories] = useState<DocuFillEntity[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<DocuFillTransactionType[]>([]);
  const [packages, setPackages] = useState<DocuFillPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_BASE}/api/internal/docufill/bootstrap`, { headers: { ...getAuthHeadersRef.current() } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Could not load DocuFill packages")))
      .then((data: { custodians: DocuFillEntity[]; depositories: DocuFillEntity[]; transactionTypes?: DocuFillTransactionType[]; packages: DocuFillPackage[] }) => {
        setCustodians(data.custodians ?? []);
        setDepositories(data.depositories ?? []);
        setTransactionTypes(data.transactionTypes?.length ? data.transactionTypes : DOCUFILL_TRANSACTION_TYPES.map((item) => ({ scope: item.value, label: item.label, active: true })));
        setPackages(data.packages ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load DocuFill packages"))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { selectedCustodian, selectedDepository } = resolveDocuFillSelections(customer, custodians, depositories);

  const matchingPackages = useMemo(() => {
    return getMatchingDocuFillPackages(packages, selectedCustodian, selectedDepository, transactionScope);
  }, [packages, selectedCustodian, selectedDepository, transactionScope]);

  const labelForScope = (scope: string) => transactionTypes.find((item) => item.scope === scope)?.label ?? getDocuFillTransactionLabel(scope);

  useEffect(() => {
    const custodianDiffers = selectedCustodian && customer.custodianId !== String(selectedCustodian.id);
    const depositoryDiffers = selectedDepository && customer.depositoryId !== String(selectedDepository.id);
    if (!custodianDiffers && !depositoryDiffers) return;
    setCustomer((prev) => {
      let next = prev;
      if (custodianDiffers) {
        next = { ...next, custodianId: String(selectedCustodian.id), custodian: selectedCustodian.name };
      }
      if (depositoryDiffers) {
        next = { ...next, depositoryId: String(selectedDepository.id), depository: selectedDepository.name };
      }
      return next;
    });
  }, [customer.custodianId, customer.depositoryId, selectedCustodian, selectedDepository, setCustomer]);

  const packageIdRef = useRef(packageId);
  packageIdRef.current = packageId;
  useEffect(() => {
    const current = packageIdRef.current;
    if (current && matchingPackages.some((pkg) => String(pkg.id) === current)) return;
    const newId = matchingPackages.length === 1 ? String(matchingPackages[0]!.id) : "";
    onPackageChange(newId);
  }, [matchingPackages, onPackageChange]);

  const selectedPkg = matchingPackages.find((p) => String(p.id) === packageId);

  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">IRA Paperwork</h2>
          <p className="text-xs text-[#8A9BB8] mt-1">Select custodian, depository, and transaction type — the interview will appear after locking the deal.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/internal/docufill")}
          className="text-xs px-2.5 py-1.5 rounded border border-[#DDD5C4] text-[#6B7A99] hover:text-[#0F1C3F] shrink-0"
        >
          Manage
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-[#6B7A99] mb-1">Custodian</span>
          <select
            value={customer.custodianId}
            disabled={locked || isLoading}
            onChange={(e) => {
              const custodian = custodians.find((c) => String(c.id) === e.target.value);
              setCustomer((prev) => ({
                ...prev,
                custodianId: custodian ? String(custodian.id) : "",
                custodian: custodian?.name ?? "",
              }));
            }}
            className="w-full bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38] disabled:opacity-60"
          >
            <option value="">Select custodian</option>
            {custodians.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-[#6B7A99] mb-1">Depository</span>
          <select
            value={customer.depositoryId}
            disabled={locked || isLoading}
            onChange={(e) => {
              const depository = depositories.find((d) => String(d.id) === e.target.value);
              setCustomer((prev) => ({
                ...prev,
                depositoryId: depository ? String(depository.id) : "",
                depository: depository?.name ?? "",
              }));
            }}
            className="w-full bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38] disabled:opacity-60"
          >
            <option value="">Select depository</option>
            {depositories.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </div>

      <label className="block mt-3">
        <span className="block text-xs text-[#6B7A99] mb-1">Transaction type</span>
        <select
          value={transactionScope}
          onChange={(e) => onTransactionScopeChange(e.target.value)}
          disabled={locked || isLoading}
          className="w-full bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38] disabled:opacity-60"
        >
          {transactionTypes.filter((item) => item.active).map((item) => <option key={item.scope} value={item.scope}>{item.label}</option>)}
        </select>
      </label>

      <label className="block mt-3">
        <span className="block text-xs text-[#6B7A99] mb-1">Matching Package</span>
        <select
          value={packageId}
          onChange={(e) => onPackageChange(e.target.value)}
          disabled={isLoading || matchingPackages.length === 0 || locked}
          className="w-full bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38] disabled:opacity-60"
        >
          <option value="">{matchingPackages.length ? "Select package" : `No active ${labelForScope(transactionScope)} package for this combination`}</option>
          {matchingPackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {labelForScope(pkg.transaction_scope)} · v{pkg.version}</option>)}
        </select>
      </label>

      {packageId && selectedPkg && !locked && (
        <p className="mt-2 text-xs text-[#8A9BB8]">
          <span className="text-green-700 font-medium">✓ Package selected</span> — the IRA interview will open automatically when you lock the deal.
        </p>
      )}

      {locked && packageId && (
        <p className="mt-2 text-xs text-[#8A9BB8]">Package locked with deal — see interview below.</p>
      )}

      {error && <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
    </section>
  );
}
