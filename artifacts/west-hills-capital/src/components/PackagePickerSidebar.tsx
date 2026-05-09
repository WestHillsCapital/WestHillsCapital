import { memo, useRef, useState, useEffect } from "react";
import { useDocuFillStore } from "@/stores/useDocuFillStore";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PackageItem } from "@/lib/docufill-local-types";

export type BuilderStep = "documents" | "mapping" | "interview" | "finalize";

export const BUILDER_STEPS: Array<{ value: BuilderStep; label: string; helper: string }> = [
  { value: "documents", label: "1. Document View", helper: "Add and order package PDFs" },
  { value: "mapping", label: "2. Data + Fields View", helper: "Drag fields onto documents" },
  { value: "interview", label: "3. Questionnaire & Output", helper: "Order questions and activate" },
];

interface PackagePickerSidebarProps {
  isAdmin: boolean;
  isSaving: boolean;
  tab: "packages" | "mapper" | "interview" | "csv" | "groups" | "compliance";
  isPublicSession: boolean;
  addingPackage: boolean;
  setAddingPackage: React.Dispatch<React.SetStateAction<boolean>>;
  newPackageName: string;
  setNewPackageName: (v: string) => void;
  newPackageInputRef: React.RefObject<HTMLInputElement | null>;
  complianceGapPackageIds?: Set<number>;
  builderStep: BuilderStep;
  goBuilderStep: (step: BuilderStep, opts?: { autoSort?: boolean; saveFirst?: boolean }) => void;
  savePackage: (pkg: PackageItem) => void;
  createPackage: () => void;
  mappingCount: number;
  unmappedCount: number;
}

