import React, { type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { FieldItem } from "@/lib/docufill-types";
import { validateCellValue, tryAutoFix, autoFixLabel, validationTypeHint } from "@/lib/docufill-field-utils";
import { packageTemplateToCsv, downloadCsv, batchResultsToCsv } from "@/lib/docufill-csv";
import type { PackageItem } from "@/lib/docufill-local-types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const CSV_BATCH_MAX = 3000;

type BatchRun = {
  batch_run_id: string;
  package_name: string;
  run_started_at: string;
  total: number | string;
  pending: number | string;
  completed: number | string;
  emailed: number | string;
};

type BatchRunSession = {
  token: string;
  signer_name?: string | null;
  link_email_recipient?: string | null;
  link_emailed_at?: string | null;
  submitted_at?: string | null;
  status: string;
};

type CsvBatchResult = {
  rowIndex: number;
  status: "processing" | "created" | "error";
  token: string | null;
  error?: string;
};

type CsvInviteResult = {
  status: "sent" | "error";
  sentTo?: string;
  error?: string;
};

export type CsvDashboardTab = "import" | "dashboard";

export interface DocuFillCsvPanelProps {
  packages: PackageItem[];
  activePackages: PackageItem[];
  csvDashboardTab: CsvDashboardTab;
  setCsvDashboardTab: React.Dispatch<React.SetStateAction<CsvDashboardTab>>;
  csvDashLoading: boolean;
  csvDashError: string | null;
  csvDashBatchRuns: BatchRun[];
  csvDashExpanded: string | null;
  setCsvDashExpanded: React.Dispatch<React.SetStateAction<string | null>>;
  csvDashRunSessions: Record<string, BatchRunSession[]>;
  setCsvDashRunSessions: React.Dispatch<React.SetStateAction<Record<string, BatchRunSession[]>>>;
  csvDashRunLoading: Record<string, boolean>;
  setCsvDashRunLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  csvBatchPackageId: string;
  setCsvBatchPackageId: React.Dispatch<React.SetStateAction<string>>;
  csvBatchFieldMap: Map<string, FieldItem>;
  csvBatchValidationSummary: {
    total: number;
    invalidRows: number[];
    emptyRequiredRows: number[];
    fieldIssues: Array<{ label: string; invalid: number[]; emptyRequired: number[] }>;
  } | null;
  csvBatchFile: File | null;
  csvBatchHeaders: string[];
  csvBatchRows: Record<string, string>[];
  setCsvBatchRows: React.Dispatch<React.SetStateAction<Record<string, string>[]>>;
  csvBatchOriginalRows: Record<string, string>[];
  csvBatchHasEdits: boolean;
  setCsvBatchHasEdits: React.Dispatch<React.SetStateAction<boolean>>;
  csvBatchMismatch: boolean;
  setCsvBatchMismatch: React.Dispatch<React.SetStateAction<boolean>>;
  csvBatchError: string | null;
  setCsvBatchError: React.Dispatch<React.SetStateAction<string | null>>;
  csvBatchResults: CsvBatchResult[] | null;
  csvBatchIsImporting: boolean;
  csvEditingCell: { rowIdx: number; header: string } | null;
  setCsvEditingCell: React.Dispatch<React.SetStateAction<{ rowIdx: number; header: string } | null>>;
  csvEditNavigatingRef: RefObject<boolean>;
  csvBatchFileInputRef: RefObject<HTMLInputElement | null>;
  csvBatchBreakdownRef: RefObject<HTMLDivElement | null>;
  csvCorrectedDownloadedTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  csvColumnsExpanded: boolean;
  setCsvColumnsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  csvBatchFieldBreakdownOpen: boolean;
  setCsvBatchFieldBreakdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  csvBreakdownHighlightedField: string | null;
  setCsvBreakdownHighlightedField: React.Dispatch<React.SetStateAction<string | null>>;
  csvCorrectedDownloaded: boolean;
  setCsvCorrectedDownloaded: React.Dispatch<React.SetStateAction<boolean>>;
  showCsvFieldKey: boolean;
  setShowCsvFieldKey: React.Dispatch<React.SetStateAction<boolean>>;
  csvInviteOpen: boolean;
  setCsvInviteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  csvInviteMessage: string;
  setCsvInviteMessage: React.Dispatch<React.SetStateAction<string>>;
  csvInviteSending: boolean;
  setCsvInviteSending: React.Dispatch<React.SetStateAction<boolean>>;
  csvInviteResults: Record<string, CsvInviteResult>;
  setCsvInviteResults: React.Dispatch<React.SetStateAction<Record<string, CsvInviteResult>>>;
  labelForTransactionScope: (scope: string | null | undefined) => string;
  getAuthHeaders: () => HeadersInit;
  docufillApiPath: string;
  handleCsvBatchFileChange: (file: File | null) => void;
  handleCsvBatchImport: (retryRowIndices?: number[]) => void;
}

export const DocuFillCsvPanel = React.memo(function DocuFillCsvPanel(props: DocuFillCsvPanelProps) {
  const {
    packages, activePackages,
    csvDashboardTab, setCsvDashboardTab,
    csvDashLoading, csvDashError, csvDashBatchRuns,
    csvDashExpanded, setCsvDashExpanded,
    csvDashRunSessions, setCsvDashRunSessions, csvDashRunLoading, setCsvDashRunLoading,
    csvBatchPackageId, setCsvBatchPackageId,
    csvBatchFieldMap, csvBatchValidationSummary,
    csvBatchFile, csvBatchHeaders, csvBatchRows, setCsvBatchRows,
    csvBatchOriginalRows, csvBatchHasEdits, setCsvBatchHasEdits,
    csvBatchMismatch, setCsvBatchMismatch, csvBatchError, setCsvBatchError,
    csvBatchResults, csvBatchIsImporting,
    csvEditingCell, setCsvEditingCell, csvEditNavigatingRef,
    csvBatchFileInputRef, csvBatchBreakdownRef, csvCorrectedDownloadedTimerRef,
    csvColumnsExpanded, setCsvColumnsExpanded,
    csvBatchFieldBreakdownOpen, setCsvBatchFieldBreakdownOpen,
    csvBreakdownHighlightedField, setCsvBreakdownHighlightedField,
    csvCorrectedDownloaded, setCsvCorrectedDownloaded,
    showCsvFieldKey, setShowCsvFieldKey,
    csvInviteOpen, setCsvInviteOpen,
    csvInviteMessage, setCsvInviteMessage,
    csvInviteSending, setCsvInviteSending,
    csvInviteResults, setCsvInviteResults,
    labelForTransactionScope, getAuthHeaders, docufillApiPath,
    handleCsvBatchFileChange, handleCsvBatchImport,
  } = props;

  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg max-w-4xl mx-auto overflow-hidden">
      <div className="flex border-b border-[#DDD5C4]">
        {(["import", "dashboard"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setCsvDashboardTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              csvDashboardTab === t
                ? "border-[#0F1C3F] text-[#0F1C3F]"
                : "border-transparent text-[#8A9BB8] hover:text-[#0F1C3F] hover:border-[#DDD5C4]"
            }`}
          >
            {t === "import" ? "Import" : "Batch Dashboard"}
          </button>
        ))}
      </div>

      {csvDashboardTab === "dashboard" && (
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold">Batch Run History</h2>
            <p className="text-xs text-[#8A9BB8] mt-0.5">All past CSV batch runs. Expand a run to see per-row status and PDF links.</p>
          </div>
          {csvDashLoading && (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-[#0F1C3F] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {csvDashError && <div className="text-sm text-red-600">{csvDashError}</div>}
          {!csvDashLoading && !csvDashError && csvDashBatchRuns.length === 0 && (
            <div className="text-center py-10 text-sm text-[#8A9BB8]">No batch runs yet — switch to Import to upload your first CSV.</div>
          )}
          {!csvDashLoading && csvDashBatchRuns.length > 0 && (
            <div className="space-y-2">
              {csvDashBatchRuns.map((run) => {
                const total     = Number(run.total);
                const pending   = Number(run.pending);
                const completed = Number(run.completed);
                const emailed   = Number(run.emailed);
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const isExpanded = csvDashExpanded === run.batch_run_id;
                const rowSessions = csvDashRunSessions[run.batch_run_id] ?? [];
                const rowLoading  = csvDashRunLoading[run.batch_run_id] ?? false;
                return (
                  <div key={run.batch_run_id} className="border border-[#DDD5C4] rounded-lg overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F8F6F0] transition-colors"
                      onClick={() => {
                        const next = isExpanded ? null : run.batch_run_id;
                        setCsvDashExpanded(next);
                        if (next && !csvDashRunSessions[run.batch_run_id]) {
                          setCsvDashRunLoading((p) => ({ ...p, [run.batch_run_id]: true }));
                          fetch(`${API_BASE}${docufillApiPath}/batch-runs/${run.batch_run_id}`, { headers: getAuthHeaders() })
                            .then((r) => r.json())
                            .then((d: { sessions: typeof rowSessions }) => setCsvDashRunSessions((p) => ({ ...p, [run.batch_run_id]: d.sessions ?? [] })))
                            .catch(() => {})
                            .finally(() => setCsvDashRunLoading((p) => ({ ...p, [run.batch_run_id]: false })));
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg className={`w-3.5 h-3.5 shrink-0 text-[#8A9BB8] transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0F1C3F] truncate">{run.package_name}</div>
                          <div className="text-xs text-[#8A9BB8]">
                            {new Date(run.run_started_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 shrink-0 ml-4 text-center">
                        <div><div className="text-sm font-semibold text-[#0F1C3F]">{total}</div><div className="text-xs text-[#8A9BB8]">Rows</div></div>
                        <div><div className="text-sm font-semibold text-blue-700">{emailed}</div><div className="text-xs text-[#8A9BB8]">Emailed</div></div>
                        <div><div className="text-sm font-semibold text-amber-600">{pending}</div><div className="text-xs text-[#8A9BB8]">Pending</div></div>
                        <div><div className="text-sm font-semibold text-emerald-700">{completed}</div><div className="text-xs text-[#8A9BB8]">Completed</div></div>
                        <div>
                          <div className={`text-sm font-bold ${pct >= 75 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-[#8A9BB8]"}`}>{pct}%</div>
                          <div className="text-xs text-[#8A9BB8]">Done</div>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-[#DDD5C4]">
                        {rowLoading && (
                          <div className="flex justify-center py-5">
                            <div className="w-4 h-4 border-2 border-[#0F1C3F] border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        {!rowLoading && rowSessions.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-[#F0EDE6]">
                              <thead className="bg-[#F8F6F0]">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">#</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Recipient</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Status</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">PDF</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Emailed</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-[#8A9BB8] uppercase tracking-wide">Submitted</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#F0EDE6] bg-white">
                                {rowSessions.map((s, idx) => {
                                  const recipient = s.signer_name || s.link_email_recipient || "—";
                                  const statusMap: Record<string, { label: string; cls: string }> = {
                                    generated: { label: "Generated", cls: "bg-emerald-50 text-emerald-700" },
                                    draft:     { label: "Pending",   cls: "bg-gray-100 text-gray-500" },
                                    submitted: { label: "Submitted", cls: "bg-blue-50 text-blue-700" },
                                    voided:    { label: "Voided",    cls: "bg-red-50 text-red-600" },
                                  };
                                  const statusInfo = statusMap[s.status] ?? { label: s.status, cls: "bg-gray-100 text-gray-500" };
                                  const pdfUrl = `${API_BASE}${docufillApiPath}/sessions/${s.token}/packet.pdf`;
                                  return (
                                    <tr key={s.token} className="hover:bg-[#FAFAF8]">
                                      <td className="px-4 py-2 text-xs text-[#8A9BB8]">{idx + 1}</td>
                                      <td className="px-4 py-2 text-sm text-[#0F1C3F] max-w-[200px] truncate" title={recipient}>{recipient}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                                      </td>
                                      <td className="px-4 py-2">
                                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#0F1C3F] underline underline-offset-2 hover:text-[#C49A38]">
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                          PDF
                                        </a>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-[#8A9BB8]">{s.link_emailed_at ? new Date(s.link_emailed_at).toLocaleDateString() : "—"}</td>
                                      <td className="px-4 py-2 text-xs">
                                        {s.submitted_at
                                          ? <span className="text-violet-700 font-medium">{new Date(s.submitted_at).toLocaleDateString()}</span>
                                          : (s.status === "generated" || s.status === "signed")
                                            ? <span className="text-emerald-600 font-medium">Submitted</span>
                                            : <span className="text-[#C0CBDA]">Pending</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {!rowLoading && rowSessions.length === 0 && (
                          <div className="text-center py-5 text-sm text-[#8A9BB8]">No sessions found.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {csvDashboardTab === "import" && <div className="p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Batch CSV Import</h2>
          <p className="text-sm text-[#6B7A99] mt-1">Select a package, upload a filled CSV, and generate one packet per row.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Package</label>
            <select
              value={csvBatchPackageId}
              onChange={(e) => {
                setCsvBatchPackageId(e.target.value);
                setCsvBatchMismatch(false);
                setCsvBatchError(null);
                setShowCsvFieldKey(false);
                setCsvEditingCell(null);
                if (csvCorrectedDownloadedTimerRef.current) {
                  clearTimeout(csvCorrectedDownloadedTimerRef.current);
                  csvCorrectedDownloadedTimerRef.current = null;
                }
                setCsvCorrectedDownloaded(false);
                if (csvBatchRows.length > 0 && e.target.value) {
                  const pkg = packages.find((p) => String(p.id) === e.target.value);
                  if (pkg) {
                    const pkgFieldNames = new Set(pkg.fields.filter((f) => f.interviewMode !== "omitted").map((f) => f.name.toLowerCase().trim()));
                    const hasMatch = csvBatchHeaders.some((h) => {
                      const n = h.toLowerCase().trim();
                      return n !== "__package_id__" && n !== "__package_name__" && pkgFieldNames.has(n);
                    });
                    setCsvBatchMismatch(!hasMatch);
                  }
                }
              }}
              className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm bg-white"
            >
              <option value="">Select active package</option>
              {activePackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name}{pkg.transaction_scope ? ` · ${labelForTransactionScope(pkg.transaction_scope)}` : ""}</option>
              ))}
            </select>
          </div>

          {csvBatchPackageId && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  const pkg = packages.find((p) => String(p.id) === csvBatchPackageId);
                  if (!pkg) return;
                  const date = new Date().toISOString().slice(0, 10);
                  const safeName = pkg.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
                  const csv = packageTemplateToCsv(pkg.id, pkg.name, pkg.fields);
                  downloadCsv(csv, `docuplete-template-${safeName}-${date}.csv`);
                }}
                className="text-sm text-[#C49A38] underline hover:text-[#b58c31]"
              >
                Download blank template
              </button>

              {(() => {
                const keyFields = [...csvBatchFieldMap.values()];
                const selectedPkg = packages.find((p) => String(p.id) === csvBatchPackageId);
                return (
                  <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0]">
                    <button
                      type="button"
                      onClick={() => setShowCsvFieldKey((v) => !v)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-[#0F1C3F] hover:bg-[#EFE8D8] rounded"
                    >
                      <span>{showCsvFieldKey ? "▲ Hide field reference" : "▼ Show field reference"} ({keyFields.length} field{keyFields.length === 1 ? "" : "s"})</span>
                    </button>
                    {showCsvFieldKey && (
                      <div className="border-t border-[#DDD5C4] overflow-x-auto">
                        <table className="text-xs min-w-full">
                          <tbody>
                            {selectedPkg && (
                              <>
                                <tr className="bg-[#F0EDE5]">
                                  <td className="px-3 py-2 text-[#6B7A99] font-medium whitespace-nowrap">Package Name</td>
                                  <td className="px-3 py-2 text-[#0F1C3F] font-medium" colSpan={3}>{selectedPkg.name}</td>
                                </tr>
                                <tr className="bg-[#F0EDE5] border-t border-[#DDD5C4]">
                                  <td className="px-3 py-2 text-[#6B7A99] font-medium whitespace-nowrap">Package ID</td>
                                  <td className="px-3 py-2 font-mono text-[#0F1C3F]" colSpan={3}>{selectedPkg.id}</td>
                                </tr>
                                <tr className="bg-[#EFE8D8] border-t-2 border-[#DDD5C4]">
                                  <td className="px-3 py-2 text-left font-medium text-[#6B7A99] whitespace-nowrap">Field Name (CSV column header)</td>
                                  <td className="px-3 py-2 text-left font-medium text-[#6B7A99]">Required?</td>
                                  <td className="px-3 py-2 text-left font-medium text-[#6B7A99]">Type</td>
                                  <td className="px-3 py-2 text-left font-medium text-[#6B7A99]">Accepted Values</td>
                                </tr>
                                <tr className="border-t border-[#DDD5C4]">
                                  <td colSpan={4} className="px-3 py-1 text-[10px] text-[#6B7A99] uppercase tracking-wide font-medium bg-[#EFE8D8]">Fields</td>
                                </tr>
                              </>
                            )}
                            {keyFields.map((f) => (
                              <tr key={f.id} className="border-t border-[#EFE8D8]">
                                <td className="px-3 py-2 font-mono text-[#0F1C3F] whitespace-nowrap">
                                  {f.name}
                                  {f.sensitive && <span className="ml-1.5 text-[10px] text-red-600" title="Sensitive field">🔒</span>}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {f.interviewMode === "required"
                                    ? <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">Required</span>
                                    : f.interviewMode === "readonly"
                                      ? <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">Read only</span>
                                      : <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-[#EFE8D8] text-[#6B7A99]">Optional</span>
                                  }
                                </td>
                                <td className="px-3 py-2 capitalize text-[#334155]">{f.type}</td>
                                <td className="px-3 py-2 text-[#334155]">
                                  {(f.type === "dropdown" || f.type === "radio" || f.type === "checkbox") && (f.options ?? []).length > 0
                                    ? <span className="flex flex-wrap gap-1">
                                        {(f.options ?? []).map((opt) => (
                                          <span key={opt} className="inline-block rounded bg-white border border-[#D4C9B5] px-1.5 py-0.5 font-mono text-[10px] text-[#0F1C3F]">{opt}</span>
                                        ))}
                                      </span>
                                    : f.type === "date"
                                      ? <span className="font-mono text-[#6B7A99]">MM/DD/YYYY</span>
                                      : <span className="text-[#6B7A99]">{validationTypeHint(f.validationType, f.validationMessage)}</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${csvBatchFile ? "border-[#C49A38] bg-[#FDFAF4]" : "border-[#D4C9B5] bg-[#F8F6F0]"}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleCsvBatchFileChange(file);
          }}
        >
          <input
            ref={csvBatchFileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleCsvBatchFileChange(e.target.files?.[0] ?? null)}
          />
          {csvBatchFile ? (
            <div className="space-y-1">
              <p className="text-sm font-medium text-[#0F1C3F]">{csvBatchFile.name}</p>
              <p className="text-xs text-[#6B7A99]">{csvBatchRows.length} data row{csvBatchRows.length === 1 ? "" : "s"} · {csvBatchHeaders.length} column{csvBatchHeaders.length === 1 ? "" : "s"}</p>
              <button type="button" onClick={() => { handleCsvBatchFileChange(null); if (csvBatchFileInputRef.current) csvBatchFileInputRef.current.value = ""; }} className="text-xs text-[#8A9BB8] underline hover:text-[#0F1C3F]">Remove file</button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#6B7A99] mb-2">Drag a CSV file here or</p>
              <button type="button" onClick={() => csvBatchFileInputRef.current?.click()} className="text-sm text-[#C49A38] underline hover:text-[#b58c31]">Browse to upload</button>
            </div>
          )}
        </div>

        {csvBatchMismatch && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Warning: no column headers in this CSV match field names for the selected package. Please check that you selected the correct package and template.
          </div>
        )}

        {csvBatchHeaders.length > 0 && csvBatchRows.length > 0 && (
          <div>
            {(() => {
              const errorRowsAbovePreview = csvBatchRows
                .map((row, idx) => ({ row, idx }))
                .filter(({ row, idx }) => {
                  if (idx < 5) return false;
                  return csvBatchHeaders.some((h) => {
                    const isMetadata = h === "__package_id__" || h === "__package_name__";
                    const matchedField = csvBatchPackageId ? csvBatchFieldMap.get(h.toLowerCase().trim()) : undefined;
                    if (!matchedField || isMetadata) return false;
                    const cellVal = row[h] ?? "";
                    const validity = validateCellValue(matchedField, cellVal);
                    return validity === "invalid" || validity === "empty-required";
                  });
                });
              const previewCount = Math.min(5, csvBatchRows.length);
              const headingExtra = errorRowsAbovePreview.length > 0
                ? ` + ${errorRowsAbovePreview.length} row${errorRowsAbovePreview.length === 1 ? "" : "s"} with errors`
                : "";
              const maxVisibleCols = 8;
              const hasOverflowCols = csvBatchHeaders.length > maxVisibleCols;
              const visibleHeaders = csvColumnsExpanded ? csvBatchHeaders : csvBatchHeaders.slice(0, maxVisibleCols);
              const colCount = visibleHeaders.length + 1 + (hasOverflowCols ? 1 : 0);

              const allDisplayedRows = [
                ...csvBatchRows.slice(0, 5).map((row, idx) => ({ row, idx })),
                ...errorRowsAbovePreview,
              ];
              const allEditableCells: { rowIdx: number; header: string }[] = [];
              for (const { row: _row, idx } of allDisplayedRows) {
                for (const hh of visibleHeaders) {
                  const isMetadata = hh === "__package_id__" || hh === "__package_name__";
                  const matchedField = csvBatchPackageId ? csvBatchFieldMap.get(hh.toLowerCase().trim()) : undefined;
                  const willSkip = csvBatchPackageId && !isMetadata && !matchedField;
                  if (!willSkip && matchedField) {
                    allEditableCells.push({ rowIdx: idx, header: hh });
                  }
                }
              }

              const renderBodyRow = (row: Record<string, string>, rowIdx: number, isErrorRow: boolean) => (
                <tr key={`${rowIdx}-${isErrorRow ? "err" : "pre"}`} className={isErrorRow ? "bg-[#FFFBF0]" : ""}>
                  <td className="px-2 py-1 text-[#9AAAC0] border-r border-[#DDD5C4] text-center select-none">{rowIdx + 1}</td>
                  {visibleHeaders.map((h) => {
                    const isMetadata = h === "__package_id__" || h === "__package_name__";
                    const matchedField = csvBatchPackageId ? csvBatchFieldMap.get(h.toLowerCase().trim()) : undefined;
                    const willSkip = csvBatchPackageId && !isMetadata && !matchedField;
                    const cellVal = row[h] ?? "";
                    const originalCellVal = csvBatchOriginalRows[rowIdx]?.[h] ?? cellVal;
                    const isCellModified = (csvBatchOriginalRows[rowIdx] !== undefined) && cellVal !== originalCellVal;
                    const validity = matchedField && !willSkip ? validateCellValue(matchedField, cellVal) : "valid";
                    const isEditable = !willSkip && !isMetadata && !!matchedField;
                    const isEditing = csvEditingCell?.rowIdx === rowIdx && csvEditingCell?.header === h;

                    const revertCell = (e?: React.MouseEvent | React.KeyboardEvent) => {
                      e?.stopPropagation();
                      setCsvBatchRows((prev) => {
                        const updated = [...prev];
                        updated[rowIdx] = { ...updated[rowIdx], [h]: originalCellVal };
                        return updated;
                      });
                      const newRows = csvBatchRows.map((r, i) => {
                        if (i !== rowIdx) return r;
                        return { ...r, [h]: originalCellVal };
                      });
                      const stillHasEdits = newRows.some((r, i) => {
                        const orig = csvBatchOriginalRows[i];
                        if (!orig) return false;
                        const allKeys = new Set([...Object.keys(r), ...Object.keys(orig)]);
                        return [...allKeys].some((k) => (r[k] ?? "") !== (orig[k] ?? ""));
                      });
                      setCsvBatchHasEdits(stillHasEdits);
                      if (csvEditingCell?.rowIdx === rowIdx && csvEditingCell?.header === h) {
                        setCsvEditingCell(null);
                      }
                    };

                    const commitEdit = (newVal: string, navigateDelta = 0) => {
                      setCsvBatchRows((prev) => {
                        const updated = [...prev];
                        updated[rowIdx] = { ...updated[rowIdx], [h]: newVal };
                        return updated;
                      });
                      setCsvBatchHasEdits(true);
                      if (navigateDelta !== 0 && allEditableCells.length > 0) {
                        const currentIdx = allEditableCells.findIndex((c) => c.rowIdx === rowIdx && c.header === h);
                        const fixedThisCell = matchedField
                          ? (() => { const v = validateCellValue(matchedField, newVal); return v !== "invalid" && v !== "empty-required"; })()
                          : false;
                        const len = allEditableCells.length;
                        let nextCell: { rowIdx: number; header: string } | null = null;
                        for (let step = 1; step <= len; step++) {
                          const checkIdx = ((currentIdx + navigateDelta * step) % len + len) % len;
                          const candidate = allEditableCells[checkIdx];
                          if (fixedThisCell && candidate.rowIdx === rowIdx && candidate.header === h) continue;
                          nextCell = candidate;
                          break;
                        }
                        setCsvEditingCell(nextCell);
                      } else {
                        setCsvEditingCell(null);
                      }
                    };

                    const tdCls = willSkip
                      ? "px-3 py-1 text-[#9AAAC0] max-w-[200px]"
                      : validity === "invalid"
                        ? "px-3 py-1 bg-red-50 text-red-700 max-w-[200px]"
                        : validity === "empty-required"
                          ? "px-3 py-1 bg-amber-50 text-amber-700 max-w-[200px]"
                          : isCellModified
                            ? "px-3 py-2 bg-blue-50 text-[#334155] max-w-[200px] truncate"
                            : "px-3 py-2 text-[#334155] max-w-[200px] truncate";

                    if (isEditing) {
                      const hasOptions = matchedField && (matchedField.type === "dropdown" || matchedField.type === "radio") && (matchedField.options ?? []).length > 0;
                      return (
                        <td key={h} className={tdCls}>
                          {hasOptions ? (
                            <select
                              autoFocus
                              defaultValue={cellVal}
                              className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 bg-white text-[#0F1C3F] focus:outline-none focus:ring-1 focus:ring-blue-400"
                              onChange={(e) => commitEdit(e.target.value)}
                              onBlur={() => { csvEditNavigatingRef.current = false; }}
                              onKeyDown={(e) => {
                                if (e.key === "Tab") { e.preventDefault(); csvEditNavigatingRef.current = true; commitEdit((e.target as HTMLSelectElement).value, e.shiftKey ? -1 : 1); }
                                if (e.key === "Enter") { e.preventDefault(); csvEditNavigatingRef.current = true; commitEdit((e.target as HTMLSelectElement).value, 1); }
                                if (e.key === "Escape") setCsvEditingCell(null);
                              }}
                            >
                              <option value="">— select —</option>
                              {(matchedField!.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              autoFocus
                              defaultValue={cellVal}
                              className="w-full text-xs border border-blue-400 rounded px-1 py-0.5 bg-white text-[#0F1C3F] focus:outline-none focus:ring-1 focus:ring-blue-400"
                              onBlur={(e) => {
                                if (csvEditNavigatingRef.current) { csvEditNavigatingRef.current = false; return; }
                                commitEdit(e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); csvEditNavigatingRef.current = true; commitEdit((e.target as HTMLInputElement).value, 1); }
                                if (e.key === "Tab") { e.preventDefault(); csvEditNavigatingRef.current = true; commitEdit((e.target as HTMLInputElement).value, e.shiftKey ? -1 : 1); }
                                if (e.key === "Escape") setCsvEditingCell(null);
                              }}
                            />
                          )}
                        </td>
                      );
                    }

                    const cellTitle = validity === "invalid"
                      ? `Click to edit — invalid value for "${h}"${isCellModified ? ` (original: "${originalCellVal}")` : ""}`
                      : validity === "empty-required"
                        ? `Click to edit — "${h}" is required`
                        : isCellModified
                          ? `Modified — original value: "${originalCellVal}"`
                          : willSkip
                            ? "Column will be skipped"
                            : undefined;

                    return (
                      <td
                        key={h}
                        className={`${tdCls}${(isEditable || isCellModified) ? " group" : ""}${isEditable ? " cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400" : ""}`}
                        title={cellTitle}
                        onClick={isEditable ? () => setCsvEditingCell({ rowIdx, header: h }) : undefined}
                        {...(isEditable ? {
                          tabIndex: 0,
                          onKeyDown: (e: React.KeyboardEvent<HTMLTableCellElement>) => {
                            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCsvEditingCell({ rowIdx, header: h }); }
                            if (e.key === "Tab") {
                              e.preventDefault();
                              if (allEditableCells.length > 0) {
                                const currentIdx = allEditableCells.findIndex((c) => c.rowIdx === rowIdx && c.header === h);
                                const delta = e.shiftKey ? -1 : 1;
                                const nextIdx = (currentIdx + delta + allEditableCells.length) % allEditableCells.length;
                                setCsvEditingCell(allEditableCells[nextIdx]);
                              }
                            }
                          },
                        } : {})}
                      >
                        <span className="truncate block max-w-[200px]">{cellVal}</span>
                        {isEditable && (
                          <span className="ml-1 text-[10px] opacity-60 group-hover:opacity-100">✎</span>
                        )}
                        {isCellModified && (
                          <button
                            type="button"
                            title={`Revert this cell to its original value: "${originalCellVal}"`}
                            aria-label={`Revert "${h}" to original value`}
                            className="ml-1 text-[10px] opacity-0 group-hover:opacity-100 focus:opacity-100 text-blue-500 hover:text-blue-700 focus:text-blue-700 transition-opacity leading-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded"
                            onClick={revertCell}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); revertCell(e); } }}
                          >
                            ↩
                          </button>
                        )}
                      </td>
                    );
                  })}
                  {hasOverflowCols && (
                    csvColumnsExpanded
                      ? <td className="px-3 py-2" />
                      : <td className="px-3 py-2 text-[#8A9BB8]">…</td>
                  )}
                </tr>
              );

              return (
                <>
                  <h3 className="text-sm font-semibold mb-2">
                    Preview (first {previewCount} row{previewCount === 1 ? "" : "s"}{headingExtra})
                  </h3>
                  <div className="overflow-x-auto rounded border border-[#DDD5C4]">
                    <table className="text-xs min-w-full">
                      <thead className="bg-[#F8F6F0] border-b border-[#DDD5C4]">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium text-[#9AAAC0] border-r border-[#DDD5C4] w-8">#</th>
                          {visibleHeaders.map((h) => {
                            const isMetadata = h === "__package_id__" || h === "__package_name__";
                            const matchedField = csvBatchPackageId ? csvBatchFieldMap.get(h.toLowerCase().trim()) : undefined;
                            const willSkip = csvBatchPackageId && !isMetadata && !matchedField;
                            const fieldIssue = csvBatchValidationSummary?.fieldIssues.find((fi) => fi.label.toLowerCase().trim() === h.toLowerCase().trim());
                            const invalidCount = fieldIssue?.invalid.length ?? 0;
                            const emptyRequiredCount = fieldIssue?.emptyRequired.length ?? 0;
                            const hasIssues = invalidCount > 0 || emptyRequiredCount > 0;
                            const handleHeaderClick = () => {
                              if (!hasIssues) return;
                              setCsvBatchFieldBreakdownOpen(true);
                              setCsvBreakdownHighlightedField(fieldIssue!.label);
                              setTimeout(() => {
                                const row = csvBatchBreakdownRef.current?.querySelector<HTMLElement>(`[data-field="${CSS.escape(fieldIssue!.label)}"]`);
                                if (row) {
                                  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                }
                              }, 80);
                            };
                            return (
                              <th
                                key={h}
                                className={`px-3 py-2 text-left font-medium whitespace-nowrap ${willSkip ? "text-[#9AAAC0] line-through" : "text-[#6B7A99]"} ${hasIssues ? "cursor-pointer hover:bg-amber-50 select-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-inset" : ""}`}
                                {...(hasIssues ? {
                                  role: "button",
                                  tabIndex: 0,
                                  onClick: handleHeaderClick,
                                  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleHeaderClick(); } },
                                } : {})}
                              >
                                <span className="inline-flex items-center gap-1 flex-wrap">
                                  {matchedField ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-default">{h}</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        {matchedField.type === "date" ? "Format: MM/DD/YYYY" : matchedField.validationType && matchedField.validationType !== "none" ? `Format: ${validationTypeHint(matchedField.validationType, matchedField.validationMessage ?? undefined)}` : matchedField.type === "checkbox" || matchedField.type === "radio" || matchedField.type === "dropdown" ? `Type: ${matchedField.type}${matchedField.options?.length ? ` — options: ${matchedField.options.slice(0, 3).join(", ")}${matchedField.options.length > 3 ? "…" : ""}` : ""}` : "Type: text"}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : willSkip ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-default">{h}</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">This column does not match any field in the selected package and will be skipped on import.</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span>{h}</span>
                                  )}
                                  {matchedField?.interviewMode === "required" && !willSkip && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-red-500 font-bold cursor-default">*</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">Required field — must have a value for every row</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {invalidCount > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-1.5 py-0.5 min-w-[16px] cursor-default">
                                          {invalidCount}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        {`Invalid value${invalidCount === 1 ? "" : "s"} in row${fieldIssue!.invalid.length === 1 ? "" : "s"}: ${fieldIssue!.invalid.slice(0, 10).join(", ")}${fieldIssue!.invalid.length > 10 ? ` … +${fieldIssue!.invalid.length - 10} more` : ""}`}
                                        {matchedField && matchedField.validationType && matchedField.validationType !== "none" ? ` — expected format: ${validationTypeHint(matchedField.validationType, matchedField.validationMessage ?? undefined)}` : ""}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {emptyRequiredCount > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none px-1.5 py-0.5 min-w-[16px] cursor-default">
                                          {emptyRequiredCount}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs">
                                        {`Required field is empty in row${fieldIssue!.emptyRequired.length === 1 ? "" : "s"}: ${fieldIssue!.emptyRequired.slice(0, 10).join(", ")}${fieldIssue!.emptyRequired.length > 10 ? ` … +${fieldIssue!.emptyRequired.length - 10} more` : ""}`}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </span>
                                {matchedField && invalidCount > 0 && autoFixLabel(matchedField) && (
                                  <button
                                    type="button"
                                    className="mt-1 block text-[10px] text-[#C49A38] hover:text-[#b58c31] underline whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-[#C49A38] rounded"
                                    title="Auto-convert all invalid values in this column to the expected format"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCsvBatchRows((prev) =>
                                        prev.map((row) => {
                                          const val = row[h] ?? "";
                                          if (validateCellValue(matchedField, val) !== "invalid") return row;
                                          const fixed = tryAutoFix(matchedField, val);
                                          return fixed ? { ...row, [h]: fixed } : row;
                                        })
                                      );
                                      setCsvBatchHasEdits(true);
                                    }}
                                  >
                                    {autoFixLabel(matchedField)}
                                  </button>
                                )}
                              </th>
                            );
                          })}
                          {hasOverflowCols && (
                            <th className="px-3 py-2 text-left font-medium">
                              <button
                                type="button"
                                className="text-[#C49A38] hover:text-[#b58c31] underline text-xs whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-[#C49A38] rounded"
                                onClick={() => setCsvColumnsExpanded((prev) => !prev)}
                              >
                                {csvColumnsExpanded ? "← Show less" : `+${csvBatchHeaders.length - maxVisibleCols} more`}
                              </button>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {csvBatchRows.slice(0, 5).map((row, idx) => renderBodyRow(row, idx, false))}
                        {errorRowsAbovePreview.length > 0 && (
                          <tr>
                            <td colSpan={colCount} className="px-3 py-1.5 text-[10px] font-semibold text-[#6B7A99] bg-[#F3F0E8] border-t border-b border-[#DDD5C4] tracking-wide">
                              Rows with errors beyond preview
                            </td>
                          </tr>
                        )}
                        {errorRowsAbovePreview.map(({ row, idx }) => renderBodyRow(row, idx, true))}
                      </tbody>
                    </table>
                  </div>
                  {csvBatchPackageId && (
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-[#6B7A99]">
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" /> Invalid value <span className="text-[#9AAAC0]">(click to fix)</span></span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200" /> Required but empty <span className="text-[#9AAAC0]">(click to fix)</span></span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-[#F8F6F0] border border-[#DDD5C4] line-through" /><span className="line-through">Column</span> will be skipped</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {csvBatchValidationSummary && (csvBatchValidationSummary.invalidRows.length > 0 || csvBatchValidationSummary.emptyRequiredRows.length > 0) && (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm space-y-2">
            <p className="font-semibold text-amber-900">
              Validation issues found across all {csvBatchValidationSummary.total} data row{csvBatchValidationSummary.total === 1 ? "" : "s"}
            </p>
            <ul className="space-y-1 text-amber-800 text-xs list-none">
              {csvBatchValidationSummary.invalidRows.length > 0 && (
                <li>
                  <span className="font-medium">{csvBatchValidationSummary.invalidRows.length} data row{csvBatchValidationSummary.invalidRows.length === 1 ? "" : "s"} with invalid values:</span>{" "}
                  <span className="font-mono">
                    {csvBatchValidationSummary.invalidRows.length <= 20
                      ? csvBatchValidationSummary.invalidRows.join(", ")
                      : csvBatchValidationSummary.invalidRows.slice(0, 20).join(", ") + ` … +${csvBatchValidationSummary.invalidRows.length - 20} more`}
                  </span>
                </li>
              )}
              {csvBatchValidationSummary.emptyRequiredRows.length > 0 && (
                <li>
                  <span className="font-medium">{csvBatchValidationSummary.emptyRequiredRows.length} data row{csvBatchValidationSummary.emptyRequiredRows.length === 1 ? "" : "s"} with empty required fields:</span>{" "}
                  <span className="font-mono">
                    {csvBatchValidationSummary.emptyRequiredRows.length <= 20
                      ? csvBatchValidationSummary.emptyRequiredRows.join(", ")
                      : csvBatchValidationSummary.emptyRequiredRows.slice(0, 20).join(", ") + ` … +${csvBatchValidationSummary.emptyRequiredRows.length - 20} more`}
                  </span>
                </li>
              )}
            </ul>
            {csvBatchValidationSummary.fieldIssues.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setCsvBatchFieldBreakdownOpen((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:text-amber-900 focus:outline-none"
                >
                  <svg className={`w-3 h-3 transition-transform ${csvBatchFieldBreakdownOpen ? "rotate-90" : ""}`} viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {csvBatchFieldBreakdownOpen ? "Hide" : "Show"} field-by-field breakdown ({csvBatchValidationSummary.fieldIssues.length} field{csvBatchValidationSummary.fieldIssues.length === 1 ? "" : "s"} affected)
                </button>
                {csvBatchFieldBreakdownOpen && (
                  <div ref={csvBatchBreakdownRef} className="mt-2 rounded border border-amber-200 bg-white overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-amber-100 text-amber-900">
                          <th className="text-left px-3 py-1.5 font-semibold">Field</th>
                          <th className="text-left px-3 py-1.5 font-semibold">Issue</th>
                          <th className="text-left px-3 py-1.5 font-semibold">Rows affected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvBatchValidationSummary.fieldIssues.flatMap((f) => {
                          const isHighlighted = csvBreakdownHighlightedField === f.label;
                          const rows: ReactNode[] = [];
                          if (f.invalid.length > 0) {
                            rows.push(
                              <tr key={`${f.label}-invalid`} data-field={f.label} className={`border-t border-amber-100 transition-colors ${isHighlighted ? "bg-amber-100 outline outline-2 outline-amber-400" : ""}`}>
                                <td className="px-3 py-1.5 font-medium text-amber-900 align-top">{f.label}</td>
                                <td className="px-3 py-1.5 text-red-700 align-top whitespace-nowrap">Invalid value</td>
                                <td className="px-3 py-1.5 font-mono text-amber-800 align-top">
                                  {f.invalid.length <= 20 ? f.invalid.join(", ") : f.invalid.slice(0, 20).join(", ") + ` … +${f.invalid.length - 20} more`}
                                </td>
                              </tr>
                            );
                          }
                          if (f.emptyRequired.length > 0) {
                            rows.push(
                              <tr key={`${f.label}-empty`} data-field={f.label} className={`border-t border-amber-100 transition-colors ${isHighlighted ? "bg-amber-100 outline outline-2 outline-amber-400" : ""}`}>
                                <td className="px-3 py-1.5 font-medium text-amber-900 align-top">{f.invalid.length > 0 ? "" : f.label}</td>
                                <td className="px-3 py-1.5 text-amber-700 align-top whitespace-nowrap">Required but empty</td>
                                <td className="px-3 py-1.5 font-mono text-amber-800 align-top">
                                  {f.emptyRequired.length <= 20 ? f.emptyRequired.join(", ") : f.emptyRequired.slice(0, 20).join(", ") + ` … +${f.emptyRequired.length - 20} more`}
                                </td>
                              </tr>
                            );
                          }
                          return rows;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            <p className="text-[11px] text-amber-700">Row numbers count from 1, not including the header row. Click any highlighted cell in the preview above to fix it inline, or correct your spreadsheet and re-upload.</p>
          </div>
        )}

        {csvBatchValidationSummary && csvBatchValidationSummary.invalidRows.length === 0 && csvBatchValidationSummary.emptyRequiredRows.length === 0 && (
          <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            All {csvBatchValidationSummary.total} row{csvBatchValidationSummary.total === 1 ? "" : "s"} passed validation.
          </div>
        )}

        {csvBatchError && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{csvBatchError}</div>
        )}

        {csvBatchRows.length > CSV_BATCH_MAX && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            This file has {csvBatchRows.length} rows — the limit is {CSV_BATCH_MAX} per batch. Please split the file and upload separately.
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={() => handleCsvBatchImport()}
            disabled={!csvBatchPackageId || csvBatchRows.length === 0 || csvBatchIsImporting || csvBatchRows.length > CSV_BATCH_MAX}
            className="disabled:opacity-60"
          >
            {csvBatchIsImporting ? "Importing…" : `Import & Generate ${csvBatchRows.length > 0 ? csvBatchRows.length : ""} row${csvBatchRows.length === 1 ? "" : "s"}`}
          </Button>
          {csvBatchHasEdits && csvBatchRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const q = (v: string) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
                const lines = [
                  csvBatchHeaders.map(q).join(","),
                  ...csvBatchRows.map((row) => csvBatchHeaders.map((h) => q(row[h] ?? "")).join(",")),
                ];
                const dateStr = new Date().toISOString().slice(0, 10);
                const baseName = csvBatchFile?.name.replace(/\.csv$/i, "") ?? "corrected";
                downloadCsv(lines.join("\n"), `${baseName}-corrected-${dateStr}.csv`);
                if (csvCorrectedDownloadedTimerRef.current) clearTimeout(csvCorrectedDownloadedTimerRef.current);
                setCsvCorrectedDownloaded(true);
                csvCorrectedDownloadedTimerRef.current = setTimeout(() => setCsvCorrectedDownloaded(false), 2000);
              }}
              className="border-[#DDD5C4] text-[#0F1C3F] hover:bg-[#F8F6F0]"
            >
              {csvCorrectedDownloaded ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-600" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 7l3.5 3.5L12 3" />
                  </svg>
                  <span className="text-green-700">Downloaded!</span>
                </span>
              ) : "Download corrected CSV"}
            </Button>
          )}
          {csvBatchHasEdits && csvBatchRows.length > 0 && csvBatchOriginalRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!window.confirm("Discard all inline edits and restore the original uploaded data?")) return;
                setCsvBatchRows(csvBatchOriginalRows.map((r) => ({ ...r })));
                setCsvBatchHasEdits(false);
                setCsvEditingCell(null);
                if (csvCorrectedDownloadedTimerRef.current) {
                  clearTimeout(csvCorrectedDownloadedTimerRef.current);
                  csvCorrectedDownloadedTimerRef.current = null;
                }
                setCsvCorrectedDownloaded(false);
              }}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Discard edits
            </Button>
          )}
          {csvBatchHasEdits && csvBatchOriginalRows.length > 0 && (() => {
            const count = csvBatchRows.reduce((total, row, rowIdx) => {
              const orig = csvBatchOriginalRows[rowIdx];
              if (!orig) return total;
              return total + csvBatchHeaders.filter((h) => (orig[h] ?? "") !== (row[h] ?? "")).length;
            }, 0);
            return count > 0 ? (
              <span className="text-xs text-[#6B7A99]">{count} cell{count === 1 ? "" : "s"} edited</span>
            ) : null;
          })()}
          {csvBatchIsImporting && <span className="text-xs text-[#6B7A99]">Processing rows sequentially, please wait…</span>}
        </div>

        {csvBatchResults && (
          <div>
            <h3 className="text-sm font-semibold mb-2">
              {csvBatchIsImporting
                ? `Processing ${csvBatchResults.length} row${csvBatchResults.length === 1 ? "" : "s"}…`
                : `Results — ${csvBatchResults.filter((r) => r.status === "created").length} created · ${csvBatchResults.filter((r) => r.status === "error").length} failed`
              }
            </h3>
            <div className="overflow-x-auto rounded border border-[#DDD5C4]">
              <table className="text-xs min-w-full">
                <thead className="bg-[#F8F6F0] border-b border-[#DDD5C4]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Row #</th>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Token</th>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Session</th>
                    <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {csvBatchResults.map((result) => (
                    <tr key={result.rowIndex} className="border-b border-[#EFE8D8] last:border-0">
                      <td className="px-3 py-2 text-[#334155]">{result.rowIndex + 1}</td>
                      <td className="px-3 py-2">
                        {result.status === "processing"
                          ? <span className="flex items-center gap-1.5 text-[#6B7A99]"><span className="inline-block w-3 h-3 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />Processing</span>
                          : result.status === "created"
                            ? <span className="text-green-700 font-medium">Created</span>
                            : <span className="text-red-700 font-medium">Error</span>
                        }
                      </td>
                      <td className="px-3 py-2 text-[#6B7A99] font-mono text-[10px] max-w-[160px] truncate">{result.token ?? "—"}</td>
                      <td className="px-3 py-2">
                        {result.status === "created" && result.token
                          ? <a href={`/internal/docufill?session=${result.token}`} target="_blank" rel="noreferrer" className="text-[#C49A38] underline">Open session</a>
                          : <span className="text-[#8A9BB8]">—</span>
                        }
                      </td>
                      <td className="px-3 py-2 text-red-700 max-w-[300px] truncate">{result.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!csvBatchIsImporting && (() => {
              const generatedResults = csvBatchResults!.filter((r) => r.status === "created" && r.token);
              const csvEmailHeader = csvBatchHeaders.find((h) => {
                const f = csvBatchFieldMap.get(h.toLowerCase().trim());
                return f && (f.validationType === "email" || h.toLowerCase().trim() === "email");
              });
              const csvNameHeader = csvBatchHeaders.find((h) => {
                const f = csvBatchFieldMap.get(h.toLowerCase().trim());
                return f && (f.validationType === "name" || h.toLowerCase().trim() === "name" || h.toLowerCase().trim().includes("full name"));
              });
              const inviteableRows = csvEmailHeader
                ? generatedResults.filter((r) => (csvBatchRows[r.rowIndex]?.[csvEmailHeader!] ?? "").trim() !== "")
                : [];
              const sentCount = Object.values(csvInviteResults).filter((r) => r.status === "sent").length;
              const errCount  = Object.values(csvInviteResults).filter((r) => r.status === "error").length;
              const failedTokenSet = new Set(
                Object.entries(csvInviteResults).filter(([, v]) => v.status === "error").map(([k]) => k),
              );
              const retryableRows = inviteableRows.filter((r) => r.token && failedTokenSet.has(r.token!));

              return (
                <>
                  {generatedResults.length > 0 && (
                    <div className="mt-4 border border-[#DDD5C4] rounded bg-[#F8F6F0]">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[#0F1C3F] hover:bg-[#EFE8D8] rounded"
                        onClick={() => setCsvInviteOpen((v) => !v)}
                      >
                        <span>📨 Send interview invitations</span>
                        <span className="text-[#6B7A99] text-xs">
                          {Object.keys(csvInviteResults).length > 0
                            ? `${sentCount} sent · ${errCount} failed`
                            : csvEmailHeader
                              ? `${inviteableRows.length} of ${generatedResults.length} rows have an email`
                              : "No email column detected"
                          }
                        </span>
                      </button>
                      {csvInviteOpen && (
                        <div className="border-t border-[#DDD5C4] px-4 py-3 space-y-3">
                          {!csvEmailHeader ? (
                            <p className="text-xs text-[#6B7A99]">No email field found in this CSV. Make sure your package has a field with email validation and that column is present in the uploaded file.</p>
                          ) : (
                            <>
                              <p className="text-xs text-[#6B7A99]">
                                Each client will receive their personal interview link at the address in the <span className="font-mono text-[#0F1C3F]">{csvEmailHeader}</span> column.
                                {csvNameHeader && <> Their name will be taken from <span className="font-mono text-[#0F1C3F]">{csvNameHeader}</span>.</>}
                              </p>
                              <div>
                                <label className="block text-xs font-medium text-[#6B7A99] mb-1">Custom message (optional)</label>
                                <textarea
                                  rows={2}
                                  className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-xs bg-white resize-none focus:outline-none focus:ring-1 focus:ring-[#C49A38]"
                                  placeholder="Add a personal note to include in the email…"
                                  value={csvInviteMessage}
                                  onChange={(e) => setCsvInviteMessage(e.target.value)}
                                  disabled={csvInviteSending}
                                />
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <Button
                                  size="sm"
                                  disabled={csvInviteSending || inviteableRows.length === 0}
                                  onClick={async () => {
                                    if (!csvEmailHeader) return;
                                    setCsvInviteSending(true);
                                    const invitations = inviteableRows.map((r) => ({
                                      token: r.token!,
                                      recipientEmail: (csvBatchRows[r.rowIndex]?.[csvEmailHeader!] ?? "").trim(),
                                      recipientName: csvNameHeader ? (csvBatchRows[r.rowIndex]?.[csvNameHeader] ?? "").trim() : "",
                                    }));
                                    try {
                                      const res = await fetch(`${API_BASE}${docufillApiPath}/batch/send-links`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                        body: JSON.stringify({ invitations, customMessage: csvInviteMessage || null }),
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data.error ?? "Failed to send invitations");
                                      const resultMap: Record<string, CsvInviteResult> = {};
                                      for (const r of (data.results as Array<{ token: string; status: "sent" | "error"; sentTo?: string; error?: string }>)) {
                                        resultMap[r.token] = { status: r.status, sentTo: r.sentTo, error: r.error };
                                      }
                                      setCsvInviteResults(resultMap);
                                    } catch (err) {
                                      console.error("[Batch invite]", err);
                                    } finally {
                                      setCsvInviteSending(false);
                                    }
                                  }}
                                >
                                  {csvInviteSending
                                    ? "Sending…"
                                    : `Send ${inviteableRows.length} invitation${inviteableRows.length === 1 ? "" : "s"}`
                                  }
                                </Button>
                                {sentCount > 0 && <span className="text-xs text-green-700">{sentCount} sent</span>}
                                {errCount  > 0 && (
                                  <span className="text-xs text-red-600 flex items-center gap-2">
                                    {errCount} failed
                                    <button
                                      type="button"
                                      disabled={csvInviteSending || retryableRows.length === 0}
                                      onClick={async () => {
                                        if (!csvEmailHeader) return;
                                        setCsvInviteSending(true);
                                        const retryInvitations = retryableRows.map((r) => ({
                                          token: r.token!,
                                          recipientEmail: (csvBatchRows[r.rowIndex]?.[csvEmailHeader!] ?? "").trim(),
                                          recipientName: csvNameHeader ? (csvBatchRows[r.rowIndex]?.[csvNameHeader] ?? "").trim() : "",
                                        }));
                                        try {
                                          const res = await fetch(`${API_BASE}${docufillApiPath}/batch/send-links`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                            body: JSON.stringify({ invitations: retryInvitations, customMessage: csvInviteMessage || null }),
                                          });
                                          const data = await res.json();
                                          if (!res.ok) throw new Error(data.error ?? "Failed to retry");
                                          const retryResultMap = { ...csvInviteResults };
                                          for (const r of (data.results as Array<{ token: string; status: "sent" | "error"; sentTo?: string; error?: string }>)) {
                                            retryResultMap[r.token] = { status: r.status, sentTo: r.sentTo, error: r.error };
                                          }
                                          setCsvInviteResults(retryResultMap);
                                        } catch (err) {
                                          console.error("[Batch invite retry]", err);
                                        } finally {
                                          setCsvInviteSending(false);
                                        }
                                      }}
                                      className="text-xs font-medium text-red-700 underline underline-offset-2 hover:text-red-900 disabled:opacity-40 disabled:no-underline"
                                    >
                                      {csvInviteSending ? "Retrying…" : `Retry ${retryableRows.length}`}
                                    </button>
                                  </span>
                                )}
                              </div>
                              {errCount > 0 && Object.entries(csvInviteResults).some(([, v]) => v.status === "error" && v.error) && (
                                <div className="mt-1 space-y-0.5">
                                  {Object.entries(csvInviteResults)
                                    .filter(([, v]) => v.status === "error" && v.error)
                                    .map(([token, v]) => {
                                      const row = inviteableRows.find((r) => r.token === token);
                                      const email = row && csvEmailHeader ? (csvBatchRows[row.rowIndex]?.[csvEmailHeader] ?? "") : token.slice(0, 12) + "…";
                                      return (
                                        <p key={token} className="text-xs text-red-600">
                                          <span className="font-medium">{email}</span>: {v.error}
                                        </p>
                                      );
                                    })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(() => {
                    const failedRows = (csvBatchResults ?? []).filter((r) => r.status === "error").map((r) => r.rowIndex);
                    return (
                      <div className="mt-3 flex items-center gap-2 flex-wrap justify-end">
                        {failedRows.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={csvBatchIsImporting}
                            onClick={() => handleCsvBatchImport(failedRows)}
                            className="border-amber-300 text-amber-800 hover:bg-amber-50"
                          >
                            {csvBatchIsImporting ? "Retrying…" : `↺ Retry ${failedRows.length} failed row${failedRows.length === 1 ? "" : "s"}`}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const dateStr = new Date().toISOString().slice(0, 10);
                            downloadCsv(batchResultsToCsv(csvBatchResults, API_BASE, csvBatchHeaders, csvBatchRows), `docuplete-batch-results-${dateStr}.csv`);
                          }}
                          className="border-[#DDD5C4] text-[#0F1C3F] hover:bg-[#F8F6F0]"
                        >
                          Download Results CSV
                        </Button>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        )}
      </div>}
    </section>
  );
});
