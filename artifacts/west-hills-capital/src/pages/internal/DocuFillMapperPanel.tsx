import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDocuFillStore } from "@/stores/useDocuFillStore";
import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DndContext, closestCenter, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESIGN_FIELD_ID_SIGNATURE, ESIGN_FIELD_ID_INITIALS, ESIGN_FIELD_ID_DATE, isSystemEsignFieldId } from "@/lib/docufill-redaction";
import { type FieldItem, type MappingItem, type MappingFormat, type RecipientItem } from "@/lib/docufill-types";
import type { DocItem, FieldLibraryItem, FieldGroup, PackageItem } from "@/lib/docufill-local-types";
import { MappingButton } from "@/components/MappingButton";
import { FieldCard } from "@/components/FieldCard";
import { EmptyState } from "@/components/DocuFillPanels";
import { DocumentPreviewTile } from "@/components/DocumentPreviewTile";
import { ScrollPageCanvas } from "@/components/DocuFillWidgets";
import { type BuilderStep, BUILDER_STEPS } from "@/components/PackagePickerSidebar";
import { SortableItem, DragGuideLines, ResizeDimTooltip } from "@/components/DocuFillDndHelpers";
import { labelForMappingFormat, sampleValueForMapping } from "@/lib/docufill-mapping-utils";
import type * as pdfjsLib from "pdfjs-dist";

const SYSTEM_ESIGN_FIELDS: Array<{ id: string; name: string; type: FieldItem["type"]; description: string }> = [
  { id: ESIGN_FIELD_ID_SIGNATURE, name: "Signature",   type: "text",     description: "Drawn or typed signature" },
  { id: ESIGN_FIELD_ID_INITIALS,  name: "Initials",    type: "initials", description: "Drawn or typed initials" },
  { id: ESIGN_FIELD_ID_DATE,      name: "Signer Date", type: "date",     description: "Auto-filled with today's date" },
];

function makeSystemEsignFieldItem(id: string): FieldItem {
  const def = SYSTEM_ESIGN_FIELDS.find((f) => f.id === id);
  return {
    id,
    name: def?.name ?? id,
    color: "#9CA3AF",
    type: def?.type ?? "text",
    interviewMode: "omitted",
    defaultValue: "",
    source: "esign-system",
    sensitive: false,
    validationType: "none",
  };
}

type AcroAnnotation = { fieldName: string; rect: [number, number, number, number]; fieldType: string };

