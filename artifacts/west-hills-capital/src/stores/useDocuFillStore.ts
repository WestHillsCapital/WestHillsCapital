import { create } from "zustand";
import { type MappingItem, type RecipientItem } from "@/lib/docufill-types";
import { type PackageItem } from "@/lib/docufill-local-types";

interface DocuFillState {
  selectedMappingId: string | null;
  selectedFieldId: string | null;
  mapperTextMode: boolean;
  resizeDim: { w: number; h: number } | null;
  dragGuides: { xs: number[]; ys: number[] } | null;
  _undoStack: MappingItem[][];
  pageCount: number;

  mappings: MappingItem[];
  recipientList: RecipientItem[];

  packages: PackageItem[];
  selectedPackageId: number | null;

  setSelectedMappingId: (id: string | null) => void;
  setSelectedFieldId: (id: string | null) => void;
  setMapperTextMode: (v: boolean) => void;
  setResizeDim: (dim: { w: number; h: number } | null) => void;
  setDragGuides: (guides: { xs: number[]; ys: number[] } | null) => void;
  setPageCount: (count: number) => void;

  pushUndo: (snapshot: MappingItem[]) => void;
  popUndo: () => MappingItem[] | undefined;
  clearUndo: () => void;

  setMappings: (mappings: MappingItem[]) => void;
  setRecipientList: (list: RecipientItem[]) => void;
  updateMapping: (id: string, patcher: (m: MappingItem) => MappingItem) => void;
  addMapping: (m: MappingItem) => void;
  removeMapping: (id: string) => void;
  removeMappingsForField: (fieldId: string) => void;
  addRecipient: (r: RecipientItem) => void;
  removeRecipient: (id: string) => void;
  updateRecipient: (id: string, patch: Partial<RecipientItem>) => void;
  clearRecipientFromMappings: (recipientId: string) => void;

  setPackages: (arg: PackageItem[] | ((prev: PackageItem[]) => PackageItem[])) => void;
  setSelectedPackageId: (arg: number | null | ((prev: number | null) => number | null)) => void;
  updateSelectedPackage: (updater: (pkg: PackageItem) => PackageItem, targetId?: number) => void;
}

export const useDocuFillStore = create<DocuFillState>()((set, get) => ({
  selectedMappingId: null,
  selectedFieldId: null,
  mapperTextMode: true,
  resizeDim: null,
  dragGuides: null,
  _undoStack: [],
  pageCount: 1,

  mappings: [],
  recipientList: [],

  packages: [],
  selectedPackageId: (() => {
    try {
      const saved = sessionStorage.getItem("docufill:selectedPackageId");
      if (saved) { const n = Number(saved); if (!isNaN(n) && n > 0) return n; }
    } catch { /* sessionStorage unavailable */ }
    return null;
  })(),

  setSelectedMappingId: (id) => set({ selectedMappingId: id }),
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),
  setMapperTextMode: (v) => set({ mapperTextMode: v }),
  setResizeDim: (dim) => set({ resizeDim: dim }),
  setDragGuides: (guides) => set({ dragGuides: guides }),
  setPageCount: (count) => set({ pageCount: count }),

  pushUndo: (snapshot) =>
    set((s) => ({ _undoStack: [...s._undoStack, snapshot].slice(-20) })),
  popUndo: () => {
    const stack = get()._undoStack;
    if (stack.length === 0) return undefined;
    const item = stack[stack.length - 1];
    set({ _undoStack: stack.slice(0, -1) });
    return item;
  },
  clearUndo: () => set({ _undoStack: [] }),

  setMappings: (mappings) => set({ mappings }),
  setRecipientList: (list) => set({ recipientList: list }),

  updateMapping: (id, patcher) =>
    set((s) => ({
      mappings: s.mappings.map((m) => (m.id === id ? patcher(m) : m)),
    })),

  addMapping: (m) => set((s) => ({ mappings: [...s.mappings, m] })),

  removeMapping: (id) =>
    set((s) => ({ mappings: s.mappings.filter((m) => m.id !== id) })),

  removeMappingsForField: (fieldId) =>
    set((s) => ({ mappings: s.mappings.filter((m) => m.fieldId !== fieldId) })),

  addRecipient: (r) =>
    set((s) => ({ recipientList: [...s.recipientList, r] })),

  removeRecipient: (id) =>
    set((s) => ({ recipientList: s.recipientList.filter((r) => r.id !== id) })),

  updateRecipient: (id, patch) =>
    set((s) => ({
      recipientList: s.recipientList.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  clearRecipientFromMappings: (recipientId) =>
    set((s) => ({
      mappings: s.mappings.map((m) =>
        m.recipientId === recipientId ? { ...m, recipientId: undefined } : m,
      ),
    })),

  setPackages: (arg) =>
    set((s) => ({ packages: typeof arg === "function" ? arg(s.packages) : arg })),

  setSelectedPackageId: (arg) =>
    set((s) => ({ selectedPackageId: typeof arg === "function" ? arg(s.selectedPackageId) : arg })),

  updateSelectedPackage: (updater, targetId) => {
    const { selectedPackageId, packages } = get();
    // Mirror the old selectedPackage derivation: explicit targetId wins,
    // then selectedPackageId, then fall back to packages[0] (same as the
    // `packages.find(...) ?? packages[0]` expression the local helper used).
    const id = targetId ?? selectedPackageId ?? packages[0]?.id;
    if (id === null || id === undefined) return;
    set({ packages: packages.map((pkg) => pkg.id === id ? updater(pkg) : pkg) });
  },
}));
