import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDocupleteStore } from "@/stores/useDocupleteStore";
import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight, Crosshair } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DndContext, closestCenter, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESIGN_FIELD_ID_SIGNATURE, ESIGN_FIELD_ID_INITIALS, ESIGN_FIELD_ID_DATE, isSystemEsignFieldId } from "@/lib/docuplete-redaction";
import { type FieldItem, type MappingItem, type MappingFormat, type RecipientItem, type BrokenReference, type BrokenReferenceKind } from "@/lib/docuplete-types";
import type { DocItem, FieldLibraryItem, FieldGroup, PackageItem } from "@/lib/docuplete-local-types";
import { MappingButton } from "@/components/MappingButton";
import { FieldCard } from "@/components/FieldCard";
import { EmptyState } from "@/components/DocupletePanels";
import { DocumentPreviewTile } from "@/components/DocumentPreviewTile";
import { ScrollPageCanvas } from "@/components/DocupleteWidgets";
import { type BuilderStep, BUILDER_STEPS } from "@/components/PackagePickerSidebar";
import { SortableItem, DragGuideLines, ResizeDimTooltip } from "@/components/DocupleteDndHelpers";
import { labelForMappingFormat, sampleValueForMapping } from "@/lib/docuplete-mapping-utils";
import * as pdfjsLib from "pdfjs-dist";

const PDFJS_STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

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

type AcroAnnotation = { fieldName: string; rect: [number, number, number, number]; fieldType: string; page: number };

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