export const PackagePickerSidebar = memo(function PackagePickerSidebar({
  isAdmin,
  isSaving,
  tab,
  isPublicSession,
  addingPackage,
  setAddingPackage,
  newPackageName,
  setNewPackageName,
  newPackageInputRef,
  builderStep,
  goBuilderStep,
  savePackage,
  createPackage,
  mappingCount,
  unmappedCount,
  complianceGapPackageIds,
}: PackagePickerSidebarProps) {
  const packages = useDocuFillStore((s) => s.packages);
  const selectedPackageId = useDocuFillStore((s) => s.selectedPackageId);
  const setSelectedPackageId = useDocuFillStore((s) => s.setSelectedPackageId);
  const updateSelectedPackage = useDocuFillStore((s) => s.updateSelectedPackage);
  const tagFilter = useDocuFillStore((s) => s.tagFilter);
  const setTagFilter = useDocuFillStore((s) => s.setTagFilter);

  const [pkgDropdownOpen, setPkgDropdownOpen] = useState(false);
  const pkgDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pkgDropdownOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (pkgDropdownRef.current && !pkgDropdownRef.current.contains(e.target as Node)) {
        setPkgDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [pkgDropdownOpen]);

  if (isPublicSession || (tab !== "packages" && tab !== "mapper")) return null;

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0] ?? null;
  const packageInterviewFields = selectedPackage?.fields.filter((field) => field.interviewMode !== "omitted") ?? [];

  const allTagsSet = new Set<string>();
  packages.forEach((pkg) => pkg.tags?.forEach((t) => allTagsSet.add(t)));
  const allTags = Array.from(allTagsSet).sort();

  const visiblePackages = tagFilter.length === 0
    ? packages
    : packages.filter((pkg) => pkg.id === selectedPackageId || tagFilter.some((t) => pkg.tags?.includes(t)));

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);

  return (
    <div className="mb-5 rounded-xl border border-[#DDD5C4] bg-white p-3 space-y-3">
      {/* Tag filter row — only shown when packages have tags */}
      {allTags.length > 0 && (() => {
        const isAll = tagFilter.length === 0;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-[#8A9BB8] shrink-0">Filter:</span>
            <button
              type="button"
              onClick={() => setTagFilter([])}
              className={`text-[11px] rounded-full px-2 py-0.5 border transition-colors ${isAll ? "bg-[#0F1C3F] border-[#0F1C3F] text-white font-medium" : "bg-[#F8F6F0] border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38]/60 hover:text-[#4A5568]"}`}
            >All</button>
            {allTags.map((tag) => {
              const active = tagFilter.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter((prev) => active ? prev.filter((t) => t !== tag) : [...prev, tag])}
                  className={`text-[11px] rounded-full px-2 py-0.5 border transition-colors ${active ? "bg-[#C49A38] border-[#C49A38] text-white font-medium" : "bg-[#F8F6F0] border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38]/60 hover:text-[#4A5568]"}`}
                >{tag}</button>
              );
            })}
          </div>
        );
      })()}

      {/* Package switcher row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-[#6B7A99] shrink-0">Package</span>
        <div ref={pkgDropdownRef} className="relative flex-1 min-w-0 max-w-xs">
          <button
            type="button"
            onClick={() => setPkgDropdownOpen((v) => !v)}
            disabled={packages.length === 0}
            className="w-full border border-[#D4C9B5] rounded-lg px-3 py-1.5 text-sm bg-white font-medium text-[#0F1C3F] text-left flex items-center justify-between gap-2 disabled:opacity-60"
          >
            <span className="truncate">{selectedPkg ? selectedPkg.name : (packages.length === 0 ? "No packages yet" : "Select a package…")}</span>
            <svg className={`w-3.5 h-3.5 shrink-0 text-[#8A9BB8] transition-transform ${pkgDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {pkgDropdownOpen && (
            <div className="absolute top-full mt-1 left-0 w-full min-w-[260px] bg-white border border-[#DDD5C4] rounded-lg shadow-lg z-50 overflow-y-auto max-h-72">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-xs text-[#8A9BB8] hover:bg-[#F8F6F0]"
                onClick={() => { setSelectedPackageId(null); setAddingPackage(false); setPkgDropdownOpen(false); }}
              >Select a package…</button>
              {visiblePackages.length === 0 && (
                <div className="px-3 py-3 text-xs text-[#8A9BB8] border-t border-[#F0EBE0] italic">No packages match the active tag filter.</div>
              )}
              {visiblePackages.map((pkg) => {
                const hasGap = complianceGapPackageIds?.has(pkg.id) ?? false;
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 border-t border-[#F0EBE0] transition-colors hover:bg-[#F8F6F0] ${selectedPackageId === pkg.id ? "bg-[#FBF7EE]" : ""}`}
                    onClick={() => { setSelectedPackageId(pkg.id); setAddingPackage(false); setPkgDropdownOpen(false); }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#0F1C3F] truncate">{pkg.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasGap && (
                          <span title="Compliance gap: required fields missing" className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626] font-semibold border border-[#FCA5A5]">⚠ gap</span>
                        )}
                        {pkg.status !== "active" && <span className="text-[10px] text-[#8A9BB8]">inactive</span>}
                      </div>
                    </div>
                    {pkg.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pkg.tags.map((tag) => (
                          <span key={tag} className="text-[10px] rounded-full px-1.5 py-px bg-[#EFE8D8] text-[#5C4A1E] border border-[#DDD5C4]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => { setAddingPackage((v) => !v); setSelectedPackageId(null); }}
            className={`shrink-0 text-xs border rounded-lg px-3 py-1.5 transition-colors ${addingPackage ? "border-[#C49A38] bg-[#C49A38]/10 text-[#8A6A20]" : "border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38]/60 hover:text-[#0F1C3F]"}`}
          >
            + New Package
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button
                  type="button"
                  disabled
                  className="shrink-0 text-xs border rounded-lg px-3 py-1.5 border-[#DDD5C4] text-[#6B7A99] opacity-40 cursor-not-allowed"
                >
                  + New Package
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Contact your admin to create packages.</TooltipContent>
          </Tooltip>
        )}

        {selectedPackage && (
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <span className="text-xs text-[#8A9BB8] hidden sm:block">
              {selectedPackage.documents.length} doc{selectedPackage.documents.length !== 1 ? "s" : ""} · {packageInterviewFields.length} question{packageInterviewFields.length !== 1 ? "s" : ""} · {mappingCount} placement{mappingCount !== 1 ? "s" : ""}{unmappedCount > 0 ? ` · ${unmappedCount} unmapped` : " · all placed"}
            </span>
            <button
              type="button"
              onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, status: pkg.status === "active" ? "inactive" : "active" }))}
              className={`shrink-0 flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border font-medium transition-colors ${
                selectedPackage.status === "active"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  : "bg-[#F8F6F0] border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38]/50 hover:text-[#4A5568]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${selectedPackage.status === "active" ? "bg-emerald-500" : "bg-[#C4B99A]"}`} />
              {selectedPackage.status === "active" ? "Active" : "Inactive"}
            </button>
            <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} variant="outline" className="shrink-0 text-xs h-8 px-3">{isSaving ? "Saving…" : "Save"}</Button>
          </div>
        )}
      </div>

      {/* Inline add-package form */}
      {addingPackage && (
        <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-3 space-y-3">
          <div className="text-sm font-semibold text-[#0F1C3F]">New package</div>
          <label className="block text-xs text-[#6B7A99]">
            Package name
            <Input
              ref={newPackageInputRef}
              value={newPackageName}
              onChange={(e) => setNewPackageName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newPackageName.trim() && !isSaving) createPackage(); }}
              placeholder="e.g. Youth Soccer Registration"
              className="mt-1 h-9 bg-white text-sm"
            />
          </label>
          <div className="flex gap-2">
            <Button onClick={createPackage} disabled={isSaving || !newPackageName.trim()}>Create Package</Button>
            <Button type="button" onClick={() => setAddingPackage(false)} variant="outline">Cancel</Button>
          </div>
        </div>
      )}

      {/* Step progress indicator — only when a package is selected */}
      {selectedPackage && !addingPackage && (
        <div className="flex items-center gap-1">
          {BUILDER_STEPS.map((step, idx) => {
            const isActive = builderStep === step.value;
            const isPast = BUILDER_STEPS.findIndex((s) => s.value === builderStep) > idx;
            return (
              <button
                key={step.value}
                type="button"
                onClick={() => goBuilderStep(step.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? "bg-[#0F1C3F] text-white" : isPast ? "bg-[#EAF0FB] text-[#0F1C3F]" : "text-[#8A9BB8] hover:text-[#0F1C3F]"}`}
              >
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0 ${isActive ? "bg-white/20 text-white" : isPast ? "bg-[#0F1C3F] text-white" : "bg-[#DDD5C4] text-[#6B7A99]"}`}>
                  {isPast ? "✓" : idx + 1}
                </span>
                <span className="hidden sm:inline">{["Documents", "Map Fields", "Finalize"][idx]}</span>
              </button>
            );
          })}
          {tab === "mapper" && (
            <span className="ml-auto text-[11px] text-[#8A9BB8]">PDF Mapper</span>
          )}
        </div>
      )}
    </div>
  );
});
