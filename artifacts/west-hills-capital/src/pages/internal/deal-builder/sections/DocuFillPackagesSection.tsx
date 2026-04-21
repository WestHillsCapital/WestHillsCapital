import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import type { Customer } from "../types";
import {
  getMatchingDocuFillPackages,
  resolveDocuFillSelections,
  type DocuFillEntity,
  type DocuFillPackage,
} from "../utils";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Props {
  customer: Customer;
  setCustomer: Dispatch<SetStateAction<Customer>>;
  savedDealId: number | null;
  locked: boolean;
  getAuthHeaders: () => HeadersInit;
}

export function DocuFillPackagesSection({ customer, setCustomer, savedDealId, locked, getAuthHeaders }: Props) {
  const [, navigate] = useLocation();
  const [custodians, setCustodians] = useState<DocuFillEntity[]>([]);
  const [depositories, setDepositories] = useState<DocuFillEntity[]>([]);
  const [packages, setPackages] = useState<DocuFillPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch(`${API_BASE}/api/internal/docufill/bootstrap`, { headers: { ...getAuthHeaders() } })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Could not load DocuFill packages")))
      .then((data: { custodians: DocuFillEntity[]; depositories: DocuFillEntity[]; packages: DocuFillPackage[] }) => {
        setCustodians(data.custodians ?? []);
        setDepositories(data.depositories ?? []);
        setPackages(data.packages ?? []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load DocuFill packages"))
      .finally(() => setIsLoading(false));
  }, [getAuthHeaders]);

  const { selectedCustodian, selectedDepository } = resolveDocuFillSelections(customer, custodians, depositories);

  const matchingPackages = useMemo(() => {
    return getMatchingDocuFillPackages(packages, selectedCustodian, selectedDepository);
  }, [packages, selectedCustodian, selectedDepository]);

  useEffect(() => {
    if (selectedCustodian && customer.custodianId !== String(selectedCustodian.id)) {
      setCustomer((prev) => ({ ...prev, custodianId: String(selectedCustodian.id), custodian: selectedCustodian.name }));
    }
    if (selectedDepository && customer.depositoryId !== String(selectedDepository.id)) {
      setCustomer((prev) => ({ ...prev, depositoryId: String(selectedDepository.id), depository: selectedDepository.name }));
    }
  }, [customer.custodianId, customer.depositoryId, selectedCustodian, selectedDepository, setCustomer]);

  useEffect(() => {
    setSelectedPackageId((current) => {
      if (current && matchingPackages.some((pkg) => String(pkg.id) === current)) return current;
      if (matchingPackages.length === 1) return String(matchingPackages[0]!.id);
      return "";
    });
  }, [matchingPackages]);

  async function launchPackage() {
    const packageId = Number(selectedPackageId);
    if (!packageId) {
      setError("Select a DocuFill package first.");
      return;
    }
    setIsLaunching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId,
          custodianId: customer.custodianId ? Number(customer.custodianId) : null,
          depositoryId: customer.depositoryId ? Number(customer.depositoryId) : null,
          dealId: savedDealId,
          source: "deal_builder",
          prefill: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            state: customer.state,
            custodian: customer.custodian,
            custodianId: customer.custodianId,
            depository: customer.depository,
            depositoryId: customer.depositoryId,
            iraAccountNumber: customer.iraAccountNumber,
            dealId: savedDealId,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not launch DocuFill package");
      navigate(`/internal/docufill?session=${data.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch DocuFill package");
    } finally {
      setIsLaunching(false);
    }
  }

  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wider">DocuFill Packages</h2>
          <p className="text-xs text-[#8A9BB8] mt-1">Select custodian + depository, then open the matching interview.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/internal/docufill")}
          className="text-xs px-2.5 py-1.5 rounded border border-[#DDD5C4] text-[#6B7A99] hover:text-[#0F1C3F]"
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
        <span className="block text-xs text-[#6B7A99] mb-1">Matching Package Interview</span>
        <select
          value={selectedPackageId}
          onChange={(e) => setSelectedPackageId(e.target.value)}
          disabled={isLoading || matchingPackages.length === 0}
          className="w-full bg-white border border-[#D4C9B5] rounded px-3 py-1.5 text-sm text-[#0F1C3F] focus:outline-none focus:border-[#C49A38] disabled:opacity-60"
        >
          <option value="">{matchingPackages.length ? "Select package" : "No active package for this combination"}</option>
          {matchingPackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · v{pkg.version}</option>)}
        </select>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={launchPackage}
          disabled={isLaunching || !selectedPackageId}
          className="px-4 py-2 rounded bg-[#0F1C3F] text-white text-sm font-medium hover:bg-[#182B5F] disabled:opacity-50"
        >
          {isLaunching ? "Opening…" : "Open DocuFill Package"}
        </button>
        <span className="text-xs text-[#8A9BB8]">Known deal data will prefill; the interview asks only for missing fields.</span>
      </div>
      {error && <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
    </section>
  );
}