function LibraryFieldPicker({
  availableLibraryFields,
  availableEsignFields,
  fieldGroups,
  onSelect,
}: {
  availableLibraryFields: FieldLibraryItem[];
  availableEsignFields: Array<{ id: string; name: string }>;
  fieldGroups: FieldGroup[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(() => new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const q = search.toLowerCase();
  const matchesSearch = (label: string) => !q || label.toLowerCase().includes(q);

  const ownFields = availableLibraryFields.filter((f) => !f.inherited);
  const inheritedFields = availableLibraryFields.filter((f) => f.inherited);

  const groupedFieldIdSet = new Set(fieldGroups.flatMap((g) => g.fieldIds));
  const ungrouped = ownFields.filter((f) => !groupedFieldIdSet.has(f.id) && matchesSearch(f.label));
  const groupSections = fieldGroups
    .map((g) => ({ group: g, fields: ownFields.filter((f) => g.fieldIds.includes(f.id) && matchesSearch(f.label)) }))
    .filter(({ fields }) => fields.length > 0);
  const inheritedFiltered = inheritedFields.filter((f) => matchesSearch(f.label));
  const esignFiltered = availableEsignFields.filter((f) => matchesSearch(f.name));

  const hasAny = ungrouped.length > 0 || groupSections.length > 0 || inheritedFiltered.length > 0 || esignFiltered.length > 0;

  const toggleGroup = (id: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative mb-2 flex-shrink-0">
      <span className="block text-[11px] text-[#6B7A99] mb-1">Add from shared library</span>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setSearch(""); }}
        className="w-full flex items-center justify-between border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white text-[#6B7A99] hover:border-[#C49A38] transition-colors"
      >
        <span>Select reusable field</span>
        <svg className={`w-3.5 h-3.5 text-[#8A9BB8] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded border border-[#D4C9B5] bg-white shadow-lg max-h-72 flex flex-col overflow-hidden">
          <div className="px-2 py-1.5 border-b border-[#EFE8D8] flex-shrink-0">
            <input
              autoFocus
              type="text"
              placeholder="Search fields…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs focus:outline-none bg-transparent placeholder:text-[#B0BCCF]"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {!hasAny && (
              <div className="px-3 py-4 text-[11px] text-center text-[#8A9BB8]">
                {search ? `No fields match "${search}"` : "No fields available to add."}
              </div>
            )}

            {/* Ungrouped shared fields */}
            {ungrouped.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A9BB8] bg-[#F8F6F0]">
                  Shared Library
                </div>
                {ungrouped.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#FDF8EE] transition-colors"
                  >
                    <span className="font-medium text-[#0F1C3F]">{item.label}</span>
                    <span className="ml-1.5 text-[#8A9BB8]">· {item.category}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Group sections */}
            {groupSections.map(({ group, fields }) => {
              const expanded = expandedGroups.has(group.id);
              return (
                <div key={group.id}>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A9BB8] bg-[#F8F6F0] hover:bg-[#F0EBE1] transition-colors"
                  >
                    <span>{group.name}</span>
                    <span className="flex items-center gap-1 normal-case font-normal text-[#B0BCCF]">
                      <span>{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
                      <svg className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </span>
                  </button>
                  {expanded && fields.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className="w-full text-left pl-5 pr-3 py-1.5 text-[11px] hover:bg-[#FDF8EE] transition-colors"
                    >
                      <span className="font-medium text-[#0F1C3F]">{item.label}</span>
                      <span className="ml-1.5 text-[#8A9BB8]">· {item.category}</span>
                    </button>
                  ))}
                </div>
              );
            })}

            {/* Inherited fields */}
            {inheritedFiltered.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A9BB8] bg-[#F8F6F0]">
                  Inherited Library (read-only)
                </div>
                {inheritedFiltered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#FDF8EE] transition-colors"
                  >
                    <span className="font-medium text-[#0F1C3F]">{item.label}</span>
                    <span className="ml-1.5 text-[#8A9BB8]">· {item.category}</span>
                  </button>
                ))}
              </div>
            )}

            {/* E-Sign fields */}
            {esignFiltered.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A9BB8] bg-[#F8F6F0]">
                  E-Sign Fields
                </div>
                {esignFiltered.map((sf) => (
                  <button
                    key={sf.id}
                    type="button"
                    onClick={() => handleSelect(sf.id)}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#FDF8EE] transition-colors"
                  >
                    <span className="font-medium text-[#0F1C3F]">{sf.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-doc scroll helpers ─────────────────────────────────────────────────
const MDSCROLL_DOC_HEADER_H = 40;
const MDSCROLL_PAGE_GAP = 16;
const MDSCROLL_TOP_PAD = 16;

function buildMultiDocPageIndex(
  docs: Array<{ id: string; pages?: number | null }>,
  scaledPageH: number,
): Array<{ docId: string; pageNum: number; pageTop: number }> {
  const items: Array<{ docId: string; pageNum: number; pageTop: number }> = [];
  let y = MDSCROLL_TOP_PAD;
  for (const doc of docs) {
    y += MDSCROLL_DOC_HEADER_H + MDSCROLL_PAGE_GAP;
    const pages = Math.max(doc.pages ?? 1, 1);
    for (let p = 1; p <= pages; p++) {
      items.push({ docId: doc.id, pageNum: p, pageTop: y });
      y += scaledPageH + MDSCROLL_PAGE_GAP;
    }
  }
  return items;
}

function brokenRefKindLabel(kind: BrokenReferenceKind): string {
  switch (kind) {
    case "condition":        return "visibility condition (primary)";
    case "condition2":       return "visibility condition (secondary)";
    case "copyFrom_trigger": return "auto-fill trigger";
    case "copyFrom_source":  return "auto-fill source field";
  }
}

export interface DocupleteMapperPanelProps {
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
  autoSaveStatus: "idle" | "pending" | "saving" | "saved" | "error";
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
  brokenRefs?: BrokenReference[];
  fieldGroups: FieldGroup[];
  addGroupToPackage: (group: FieldGroup) => void;
  removeRecipient: (id: string) => void;
  updateRecipient: (id: string, patch: Partial<RecipientItem>) => void;
  getAuthHeaders: () => HeadersInit;
  docupleteApiPath: string;
  documentPreviewCache: React.MutableRefObject<Record<string, string>>;
  documentPreviewCacheOrder: React.MutableRefObject<string[]>;
}

export const DocupleteMapperPanel = React.memo(function DocupleteMapperPanel(props: DocupleteMapperPanelProps) {
  const {
    selectedPackage, selectedDocument, selectedDocumentId, setSelectedDocumentId,
    selectedPage, setSelectedPage, nativePageW, nativePageH, effectiveScale,
    mapperViewW, mapperViewH, mapperScrollMode, setMapperScrollMode, userZoom, setUserZoom,
    snapGrid, setSnapGrid, documentPreviewUrl, acroAnnotations, showAcroLayer, setShowAcroLayer,
    isPdfRendering, pdfRenderError, fieldLibrary, inspectorMode, setInspectorMode,
    placementModal, setPlacementModal, setPlacementModalPos,
    recipientsExpanded, setRecipientsExpanded, setRecipientPickerOpen, sortSensors,
    isUploadingDocument, isSaving, autoSaveStatus, showShortcutsPopover, setShowShortcutsPopover, shortcutsPopoverRef,
    beginMappingPointer, mappingStartedDocIds, selectedField, fieldDragFromHandle, setSelectedFieldId,
    scrollContainerRef, scrollPdfDoc, canvasRef, pageFrameRef, setMapperContainerEl,
    goBuilderStep, savePackage, updateSelectedPackage, uploadDocument, removeDocument,
    removeField, removeSelectedMapping, updateSelectedMapping, chooseMappingFormat, duplicateMapping,
    openFieldEditorForEdit, openFieldEditorForAdd, autoMapFromPdfFields, dropFieldOnPage, placeFieldAtCoords,
    updateFieldInPackage, copyField, addLibraryFieldToPackage, fieldGroups, addGroupToPackage, removeRecipient, updateRecipient,
    getAuthHeaders, docupleteApiPath, documentPreviewCache, documentPreviewCacheOrder,
    brokenRefs,
  } = props;

  // ── Internal store subscriptions (these fire at 60fps during drag/resize) ─
  const storeDragGuides = useDocupleteStore((s) => s.dragGuides);
  const storeResizeDim = useDocupleteStore((s) => s.resizeDim);
  const mapperTextMode = useDocupleteStore((s) => s.mapperTextMode);
  const setMapperTextMode = useDocupleteStore((s) => s.setMapperTextMode);
  const selectedMappingId = useDocupleteStore((s) => s.selectedMappingId);
  const setSelectedMappingId = useDocupleteStore((s) => s.setSelectedMappingId);
  const selectedMapping = useDocupleteStore((s) => s.mappings.find((m) => m.id === s.selectedMappingId) ?? null);
  const storeMappings = useDocupleteStore((s) => s.mappings);
  const storeRemoveMapping = useDocupleteStore((s) => s.removeMapping);
  const storeSetMappings = useDocupleteStore((s) => s.setMappings);
  const storePushUndo = useDocupleteStore((s) => s.pushUndo);
  const storeRecipientList = useDocupleteStore((s) => s.recipientList);
  const pageMappingIds = useDocupleteStore(
    useShallow((s): string[] => {
      if (!selectedDocument) return [];
      const knownFieldIds = new Set(selectedPackage.fields.map((f) => f.id));
      return s.mappings
        .filter((m) => m.documentId === selectedDocument.id && (m.page ?? 1) === selectedPage && knownFieldIds.has(m.fieldId))
        .map((m) => m.id);
    }),
  );

  const packageMappedFieldIds = new Set(storeMappings.map((m) => m.fieldId));
  const fieldBrokenRefMap = useMemo(() => {
    const map = new Map<string, typeof brokenRefs>();
    for (const ref of brokenRefs ?? []) {
      const existing = map.get(ref.affectedFieldId) ?? [];
      map.set(ref.affectedFieldId, [...existing, ref]);
    }
    return map;
  }, [brokenRefs]);

  // ── Field list filter / sort / click-to-place ─────────────────────────────
  const [showUnplacedOnly, setShowUnplacedOnly] = useState(() => {
    try { return localStorage.getItem("docuplete-field-filter-unplaced") === "1"; } catch { return false; }
  });
  const [fieldSort, setFieldSort] = useState<"default" | "alpha" | "unplaced-first">(() => {
    const v = (() => { try { return localStorage.getItem("docuplete-field-sort"); } catch { return null; } })();
    return v === "alpha" || v === "unplaced-first" ? v : "default";
  });
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("docuplete-mapper-left-panel");
      if (saved !== null) return saved === "true";
    } catch { /* ignore */ }
    return typeof window !== "undefined" ? window.innerWidth >= 1300 : true;
  });
  useEffect(() => {
    try { localStorage.setItem("docuplete-mapper-left-panel", leftPanelOpen ? "true" : "false"); } catch { /* ignore */ }
  }, [leftPanelOpen]);

  const [clickToPlaceFieldId, setClickToPlaceFieldId] = useState<string | null>(null);
  const clickToPlaceFrameRef = useRef<HTMLElement | null>(null);
  const fieldListScrollRef = useRef<HTMLDivElement | null>(null);

  // ── Multi-doc scroll state ────────────────────────────────────────────────
  const [multiScrollPdfDocs, setMultiScrollPdfDocs] = useState<Record<string, pdfjsLib.PDFDocumentProxy | null>>({});
  const multiScrollPdfDocRefsMap = useRef<Record<string, pdfjsLib.PDFDocumentProxy | null>>({});
  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;
  const isUserScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current page value so the scroll-on-toggle effect can read it
  // without needing it in the dependency array (which would cause scroll jank).
  const selectedPageRef = useRef(selectedPage);
  useEffect(() => { selectedPageRef.current = selectedPage; }, [selectedPage]);
  // Track the previous scroll-mode value to detect the toggle-on moment.
  const prevScrollModeRef = useRef(mapperScrollMode);

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

  // Orphaned mappings: placed slots whose target field no longer exists in the package.
  // These render blank in generated PDFs. Computed once; re-checked whenever fields or
  // mappings change (e.g. after a field is deleted and re-added with a new ID).
  const orphanedMappings = useMemo(() => {
    const knownFieldIds = new Set(selectedPackage.fields.map((f) => f.id));
    return storeMappings.filter((m) => m.fieldId && !knownFieldIds.has(m.fieldId));
  }, [storeMappings, selectedPackage.fields]);

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

  // Scroll the active field card into view whenever the selected field changes.
  // If the field is filtered out (unplaced-only mode), clear the filter first so
  // the card becomes visible, then scroll on the next effect run.
  useEffect(() => {
    if (!selectedField?.id) return;
    const el = fieldListScrollRef.current?.querySelector(`[data-field-id="${selectedField.id}"]`);
    if (!el) {
      if (showUnplacedOnly) {
        setShowUnplacedOnly(false);
        try { localStorage.setItem("docuplete-field-filter-unplaced", ""); } catch {}
      }
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedField?.id, showUnplacedOnly]);

  // ── Load PDFs for all docs when scroll mode is active ────────────────────
  useEffect(() => {
    if (!mapperScrollMode) {
      Object.values(multiScrollPdfDocRefsMap.current).forEach((d) => d?.destroy().catch(() => {}));
      multiScrollPdfDocRefsMap.current = {};
      setMultiScrollPdfDocs({});
      return;
    }
    let cancelled = false;
    const docsToLoad = selectedPackage.documents.filter((d) => d.pdfStored);
    (async () => {
      for (const doc of docsToLoad) {
        if (cancelled) break;
        const cacheKey = `${selectedPackage.id}:${doc.id}`;
        let blobUrl = documentPreviewCache.current[cacheKey];
        if (!blobUrl) {
          try {
            const res = await fetch(
              `${docupleteApiPath}/packages/${selectedPackage.id}/documents/${doc.id}.pdf`,
              { headers: { ...getAuthHeadersRef.current() } },
            );
            if (!res.ok || cancelled) { setMultiScrollPdfDocs((p) => ({ ...p, [doc.id]: null })); continue; }
            const blob = await res.blob();
            if (cancelled) break;
            blobUrl = URL.createObjectURL(blob);
            documentPreviewCacheOrder.current.push(cacheKey);
            documentPreviewCache.current[cacheKey] = blobUrl;
            while (documentPreviewCacheOrder.current.length > 8) {
              const oldest = documentPreviewCacheOrder.current.shift();
              if (oldest) { const u = documentPreviewCache.current[oldest]; if (u) { URL.revokeObjectURL(u); delete documentPreviewCache.current[oldest]; } }
            }
          } catch { setMultiScrollPdfDocs((p) => ({ ...p, [doc.id]: null })); continue; }
        }
        if (cancelled) break;
        try {
          const pdfDoc = await pdfjsLib.getDocument({ url: blobUrl, standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL }).promise;
          if (cancelled) { pdfDoc.destroy(); break; }
          multiScrollPdfDocRefsMap.current = { ...multiScrollPdfDocRefsMap.current, [doc.id]: pdfDoc };
          setMultiScrollPdfDocs((p) => ({ ...p, [doc.id]: pdfDoc }));
        } catch { setMultiScrollPdfDocs((p) => ({ ...p, [doc.id]: null })); }
      }
    })();
    return () => {
      cancelled = true;
      Object.values(multiScrollPdfDocRefsMap.current).forEach((d) => d?.destroy().catch(() => {}));
      multiScrollPdfDocRefsMap.current = {};
      setMultiScrollPdfDocs({});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapperScrollMode, selectedPackage.id, selectedPackage.documents]);

  // ── When left panel selection changes, scroll the multi-doc view to match ─
  useEffect(() => {
    if (!mapperScrollMode || !scrollContainerRef.current || !selectedDocumentId || isUserScrollingRef.current) return;
    const scaledPageH = Math.round(nativePageH * effectiveScale);
    const items = buildMultiDocPageIndex(selectedPackage.documents, scaledPageH);

    // When the user just toggled INTO scroll mode, land on the exact page they
    // were viewing in paginated mode (selectedPageRef holds the current value).
    // When the selected document changes via the left panel, scroll to its start.
    const justToggledOn = !prevScrollModeRef.current && mapperScrollMode;
    prevScrollModeRef.current = mapperScrollMode;

    const targetItem = justToggledOn
      ? (items.find((item) => item.docId === selectedDocumentId && item.pageNum === selectedPageRef.current)
          ?? items.find((item) => item.docId === selectedDocumentId))
      : items.find((item) => item.docId === selectedDocumentId);

    if (targetItem) {
      scrollContainerRef.current.scrollTo({ top: Math.max(0, targetItem.pageTop - MDSCROLL_TOP_PAD - 4), behavior: "smooth" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentId, mapperScrollMode]);

  return (
    <div className="grid gap-4 items-stretch" style={{ height: 'calc(100vh - 220px)', minHeight: '620px', gridTemplateColumns: leftPanelOpen ? '190px 1fr 260px' : '32px 1fr 260px', transition: 'grid-template-columns 150ms ease' }}>
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
      <section className="bg-white border border-[#DDD5C4] rounded-lg flex flex-col h-full overflow-hidden" style={{ transition: 'width 150ms ease' }}>
        {/* Collapsed strip */}
        {!leftPanelOpen && (
          <button
            type="button"
            onClick={() => setLeftPanelOpen(true)}
            className="relative flex flex-col items-center w-full h-full pt-2 pb-3 gap-2.5 cursor-pointer hover:bg-[#F8F5F0] transition-colors rounded-lg overflow-hidden"
            title="Expand panel"
          >
            {/* Chevron pinned to bottom-right edge — clear of all icons */}
            <ChevronRight className="absolute right-0.5 bottom-2 w-3.5 h-3.5 text-[#8A9BB8]" />
            {/* Recipients icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[#C4B99A]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Recipients ({storeRecipientList.length})</TooltipContent>
            </Tooltip>
            <div className="w-full border-t border-[#EFE8D8] mx-1" />
            {/* One doc icon per uploaded document */}
            {selectedPackage.documents.map((doc) => (
              <Tooltip key={doc.id}>
                <TooltipTrigger asChild>
                  <span className={`relative flex items-center justify-center ${selectedDocument?.id === doc.id ? "text-[#C49A38]" : "text-[#C4B99A]"}`}>
                    {selectedDocument?.id === doc.id && <span className="absolute -left-2 top-0 bottom-0 w-0.5 bg-[#C49A38] rounded-full" />}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">{doc.title || doc.fileName || "Untitled"}</TooltipContent>
              </Tooltip>
            ))}
            {selectedPackage.documents.length === 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[#DDD5C4]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">No documents yet</TooltipContent>
              </Tooltip>
            )}
          </button>
        )}
        {/* Expanded content */}
        {leftPanelOpen && <div className="p-3 flex flex-col gap-3 h-full overflow-hidden">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <button type="button" onClick={() => setRecipientsExpanded((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-[#0F1C3F] hover:text-[#C49A38] transition-colors">
              <svg className={`w-3 h-3 transition-transform ${recipientsExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              Recipients
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setRecipientPickerOpen(true)} className="text-xs text-[#C49A38] hover:underline">Add</button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => setLeftPanelOpen(false)} className="text-[#B0BAD0] hover:text-[#8A9BB8] transition-colors" title="Collapse panel">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse panel</TooltipContent>
              </Tooltip>
            </div>
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
            <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
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
                        docupleteApiPath={docupleteApiPath}
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
        </div>}
      </section>

      {/* ── Center: toolbar + canvas ── */}
      <section ref={setMapperContainerEl} className="bg-white border border-[#DDD5C4] rounded-lg p-4 overflow-y-auto flex flex-col h-full">
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
                localStorage.setItem("docuplete-inspector-mode", next);
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

        {mapperScrollMode && (
          <div
            ref={scrollContainerRef}
            className="bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner overflow-y-auto"
            style={{ width: mapperViewW, height: mapperViewH }}
            onScroll={(e) => {
              if (selectedPackage.documents.length === 0) return;
              const container = e.currentTarget;
              const scaledPageH = Math.round(nativePageH * effectiveScale);
              const scrollMid = container.scrollTop + container.clientHeight / 2;
              const items = buildMultiDocPageIndex(selectedPackage.documents, scaledPageH);
              if (items.length === 0) return;
              let best = items[0]!;
              let bestDist = Math.abs(scrollMid - (best.pageTop + scaledPageH / 2));
              for (const item of items) {
                const dist = Math.abs(scrollMid - (item.pageTop + scaledPageH / 2));
                if (dist < bestDist) { bestDist = dist; best = item; }
              }
              isUserScrollingRef.current = true;
              if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
              userScrollTimerRef.current = setTimeout(() => { isUserScrollingRef.current = false; }, 300);
              setSelectedDocumentId(best.docId);
              setSelectedPage(best.pageNum);
            }}
          >
            {selectedPackage.documents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-[#8A9BB8]">No documents in this package yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", padding: `${MDSCROLL_TOP_PAD}px 0 ${MDSCROLL_PAGE_GAP}px`, alignItems: "flex-start" }}>
                {selectedPackage.documents.map((doc, docIdx) => {
                  const scaledW = Math.round(nativePageW * effectiveScale);
                  const scaledH = Math.round(nativePageH * effectiveScale);
                  const pdfDoc = multiScrollPdfDocs[doc.id] ?? null;
                  const isSelectedDoc = selectedDocumentId === doc.id;
                  const knownFieldIds = new Set(selectedPackage.fields.map((f) => f.id));
                  return (
                    <div key={doc.id} style={{ display: "flex", flexDirection: "column", width: scaledW }}>
                      {/* Document separator */}
                      <div style={{
                        height: MDSCROLL_DOC_HEADER_H,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        paddingLeft: 4,
                        paddingRight: 4,
                        marginBottom: MDSCROLL_PAGE_GAP,
                        borderBottom: `2px solid ${isSelectedDoc ? "#C49A38" : "#DDD5C4"}`,
                      }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1,
                          backgroundColor: isSelectedDoc ? "#C49A38" : "#DDD5C4",
                          color: isSelectedDoc ? "#FFF" : "#8A9BB8",
                          borderRadius: 3,
                          padding: "2px 5px",
                          flexShrink: 0,
                        }}>
                          {docIdx + 1}
                        </span>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isSelectedDoc ? "#8A6520" : "#3A4A5A",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {doc.title || doc.fileName || `Document ${docIdx + 1}`}
                        </span>
                        {!doc.pdfStored && (
                          <span style={{ fontSize: 10, color: "#8A9BB8", fontStyle: "italic", flexShrink: 0 }}>no PDF</span>
                        )}
                      </div>
                      {/* Pages for this document */}
                      {!doc.pdfStored ? (
                        <div style={{ width: scaledW, height: scaledH, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #DDD5C4", backgroundColor: "#FFF", marginBottom: MDSCROLL_PAGE_GAP }}>
                          <span style={{ fontSize: 11, color: "#8A9BB8", fontStyle: "italic" }}>Upload a PDF to preview</span>
                        </div>
                      ) : !pdfDoc ? (
                        <div style={{ width: scaledW, height: scaledH, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #DDD5C4", backgroundColor: "#FFF", marginBottom: MDSCROLL_PAGE_GAP }}>
                          <div className="w-5 h-5 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        Array.from({ length: Math.max(doc.pages ?? 1, 1) }, (_, i) => i + 1).map((pageNum) => {
                          const pageMs = storeMappings.filter(
                            (m) => m.documentId === doc.id && (m.page ?? 1) === pageNum && knownFieldIds.has(m.fieldId)
                          );
                          return (
                            <div key={pageNum} style={{ marginBottom: MDSCROLL_PAGE_GAP, width: scaledW, height: scaledH, position: "relative", flexShrink: 0 }}>
                              <div
                                onDragOver={(e) => { e.preventDefault(); if (selectedDocumentId !== doc.id) setSelectedDocumentId(doc.id); }}
                                onDrop={(e) => { setSelectedDocumentId(doc.id); dropFieldOnPage(e, e.currentTarget, pageNum); }}
                                onClick={(e) => {
                                  if (clickToPlaceFieldId) {
                                    setSelectedDocumentId(doc.id);
                                    placeFieldAtCoords(clickToPlaceFieldId, e.clientX, e.clientY, e.currentTarget, pageNum);
                                    setClickToPlaceFieldId(null);
                                    return;
                                  }
                                  setSelectedDocumentId(doc.id);
                                  setSelectedPage(pageNum);
                                  setPlacementModal(null);
                                }}
                                className="absolute top-0 left-0 bg-white border border-[#D4C9B5] shadow-sm overflow-hidden"
                                style={{ cursor: clickToPlaceFieldId ? "crosshair" : undefined, width: nativePageW, height: nativePageH, transform: `scale(${effectiveScale})`, transformOrigin: "top left" }}
                              >
                                <ScrollPageCanvas pageNum={pageNum} pdfDoc={pdfDoc} nativeW={nativePageW} nativeH={nativePageH} />
                                {pageMs.map((m) => {
                                  const field = selectedPackage.fields.find((f) => f.id === m.fieldId);
                                  const recipient = m.recipientId ? storeRecipientList.find((r) => r.id === m.recipientId) : undefined;
                                  const fieldColor = recipient?.color ?? (isSystemEsignFieldId(m.fieldId) ? "#9CA3AF" : (field?.color ?? "#C49A38"));
                                  return (
                                    <MappingButton
                                      key={m.id}
                                      mappingId={m.id}
                                      fieldName={field?.name ?? "Field"}
                                      sampleValue={sampleValueForMapping(field, m.format, m.mark)}
                                      formatLabel={labelForMappingFormat(m.format)}
                                      fieldColor={fieldColor}
                                      fieldType={field?.type}
                                      recipient={recipient}
                                      onMoveStart={(e) => beginMappingPointer(e, m.id, "move", e.currentTarget.parentElement as HTMLElement)}
                                      onResizeStart={(e) => beginMappingPointer(e, m.id, "resize", e.currentTarget.parentElement?.parentElement as HTMLElement)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDocumentId(doc.id);
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
                                        setSelectedDocumentId(doc.id);
                                        setSelectedPage(pageNum);
                                        setSelectedMappingId(m.id); setSelectedFieldId(m.fieldId);
                                        setPlacementModal({ mappingId: m.id, pdfX: m.x, pdfY: m.y });
                                        setPlacementModalPos(null);
                                      }}
                                    />
                                  );
                                })}
                                {(() => {
                                  const activeMappingId = selectedMappingId;
                                  const activeM = storeMappings.find((m) => m.id === activeMappingId);
                                  const isThisPage = activeM?.documentId === doc.id && (activeM?.page ?? 1) === pageNum;
                                  return isThisPage ? <DragGuideLines dragGuides={storeDragGuides} /> : null;
                                })()}
                                {showAcroLayer && acroAnnotations
                                  .filter((ann) => ann.page === pageNum)
                                  .map((ann, i) => {
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
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                  sampleValue={sampleValueForMapping(field, meta.format, meta.mark)}
                  formatLabel={labelForMappingFormat(meta.format)}
                  fieldColor={fieldColor}
                  fieldType={field?.type}
                  recipient={recipient}
                  isFullyDefined={isFullyDefined}
                  onMoveStart={(e) => beginMappingPointer(e, mappingId, "move")}
                  onResizeStart={(e) => beginMappingPointer(e, mappingId, "resize")}
                  onClick={() => {
                    setSelectedMappingId(mappingId);
                    setSelectedFieldId(meta.fieldId);
                    if (inspectorMode === "panel") {
                      const fullM = useDocupleteStore.getState().mappings.find((m) => m.id === mappingId);
                      setPlacementModal({ mappingId, pdfX: fullM?.x ?? 0, pdfY: fullM?.y ?? 0 });
                      setPlacementModalPos(null);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    setSelectedMappingId(mappingId); setSelectedFieldId(meta.fieldId);
                    const fullM = useDocupleteStore.getState().mappings.find((m) => m.id === mappingId);
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
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {autoSaveStatus !== "idle" && (
            <span className={`text-xs ${
              autoSaveStatus === "saved"  ? "text-green-600" :
              autoSaveStatus === "error"  ? "text-amber-600" :
              "text-[#8A9BB8]"
            }`}>
              {autoSaveStatus === "pending" ? "Changes pending…" :
               autoSaveStatus === "saving"  ? "Auto-saving…" :
               autoSaveStatus === "saved"   ? "Auto-saved ✓" :
               "Auto-save failed — save manually"}
            </span>
          )}
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
          {/* Orphaned mapping warning */}
          {orphanedMappings.length > 0 && (
            <div className="mb-2 flex-shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-amber-800">
                  {orphanedMappings.length} placed slot{orphanedMappings.length === 1 ? "" : "s"} point to a removed field
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const orphanIds = new Set(orphanedMappings.map((m) => m.id));
                    storePushUndo([...storeMappings]);
                    storeSetMappings(storeMappings.filter((m) => !orphanIds.has(m.id)));
                  }}
                  className="shrink-0 rounded bg-amber-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-700 transition-colors"
                >
                  Remove all
                </button>
              </div>
              <p className="text-amber-700 mt-0.5">
                {orphanedMappings.length === 1
                  ? "This slot will be blank in generated PDFs."
                  : "These slots will be blank in generated PDFs."}
                {" "}Remove each slot below, then re-place it using the current field.
              </p>
              <ul className="mt-1.5 space-y-1">
                {orphanedMappings.map((m) => {
                  const doc = selectedPackage.documents.find((d) => d.id === m.documentId);
                  const docName = doc?.title ?? doc?.fileName ?? "Unknown doc";
                  const formatLabel = labelForMappingFormat(m.format);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 rounded bg-amber-100 border border-amber-200 px-2 py-1">
                      <span className="text-amber-900 truncate">
                        <span className="font-medium">{docName}</span>
                        <span className="text-amber-600"> · p.{m.page ?? 1} · {formatLabel}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          storePushUndo([...storeMappings]);
                          storeRemoveMapping(m.id);
                        }}
                        className="shrink-0 text-amber-600 hover:text-red-600 transition-colors font-bold leading-none"
                        title="Remove this slot"
                      >×</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {/* Filter / sort controls */}
          <div className="flex items-center gap-1.5 mb-2 flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-3 text-[11px] font-medium border-b border-[#EFE8D8]">
              <button
                type="button"
                onClick={() => { setShowUnplacedOnly(false); try { localStorage.setItem("docuplete-field-filter-unplaced", ""); } catch {} }}
                className={`pb-1 transition-colors border-b-2 -mb-px ${!showUnplacedOnly ? "border-[#C49A38] text-[#0F1C3F]" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}
              >All</button>
              <button
                type="button"
                onClick={() => { setShowUnplacedOnly(true); try { localStorage.setItem("docuplete-field-filter-unplaced", "1"); } catch {} }}
                className={`pb-1 transition-colors border-b-2 -mb-px ${showUnplacedOnly ? "border-[#C49A38] text-[#0F1C3F]" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}
              >Unplaced{unplacedCount > 0 ? <span className="ml-0.5 opacity-60">({unplacedCount})</span> : null}</button>
            </div>
            <select
              value={fieldSort}
              onChange={(e) => {
                const v = e.target.value as typeof fieldSort;
                setFieldSort(v);
                try { localStorage.setItem("docuplete-field-sort", v); } catch {}
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
            const esignPkgIds = new Set(selectedPackage.fields.filter((f) => isSystemEsignFieldId(f.id)).map((f) => f.id));
            const availableEsignFields = SYSTEM_ESIGN_FIELDS.filter((sf) => !esignPkgIds.has(sf.id));
            if (availableLibraryFields.length === 0 && availableEsignFields.length === 0) return null;
            return (
              <LibraryFieldPicker
                availableLibraryFields={availableLibraryFields}
                availableEsignFields={availableEsignFields}
                fieldGroups={fieldGroups}
                onSelect={(val) => {
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
                      return { ...pkg, fields, auth_level: "email_otp" };
                    });
                  } else {
                    const libraryField = fieldLibrary.find((item) => item.id === val);
                    if (libraryField) addLibraryFieldToPackage(libraryField);
                  }
                }}
              />
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
                <div ref={fieldListScrollRef} className="space-y-2 overflow-y-auto flex-1 min-h-0">
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
                            data-field-id={field.id}
                            onDragStart={(e) => { e.dataTransfer.setData("text/field", field.id); }}
                            onDoubleClick={() => openFieldEditorForEdit(field.id)}
                            style={{ borderColor: isActivePlacing ? "#C49A38" : field.color, outline: selectedField?.id === field.id ? `4px solid ${field.color}` : undefined, outlineOffset: "2px" }}
                            className={`w-full text-left border-2 rounded px-3 py-2 bg-white transition-shadow cursor-alias ${isActivePlacing ? "ring-2 ring-[#C49A38]/40 shadow-md" : ""}`}
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
                                    {(fieldBrokenRefMap.get(field.id)?.length ?? 0) > 0 && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); openFieldEditorForEdit(field.id); }}
                                            className="text-[10px] uppercase tracking-wide rounded bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.5 flex items-center gap-1"
                                          >⚠ Repair</button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="text-xs max-w-52">
                                          {fieldBrokenRefMap.get(field.id)!.map((r) => (
                                            <div key={r.id}>{brokenRefKindLabel(r.kind)} references removed field "{r.deletedFieldName}"</div>
                                          ))}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
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
                                data-field-id={field.id}
                                style={{ ...wrapperStyle, borderColor: isActivePlacing ? "#C49A38" : field.color, outline: selectedField?.id === field.id ? `4px solid ${field.color}` : undefined, outlineOffset: "2px" }}
                                draggable
                                onDragStart={(e) => {
                                  if (fieldDragFromHandle.current) { e.preventDefault(); return; }
                                  e.dataTransfer.setData("text/field", field.id);
                                }}
                                onDoubleClick={() => openFieldEditorForEdit(field.id)}
                                className={`w-full text-left border-2 rounded px-3 py-2 bg-white transition-shadow cursor-alias ${isDragging ? "opacity-40 shadow-lg" : ""} ${isActivePlacing ? "ring-2 ring-[#C49A38]/40 shadow-md" : ""}`}
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
                                        {(fieldBrokenRefMap.get(field.id)?.length ?? 0) > 0 && (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openFieldEditorForEdit(field.id); }}
                                                className="text-[10px] uppercase tracking-wide rounded bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.5 flex items-center gap-1"
                                              >⚠ Repair</button>
                                            </TooltipTrigger>
                                            <TooltipContent side="left" className="text-xs max-w-52">
                                              {fieldBrokenRefMap.get(field.id)!.map((r) => (
                                                <div key={r.id}>{brokenRefKindLabel(r.kind)} references removed field "{r.deletedFieldName}"</div>
                                              ))}
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
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
