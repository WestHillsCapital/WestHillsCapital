import React from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { DndContext, closestCenter, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isSystemEsignFieldId } from "@/lib/docuplete-redaction";
import { type FieldItem, type MappingItem } from "@/lib/docuplete-types";
import type { DocItem, FieldLibraryItem, FieldGroup, PackageItem, Entity, TransactionType } from "@/lib/docuplete-local-types";
import { EmptyState } from "@/components/DocupletePanels";
import { DocumentPreviewTile } from "@/components/DocumentPreviewTile";
import { type BuilderStep, BUILDER_STEPS } from "@/components/PackagePickerSidebar";
import { SortableItem } from "@/components/DocupleteDndHelpers";
import { TagChipInput, EmbedSnippetPanel } from "@/components/DocupleteWidgets";
import { DemoWelcomeBanner } from "@/components/DemoWelcomeBanner";
import { formatOrgTime } from "@/lib/orgDateFormat";
import { getCachedOrg } from "@/hooks/useOrgSettings";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

type WebhookDelivery = {
  id: number;
  event_type: string;
  http_status: number | null;
  duration_ms: number;
  attempt_number: number;
  has_payload: boolean;
  response_body: string | null;
  created_at: string;
};

export interface DocupleteBuilderPanelProps {
  selectedPackage: PackageItem | null;
  bootstrapLoaded: boolean;
  packages: PackageItem[];
  groups: Entity[];
  transactionTypes: TransactionType[];
  storeMappings: MappingItem[];
  packageInterviewFields: FieldItem[];
  packageFixedOrHiddenFields: FieldItem[];
  packageMappedFieldIds: Set<string>;
  inlineAddTypeOpen: boolean;
  setInlineAddTypeOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inlineAddTypeName: string;
  setInlineAddTypeName: React.Dispatch<React.SetStateAction<string>>;
  inlineAddTypeLoading: boolean;
  setInlineAddTypeLoading: React.Dispatch<React.SetStateAction<boolean>>;
  inlineAddTypeError: string | null;
  setInlineAddTypeError: React.Dispatch<React.SetStateAction<string | null>>;
  inlineAddGroupOpen: boolean;
  setInlineAddGroupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inlineAddGroupName: string;
  setInlineAddGroupName: React.Dispatch<React.SetStateAction<string>>;
  inlineAddGroupLoading: boolean;
  setInlineAddGroupLoading: React.Dispatch<React.SetStateAction<boolean>>;
  inlineAddGroupError: string | null;
  setInlineAddGroupError: React.Dispatch<React.SetStateAction<string | null>>;
  typeManageOpen: boolean;
  setTypeManageOpen: React.Dispatch<React.SetStateAction<boolean>>;
  typeDeletingScope: string | null;
  setTypeDeletingScope: React.Dispatch<React.SetStateAction<string | null>>;
  fieldLibrary: FieldLibraryItem[];
  isSaving: boolean;
  isUploadingDocument: boolean;
  isDocumentDropActive: boolean;
  setIsDocumentDropActive: React.Dispatch<React.SetStateAction<boolean>>;
  isDeletingPackage: boolean;
  isAdmin: boolean;
  builderStep: BuilderStep;
  seedingDemo: boolean;
  demoUiState: "try" | "open" | "dismissed";
  demoSessionLoading: boolean;
  selectedDocument: DocItem | null;
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
  selectedPage: number;
  setSelectedPage: React.Dispatch<React.SetStateAction<number>>;
  addingPackage: boolean;
  setAddingPackage: React.Dispatch<React.SetStateAction<boolean>>;
  sortSensors: ReturnType<typeof useSensors>;
  documentPreviewCache: React.MutableRefObject<Record<string, string>>;
  documentPreviewCacheOrder: React.MutableRefObject<string[]>;
  getAuthHeaders: () => HeadersInit;
  docupleteApiPath: string;
  slackConnected: boolean;
  webhookTestStatus: { ok: boolean; message: string } | null;
  webhookSecret: string | null;
  webhookSecretLoading: boolean;
  webhookSecretRevealed: boolean;
  webhookSecretCopied: boolean;
  setWebhookTestStatus: React.Dispatch<React.SetStateAction<{ ok: boolean; message: string } | null>>;
  setWebhookSecretRevealed: React.Dispatch<React.SetStateAction<boolean>>;
  setWebhookSecretCopied: React.Dispatch<React.SetStateAction<boolean>>;
  webhookDeliveries: WebhookDelivery[];
  webhookDeliveriesLoading: boolean;
  expandedDelivery: number | null;
  setExpandedDelivery: React.Dispatch<React.SetStateAction<number | null>>;
  retryingDelivery: number | null;
  goBuilderStep: (step: BuilderStep, opts?: { autoSort?: boolean; saveFirst?: boolean }) => void;
  savePackage: (pkg: PackageItem) => Promise<void>;
  updateSelectedPackage: (updater: (pkg: PackageItem) => PackageItem, targetId?: number) => void;
  uploadDocuments: (files: FileList) => void;
  uploadDocument: (file: File, docId?: string) => void;
  addDocument: () => void;
  removeDocument: (docId: string) => void;
  deletePackage: (pkg: PackageItem) => void;
  createGroup: () => void;
  updateGroupLocal: (id: number, patch: Partial<Entity>) => void;
  saveGroup: (g: Entity) => void;
  deleteGroup: (id: number) => void;
  createGroupNamed: (name: string) => Promise<{ id: number } | string>;
  createTransactionType: () => void;
  updateTransactionTypeLocal: (scope: string, patch: Partial<TransactionType>) => void;
  saveTransactionType: (item: TransactionType) => void;
  deleteTransactionType: (scope: string) => void;
  createTransactionTypeNamed: (name: string) => Promise<{ scope: string } | string>;
  createFieldLibraryItem: () => void;
  updateFieldLibraryLocal: (id: string, patch: Partial<FieldLibraryItem>) => void;
  saveFieldLibraryItem: (item: FieldLibraryItem) => void;
  deleteFieldLibraryItem: (id: string) => void;
  addLibraryFieldToPackage: (item: FieldLibraryItem) => void;
  loadFieldLibraryVersions?: (fieldId: string) => Promise<import("@/lib/docuplete-local-types").FieldVersionRow[] | string>;
  restoreFieldLibraryVersion?: (fieldId: string, versionId: number) => Promise<string | null>;
  loadFieldLibraryAnalytics?: (fieldId: string) => Promise<import("@/lib/docuplete-local-types").FieldAnalytics | string>;
  exportFieldLibrary?: (format: "json" | "csv") => Promise<void>;
  importFieldLibrary?: (data: import("@/components/DocupletePanels").FieldLibraryImportPayload) => Promise<import("@/components/DocupletePanels").FieldLibraryImportResult | string>;
  fieldGroups: FieldGroup[];
  createFieldGroup: () => Promise<string | null>;
  updateFieldGroupLocal: (id: number, patch: Partial<FieldGroup>) => void;
  saveFieldGroup: (item: FieldGroup) => Promise<string | null>;
  deleteFieldGroup: (id: number) => Promise<string | null>;
  addGroupToPackage: (group: FieldGroup) => void;
  launchTestInterview: (pkg: PackageItem) => void;
  openFieldEditorForAdd: () => void;
  openFieldEditorForEdit: (fieldId: string) => void;
  removeField: (fieldId: string) => void;
  setSelectedFieldId: (id: string | null) => void;
  setPackages: (updater: PackageItem[] | ((prev: PackageItem[]) => PackageItem[])) => void;
  dismissDemoUi: () => void;
  handleOpenDemoInterview: () => void;
  handleSeedDemo: () => void;
  setStandalonePackageId: React.Dispatch<React.SetStateAction<string>>;
  allComplianceTags?: import("@/lib/docuplete-local-types").ComplianceTag[];
  setFieldComplianceTags?: (fieldId: string, tags: string[]) => Promise<string | null>;
  setTab: React.Dispatch<React.SetStateAction<"packages" | "sessions" | "mapper" | "batch" | "library" | "help">>;
  sendTestWebhook: (packageId: number) => Promise<void>;
  fetchWebhookDeliveries: (packageId: number) => Promise<void>;
  fetchWebhookSecret: (packageId: number) => Promise<void>;
  retryDelivery: (packageId: number, deliveryId: number) => Promise<void>;
}