// ─── Compact searchable group picker for the field list ────────────────────────
function GroupPicker({
  fieldGroups,
  fieldLibrary,
  existingLibraryIds,
  onUse,
}: {
  fieldGroups: FieldGroup[];
  fieldLibrary: FieldLibraryItem[];
  existingLibraryIds: Set<string>;
  onUse: (group: FieldGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);

  const filteredGroups = fieldGroups
    .filter((g) => g.fieldIds.some((id) => !existingLibraryIds.has(id)))
    .filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  if (fieldGroups.length === 0) return null;

  return (
    <div className="mb-2 flex-shrink-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#6B7A99]">Add field group</span>
        <button
          type="button"
          onClick={() => { setOpen(!open); setSearch(""); setPreviewId(null); }}
          className="text-[11px] text-[#C49A38]"
        >
          {open ? "Close" : "Browse groups"}
        </button>
      </div>
      {open && (
        <div className="rounded border border-[#D4C9B5] bg-white overflow-hidden">
          <input
            autoFocus
            type="text"
            placeholder="Search groups by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-b border-[#EFE8D8] focus:outline-none"
          />
          <div className="max-h-56 overflow-y-auto">
            {filteredGroups.length === 0 ? (
              <div className="px-2 py-3 text-[11px] text-center text-[#8A9BB8]">
                {search ? `No groups match "${search}"` : "All group fields are already in this package."}
              </div>
            ) : filteredGroups.map((g) => {
              const newFields = g.fieldIds
                .filter((id) => !existingLibraryIds.has(id))
                .map((id) => g.fields?.find((f) => f.id === id) ?? fieldLibrary.find((f) => f.id === id))
                .filter((f): f is FieldLibraryItem => Boolean(f));
              const isPreview = previewId === g.id;
              return (
                <div key={g.id} className={`border-b border-[#F0EBE1] last:border-0 ${isPreview ? "bg-[#FFFBF3]" : ""}`}>
                  <div className="flex items-center justify-between px-2 py-1.5 gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-[#0F1C3F] truncate">{g.name}</div>
                      <div className="text-[10px] text-[#8A9BB8]">
                        {newFields.length} new field{newFields.length !== 1 ? "s" : ""}
                        {g.description && <span className="ml-1 italic truncate">— {g.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewId(isPreview ? null : g.id)}
                        title={isPreview ? "Hide field preview" : "Preview fields"}
                        className="text-[10px] text-[#8A9BB8] hover:text-[#4A5568] border border-[#E8E0D4] rounded px-1"
                      >
                        {isPreview ? "▲" : "▾"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { onUse(g); setOpen(false); setSearch(""); setPreviewId(null); }}
                        className="text-[11px] font-medium text-[#C49A38] hover:text-[#B8882E]"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {isPreview && newFields.length > 0 && (
                    <div className="px-2 pb-2">
                      <div className="rounded bg-[#F8F6F0] border border-[#EFE8D8] px-2 py-1.5 space-y-0.5">
                        {newFields.map((f, i) => (
                          <div key={f.id} className="text-[10px] text-[#4A5568] flex items-center gap-1.5 flex-wrap">
                            <span className="text-[#C49A38] font-mono font-semibold shrink-0">{i + 1}.</span>
                            <span className="font-medium">{f.label}</span>
                            <span className="text-[#8A9BB8]">· {f.type}{f.sensitive ? " · masked" : ""}{f.required ? " · required" : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface DocuFillMapperPanelProps {
  selectedPackage: PackageItem;
  selectedDocument: DocItem | null;
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;
  selectedPage: number;
  setSelectedPage: React.Dispatch<React.SetStateAction<number>>;
  nativePageW: number;
  nativePageH: number;
  effectiveScale: number;
  mapperViewW: number;
  mapperViewH: number;
  mapperScrollMode: boolean;
  setMapperScrollMode: (v: boolean) => void;
  userZoom: number;
  setUserZoom: React.Dispatch<React.SetStateAction<number>>;
  snapGrid: boolean;
  setSnapGrid: React.Dispatch<React.SetStateAction<boolean>>;
  documentPreviewUrl: string | null;
  acroAnnotations: AcroAnnotation[];
  showAcroLayer: boolean;
  setShowAcroLayer: React.Dispatch<React.SetStateAction<boolean>>;
  isPdfRendering: boolean;
  pdfRenderError: string | null;
  fieldLibrary: FieldLibraryItem[];
  inspectorMode: "panel" | "modal";
  setInspectorMode: (mode: "panel" | "modal") => void;
  placementModal: { mappingId: string; pdfX: number; pdfY: number } | null;
  setPlacementModal: (m: { mappingId: string; pdfX: number; pdfY: number } | null) => void;
  placementModalPos: { x: number; y: number } | null;
  setPlacementModalPos: (p: { x: number; y: number } | null) => void;
  recipientsExpanded: boolean;
  setRecipientsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  setRecipientPickerOpen: (v: boolean) => void;
  sortSensors: ReturnType<typeof useSensors>;
  isUploadingDocument: boolean;
  isSaving: boolean;
  showShortcutsPopover: boolean;
  setShowShortcutsPopover: React.Dispatch<React.SetStateAction<boolean>>;
  shortcutsPopoverRef: React.RefObject<HTMLDivElement | null>;
  beginMappingPointer: (e: React.MouseEvent | React.PointerEvent | React.TouchEvent, mappingId: string, mode: "move" | "resize", frameEl?: HTMLElement | null) => void;
  mappingStartedDocIds: Set<string>;
  selectedField: FieldItem | null;
  fieldDragFromHandle: React.MutableRefObject<boolean>;
  setSelectedFieldId: (id: string | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollPdfDoc: pdfjsLib.PDFDocumentProxy | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  pageFrameRef: React.RefObject<HTMLDivElement | null>;
  setMapperContainerEl: (el: HTMLElement | null) => void;
  goBuilderStep: (step: BuilderStep, opts?: { autoSort?: boolean; saveFirst?: boolean }) => void;
  savePackage: (pkg: PackageItem) => void;
  updateSelectedPackage: (updater: (pkg: PackageItem) => PackageItem, targetId?: number) => void;
  uploadDocument: (file: File, docId?: string) => void;
  removeDocument: (docId: string) => void;
  removeField: (fieldId: string) => void;
  removeSelectedMapping: () => void;
  updateSelectedMapping: (patch: Partial<MappingItem>) => void;
  chooseMappingFormat: (mappingId: string, format: MappingFormat | string) => void;
  duplicateMapping: (mappingId: string) => void;
  openFieldEditorForEdit: (fieldId: string) => void;
  openFieldEditorForAdd: () => void;
  autoMapFromPdfFields: () => void;
  dropFieldOnPage: (e: React.DragEvent<HTMLDivElement>, frameEl?: HTMLElement | null, pageNum?: number) => void;
  placeFieldAtCoords: (fieldId: string, clientX: number, clientY: number, frameEl?: HTMLElement | null, pageNum?: number) => void;
  updateFieldInPackage: (fieldId: string, patch: Partial<FieldItem>) => void;
  copyField: (fieldId: string) => void;
  addLibraryFieldToPackage: (item: FieldLibraryItem) => void;
  fieldGroups: FieldGroup[];
  addGroupToPackage: (group: FieldGroup) => void;
  removeRecipient: (id: string) => void;
  updateRecipient: (id: string, patch: Partial<RecipientItem>) => void;
  getAuthHeaders: () => HeadersInit;
  docufillApiPath: string;
  documentPreviewCache: React.MutableRefObject<Record<string, string>>;
  documentPreviewCacheOrder: React.MutableRefObject<string[]>;
}

export const DocuFillMapperPanel = React.memo(function DocuFillMapperPanel(props: DocuFillMapperPanelProps) {
  const {
    selectedPackage, selectedDocument, setSelectedDocumentId,
    selectedPage, setSelectedPage, nativePageW, nativePageH, effectiveScale,
    mapperViewW, mapperViewH, mapperScrollMode, setMapperScrollMode, userZoom, setUserZoom,
    snapGrid, setSnapGrid, documentPreviewUrl, acroAnnotations, showAcroLayer, setShowAcroLayer,
    isPdfRendering, pdfRenderError, fieldLibrary, inspectorMode, setInspectorMode,
    placementModal, setPlacementModal, setPlacementModalPos,
    recipientsExpanded, setRecipientsExpanded, setRecipientPickerOpen, sortSensors,
    isUploadingDocument, isSaving, showShortcutsPopover, setShowShortcutsPopover, shortcutsPopoverRef,
    beginMappingPointer, mappingStartedDocIds, selectedField, fieldDragFromHandle, setSelectedFieldId,
    scrollContainerRef, scrollPdfDoc, canvasRef, pageFrameRef, setMapperContainerEl,
    goBuilderStep, savePackage, updateSelectedPackage, uploadDocument, removeDocument,
    removeField, removeSelectedMapping, updateSelectedMapping, chooseMappingFormat, duplicateMapping,
    openFieldEditorForEdit, openFieldEditorForAdd, autoMapFromPdfFields, dropFieldOnPage, placeFieldAtCoords,
    updateFieldInPackage, copyField, addLibraryFieldToPackage, fieldGroups, addGroupToPackage, removeRecipient, updateRecipient,
    getAuthHeaders, docufillApiPath, documentPreviewCache, documentPreviewCacheOrder,
  } = props;

  // ── Internal store subscriptions (these fire at 60fps during drag/resize) ─
  const storeDragGuides = useDocuFillStore((s) => s.dragGuides);
  const storeResizeDim = useDocuFillStore((s) => s.resizeDim);
  const mapperTextMode = useDocuFillStore((s) => s.mapperTextMode);
  const setMapperTextMode = useDocuFillStore((s) => s.setMapperTextMode);
  const selectedMappingId = useDocuFillStore((s) => s.selectedMappingId);
  const setSelectedMappingId = useDocuFillStore((s) => s.setSelectedMappingId);
  const selectedMapping = useDocuFillStore((s) => s.mappings.find((m) => m.id === s.selectedMappingId) ?? null);
  const storeMappings = useDocuFillStore((s) => s.mappings);
  const storeRecipientList = useDocuFillStore((s) => s.recipientList);
  const pageMappingIds = useDocuFillStore(
    useShallow((s): string[] => {
      if (!selectedDocument) return [];
      const knownFieldIds = new Set(selectedPackage.fields.map((f) => f.id));
      return s.mappings
        .filter((m) => m.documentId === selectedDocument.id && (m.page ?? 1) === selectedPage && knownFieldIds.has(m.fieldId))
        .map((m) => m.id);
    }),
  );

  const packageMappedFieldIds = new Set(storeMappings.map((m) => m.fieldId));

  // ── Field list filter / sort / click-to-place ─────────────────────────────
  const [showUnplacedOnly, setShowUnplacedOnly] = useState(() => {
    try { return localStorage.getItem("docufill-field-filter-unplaced") === "1"; } catch { return false; }
  });
  const [fieldSort, setFieldSort] = useState<"default" | "alpha" | "unplaced-first">(() => {
    const v = (() => { try { return localStorage.getItem("docufill-field-sort"); } catch { return null; } })();
    return v === "alpha" || v === "unplaced-first" ? v : "default";
  });
  const [clickToPlaceFieldId, setClickToPlaceFieldId] = useState<string | null>(null);
  const clickToPlaceFrameRef = useRef<HTMLElement | null>(null);

  const displayFields = useMemo(() => {
    let fields = selectedPackage.fields;
    if (showUnplacedOnly) fields = fields.filter((f) => !packageMappedFieldIds.has(f.id));
    if (fieldSort === "alpha") {
      fields = [...fields].sort((a, b) => a.name.localeCompare(b.name));
    } else if (fieldSort === "unplaced-first") {
      fields = [...fields].sort((a, b) => (packageMappedFieldIds.has(a.id) ? 1 : 0) - (packageMappedFieldIds.has(b.id) ? 1 : 0));
    }
    return fields;
  }, [selectedPackage.fields, packageMappedFieldIds, showUnplacedOnly, fieldSort]);

  const isFiltered = showUnplacedOnly || fieldSort !== "default";
  const unplacedCount = selectedPackage.fields.filter((f) => !packageMappedFieldIds.has(f.id)).length;

  // Cancel click-to-place on Escape
  useEffect(() => {
    if (!clickToPlaceFieldId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setClickToPlaceFieldId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [clickToPlaceFieldId]);

  // Clear click-to-place when changing document/page
  useEffect(() => { setClickToPlaceFieldId(null); }, [selectedDocument?.id, selectedPage]);

  // Clear click-to-place if the target field is removed
  useEffect(() => {
    if (clickToPlaceFieldId && !selectedPackage.fields.find((f) => f.id === clickToPlaceFieldId)) {
      setClickToPlaceFieldId(null);
    }
  }, [selectedPackage.fields, clickToPlaceFieldId]);

  // Clear selectedMappingId when it is no longer on the current page
  useEffect(() => {
    if (!selectedMappingId) return;
    if (!pageMappingIds.includes(selectedMappingId)) setSelectedMappingId(null);
  }, [pageMappingIds, selectedMappingId, setSelectedMappingId]);

  return (
    <div className="grid lg:grid-cols-[190px_1fr_260px] gap-4 min-h-[720px] items-start">
      {/* ── Click-to-place banner ── */}
      {clickToPlaceFieldId && (() => {
        const activePlaceField = selectedPackage.fields.find((f) => f.id === clickToPlaceFieldId);
        return (
          <div className="fixed inset-x-0 top-14 z-[999] flex justify-center pointer-events-none" style={{ paddingTop: 4 }}>
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg shadow-xl border text-sm pointer-events-auto" style={{ background: "#0F1C3F", color: "white", borderColor: "#253762" }}>
              <Crosshair className="w-4 h-4 shrink-0" style={{ color: "#C49A38" }} />
              <span>Click on the document to place <strong className="font-semibold">{activePlaceField?.name ?? "field"}</strong></span>
              <button type="button" onClick={() => setClickToPlaceFieldId(null)} className="ml-2 text-xs opacity-60 hover:opacity-100 underline underline-offset-2">Cancel</button>
              <span className="opacity-30 text-xs">· Esc</span>
            </div>
          </div>
        );
      })()}
      {/* ── Left sidebar: recipients + documents ── */}
      <section className="bg-white border border-[#DDD5C4] rounded-lg p-3 flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <button type="button" onClick={() => setRecipientsExpanded((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-[#0F1C3F] hover:text-[#C49A38] transition-colors">
              <svg className={`w-3 h-3 transition-transform ${recipientsExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              Recipients
            </button>
            <button type="button" onClick={() => setRecipientPickerOpen(true)} className="text-xs text-[#C49A38] hover:underline">Add</button>
          </div>
          {recipientsExpanded && (
            <div className="space-y-1">
              {storeRecipientList.length === 0 ? (
                <p className="text-[11px] text-[#8A9BB8] italic px-1">No recipients yet.</p>
              ) : (
                storeRecipientList.map((r) => (
                  <div key={r.id} className="rounded border border-[#EFE8D8] bg-[#F8F6F0] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-1.5 py-1">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="text-[11px] text-[#0F1C3F] font-medium truncate flex-1">{r.label}</span>
                      <span className="text-[10px] text-[#8A9BB8] capitalize flex-shrink-0">{r.type === "customer" ? "cust." : r.type.slice(0, 4) + "."}</span>
                      <button type="button" onClick={() => removeRecipient(r.id)} className="text-[#8A9BB8] hover:text-red-500 flex-shrink-0 ml-0.5" title="Remove">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="border-t border-[#EFE8D8] px-1.5 py-1">
                      <input
                        type="email"
                        value={r.email ?? ""}
                        onChange={(e) => updateRecipient(r.id, { email: e.target.value })}
                        placeholder="Email address"
                        className="w-full bg-transparent text-[11px] text-[#0F1C3F] placeholder-[#B0BAD0] outline-none focus:placeholder-[#D4C9B5]"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="border-t border-[#EFE8D8]" />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold">Documents</h2>
            <label className={`text-xs ${isUploadingDocument ? "text-[#6B7A99] pointer-events-none opacity-50" : "text-[#C49A38] cursor-pointer"}`}>
              {isUploadingDocument ? "Uploading…" : "Add"}
              <input
                type="file"
                accept="application/pdf"
                disabled={isUploadingDocument}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  uploadDocument(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
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
          <SortableContext items={selectedPackage.documents.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 overflow-y-auto flex-1">
              {selectedPackage.documents.map((doc, index) => (
                <SortableItem key={doc.id} id={doc.id}>
                  {({ handleProps, wrapperRef, wrapperStyle, isDragging }) => (
                    <div
                      ref={wrapperRef}
                      style={wrapperStyle}
                      {...handleProps}
                      className={`border rounded p-2 transition-shadow cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-40 shadow-lg" : ""} ${selectedDocument?.id === doc.id ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4]"}`}
                    >
                      <DocumentPreviewTile
                        packageId={selectedPackage.id}
                        doc={doc}
                        order={index + 1}
                        selected={selectedDocument?.id === doc.id}
                        getAuthHeaders={getAuthHeaders}
                        docufillApiPath={docufillApiPath}
                        previewCache={documentPreviewCache}
                        previewCacheOrder={documentPreviewCacheOrder}
                        onSelect={() => { setSelectedDocumentId(doc.id); setSelectedPage(1); }}
                      />
                      <Input value={doc.title} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, documents: pkg.documents.map((d) => d.id === doc.id ? { ...d, title: e.target.value } : d) }))} className="mt-2 h-8 text-xs" />
                      <div className="mt-1 text-[10px] text-[#8A9BB8] truncate">{doc.fileName ?? "Metadata only"}</div>
                      <div className="flex gap-1 mt-1 items-center">
                        <label className={`text-[11px] ${isUploadingDocument ? "text-[#6B7A99] pointer-events-none opacity-50" : "text-[#C49A38] cursor-pointer"}`}>
                          {isUploadingDocument ? "Uploading…" : "Replace"}
                          <input type="file" accept="application/pdf" disabled={isUploadingDocument} className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDocument(file, doc.id); e.target.value = ""; }} />
                        </label>
                        <button onClick={() => removeDocument(doc.id)} className="ml-auto text-[11px] text-red-600">Remove</button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      {/* ── Center: toolbar + canvas ── */}
      <section ref={setMapperContainerEl} className="bg-white border border-[#DDD5C4] rounded-lg p-4">
        <div className="mb-2">
          <h2 className="text-sm font-semibold">Assign Package Fields and Rules</h2>
          <p className="text-xs text-[#8A9BB8]">Place fields on PDFs, then decide which are required, fixed/defaulted, validated, or omitted from the generated interview.</p>
        </div>

        {/* Toolbar */}
        <div className="sticky top-0 z-20 flex items-center bg-white border border-[#E0D8CC] rounded-lg px-2.5 py-1.5 mb-3 shadow-sm">
          <div className="shrink-0 flex items-center border border-[#DDD5C4] rounded-md overflow-hidden">
            <button type="button" title="Prev page [←]" onClick={() => setSelectedPage((p) => Math.max(1, p - 1))} disabled={!selectedDocument || selectedPage <= 1} className={`w-7 h-[26px] flex items-center justify-center text-[#6B7A8A] bg-white hover:bg-[#F8F5F0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${mapperScrollMode ? "invisible" : ""}`}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-medium text-[#4A5B6A] tabular-nums whitespace-nowrap select-none min-w-[3.2rem] text-center px-1 border-x border-[#DDD5C4] h-[26px] flex items-center justify-center">{selectedPage} / {Math.max(selectedDocument?.pages ?? 1, 1)}</span>
            <button type="button" title="Next page [→]" onClick={() => setSelectedPage((p) => Math.min(Math.max(selectedDocument?.pages ?? 1, 1), p + 1))} disabled={!selectedDocument || selectedPage >= Math.max(selectedDocument?.pages ?? 1, 1)} className={`w-7 h-[26px] flex items-center justify-center text-[#6B7A8A] bg-white hover:bg-[#F8F5F0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${mapperScrollMode ? "invisible" : ""}`}>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
            <div className="flex items-center border border-[#DDD5C4] rounded-md overflow-hidden shrink-0 text-[11px] font-medium" title="Toggle between viewing one page at a time or all pages stacked">
              <button type="button" onClick={() => setMapperScrollMode(false)} className={`flex items-center gap-1 px-2.5 h-[26px] leading-none transition-all ${!mapperScrollMode ? "bg-white text-[#1C2B4A] font-medium shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}>
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="2" width="12" height="12" rx="1.5" /></svg>
                Single
              </button>
              <div className="w-px h-full bg-[#DDD5C4] shrink-0" />
              <button type="button" onClick={() => setMapperScrollMode(true)} className={`flex items-center gap-1 px-2.5 h-[26px] leading-none transition-all ${mapperScrollMode ? "bg-white text-[#1C2B4A] font-medium shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}>
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}><rect x="2" y="1" width="12" height="5" rx="1" /><rect x="2" y="10" width="12" height="5" rx="1" /></svg>
                Scroll
              </button>
            </div>

            <div className="flex items-center border border-[#DDD5C4] rounded-md overflow-hidden shrink-0 text-[11px] font-medium">
              <button type="button" onClick={() => setUserZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))} className="w-7 h-[26px] flex items-center justify-center text-[#6B7A8A] bg-white hover:bg-[#F8F5F0] transition-colors" title="Zoom out [−]">−</button>
              <button type="button" onClick={() => setUserZoom(1)} className="px-1.5 h-[26px] flex items-center justify-center text-[#4A5B6A] bg-white hover:bg-[#F8F5F0] transition-colors tabular-nums min-w-[2.6rem] text-center border-x border-[#DDD5C4]" title="Reset zoom">{Math.round(userZoom * 100)}%</button>
              <button type="button" onClick={() => setUserZoom((z) => Math.min(4, parseFloat((z + 0.25).toFixed(2))))} className="w-7 h-[26px] flex items-center justify-center text-[#6B7A8A] bg-white hover:bg-[#F8F5F0] transition-colors" title="Zoom in [+]">+</button>
            </div>

            <div className="flex items-center border border-[#DDD5C4] rounded-md overflow-hidden shrink-0 text-[11px] font-medium">
              <button type="button" onClick={() => setMapperTextMode(true)} className={`px-2.5 h-[26px] leading-none transition-all ${mapperTextMode ? "bg-white text-[#1C2B4A] font-medium shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}>Text</button>
              <div className="w-px h-full bg-[#DDD5C4] shrink-0" />
              <button type="button" onClick={() => setMapperTextMode(false)} className={`px-2.5 h-[26px] leading-none transition-all ${!mapperTextMode ? "bg-white text-[#1C2B4A] font-medium shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}>Labels</button>
            </div>

            <button
              type="button"
              title={snapGrid ? "Snap to grid on — click to turn off [S]" : "Snap to grid off — click to turn on (4 pt grid) [S]"}
              onClick={() => setSnapGrid((v) => !v)}
              className={`flex items-center gap-1.5 text-[11px] font-medium border border-[#DDD5C4] rounded-md px-2.5 h-[26px] leading-none transition-all shrink-0 ${snapGrid ? "bg-white text-[#1C2B4A] shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <line x1="4" y1="0" x2="4" y2="16"/><line x1="8" y1="0" x2="8" y2="16"/><line x1="12" y1="0" x2="12" y2="16"/>
                <line x1="0" y1="4" x2="16" y2="4"/><line x1="0" y1="8" x2="16" y2="8"/><line x1="0" y1="12" x2="16" y2="12"/>
              </svg>
              Snap
            </button>

            {documentPreviewUrl && acroAnnotations.length > 0 && (
              <>
                <button type="button" onClick={() => setShowAcroLayer((v) => !v)} className={`text-[11px] font-medium border border-[#DDD5C4] rounded-md px-2.5 h-[26px] leading-none transition-all shrink-0 ${showAcroLayer ? "bg-white text-[#1C2B4A] shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}>
                  PDF Fields
                </button>
                {selectedDocument && (mappingStartedDocIds.has(selectedDocument.id) || (selectedPackage.fields.length ?? 0) > 0) && (
                  <button
                    type="button"
                    title={`Auto-create mappings from ${acroAnnotations.length} detected PDF form field${acroAnnotations.length === 1 ? "" : "s"} on this page`}
                    onClick={autoMapFromPdfFields}
                    className="flex items-center gap-1.5 text-[11px] font-medium border border-[#D4B96A] rounded-md px-2.5 h-[26px] leading-none bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A] transition-colors shrink-0"
                  >
                    <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6}>
                      <path d="M2 8h5M10 8h4M7 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Auto-map
                  </button>
                )}
              </>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            <button
              type="button"
              title={inspectorMode === "panel" ? "Switch to floating popup" : "Switch to side panel"}
              onClick={() => {
                const next = inspectorMode === "panel" ? "modal" : "panel";
                setInspectorMode(next);
                localStorage.setItem("docufill-inspector-mode", next);
                setPlacementModal(null);
              }}
              className="flex items-center gap-1.5 text-[11px] font-medium border border-[#DDD5C4] rounded-md px-2.5 h-[26px] leading-none bg-white text-[#6B7A8A] hover:bg-[#F8F5F0] hover:text-[#3A4A5A] transition-colors"
            >
              {inspectorMode === "panel" ? (
                <><svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" /></svg><span>Panel</span></>
              ) : (
                <><svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="5" y="5" width="14" height="14" rx="2" /><path strokeLinecap="round" d="M5 9h14" /></svg><span>Popup</span></>
              )}
            </button>

            <div ref={shortcutsPopoverRef} className="relative">
              <button
                type="button"
                title="Keyboard shortcuts"
                onClick={() => setShowShortcutsPopover((v) => !v)}
                className={`w-[26px] h-[26px] flex items-center justify-center rounded-md text-[11px] font-semibold border border-[#DDD5C4] transition-all ${showShortcutsPopover ? "bg-white text-[#1C2B4A] shadow-[inset_0_-2px_0_#C49A38]" : "bg-white text-[#8A9BB8] hover:bg-[#F8F5F0] hover:text-[#3A4A5A]"}`}
              >
                ?
              </button>
              {showShortcutsPopover && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white border border-[#DDD5C4] rounded-xl shadow-lg p-3 text-[11px]">
                  <div className="font-semibold text-[#3A2E1A] mb-2 pb-1.5 border-b border-[#EAE3D8]">Keyboard Shortcuts</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { keys: ["←", "→"], label: "Previous / next page" },
                      { keys: ["+", "−"], label: "Zoom in / out" },
                      { keys: ["S"], label: "Toggle snap to grid" },
                      { keys: ["Esc"], label: "Close popover / deselect" },
                      { keys: ["Delete", "Backspace"], label: "Remove selected field" },
                    ].map(({ keys, label }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-[#6B7A99]">{label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {keys.map((k) => (
                            <kbd key={k} className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded bg-[#F0EDE6] border border-[#DDD5C4] text-[#3A2E1A] font-mono text-[10px] leading-none">{k}</kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isUploadingDocument && <div className="mb-2 text-xs text-[#6B7A99]">Uploading PDF…</div>}

        {mapperScrollMode && selectedDocument && documentPreviewUrl && (
          <div
            ref={scrollContainerRef}
            className="bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner overflow-y-auto"
            style={{ width: mapperViewW, height: mapperViewH }}
            onScroll={(e) => {
              const container = e.currentTarget;
              const scaledPageH = Math.round(nativePageH * effectiveScale);
              const itemH = scaledPageH + 16;
              const topPad = 16;
              const scrollMid = container.scrollTop + container.clientHeight / 2;
              const idx = Math.floor((scrollMid - topPad) / itemH);
              const totalPages = Math.max(selectedDocument.pages ?? 1, 1);
              setSelectedPage(Math.max(1, Math.min(totalPages, idx + 1)));
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 0", alignItems: "flex-start" }}>
              {Array.from({ length: Math.max(selectedDocument.pages ?? 1, 1) }, (_, i) => i + 1).map((pageNum) => {
                const _knownFieldIds = new Set((selectedPackage.fields ?? []).map((f) => f.id));
                const pageMs = storeMappings.filter(
                  (m) => m.documentId === selectedDocument.id && m.page === pageNum && _knownFieldIds.has(m.fieldId)
                );
                return (
                  <div key={pageNum} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ width: Math.round(nativePageW * effectiveScale), height: Math.round(nativePageH * effectiveScale), position: "relative", flexShrink: 0 }}>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => dropFieldOnPage(e, e.currentTarget, pageNum)}
                        onClick={(e) => {
                          if (clickToPlaceFieldId) {
                            placeFieldAtCoords(clickToPlaceFieldId, e.clientX, e.clientY, e.currentTarget, pageNum);
                            setClickToPlaceFieldId(null);
                            return;
                          }
                          setSelectedPage(pageNum);
                          setPlacementModal(null);
                        }}
                        className="absolute top-0 left-0 bg-white border border-[#D4C9B5] shadow-sm overflow-hidden"
                        style={{ cursor: clickToPlaceFieldId ? "crosshair" : undefined, width: nativePageW, height: nativePageH, transform: `scale(${effectiveScale})`, transformOrigin: "top left" }}
                      >
                        <ScrollPageCanvas pageNum={pageNum} pdfDoc={scrollPdfDoc} nativeW={nativePageW} nativeH={nativePageH} />
                        {pageMs.map((m) => {
                          const field = selectedPackage.fields.find((f) => f.id === m.fieldId);
                          const recipient = m.recipientId ? storeRecipientList.find((r) => r.id === m.recipientId) : undefined;
                          const fieldColor = recipient?.color ?? (isSystemEsignFieldId(m.fieldId) ? "#9CA3AF" : (field?.color ?? "#C49A38"));
                          return (
                            <MappingButton
                              key={m.id}
                              mappingId={m.id}
                              fieldName={field?.name ?? "Field"}
                              sampleValue={sampleValueForMapping(field, m.format)}
                              formatLabel={labelForMappingFormat(m.format)}
                              fieldColor={fieldColor}
                              recipient={recipient}
                              onMoveStart={(e) => beginMappingPointer(e, m.id, "move", e.currentTarget.parentElement as HTMLElement)}
                              onResizeStart={(e) => beginMappingPointer(e, m.id, "resize", e.currentTarget.parentElement?.parentElement as HTMLElement)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPage(pageNum);
                                setSelectedMappingId(m.id);
                                setSelectedFieldId(m.fieldId);
                                if (inspectorMode === "panel") {
                                  setPlacementModal({ mappingId: m.id, pdfX: m.x, pdfY: m.y });
                                  setPlacementModalPos(null);
                                }
                              }}
                              onContextMenu={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                setSelectedPage(pageNum);
                                setSelectedMappingId(m.id); setSelectedFieldId(m.fieldId);
                                setPlacementModal({ mappingId: m.id, pdfX: m.x, pdfY: m.y });
                                setPlacementModalPos(null);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {mapperScrollMode && (!selectedDocument || !documentPreviewUrl) && (
          <div className="bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner flex items-center justify-center" style={{ width: mapperViewW, height: mapperViewH }}>
            <p className="text-xs text-[#8A9BB8]">{selectedDocument ? "Upload a PDF to enable scroll view." : "Select a document to get started."}</p>
          </div>
        )}
        {!mapperScrollMode && <div className="relative bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner overflow-auto" style={{ width: mapperViewW, height: mapperViewH }}>
          <div style={{ width: Math.round(nativePageW * effectiveScale), height: Math.round(nativePageH * effectiveScale), position: "relative", flexShrink: 0 }}>
          <div
            ref={pageFrameRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={dropFieldOnPage}
            onClick={(e) => {
              if (clickToPlaceFieldId) {
                placeFieldAtCoords(clickToPlaceFieldId, e.clientX, e.clientY, e.currentTarget);
                setClickToPlaceFieldId(null);
                return;
              }
              setPlacementModal(null);
            }}
            className="absolute top-0 left-0 bg-white border border-[#D4C9B5] shadow-sm overflow-hidden"
            style={{ cursor: clickToPlaceFieldId ? "crosshair" : undefined, width: nativePageW, height: nativePageH, transform: `scale(${effectiveScale})`, transformOrigin: "top left" }}
          >
            {documentPreviewUrl ? (
              <>
                <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: nativePageW, height: nativePageH }} />
                {isPdfRendering && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {pdfRenderError && !isPdfRendering && (
                  <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-2 pointer-events-none">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" /></svg>
                    <span className="text-xs text-red-600 text-center px-4">{pdfRenderError}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 p-6 text-xs text-[#6B7A99]">
                <div className="font-semibold text-[#0F1C3F] mb-3">{selectedDocument?.title ?? "No document selected"}</div>
                {selectedDocument ? (
                  <div className="rounded border border-dashed border-[#D4C9B5] p-5 text-center">Upload or replace this package document with a PDF to show a true page preview.</div>
                ) : (
                  Array.from({ length: 18 }).map((_, i) => <div key={i} className="h-2 bg-[#EFE8D8] rounded mb-3" style={{ width: `${70 + (i % 4) * 7}%` }} />)
                )}
              </div>
            )}
            {showAcroLayer && !isPdfRendering && acroAnnotations.map((ann, i) => {
              const [x1, y1, x2, y2] = ann.rect;
              return (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${(x1 / nativePageW) * 100}%`,
                    top: `${((nativePageH - y2) / nativePageH) * 100}%`,
                    width: `${((x2 - x1) / nativePageW) * 100}%`,
                    height: `${((y2 - y1) / nativePageH) * 100}%`,
                    border: "1px dashed rgba(37,99,235,0.45)",
                    backgroundColor: "rgba(37,99,235,0.04)",
                    boxSizing: "border-box",
                    zIndex: 1,
                  }}
                  title={ann.fieldName || `PDF ${ann.fieldType || "field"}`}
                >
                  {ann.fieldName ? (
                    <span className="block overflow-hidden whitespace-nowrap select-none leading-none" style={{ fontSize: "6px", color: "rgba(37,99,235,0.6)", paddingLeft: "1px", paddingTop: "1px" }}>
                      {ann.fieldName}
                    </span>
                  ) : null}
                </div>
              );
            })}
            {pageMappingIds.map((mappingId) => {
              const meta = storeMappings.find((m) => m.id === mappingId);
              if (!meta) return null;
              const field = selectedPackage.fields.find((f) => f.id === meta.fieldId);
              const recipient = meta.recipientId ? storeRecipientList.find((r) => r.id === meta.recipientId) : undefined;
              const fieldColor = recipient?.color ?? (isSystemEsignFieldId(meta.fieldId) ? "#9CA3AF" : (field?.color ?? "#C49A38"));
              const isFullyDefined = Boolean(field?.name && !field.name.match(/^Field \d+$/i) && (field.libraryFieldId || field.interviewMode));
              return (
                <MappingButton
                  key={mappingId}
                  mappingId={mappingId}
                  fieldName={field?.name ?? "Field"}
                  sampleValue={sampleValueForMapping(field, meta.format)}
                  formatLabel={labelForMappingFormat(meta.format)}
                  fieldColor={fieldColor}
                  recipient={recipient}
                  isFullyDefined={isFullyDefined}
                  onMoveStart={(e) => beginMappingPointer(e, mappingId, "move")}
                  onResizeStart={(e) => beginMappingPointer(e, mappingId, "resize")}
                  onClick={() => {
                    setSelectedMappingId(mappingId);
                    setSelectedFieldId(meta.fieldId);
                    if (inspectorMode === "panel") {
                      const fullM = useDocuFillStore.getState().mappings.find((m) => m.id === mappingId);
                      setPlacementModal({ mappingId, pdfX: fullM?.x ?? 0, pdfY: fullM?.y ?? 0 });
                      setPlacementModalPos(null);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setSelectedMappingId(mappingId); setSelectedFieldId(meta.fieldId);
                    const fullM = useDocuFillStore.getState().mappings.find((m) => m.id === mappingId);
                    setPlacementModal({ mappingId, pdfX: fullM?.x ?? 0, pdfY: fullM?.y ?? 0 });
                    setPlacementModalPos(null);
                  }}
                />
              );
            })}
            <DragGuideLines dragGuides={storeDragGuides} />
            {selectedMapping && (
              <ResizeDimTooltip
                x={selectedMapping.x ?? 0}
                y={selectedMapping.y ?? 0}
                w={selectedMapping.w ?? 26}
                h={selectedMapping.h ?? 6}
                resizeDim={storeResizeDim}
              />
            )}
          </div>
          </div>
        </div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={() => goBuilderStep("interview", { autoSort: true })} variant="outline">Review Generated Interview</Button>
          <Button
            onClick={() => savePackage(selectedPackage)}
            disabled={isSaving || (selectedPackage.fields.length === 0 && storeMappings.length === 0)}
          >
            {isSaving ? "Saving…" : `Save ${selectedPackage.fields.length} Fields / ${storeMappings.length} Placements`}
          </Button>
        </div>
      </section>

      {/* ── Right sidebar: inspector + field list ── */}
      <section className="bg-white border border-[#DDD5C4] rounded-lg flex flex-col min-h-0 overflow-hidden">
        {inspectorMode === "panel" && placementModal && (() => {
          const mapping = storeMappings.find((item) => item.id === placementModal.mappingId);
          if (!mapping) return null;
          const field = selectedPackage.fields.find((item) => item.id === mapping.fieldId);
          return (
            <FieldCard
              mapping={mapping}
              field={field}
              recipients={storeRecipientList}
              onClose={() => setPlacementModal(null)}
              onUpdateField={updateFieldInPackage}
              onUpdateMapping={updateSelectedMapping}
              onChooseMappingFormat={chooseMappingFormat}
              onCopyField={copyField}
              onDuplicateMapping={duplicateMapping}
              onRemoveMapping={() => { removeSelectedMapping(); setPlacementModal(null); }}
              onOpenFieldEditor={openFieldEditorForEdit}
            />
          );
        })()}
        <div className="p-3 flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
            <h2 className="text-sm font-semibold">Fields</h2>
            <button onClick={openFieldEditorForAdd} className="text-xs text-[#C49A38]">Add</button>
          </div>
          {/* Filter / sort controls */}
          <div className="flex items-center gap-1.5 mb-2 flex-shrink-0 flex-wrap">
            <div className="flex items-center border border-[#DDD5C4] rounded overflow-hidden text-[10px] font-medium leading-none">
              <button
                type="button"
                onClick={() => { setShowUnplacedOnly(false); try { localStorage.setItem("docufill-field-filter-unplaced", ""); } catch {} }}
                className={`px-2 h-[22px] transition-colors ${!showUnplacedOnly ? "bg-[#0F1C3F] text-white" : "bg-white text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
              >All</button>
              <button
                type="button"
                onClick={() => { setShowUnplacedOnly(true); try { localStorage.setItem("docufill-field-filter-unplaced", "1"); } catch {} }}
                className={`px-2 h-[22px] transition-colors ${showUnplacedOnly ? "bg-[#0F1C3F] text-white" : "bg-white text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
              >Unplaced{unplacedCount > 0 ? <span className="ml-0.5 opacity-70">({unplacedCount})</span> : null}</button>
            </div>
            <select
              value={fieldSort}
              onChange={(e) => {
                const v = e.target.value as typeof fieldSort;
                setFieldSort(v);
                try { localStorage.setItem("docufill-field-sort", v); } catch {}
              }}
              className="text-[10px] border border-[#DDD5C4] rounded bg-white text-[#6B7A99] h-[22px] px-1.5 leading-none cursor-pointer"
            >
              <option value="default">Order: default</option>
              <option value="alpha">Order: A–Z</option>
              <option value="unplaced-first">Order: unplaced first</option>
            </select>
          </div>
          {isFiltered && (
            <p className="text-[10px] text-[#8A9BB8] mb-1.5 flex-shrink-0 italic">
              {displayFields.length} of {selectedPackage.fields.length} · drag-to-reorder disabled while filtered
            </p>
          )}
          {(() => {
            const usedLibraryIds = new Set(selectedPackage.fields.map((f) => f.libraryFieldId).filter(Boolean));
            const availableLibraryFields = fieldLibrary.filter((item) => item.active && !usedLibraryIds.has(item.id));
            const esignPkgIds = new Set(selectedPackage.fields.filter((f) => f.source === "esign-system").map((f) => f.id));
            const availableEsignFields = SYSTEM_ESIGN_FIELDS.filter((sf) => !esignPkgIds.has(sf.id));
            if (availableLibraryFields.length === 0 && availableEsignFields.length === 0) return null;
            return (
              <label className="block mb-2 flex-shrink-0">
                <span className="block text-[11px] text-[#6B7A99] mb-1">Add from shared library</span>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (isSystemEsignFieldId(val)) {
                      updateSelectedPackage((pkg) => {
                        if (pkg.fields.find((f) => f.id === val)) return pkg;
                        const newField = makeSystemEsignFieldItem(val);
                        let fields = [newField, ...pkg.fields];
                        const needsAutoDate = (val === ESIGN_FIELD_ID_SIGNATURE || val === ESIGN_FIELD_ID_INITIALS);
                        if (needsAutoDate && !fields.find((f) => f.id === ESIGN_FIELD_ID_DATE)) {
                          const autoDate = makeSystemEsignFieldItem(ESIGN_FIELD_ID_DATE);
                          fields = [autoDate, ...fields];
                        }
                        return { ...pkg, fields };
                      });
                    } else {
                      const libraryField = fieldLibrary.find((item) => item.id === val);
                      if (libraryField) addLibraryFieldToPackage(libraryField);
                    }
                  }}
                  className="w-full border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="">Select reusable field</option>
                  {availableLibraryFields.some((f) => f.inherited) && (
                    <optgroup label="Inherited Library (read-only)">
                      {availableLibraryFields.filter((f) => f.inherited).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.category}</option>)}
                    </optgroup>
                  )}
                  {availableLibraryFields.some((f) => !f.inherited) && (
                    <optgroup label="Shared Library">
                      {availableLibraryFields.filter((f) => !f.inherited).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.category}</option>)}
                    </optgroup>
                  )}
                  {availableEsignFields.length > 0 && (
                    <optgroup label="E-Sign Fields">
                      {availableEsignFields.map((sf) => <option key={sf.id} value={sf.id}>{sf.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </label>
            );
          })()}
          <GroupPicker
            fieldGroups={fieldGroups}
            fieldLibrary={fieldLibrary}
            existingLibraryIds={new Set(selectedPackage.fields.map((f) => f.libraryFieldId).filter((id): id is string => Boolean(id)))}
            onUse={addGroupToPackage}
          />
          {inspectorMode === "panel" && storeMappings.length > 0 && (
            <p className="mb-2 text-[10px] text-[#8A9BB8] italic flex-shrink-0">Click a placement on the document to inspect it.</p>
          )}
          <div className="flex-1 min-h-0 flex flex-col">
            {(() => {
              const fieldRows = (
                <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
                  {selectedPackage.fields.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 px-3 text-center gap-2">
                      <svg className="w-6 h-6 text-[#C49A38]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      <p className="text-xs text-[#8A9BB8] leading-snug italic">No fields yet. Click <strong className="not-italic font-semibold text-[#C49A38]">Add</strong> above to create your first field, then drag it onto the document to place it.</p>
                    </div>
                  )}
                  {displayFields.length === 0 && selectedPackage.fields.length > 0 && (
                    <div className="flex flex-col items-center justify-center py-8 px-3 text-center gap-2">
                      <svg className="w-6 h-6 text-[#C49A38]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-xs text-[#8A9BB8] leading-snug italic">All fields are placed.</p>
                    </div>
                  )}
                  {isFiltered
                    ? displayFields.map((field) => {
                        const isActivePlacing = clickToPlaceFieldId === field.id;
                        return (
                          <div
                            key={field.id}
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData("text/field", field.id); }}
                            onDoubleClick={() => openFieldEditorForEdit(field.id)}
                            style={{ borderColor: isActivePlacing ? "#C49A38" : field.color }}
                            className={`w-full text-left border-2 rounded px-3 py-2 bg-white transition-shadow cursor-alias ${isActivePlacing ? "ring-2 ring-[#C49A38]/40 shadow-md" : ""} ${selectedField?.id === field.id ? "ring-2 ring-[#C49A38]/30" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <button type="button" onClick={() => setSelectedFieldId(field.id)} className="text-left flex-1 min-w-0">
                                  <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                    <span>{field.name}</span>
                                    {isSystemEsignFieldId(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5">E-Sign</span>}
                                    {!isSystemEsignFieldId(field.id) && field.libraryFieldId && (() => {
                                      const libField = fieldLibrary.find((lf) => lf.id === field.libraryFieldId);
                                      return libField?.inherited
                                        ? <span className="text-[10px] uppercase tracking-wide rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5" title={`Inherited from ${libField.inheritedFrom ?? "parent account"}`}>Inherited</span>
                                        : <span className="text-[10px] uppercase tracking-wide rounded bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8] px-1.5 py-0.5">Shared</span>;
                                    })()}
                                    {field.sensitive && <span className="text-[10px] uppercase tracking-wide rounded bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5">Sensitive</span>}
                                    {(field.condition?.fieldId || field.condition2?.fieldId) && <span className="text-[10px] uppercase tracking-wide rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5">Conditional</span>}
                                    {!packageMappedFieldIds.has(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5">No placement</span>}
                                  </div>
                                  <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.interviewMode ?? "optional"}{field.sensitive ? " · masked" : ""}</div>
                                </button>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setClickToPlaceFieldId(isActivePlacing ? null : field.id); }}
                                      className={`rounded border px-1.5 py-0.5 text-[10px] flex items-center gap-1 transition-colors ${isActivePlacing ? "border-[#C49A38] bg-[#C49A38] text-white" : "border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38] hover:text-[#C49A38]"}`}
                                      title="Click to place on document"
                                    ><Crosshair className="w-3 h-3" /></button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-xs">Click on document to place</TooltipContent>
                                </Tooltip>
                                {!isSystemEsignFieldId(field.id) && <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                                  className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-50 hover:border-red-300"
                                  title="Remove field"
                                >✕</button>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    : displayFields.map((field) => {
                        const isActivePlacing = clickToPlaceFieldId === field.id;
                        return (
                          <SortableItem key={field.id} id={field.id}>
                            {({ handleProps, wrapperRef, wrapperStyle, isDragging }) => (
                              <div
                                ref={wrapperRef}
                                style={{ ...wrapperStyle, borderColor: isActivePlacing ? "#C49A38" : field.color }}
                                draggable
                                onDragStart={(e) => {
                                  if (fieldDragFromHandle.current) { e.preventDefault(); return; }
                                  e.dataTransfer.setData("text/field", field.id);
                                }}
                                onDoubleClick={() => openFieldEditorForEdit(field.id)}
                                className={`w-full text-left border-2 rounded px-3 py-2 bg-white transition-shadow cursor-alias ${isDragging ? "opacity-40 shadow-lg" : ""} ${isActivePlacing ? "ring-2 ring-[#C49A38]/40 shadow-md" : ""} ${selectedField?.id === field.id ? "ring-2 ring-[#C49A38]/30" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <div
                                      {...handleProps}
                                      onPointerDown={(e) => {
                                        fieldDragFromHandle.current = true;
                                        (handleProps.onPointerDown as React.PointerEventHandler<HTMLDivElement>)?.(e);
                                      }}
                                      onPointerUp={() => { fieldDragFromHandle.current = false; }}
                                      onPointerCancel={() => { fieldDragFromHandle.current = false; }}
                                      title="Drag to reorder"
                                      className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-[#C4B89A] hover:text-[#A89878]"
                                    >
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                                        <circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/>
                                        <circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/>
                                        <circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
                                      </svg>
                                    </div>
                                    <button type="button" onClick={() => setSelectedFieldId(field.id)} className="text-left flex-1 min-w-0">
                                      <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                        <span>{field.name}</span>
                                        {isSystemEsignFieldId(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5">E-Sign</span>}
                                        {!isSystemEsignFieldId(field.id) && field.libraryFieldId && (() => {
                                          const libField = fieldLibrary.find((lf) => lf.id === field.libraryFieldId);
                                          return libField?.inherited
                                            ? <span className="text-[10px] uppercase tracking-wide rounded bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5" title={`Inherited from ${libField.inheritedFrom ?? "parent account"}`}>Inherited</span>
                                            : <span className="text-[10px] uppercase tracking-wide rounded bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8] px-1.5 py-0.5">Shared</span>;
                                        })()}
                                        {field.sensitive && <span className="text-[10px] uppercase tracking-wide rounded bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5">Sensitive</span>}
                                        {(field.condition?.fieldId || field.condition2?.fieldId) && <span className="text-[10px] uppercase tracking-wide rounded bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5">Conditional</span>}
                                        {!packageMappedFieldIds.has(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5">No placement</span>}
                                      </div>
                                      <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.interviewMode ?? "optional"}{field.sensitive ? " · masked" : ""}</div>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setClickToPlaceFieldId(isActivePlacing ? null : field.id); }}
                                          className={`rounded border px-1.5 py-0.5 text-[10px] flex items-center gap-1 transition-colors ${isActivePlacing ? "border-[#C49A38] bg-[#C49A38] text-white" : "border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38] hover:text-[#C49A38]"}`}
                                          title="Click to place on document"
                                        ><Crosshair className="w-3 h-3" /></button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="text-xs">Click on document to place</TooltipContent>
                                    </Tooltip>
                                    {!isSystemEsignFieldId(field.id) && <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                                      className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-50 hover:border-red-300"
                                      title="Remove field"
                                    >✕</button>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </SortableItem>
                        );
                      })}
                </div>
              );
              return isFiltered ? fieldRows : (
                <DndContext
                  sensors={sortSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event: DragEndEvent) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    updateSelectedPackage((pkg) => {
                      const oldIdx = pkg.fields.findIndex((f) => f.id === active.id);
                      const newIdx = pkg.fields.findIndex((f) => f.id === over.id);
                      return { ...pkg, fields: arrayMove(pkg.fields, oldIdx, newIdx) };
                    });
                  }}
                >
                  <SortableContext items={selectedPackage.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    {fieldRows}
                  </SortableContext>
                </DndContext>
              );
            })()}
          </div>
        </div>
      </section>
    </div>
  );
});