export const DocupleteBuilderPanel = React.memo(function DocupleteBuilderPanel(props: DocupleteBuilderPanelProps) {
  const {
    selectedPackage, bootstrapLoaded, packages, groups, transactionTypes, storeMappings,
    packageInterviewFields, packageFixedOrHiddenFields, packageMappedFieldIds,
    inlineAddTypeOpen, setInlineAddTypeOpen, inlineAddTypeName, setInlineAddTypeName,
    inlineAddTypeLoading, setInlineAddTypeLoading, inlineAddTypeError, setInlineAddTypeError,
    inlineAddGroupOpen, setInlineAddGroupOpen, inlineAddGroupName, setInlineAddGroupName,
    inlineAddGroupLoading, setInlineAddGroupLoading, inlineAddGroupError, setInlineAddGroupError,
    typeManageOpen, setTypeManageOpen, typeDeletingScope, setTypeDeletingScope,
    fieldLibrary, isSaving, isUploadingDocument, isDocumentDropActive, setIsDocumentDropActive,
    isDeletingPackage, isAdmin, builderStep, seedingDemo, demoUiState, demoSessionLoading,
    selectedDocument, setSelectedDocumentId, setSelectedPage,
    addingPackage, setAddingPackage, sortSensors, documentPreviewCache, documentPreviewCacheOrder,
    getAuthHeaders, docupleteApiPath, slackConnected,
    webhookTestStatus, webhookSecret, webhookSecretLoading, webhookSecretRevealed, webhookSecretCopied,
    setWebhookTestStatus, setWebhookSecretRevealed, setWebhookSecretCopied,
    webhookDeliveries, webhookDeliveriesLoading, expandedDelivery, setExpandedDelivery, retryingDelivery,
    goBuilderStep, savePackage, updateSelectedPackage, uploadDocuments, uploadDocument, addDocument,
    removeDocument, deletePackage, createGroup, updateGroupLocal, saveGroup, deleteGroup, createGroupNamed,
    createTransactionType, updateTransactionTypeLocal, saveTransactionType, deleteTransactionType,
    createTransactionTypeNamed, createFieldLibraryItem, updateFieldLibraryLocal, saveFieldLibraryItem,
    deleteFieldLibraryItem, addLibraryFieldToPackage, loadFieldLibraryVersions, restoreFieldLibraryVersion, loadFieldLibraryAnalytics,
    exportFieldLibrary, importFieldLibrary,
    fieldGroups, createFieldGroup, updateFieldGroupLocal, saveFieldGroup, deleteFieldGroup, addGroupToPackage,
    launchTestInterview, openFieldEditorForAdd,
    openFieldEditorForEdit, removeField, setSelectedFieldId, setPackages,
    dismissDemoUi, handleOpenDemoInterview, handleSeedDemo, setStandalonePackageId, setTab,
    allComplianceTags, setFieldComplianceTags,
    sendTestWebhook, fetchWebhookDeliveries, fetchWebhookSecret, retryDelivery,
  } = props;

  return (
    <div>
      <section className="bg-white rounded-lg p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)]">
        {!selectedPackage ? (
          bootstrapLoaded && packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-14 h-14 bg-[#F0EBE4] rounded-2xl flex items-center justify-center mb-5 shrink-0">
                <svg className="w-7 h-7 text-[#8A6A20]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-[#0F1C3F] mb-1.5">You're all set — let's build something</h2>
              <p className="text-sm text-[#6B7A99] mb-7 max-w-sm leading-relaxed">
                Load a pre-built sample package to explore all the features, or jump straight in and create your first package from scratch.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  disabled={seedingDemo}
                  className="flex items-center gap-2 bg-[#C49A38] hover:bg-[#A8832E] disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
                >
                  {seedingDemo ? (
                    <><svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Loading sample…</>
                  ) : (
                    <><svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>Load sample package</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingPackage(true)}
                  className="flex items-center gap-2 bg-white border border-[#DDD5C4] hover:border-[#C49A38] hover:text-[#0F1C3F] text-[#6B7A99] text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                  New Package
                </button>
              </div>
            </div>
          ) : (
            <EmptyState message="Create a package to begin." />
          )
        ) : selectedPackage.name.startsWith("Demo") && demoUiState !== "dismissed" ? (
          <DemoWelcomeBanner
            demoUiState={demoUiState}
            demoSessionLoading={demoSessionLoading}
            onDismiss={dismissDemoUi}
            onOpenInterview={handleOpenDemoInterview}
          />
        ) : (
          <div className="space-y-5">
            {builderStep === "documents" && (
              <div className="space-y-4 max-w-[1200px]">
                <div className="rounded-lg bg-white p-4 space-y-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)]">
                  <div className="text-sm font-semibold text-[#0F1C3F]">Optional settings</div>
                  <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 max-w-2xl">
                  {/* Groups */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Groups</span>
                      {groups.length > 0 && !inlineAddGroupOpen && (
                        <button type="button" onClick={() => { setInlineAddGroupOpen(true); setInlineAddGroupName(""); setInlineAddGroupError(null); }} className="text-xs text-[#C49A38] hover:underline">+ Add group</button>
                      )}
                    </div>
                    {inlineAddGroupOpen && (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Group name…"
                          value={inlineAddGroupName}
                          onChange={(e) => setInlineAddGroupName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && inlineAddGroupName.trim()) {
                              e.preventDefault();
                              setInlineAddGroupLoading(true);
                              setInlineAddGroupError(null);
                              const result = await createGroupNamed(inlineAddGroupName.trim());
                              setInlineAddGroupLoading(false);
                              if (typeof result === "string") {
                                setInlineAddGroupError(result);
                              } else {
                                if (result.id) updateSelectedPackage((pkg) => ({ ...pkg, group_ids: [...(pkg.group_ids ?? []), result.id], group_id: pkg.group_id ?? result.id }));
                                setInlineAddGroupOpen(false);
                                setInlineAddGroupName("");
                              }
                            } else if (e.key === "Escape") {
                              setInlineAddGroupOpen(false);
                            }
                          }}
                          className="flex-1 border border-[#D4C9B5] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#C49A38]"
                        />
                        <button
                          type="button"
                          disabled={!inlineAddGroupName.trim() || inlineAddGroupLoading}
                          onClick={async () => {
                            setInlineAddGroupLoading(true);
                            setInlineAddGroupError(null);
                            const result = await createGroupNamed(inlineAddGroupName.trim());
                            setInlineAddGroupLoading(false);
                            if (typeof result === "string") {
                              setInlineAddGroupError(result);
                            } else {
                              if (result.id) updateSelectedPackage((pkg) => ({ ...pkg, group_ids: [...(pkg.group_ids ?? []), result.id], group_id: pkg.group_id ?? result.id }));
                              setInlineAddGroupOpen(false);
                              setInlineAddGroupName("");
                            }
                          }}
                          className="text-xs bg-[#C49A38] text-white rounded px-2 py-1.5 disabled:opacity-40"
                        >{inlineAddGroupLoading ? "Adding…" : "Add"}</button>
                        <button type="button" onClick={() => setInlineAddGroupOpen(false)} className="text-xs text-[#8A9BB8] hover:text-[#4A5568]">Cancel</button>
                      </div>
                    )}
                    {inlineAddGroupError && <p className="text-xs text-red-600">{inlineAddGroupError}</p>}
                    {(() => {
                      const activeGroups = groups.filter((g) => g.active !== false);
                      const categories = [...new Set(activeGroups.map((g) => g.kind ?? "general"))].sort();
                      return categories.map((cat) => {
                        const catGroups = activeGroups.filter((g) => (g.kind ?? "general") === cat && g.name?.trim());
                        if (catGroups.length === 0) return null;
                        const selectedInCat = (selectedPackage.group_ids ?? []).find((gid) => catGroups.some((g) => g.id === gid));
                        return (
                          <div key={cat}>
                            {cat !== "general" && <span className="block text-xs text-[#6B7A99] mb-1 capitalize">{cat}</span>}
                            <select
                              value={selectedInCat ?? ""}
                              onChange={(e) => {
                                const chosenId = e.target.value ? Number(e.target.value) : null;
                                updateSelectedPackage((pkg) => {
                                  const otherIds = (pkg.group_ids ?? []).filter((gid) => !catGroups.some((g) => g.id === gid));
                                  const nextIds = chosenId ? [...otherIds, chosenId] : otherIds;
                                  return { ...pkg, group_ids: nextIds, group_id: nextIds[0] ?? null };
                                });
                              }}
                              className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm"
                            >
                              <option value="">None</option>
                              {catGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {/* Type */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Type <span className="text-gray-400 normal-case font-normal tracking-normal">(optional)</span></span>
                      {!inlineAddTypeOpen && (
                        <button type="button" onClick={() => { setInlineAddTypeOpen(true); setInlineAddTypeName(""); setInlineAddTypeError(null); }} className="text-xs text-[#C49A38] hover:underline">+ Add type</button>
                      )}
                    </div>
                    <select value={selectedPackage.transaction_scope ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, transaction_scope: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm">
                      <option value="">Not specified</option>
                      {transactionTypes.filter((item) => item.active || item.scope === selectedPackage.transaction_scope).map((item) => <option key={item.scope} value={item.scope}>{item.label}</option>)}
                    </select>
                    {inlineAddTypeOpen && (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Type name…"
                          value={inlineAddTypeName}
                          onChange={(e) => setInlineAddTypeName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === "Enter" && inlineAddTypeName.trim()) {
                              e.preventDefault();
                              setInlineAddTypeLoading(true);
                              setInlineAddTypeError(null);
                              const result = await createTransactionTypeNamed(inlineAddTypeName.trim());
                              setInlineAddTypeLoading(false);
                              if (typeof result === "string") {
                                setInlineAddTypeError(result);
                              } else {
                                updateSelectedPackage((pkg) => ({ ...pkg, transaction_scope: result.scope }));
                                setInlineAddTypeOpen(false);
                                setInlineAddTypeName("");
                              }
                            } else if (e.key === "Escape") {
                              setInlineAddTypeOpen(false);
                            }
                          }}
                          className="flex-1 border border-[#D4C9B5] rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#C49A38]"
                        />
                        <button
                          type="button"
                          disabled={!inlineAddTypeName.trim() || inlineAddTypeLoading}
                          onClick={async () => {
                            setInlineAddTypeLoading(true);
                            setInlineAddTypeError(null);
                            const result = await createTransactionTypeNamed(inlineAddTypeName.trim());
                            setInlineAddTypeLoading(false);
                            if (typeof result === "string") {
                              setInlineAddTypeError(result);
                            } else {
                              updateSelectedPackage((pkg) => ({ ...pkg, transaction_scope: result.scope }));
                              setInlineAddTypeOpen(false);
                              setInlineAddTypeName("");
                            }
                          }}
                          className="text-xs bg-[#C49A38] text-white rounded px-2 py-1.5 disabled:opacity-40"
                        >{inlineAddTypeLoading ? "Adding…" : "Add"}</button>
                        <button type="button" onClick={() => setInlineAddTypeOpen(false)} className="text-xs text-[#8A9BB8] hover:text-[#4A5568]">Cancel</button>
                      </div>
                    )}
                    {inlineAddTypeError && <p className="text-xs text-red-600">{inlineAddTypeError}</p>}
                  </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Description / interview notes</span>
                    <Textarea value={selectedPackage.description ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, description: e.target.value }))} />
                  </label>
                  <div>
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tags</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center justify-center w-4 h-4 rounded-full border border-[#C4B99A] text-[#8A9BB8] text-[10px] leading-none cursor-help select-none">?</span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-64">
                          Free-form labels for organizing and filtering packages. Tags appear as filter chips above the package list — click any to show only matching packages. Press Enter or comma to add.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <TagChipInput
                      tags={selectedPackage.tags ?? []}
                      onChange={(tags) => updateSelectedPackage((pkg) => ({ ...pkg, tags }))}
                    />
                  </div>
                  </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Package documents</h2>
                    <p className="text-xs text-[#8A9BB8]">The order below becomes the order of the generated paperwork packet.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={addDocument}>Add placeholder</Button>
                    <label className={`${buttonVariants({ size: "sm" })} cursor-pointer`}>
                      Upload PDFs
                      <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        className="sr-only"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files?.length) {
                            if (files.length === 1) uploadDocument(files[0]);
                            else uploadDocuments(files);
                          }
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div
                  onDragEnter={(e: ReactDragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDocumentDropActive(true); }}
                  onDragOver={(e: ReactDragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setIsDocumentDropActive(true); }}
                  onDragLeave={(e: ReactDragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDocumentDropActive(false); }}
                  onDrop={(e: ReactDragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDocumentDropActive(false); const files = e.dataTransfer.files; if (files.length === 1) uploadDocument(files[0]); else uploadDocuments(files); }}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition ${isDocumentDropActive ? "border-blue-400 bg-blue-100/60" : "border-blue-300 bg-blue-50/50"}`}
                >
                  <div className="flex justify-center mb-3">
                    <svg className={`w-8 h-8 transition ${isDocumentDropActive ? "text-blue-500" : "text-blue-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5v-9m0 0-3 3m3-3 3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.338-2.32 5.75 5.75 0 0 1 1.026 11.095H6.75Z" />
                    </svg>
                  </div>
                  <div className="text-sm font-semibold text-[#0F1C3F]">Drag and drop multiple PDFs here</div>
                  <p className="mt-1 text-xs text-[#6B7A99]">Drop all paperwork documents at once. Docuplete will upload them in order and add each file to this package.</p>
                  <label className={`mt-3 ${buttonVariants({ variant: "outline", size: "sm" })} ${isUploadingDocument ? "opacity-50 pointer-events-none cursor-not-allowed" : "cursor-pointer"}`}>
                    {isUploadingDocument ? "Uploading…" : "Browse PDF files"}
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      disabled={isUploadingDocument}
                      className="sr-only"
                      onChange={(e) => { const files = e.target.files; if (files?.length) { if (files.length === 1) uploadDocument(files[0]); else uploadDocuments(files); } e.target.value = ""; }}
                    />
                  </label>
                </div>
                {isUploadingDocument && <div className="text-xs text-[#6B7A99]">Uploading PDF documents, please wait…</div>}
                {selectedPackage.documents.length === 0 ? (
                  <EmptyState message="Upload PDFs here, then arrange them into the order customers should receive them." />
                ) : (
                  <DndContext
                    sensors={sortSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event: DragEndEvent) => {
                      const { active, over } = event;
                      if (!over || active.id === over.id) return;
                      updateSelectedPackage((pkg) => {
                        const oldIdx = pkg.documents.findIndex((d) => d.id === active.id);
                        const newIdx = pkg.documents.findIndex((d) => d.id === over.id);
                        return { ...pkg, documents: arrayMove(pkg.documents, oldIdx, newIdx) };
                      });
                    }}
                  >
                    <SortableContext items={selectedPackage.documents.map((d) => d.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {selectedPackage.documents.map((doc, index) => (
                          <SortableItem key={doc.id} id={doc.id}>
                            {({ handleProps, wrapperRef, wrapperStyle, isDragging }) => (
                              <div
                                ref={wrapperRef}
                                style={wrapperStyle}
                                {...handleProps}
                                className={`rounded-lg border bg-white flex flex-col transition-shadow cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-40 shadow-2xl scale-95" : "hover:shadow-md"} ${selectedDocument?.id === doc.id ? "border-[#C49A38] ring-2 ring-[#C49A38]/20" : "border-[#DDD5C4]"}`}
                              >
                                <DocumentPreviewTile
                                  packageId={selectedPackage.id}
                                  doc={doc}
                                  order={index + 1}
                                  selected={selectedDocument?.id === doc.id}
                                  getAuthHeaders={getAuthHeaders}
                                  docupleteApiPath={docupleteApiPath}
                                  previewCache={documentPreviewCache}
                                  previewCacheOrder={documentPreviewCacheOrder}
                                  onSelect={() => { setSelectedDocumentId(doc.id); setSelectedPage(1); }}
                                  previewHeight="h-52"
                                />
                                <div className="p-2.5 flex flex-col gap-1.5 border-t border-[#EFE8D8]">
                                  <Input
                                    value={doc.title}
                                    onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, documents: pkg.documents.map((d) => d.id === doc.id ? { ...d, title: e.target.value } : d) }))}
                                    className="h-7 text-xs px-2"
                                    placeholder="Document title"
                                  />
                                  <div className="text-[10px] text-[#8A9BB8] truncate">{doc.pages} page{doc.pages === 1 ? "" : "s"}{doc.fileName ? ` · ${doc.fileName}` : ""}</div>
                                  <div className="flex gap-2 items-center">
                                    <label className={`text-[10px] ${isUploadingDocument ? "text-[#6B7A99] pointer-events-none opacity-50" : "text-[#C49A38] cursor-pointer hover:underline"}`}>
                                      {isUploadingDocument ? "Uploading…" : "Replace"}
                                      <input type="file" accept="application/pdf" disabled={isUploadingDocument} className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file, doc.id); e.target.value = ""; }} />
                                    </label>
                                    <button onClick={() => removeDocument(doc.id)} className="ml-auto text-[10px] text-red-500 hover:underline">Remove</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    onClick={async () => { await savePackage(selectedPackage); goBuilderStep("mapping"); }}
                    disabled={isSaving || selectedPackage.documents.length === 0}
                  >
                    {isSaving ? "Saving…" : "Save & Continue →"}
                  </Button>
                  <span className="text-xs text-[#8A9BB8]">Step 1 of 3 · add your PDFs above, then continue</span>
                </div>
              </div>
            )}
            {(builderStep === "interview" || builderStep === "finalize") && (() => {
              const unmappedInterviewFields = packageInterviewFields.filter((f) => !packageMappedFieldIds.has(f.id));
              return (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-lg bg-white p-4 flex flex-col gap-3 overflow-y-auto max-h-[520px] shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Interview order</h2>
                      {packageInterviewFields.length > 1 && (
                        <button type="button" onClick={() => goBuilderStep("interview", { autoSort: true })} className="text-xs text-[#6B7A99] border border-[#DDD5C4] rounded px-2 py-1 hover:border-[#C49A38] hover:text-[#C49A38] transition-colors">Sort by PDF order</button>
                      )}
                    </div>
                    <p className="text-xs text-[#8A9BB8] -mt-1">Questions staff will be asked, top to bottom. Drag to reorder — the preview updates live.</p>
                    {packageInterviewFields.length === 0 ? (
                      <EmptyState message="No interview questions yet. Go to Data + Fields View and mark fields that require input." />
                    ) : (
                      <DndContext
                        sensors={sortSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event: DragEndEvent) => {
                          const { active, over } = event;
                          if (!over || active.id === over.id || !selectedPackage) return;
                          const oldIdx = selectedPackage.fields.findIndex((f) => f.id === active.id);
                          const newIdx = selectedPackage.fields.findIndex((f) => f.id === over.id);
                          if (oldIdx < 0 || newIdx < 0) return;
                          const reordered = { ...selectedPackage, fields: arrayMove(selectedPackage.fields, oldIdx, newIdx) };
                          setPackages((prev) => prev.map((pkg) => pkg.id === reordered.id ? reordered : pkg));
                          void savePackage(reordered);
                        }}
                      >
                        <SortableContext items={packageInterviewFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1">
                            {packageInterviewFields.map((field, index) => (
                            <SortableItem key={field.id} id={field.id}>
                            {({ handleProps, wrapperRef, wrapperStyle, isDragging }) => (
                            <div
                              ref={wrapperRef}
                              style={wrapperStyle}
                              {...handleProps}
                              className={`rounded border p-3 flex items-center gap-3 transition-shadow cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-40 shadow-lg border-[#C49A38] bg-[#FDF8EE]" : "border-[#EFE8D8] bg-[#F8F6F0]"}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                  <span>{index + 1}. {field.name}</span>
                                  {!packageMappedFieldIds.has(field.id) && (
                                    <span className="text-[10px] font-normal bg-orange-50 border border-orange-300 text-orange-700 rounded px-1.5 py-0.5 leading-none">Not on PDF</span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.interviewMode ?? "optional"}{field.validationType && field.validationType !== "none" ? ` · ${field.validationType}` : ""}{field.sensitive ? " · masked" : ""}</div>
                              </div>
                            </div>
                            )}
                            </SortableItem>
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                    {packageFixedOrHiddenFields.length > 0 && (
                      <details className="border-t border-[#EFE8D8] pt-3">
                        <summary className="text-xs font-semibold text-[#6B7A99] cursor-pointer select-none">{packageFixedOrHiddenFields.length} field{packageFixedOrHiddenFields.length !== 1 ? "s" : ""} hidden from interview</summary>
                        <div className="space-y-1 mt-2 text-xs">
                          {packageFixedOrHiddenFields.map((field) => (
                            <div key={field.id} className={`rounded border px-2 py-1 ${isSystemEsignFieldId(field.id) ? "border-indigo-200 bg-indigo-50" : "border-[#EFE8D8]"}`}>
                              <div className="font-medium flex items-center gap-1.5">
                                {field.name}
                                {isSystemEsignFieldId(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-indigo-100 text-indigo-600 border border-indigo-200 px-1 py-0.5 font-semibold">E-Sign</span>}
                              </div>
                              <div className="text-[#6B7A99]">
                                {isSystemEsignFieldId(field.id) ? "System field — always omitted" : `Omitted${field.defaultValue ? " · has default value" : " · no default"}${field.sensitive ? " · masked" : ""}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    <div className="pt-1">
                      <Button onClick={() => goBuilderStep("mapping")} variant="outline" className="text-xs">Edit Mapping Rules</Button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#F8F6F0] p-4 flex flex-col gap-3 overflow-y-auto max-h-[520px] shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_0_rgba(0,0,0,0.03)]">
                    <div>
                      <h2 className="text-sm font-semibold">Interview preview</h2>
                      <p className="text-xs text-[#8A9BB8] mt-0.5">How this will appear to staff during an interview. Updates as you reorder.</p>
                    </div>
                    {packageInterviewFields.length === 0 ? (
                      <p className="text-xs text-[#8A9BB8] italic">No questions to preview yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {packageInterviewFields.map((field, index) => {
                          const mode = field.interviewMode ?? "optional";
                          return (
                          <div key={field.id} className="rounded-lg border border-[#DDD5C4] bg-white p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="text-sm font-medium leading-snug">{index + 1}. {field.name}</span>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide border ${
                                mode === "required" ? "bg-red-50 text-red-700 border-red-100"
                                : mode === "readonly" ? "bg-blue-50 text-blue-700 border-blue-100"
                                : "bg-[#F8F6F0] text-[#6B7A99] border-[#EFE8D8]"
                              }`}>{mode === "required" ? "Required" : mode === "readonly" ? "Read only" : "Optional"}</span>
                            </div>
                            {field.type === "radio" || field.type === "checkbox" ? (
                              <div className="space-y-1.5">
                                {(field.options?.length ? field.options : ["Option A", "Option B"]).slice(0, 3).map((opt) => (
                                  <div key={opt} className="flex items-center gap-2 text-xs text-[#6B7A99]">
                                    <div className={`w-3 h-3 flex-shrink-0 border border-[#C4B99A] ${field.type === "checkbox" ? "rounded-sm" : "rounded-full"}`} />
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            ) : field.type === "dropdown" ? (
                              <div className="flex items-center justify-between border border-[#D4C9B5] rounded px-2.5 py-1.5 text-xs text-[#8A9BB8] bg-white">
                                <span>Select…</span>
                                <svg className="w-3 h-3 text-[#8A9BB8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </div>
                            ) : (
                              <div className="border border-[#D4C9B5] rounded px-2.5 py-1.5 text-xs text-[#8A9BB8] bg-white">
                                {field.type === "date" ? "mm / dd / yyyy" : field.sensitive ? "••••••••" : `Enter ${field.name.toLowerCase()}…`}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-[#DDD5C4]" />

                <div className="space-y-4">
                  {unmappedInterviewFields.length > 0 && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <div>
                          <div className="text-sm font-semibold text-orange-800 mb-1">
                            {unmappedInterviewFields.length} interview {unmappedInterviewFields.length === 1 ? "field" : "fields"} {unmappedInterviewFields.length === 1 ? "has" : "have"} no PDF placement
                          </div>
                          <p className="text-xs text-orange-700 mb-2">
                            Staff will be asked these questions during the interview, but the answers <strong>will not be printed on any PDF</strong> in the packet. Go to Data + Fields View and place each field in the correct row on the form before activating.
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {unmappedInterviewFields.map((f) => (
                              <button key={f.id} type="button" onClick={() => { setSelectedFieldId(f.id); goBuilderStep("mapping"); }} className="text-xs bg-white border border-orange-300 text-orange-800 rounded px-2 py-0.5 hover:bg-orange-100 transition-colors">
                                {f.name} →
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold mb-1">Output channels</h3>
                    <p className="text-xs text-[#8A9BB8] mb-3">Choose how completed interviews are delivered. PDF generation is always included.</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="rounded-lg border-2 border-[#C49A38] bg-white p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className="w-4 h-4 text-[#C49A38] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          <span className="text-sm font-semibold">Filled PDF Packet</span>
                          <span className="ml-auto text-[10px] bg-[#FDF8EE] text-[#8A6A20] border border-[#C49A38]/40 rounded px-1.5 py-0.5 shrink-0">Always on</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Generates a completed, print-ready PDF packet when any interview on this package is submitted.</p>
                      </div>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_interview: !pkg.enable_interview }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_interview ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_interview ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.enable_interview ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Staff Interview</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_interview ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.enable_interview ? "Enabled" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Staff can launch guided interviews from the Interviews tab and Deal Builder.</p>
                      </button>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_csv: !pkg.enable_csv }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_csv ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_csv ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375A1.125 1.125 0 002.25 5.625v12.75" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.enable_csv ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Batch CSV</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_csv ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.enable_csv ? "Enabled" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Upload a spreadsheet of clients — Docuplete generates one PDF packet per row.</p>
                      </button>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, require_preview: !pkg.require_preview }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.require_preview ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.require_preview ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.require_preview ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Require document preview before signing</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.require_preview ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.require_preview ? "Required" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Require the signer to open and view the filled PDF before the signing step becomes available.</p>
                      </button>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, require_scroll_confirmation: !pkg.require_scroll_confirmation }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.require_scroll_confirmation ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.require_scroll_confirmation ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 4.5l-7.5 7.5-7.5-7.5" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.require_scroll_confirmation ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Require full scroll through document</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.require_scroll_confirmation ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.require_scroll_confirmation ? "Required" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Signer must scroll to the bottom of the document before "Proceed to sign" becomes available. Enables the inline PDF renderer with scroll tracking.</p>
                      </button>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_customer_link: !pkg.enable_customer_link }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_customer_link ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_customer_link ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.enable_customer_link ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Customer Link</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_customer_link ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.enable_customer_link ? "Enabled" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Send a time-limited, branded link directly to the customer. They fill it out on their own device — no login needed.</p>
                      </button>
                      <div className={`rounded-lg border-2 p-3 transition-colors ${selectedPackage.webhook_enabled ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <button
                          type="button"
                          onClick={() => {
                            const enabling = !selectedPackage.webhook_enabled;
                            updateSelectedPackage((pkg) => ({ ...pkg, webhook_enabled: enabling }));
                            setWebhookTestStatus(null);
                            if (enabling && selectedPackage.id) {
                              void fetchWebhookDeliveries(selectedPackage.id);
                            }
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <svg className={`w-4 h-4 shrink-0 ${selectedPackage.webhook_enabled ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" /></svg>
                            <span className={`text-sm font-semibold ${selectedPackage.webhook_enabled ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Webhook / Make.com</span>
                            <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.webhook_enabled ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.webhook_enabled ? "Enabled" : "Off"}</span>
                          </div>
                          <p className="text-xs text-[#6B7A99]">Fire a POST request to any URL when an interview or customer form is completed.</p>
                        </button>
                        {selectedPackage.webhook_enabled && (
                          <div className="mt-3 space-y-3">
                            <div className="flex gap-2 items-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <input
                                    type="url"
                                    placeholder="https://your-endpoint.com/webhook"
                                    value={selectedPackage.webhook_url ?? ""}
                                    onChange={(e) => { updateSelectedPackage((pkg) => ({ ...pkg, webhook_url: e.target.value || null })); setWebhookTestStatus(null); }}
                                    onKeyDown={(e) => { if (e.key === "Enter" && selectedPackage.webhook_url) void sendTestWebhook(selectedPackage.id); }}
                                    className="flex-1 min-w-0 text-xs rounded border border-[#DDD5C4] bg-white px-2 py-1.5 text-[#0F1C3F] placeholder:text-[#B0A898] focus:outline-none focus:ring-1 focus:ring-[#0F1C3F]"
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top">URL must be HTTPS. A POST request is sent each time an interview or customer form is submitted.</TooltipContent>
                              </Tooltip>
                              <button
                                type="button"
                                disabled={!selectedPackage.webhook_url}
                                onClick={() => { void sendTestWebhook(selectedPackage.id); }}
                                className="shrink-0 text-xs rounded border border-[#DDD5C4] bg-white px-2.5 py-1.5 text-[#0F1C3F] hover:bg-[#EAF0FB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                Send test
                              </button>
                            </div>
                            {webhookTestStatus && (
                              <p className={`text-xs ${webhookTestStatus.ok ? "text-green-700" : "text-red-600"}`}>
                                {webhookTestStatus.ok ? "✓" : "✗"} {webhookTestStatus.message}
                              </p>
                            )}
                            <p className="text-[11px] text-[#8A9BB8]">Payload: <code className="font-mono">{"{ event, package_id, package_name, token, submitted_at, answers }"}</code>. Sensitive fields are redacted.</p>
                            <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] px-2.5 py-2 space-y-1.5">
                              <p className="text-[11px] font-medium text-[#0F1C3F]">Signing secret</p>
                              <div className="flex items-center gap-1.5">
                                <code className="flex-1 min-w-0 font-mono text-[10px] break-all text-[#0F1C3F] bg-white border border-[#E8E0D0] rounded px-1.5 py-1">
                                  {webhookSecretRevealed && webhookSecret ? webhookSecret : "•".repeat(40)}
                                </code>
                                <button
                                  type="button"
                                  disabled={webhookSecretLoading}
                                  onClick={() => {
                                    if (!webhookSecretRevealed) {
                                      setWebhookSecretRevealed(true);
                                      if (!webhookSecret && selectedPackage.id) {
                                        void fetchWebhookSecret(selectedPackage.id);
                                      }
                                    } else {
                                      setWebhookSecretRevealed(false);
                                    }
                                  }}
                                  className="shrink-0 text-[10px] border border-[#DDD5C4] bg-white rounded px-2 py-1 text-[#0F1C3F] hover:bg-[#EAF0FB] disabled:opacity-40 transition-colors"
                                >
                                  {webhookSecretLoading ? "Loading…" : webhookSecretRevealed ? "Hide" : "Reveal"}
                                </button>
                                {webhookSecretRevealed && webhookSecret && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!webhookSecret) return;
                                      void navigator.clipboard.writeText(webhookSecret).then(() => {
                                        setWebhookSecretCopied(true);
                                        setTimeout(() => setWebhookSecretCopied(false), 2000);
                                      });
                                    }}
                                    className="shrink-0 text-[10px] border border-[#DDD5C4] bg-white rounded px-2 py-1 text-[#0F1C3F] hover:bg-[#EAF0FB] transition-colors"
                                  >
                                    {webhookSecretCopied ? "Copied ✓" : "Copy"}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] px-2.5 py-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-medium text-[#0F1C3F]">Recent deliveries</p>
                                <button type="button" onClick={() => { void fetchWebhookDeliveries(selectedPackage.id); }} className="text-[10px] text-[#6B7A99] hover:text-[#0F1C3F] transition-colors">Refresh</button>
                              </div>
                              {webhookDeliveriesLoading && <p className="text-[10px] text-[#8A9BB8]">Loading…</p>}
                              {!webhookDeliveriesLoading && webhookDeliveries.length === 0 && (
                                <p className="text-[10px] text-[#8A9BB8]">No deliveries yet. Send a test to see your first entry.</p>
                              )}
                              {!webhookDeliveriesLoading && webhookDeliveries.length > 0 && (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                  {webhookDeliveries.map((d) => {
                                    const isOk = d.http_status !== null && d.http_status >= 200 && d.http_status < 300;
                                    const isFailed = !isOk;
                                    const isExpanded = expandedDelivery === d.id;
                                    const isRetrying = retryingDelivery === d.id;
                                    const canRetry = isFailed && d.has_payload;
                                    return (
                                      <div key={d.id} className="bg-white border border-[#E8E0D0] rounded px-2 py-1.5">
                                        <div className="flex items-center gap-2">
                                          <button type="button" onClick={() => setExpandedDelivery(isExpanded ? null : d.id)} className="flex-1 min-w-0 text-left flex items-center gap-2">
                                            <span className={`text-[10px] font-mono font-bold shrink-0 w-8 text-center rounded px-1 ${isOk ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{d.http_status ?? "ERR"}</span>
                                            <span className="text-[10px] text-[#6B7A99] flex-1 min-w-0 truncate">{d.event_type}</span>
                                            {d.attempt_number > 1 && <span className="text-[9px] text-amber-600 shrink-0">retry #{d.attempt_number}</span>}
                                            <span className="text-[10px] text-[#B0A898] shrink-0">{d.duration_ms}ms</span>
                                            <span className="text-[10px] text-[#B0A898] shrink-0">{formatOrgTime(d.created_at, getCachedOrg())}</span>
                                          </button>
                                          {canRetry && (
                                            <button
                                              type="button"
                                              disabled={isRetrying}
                                              onClick={() => { void retryDelivery(selectedPackage.id, d.id); }}
                                              className="shrink-0 text-[10px] border border-red-200 bg-red-50 text-red-700 rounded px-1.5 py-0.5 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                              {isRetrying ? "Retrying…" : "Retry"}
                                            </button>
                                          )}
                                        </div>
                                        {isExpanded && d.response_body && (
                                          <pre className="mt-1.5 text-[9px] font-mono text-[#6B7A99] bg-[#F8F6F0] rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-20 overflow-y-auto">{d.response_body}</pre>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`rounded-lg border-2 p-3 transition-colors ${selectedPackage.slack_notifications_enabled ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, slack_notifications_enabled: !pkg.slack_notifications_enabled }))} className="w-full text-left">
                          <div className="flex items-center gap-2 mb-1.5">
                            <svg className={`w-4 h-4 shrink-0 ${selectedPackage.slack_notifications_enabled ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                            <span className={`text-sm font-semibold ${selectedPackage.slack_notifications_enabled ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Slack</span>
                            <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.slack_notifications_enabled ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.slack_notifications_enabled ? "Enabled" : "Off"}</span>
                          </div>
                          <p className="text-xs text-[#6B7A99]">Post a message to your connected Slack channel whenever an interview or customer form is completed.</p>
                        </button>
                        {selectedPackage.slack_notifications_enabled && !slackConnected && (
                          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                            Slack is not connected yet.{" "}
                            <a href="/app/settings?tab=integrations" className="underline font-medium hover:text-amber-900" target="_blank" rel="noopener noreferrer">Connect Slack in Settings → Integrations</a>{" "}to enable notifications.
                          </p>
                        )}
                      </div>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, notify_staff_on_submit: !pkg.notify_staff_on_submit }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.notify_staff_on_submit ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.notify_staff_on_submit ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.notify_staff_on_submit ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Staff notification</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.notify_staff_on_submit ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.notify_staff_on_submit ? "Enabled" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Email all account staff when a client submits an interview.</p>
                      </button>
                      <button type="button" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, notify_client_on_submit: !pkg.notify_client_on_submit }))} className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.notify_client_on_submit ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg className={`w-4 h-4 shrink-0 ${selectedPackage.notify_client_on_submit ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                          <span className={`text-sm font-semibold ${selectedPackage.notify_client_on_submit ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Client confirmation</span>
                          <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.notify_client_on_submit ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.notify_client_on_submit ? "Enabled" : "Off"}</span>
                        </div>
                        <p className="text-xs text-[#6B7A99]">Send the client a branded receipt email after they submit.</p>
                      </button>
                      <div className={`rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_embed ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}>
                        <button type="button" className="w-full text-left" onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_embed: !pkg.enable_embed }))}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_embed ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                            <span className={`text-sm font-semibold ${selectedPackage.enable_embed ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Embed</span>
                            <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_embed ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>{selectedPackage.enable_embed ? "Enabled" : "Off"}</span>
                          </div>
                          <p className="text-xs text-[#6B7A99]">Drop a JavaScript snippet onto any webpage. Customers complete the form inline without leaving your site.</p>
                        </button>
                        {selectedPackage.enable_embed && (
                          <EmbedSnippetPanel embedKey={selectedPackage.embed_key} apiBase={API_BASE} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-[#DDD5C4] pt-4">
                    <Button onClick={() => goBuilderStep("mapping")} variant="outline" className="text-[#6B7A99]">← Back to Mapping</Button>
                    {selectedPackage.status !== "active" && (
                      <Button onClick={() => savePackage({ ...selectedPackage, status: "active" })} disabled={isSaving || selectedPackage.documents.length === 0 || storeMappings.length === 0}>{isSaving ? "Saving…" : "Activate Package"}</Button>
                    )}
                    <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} variant="outline">{isSaving ? "Saving…" : "Save"}</Button>
                    {selectedPackage.status !== "active" && selectedPackage.id && (
                      <Button onClick={() => launchTestInterview(selectedPackage)} disabled={isSaving || selectedPackage.documents.length === 0} variant="outline" className="text-[#6B7A99] border-dashed">
                        Preview Interview
                      </Button>
                    )}
                    {selectedPackage.status === "active" && <Button onClick={() => { setStandalonePackageId(String(selectedPackage.id)); setTab("sessions"); }} variant="outline">Go to Sessions →</Button>}
                    {selectedPackage.id && isAdmin && (
                      <button type="button" onClick={() => deletePackage(selectedPackage)} disabled={isDeletingPackage} className="ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors">
                        {isDeletingPackage ? "Deleting…" : "Delete package"}
                      </button>
                    )}
                    {selectedPackage.id && !isAdmin && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-auto">
                            <button type="button" disabled className="text-xs text-red-400 opacity-40 cursor-not-allowed">Delete package</button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Contact your admin to delete packages.</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}
          </div>
        )}
      </section>
    </div>
  );
});
