import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDocuFillPrefillDisplayValue } from "@/lib/docufill-redaction";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const DOCUFILL_TRANSACTION_TYPES = [
  { value: "ira_transfer", label: "IRA transfer / rollover" },
  { value: "ira_contribution", label: "IRA contribution" },
  { value: "ira_distribution", label: "IRA distribution" },
  { value: "cash_purchase", label: "Cash purchase" },
  { value: "storage_change", label: "Storage change" },
  { value: "beneficiary_update", label: "Beneficiary update" },
  { value: "liquidation", label: "Liquidation" },
  { value: "buy_sell_direction", label: "Buy / sell direction" },
  { value: "address_change", label: "Address change" },
] as const;

function transactionScopeLabel(scope: string | null | undefined) {
  return DOCUFILL_TRANSACTION_TYPES.find((item) => item.value === scope)?.label ?? "IRA transfer / rollover";
}

function normalizeTransactionScope(scope: string | null | undefined) {
  if (DOCUFILL_TRANSACTION_TYPES.some((item) => item.value === scope)) return scope as string;
  const text = String(scope ?? "").toLowerCase();
  if (text.includes("contribution")) return "ira_contribution";
  if (text.includes("distribution")) return "ira_distribution";
  if (text.includes("cash")) return "cash_purchase";
  if (text.includes("storage")) return "storage_change";
  if (text.includes("beneficiary")) return "beneficiary_update";
  if (/^[a-z0-9_]{2,48}$/.test(String(scope ?? ""))) return String(scope);
  return "ira_transfer";
}

type Entity = {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
};

type TransactionType = {
  scope: string;
  label: string;
  active: boolean;
  sort_order: number;
};

type DocItem = {
  id: string;
  title: string;
  pages: number;
  fileName?: string;
  byteSize?: number;
  contentType?: string;
  pdfStored?: boolean;
  pageSizes?: Array<{ width: number; height: number }>;
  uploadedAt?: string;
  updatedAt?: string;
};

type FieldItem = {
  id: string;
  libraryFieldId?: string;
  name: string;
  color: string;
  type: "text" | "radio" | "checkbox" | "dropdown" | "date";
  options?: string[];
  optionsMode?: "inherit" | "override";
  interviewVisible: boolean;
  adminOnly: boolean;
  defaultValue: string;
  source: string;
  sensitive: boolean;
  required?: boolean;
  validationType?: "none" | "name" | "number" | "currency" | "email" | "phone" | "date" | "ssn" | "custom";
  validationPattern?: string;
  validationMessage?: string;
};

type FieldLibraryItem = {
  id: string;
  label: string;
  category: string;
  type: FieldItem["type"];
  source: string;
  options: string[];
  sensitive: boolean;
  required: boolean;
  validationType: FieldItem["validationType"];
  validationPattern?: string;
  validationMessage?: string;
  active: boolean;
  sortOrder: number;
};

type MappingFormat =
  | "as-entered"
  | "uppercase"
  | "lowercase"
  | "first-name"
  | "middle-name"
  | "last-name"
  | "first-last"
  | "initials"
  | "digits-only"
  | "last-four"
  | "currency"
  | "date-mm-dd-yyyy"
  | "checkbox-yes";

type MappingItem = {
  id: string;
  fieldId: string;
  documentId: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  format?: MappingFormat;
};

type BuilderStep = "documents" | "mapping" | "interview" | "finalize";

const BUILDER_STEPS: Array<{ value: BuilderStep; label: string; helper: string }> = [
  { value: "documents", label: "1. Document View", helper: "Add and order package PDFs" },
  { value: "mapping", label: "2. Data + Fields View", helper: "Drag fields onto documents" },
  { value: "interview", label: "3. Questionnaire", helper: "Review generated questions" },
  { value: "finalize", label: "4. Finalize", helper: "Activate for reuse" },
];

type PackageItem = {
  id: number;
  name: string;
  custodian_id: number | null;
  depository_id: number | null;
  custodian_name: string | null;
  depository_name: string | null;
  transaction_scope: string;
  description: string | null;
  status: string;
  version: number;
  documents: DocItem[];
  fields: FieldItem[];
  mappings: MappingItem[];
};

type Session = {
  token: string;
  package_name: string;
  custodian_name: string | null;
  depository_name: string | null;
  documents: DocItem[];
  fields: FieldItem[];
  mappings: MappingItem[];
  prefill: Record<string, string>;
  answers: Record<string, string>;
  status: string;
  transaction_scope?: string;
  generated_pdf_url?: string | null;
  generated_pdf_saved_at?: string | null;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function clampPercent(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function defaultMappingFormat(field: FieldItem): MappingItem["format"] {
  if (field.validationType === "currency") return "currency";
  if (field.validationType === "number") return "digits-only";
  if (field.validationType === "date" || field.type === "date") return "date-mm-dd-yyyy";
  if (field.type === "checkbox") return "checkbox-yes";
  return "as-entered";
}

const FIELD_COLOR_PALETTE = [
  "#2563EB", "#DC2626", "#16A34A", "#D97706", "#7C3AED",
  "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#4F46E5",
  "#059669", "#B91C1C", "#1D4ED8", "#CA8A04", "#6D28D9",
];

function pickFieldColor(usedColors: string[], sensitive: boolean): string {
  if (sensitive) return "#DC2626";
  const available = FIELD_COLOR_PALETTE.filter((c) => !usedColors.includes(c));
  const pool = available.length > 0 ? available : FIELD_COLOR_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

const MAPPING_FORMAT_OPTIONS: Array<{ value: MappingFormat; label: string; group: string }> = [
  { value: "as-entered", label: "Whole answer", group: "Common" },
  { value: "first-name", label: "First", group: "Name" },
  { value: "middle-name", label: "Middle", group: "Name" },
  { value: "last-name", label: "Last", group: "Name" },
  { value: "first-last", label: "First + Last", group: "Name" },
  { value: "initials", label: "Initials", group: "Name" },
  { value: "uppercase", label: "Uppercase", group: "Text" },
  { value: "lowercase", label: "Lowercase", group: "Text" },
  { value: "digits-only", label: "Digits only", group: "Numbers" },
  { value: "last-four", label: "Last four", group: "Numbers" },
  { value: "currency", label: "Currency", group: "Numbers" },
  { value: "date-mm-dd-yyyy", label: "Date MM/DD/YYYY", group: "Dates" },
  { value: "checkbox-yes", label: "Checkbox mark when yes", group: "Checks" },
];

const NAME_MAPPING_FORMATS: MappingFormat[] = ["as-entered", "first-name", "middle-name", "last-name", "first-last", "initials"];

function labelForMappingFormat(format: MappingFormat | undefined) {
  return MAPPING_FORMAT_OPTIONS.find((option) => option.value === (format ?? "as-entered"))?.label ?? "Whole answer";
}

function isNameLikeField(field: FieldItem | undefined) {
  if (!field) return false;
  const text = [field.name, field.source, field.validationType].join(" ").toLowerCase();
  return /\b(name|firstname|lastname|fullname|clientname)\b/.test(text.replace(/[_-]/g, " "));
}

function mappingFormatOptionsForField(field: FieldItem | undefined) {
  if (!isNameLikeField(field)) return MAPPING_FORMAT_OPTIONS;
  const nameOptions = MAPPING_FORMAT_OPTIONS.filter((option) => NAME_MAPPING_FORMATS.includes(option.value));
  const remaining = MAPPING_FORMAT_OPTIONS.filter((option) => !NAME_MAPPING_FORMATS.includes(option.value));
  return [...nameOptions, ...remaining];
}

function normalizePackages(items: PackageItem[]): PackageItem[] {
  return items.map((pkg) => ({
    ...pkg,
    transaction_scope: normalizeTransactionScope(pkg.transaction_scope),
    documents: Array.isArray(pkg.documents) ? pkg.documents : [],
    fields: Array.isArray(pkg.fields) ? pkg.fields.map((field) => ({
      ...field,
      libraryFieldId: field.libraryFieldId ?? "",
      sensitive: field.sensitive === true,
      required: field.required === true,
      options: Array.isArray(field.options) ? field.options : undefined,
      optionsMode: field.optionsMode === "inherit" || field.optionsMode === "override" ? field.optionsMode : field.libraryFieldId && (!Array.isArray(field.options) || field.options.length === 0) ? "inherit" : "override",
      validationType: field.validationType ?? "none",
      validationPattern: field.validationPattern ?? "",
      validationMessage: field.validationMessage ?? "",
    })) : [],
    mappings: Array.isArray(pkg.mappings) ? pkg.mappings.map((mapping) => ({
      ...mapping,
      fontSize: Number(mapping.fontSize ?? 9),
      align: mapping.align ?? "left",
      format: mapping.format ?? "as-entered",
    })) : [],
  }));
}

function normalizeFieldLibrary(items: FieldLibraryItem[]): FieldLibraryItem[] {
  return Array.isArray(items) ? items.map((item) => ({
    ...item,
    category: item.category || "General",
    type: ["text", "date", "radio", "checkbox", "dropdown"].includes(item.type) ? item.type : "text",
    source: item.source || "interview",
    options: Array.isArray(item.options) ? item.options : [],
    sensitive: item.sensitive === true,
    required: item.required === true,
    validationType: item.validationType ?? "none",
    validationPattern: item.validationPattern ?? "",
    validationMessage: item.validationMessage ?? "",
    active: item.active !== false,
    sortOrder: Number(item.sortOrder ?? 100),
  })) : [];
}

function interviewFieldValue(field: FieldItem, answers: Record<string, string>, prefill: Record<string, string> | undefined) {
  return String(
    answers[field.id]
    ?? (field.source ? prefill?.[field.source] : undefined)
    ?? prefill?.[field.name]
    ?? field.defaultValue
    ?? "",
  );
}

function safeInterviewDisplayValue(field: FieldItem, value: string) {
  if (!value) return "";
  if (!field.sensitive) return value;
  const compact = value.replace(/\s+/g, "");
  return compact.length > 4 ? `••••${compact.slice(-4)}` : "••••";
}

export default function DocuFill() {
  const search = useSearch();
  const params = useParams<{ token?: string }>();
  const [, navigate] = useLocation();
  const publicSessionToken = params.token ?? null;
  const sessionToken = publicSessionToken ?? new URLSearchParams(search).get("session");
  const isPublicSession = Boolean(publicSessionToken);
  const { getAuthHeaders } = useInternalAuth();
  const [tab, setTab] = useState<"packages" | "mapper" | "interview">(sessionToken ? "interview" : "packages");
  const [builderStep, setBuilderStep] = useState<BuilderStep>("documents");
  const [custodians, setCustodians] = useState<Entity[]>([]);
  const [depositories, setDepositories] = useState<Entity[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [fieldLibrary, setFieldLibrary] = useState<FieldLibraryItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [standalonePackageId, setStandalonePackageId] = useState("");
  const [newPackageName, setNewPackageName] = useState("");
  const [newPackageCustodianId, setNewPackageCustodianId] = useState("");
  const [newPackageDepositoryId, setNewPackageDepositoryId] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingPackage, setIsDeletingPackage] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isDocumentDropActive, setIsDocumentDropActive] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [driveWarnings, setDriveWarnings] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [formatMenu, setFormatMenu] = useState<{ mappingId: string; x: number; y: number } | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const pageFrameRef = useRef<HTMLDivElement | null>(null);
  const documentPreviewCache = useRef<Record<string, string>>({});
  const documentPreviewCacheOrder = useRef<string[]>([]);

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0] ?? null;
  const selectedDocument = selectedPackage?.documents.find((doc) => doc.id === selectedDocumentId) ?? selectedPackage?.documents[0] ?? null;
  const selectedField = selectedPackage?.fields.find((field) => field.id === selectedFieldId) ?? selectedPackage?.fields[0] ?? null;
  const selectedFieldIsShared = Boolean(selectedField?.libraryFieldId);
  const selectedMapping = selectedPackage?.mappings.find((mapping) => mapping.id === selectedMappingId) ?? null;
  const selectedMappingField = selectedMapping ? selectedPackage?.fields.find((field) => field.id === selectedMapping.fieldId) : undefined;
  const selectedMappingFormatOptions = mappingFormatOptionsForField(selectedMappingField);
  const selectedPageSize = selectedDocument?.pageSizes?.[selectedPage - 1] ?? selectedDocument?.pageSizes?.[0];
  const labelForTransactionScope = (scope: string | null | undefined) => transactionTypes.find((item) => item.scope === scope)?.label ?? transactionScopeLabel(scope);
  const selectedPageAspect = selectedPageSize && selectedPageSize.width > 0 && selectedPageSize.height > 0
    ? `${selectedPageSize.width} / ${selectedPageSize.height}`
    : "612 / 792";
  const pageMappings = useMemo(() => {
    if (!selectedPackage || !selectedDocument) return [];
    return selectedPackage.mappings.filter((m) => m.documentId === selectedDocument.id && (m.page ?? 1) === selectedPage);
  }, [selectedPackage, selectedDocument, selectedPage]);
  const visibleInterviewFields = useMemo(() => session?.fields.filter((field) => field.interviewVisible) ?? [], [session]);
  const missingRequiredFields = useMemo(() => {
    if (!session) return [];
    return visibleInterviewFields.filter((field) => field.required && !interviewFieldValue(field, answers, session.prefill).trim()).map((field) => field.name);
  }, [session, visibleInterviewFields, answers]);
  const answeredFieldCount = visibleInterviewFields.filter((field) => interviewFieldValue(field, answers, session?.prefill).trim()).length;
  const sessionBasePath = isPublicSession ? "/api/docufill/public/sessions" : "/api/internal/docufill/sessions";
  const sessionHeaders = isPublicSession ? {} : { ...getAuthHeaders() };
  const activePackages = packages.filter((pkg) => pkg.status === "active");
  const packageInterviewFields = selectedPackage?.fields.filter((field) => field.interviewVisible) ?? [];
  const packageFixedOrHiddenFields = selectedPackage?.fields.filter((field) => !field.interviewVisible || field.adminOnly || field.defaultValue.trim()) ?? [];
  const packageMappedFieldIds = new Set(selectedPackage?.mappings.map((mapping) => mapping.fieldId) ?? []);
  const unmappedPackageFields = selectedPackage?.fields.filter((field) => !packageMappedFieldIds.has(field.id)) ?? [];

  async function loadBootstrap() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/internal/docufill/bootstrap`, { headers: { ...getAuthHeaders() } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load DocuFill data");
      const loadedPackages = normalizePackages(data.packages ?? []);
      setCustodians(data.custodians ?? []);
      setDepositories(data.depositories ?? []);
      setTransactionTypes(Array.isArray(data.transactionTypes) && data.transactionTypes.length ? data.transactionTypes : DOCUFILL_TRANSACTION_TYPES.map((item, index) => ({ scope: item.value, label: item.label, active: true, sort_order: (index + 1) * 10 })));
      setFieldLibrary(normalizeFieldLibrary(data.fieldLibrary ?? []));
      setPackages(loadedPackages);
      setSelectedPackageId((current) => current ?? loadedPackages[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load DocuFill data");
    }
  }

  useEffect(() => {
    if (isPublicSession) return;
    loadBootstrap();
  }, [isPublicSession]);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(`${API_BASE}${sessionBasePath}/${sessionToken}`, { headers: sessionHeaders })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Could not load interview")))
      .then((data: { session: Session }) => {
        setSession(data.session);
        setAnswers(data.session.answers ?? {});
        setDriveUrl(data.session.generated_pdf_url ?? null);
        setGeneratedUrl(data.session.status === "generated" ? `${API_BASE}${sessionBasePath}/${sessionToken}/packet.pdf` : null);
        setTab("interview");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load interview"));
  }, [sessionToken, sessionBasePath, getAuthHeaders, isPublicSession]);

  useEffect(() => {
    if (selectedPackage && !selectedDocumentId) setSelectedDocumentId(selectedPackage.documents[0]?.id ?? null);
    if (selectedPackage && !selectedFieldId) setSelectedFieldId(selectedPackage.fields[0]?.id ?? null);
  }, [selectedPackage, selectedDocumentId, selectedFieldId]);

  useEffect(() => {
    const pageCount = Math.max(selectedDocument?.pages ?? 1, 1);
    if (selectedPage > pageCount) setSelectedPage(pageCount);
    if (selectedPage < 1) setSelectedPage(1);
  }, [selectedDocument?.id, selectedDocument?.pages, selectedPage]);

  useEffect(() => {
    if (!selectedMappingId) return;
    if (!pageMappings.some((mapping) => mapping.id === selectedMappingId)) setSelectedMappingId(null);
  }, [pageMappings, selectedMappingId]);

  useEffect(() => {
    let cancelled = false;
    setDocumentPreviewUrl(null);
    if (!selectedPackage || !selectedDocument?.pdfStored) return;
    const cacheKey = `${selectedPackage.id}:${selectedDocument.id}`;
    const cachedUrl = documentPreviewCache.current[cacheKey];
    if (cachedUrl) {
      setDocumentPreviewUrl(cachedUrl);
      return;
    }
    const url = `${API_BASE}/api/internal/docufill/packages/${selectedPackage.id}/documents/${selectedDocument.id}.pdf`;
    fetch(url, { headers: { ...getAuthHeaders() } })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load PDF preview");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        documentPreviewCacheOrder.current = documentPreviewCacheOrder.current.filter((key) => key !== cacheKey);
        documentPreviewCacheOrder.current.push(cacheKey);
        documentPreviewCache.current[cacheKey] = objectUrl;
        while (documentPreviewCacheOrder.current.length > 6) {
          const oldestKey = documentPreviewCacheOrder.current.shift();
          if (!oldestKey) break;
          const oldestUrl = documentPreviewCache.current[oldestKey];
          if (oldestUrl) URL.revokeObjectURL(oldestUrl);
          delete documentPreviewCache.current[oldestKey];
        }
        setDocumentPreviewUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load PDF preview");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPackage?.id, selectedDocument?.id, selectedDocument?.pdfStored, getAuthHeaders]);

  useEffect(() => {
    return () => {
      Object.values(documentPreviewCache.current).forEach((url) => URL.revokeObjectURL(url));
      documentPreviewCache.current = {};
      documentPreviewCacheOrder.current = [];
    };
  }, []);

  async function savePackage(pkg: PackageItem) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: pkg.name,
          custodianId: pkg.custodian_id,
          depositoryId: pkg.depository_id,
          transactionScope: pkg.transaction_scope,
          description: pkg.description,
          status: pkg.status,
          documents: pkg.documents,
          fields: pkg.fields,
          mappings: pkg.mappings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save package");
      setStatus("Saved package.");
      await loadBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save package");
    } finally {
      setIsSaving(false);
    }
  }

  async function createPackage() {
    const trimmedName = newPackageName.trim();
    if (!trimmedName) {
      setError("Enter a package name before adding it.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: trimmedName,
          custodianId: newPackageCustodianId ? Number(newPackageCustodianId) : null,
          depositoryId: newPackageDepositoryId ? Number(newPackageDepositoryId) : null,
          transactionScope: "ira_transfer",
          status: "draft",
          documents: [],
          fields: [],
          mappings: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create package");
      await loadBootstrap();
      setSelectedPackageId(data.package.id);
      setNewPackageName("");
      setNewPackageCustodianId("");
      setNewPackageDepositoryId("");
      setBuilderStep("documents");
      setTab("packages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create package");
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePackage(pkg: PackageItem) {
    const confirmed = window.confirm(`Delete "${pkg.name}" and all of its documents, mappings, and interview sessions? This cannot be undone.`);
    if (!confirmed) return;
    setIsDeletingPackage(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/packages/${pkg.id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete package");
      clearPackageDocumentPreviews(pkg.id);
      setPackages((prev) => {
        const nextPackages = prev.filter((item) => item.id !== pkg.id);
        const nextSelection = nextPackages[0]?.id ?? null;
        setSelectedPackageId(nextSelection);
        setSelectedDocumentId(nextPackages[0]?.documents[0]?.id ?? null);
        setSelectedFieldId(nextPackages[0]?.fields[0]?.id ?? null);
        setSelectedMappingId(null);
        return nextPackages;
      });
      setStatus("Deleted package.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete package");
    } finally {
      setIsDeletingPackage(false);
    }
  }

  async function createEntity(type: "custodians" | "depositories") {
    const count = type === "custodians" ? custodians.length + 1 : depositories.length + 1;
    const label = type === "custodians" ? `New Custodian ${count}` : `New Depository ${count}`;
    const res = await fetch(`${API_BASE}/api/internal/docufill/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ name: label, active: true }),
    });
    if (res.ok) await loadBootstrap();
  }

  function updateEntityLocal(type: "custodians" | "depositories", id: number, patch: Partial<Entity>) {
    const updater = (item: Entity) => item.id === id ? { ...item, ...patch } : item;
    if (type === "custodians") setCustodians((prev) => prev.map(updater));
    if (type === "depositories") setDepositories((prev) => prev.map(updater));
  }

  async function saveEntity(type: "custodians" | "depositories", item: Entity) {
    setError(null);
    const res = await fetch(`${API_BASE}/api/internal/docufill/${type}/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        name: item.name,
        contactName: item.contact_name,
        email: item.email,
        phone: item.phone,
        notes: item.notes,
        active: item.active,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save record");
      return;
    }
    setStatus("Saved record.");
    await loadBootstrap();
  }

  async function createTransactionType() {
    const label = `New transaction type ${transactionTypes.length + 1}`;
    const res = await fetch(`${API_BASE}/api/internal/docufill/transaction-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ label, active: true, sortOrder: (transactionTypes.length + 1) * 10 }),
    });
    if (res.ok) await loadBootstrap();
  }

  function updateTransactionTypeLocal(scope: string, patch: Partial<TransactionType>) {
    setTransactionTypes((prev) => prev.map((item) => item.scope === scope ? { ...item, ...patch } : item));
  }

  async function saveTransactionType(item: TransactionType) {
    setError(null);
    const res = await fetch(`${API_BASE}/api/internal/docufill/transaction-types/${item.scope}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        label: item.label,
        active: item.active,
        sortOrder: item.sort_order,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save transaction type");
      return;
    }
    setStatus("Saved transaction type.");
    await loadBootstrap();
  }

  async function createFieldLibraryItem() {
    const label = `Reusable field ${fieldLibrary.length + 1}`;
    const res = await fetch(`${API_BASE}/api/internal/docufill/field-library`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ label, category: "General", type: "text", source: "interview", active: true, sortOrder: (fieldLibrary.length + 1) * 10 }),
    });
    if (res.ok) await loadBootstrap();
  }

  function updateFieldLibraryLocal(id: string, patch: Partial<FieldLibraryItem>) {
    setFieldLibrary((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function saveFieldLibraryItem(item: FieldLibraryItem) {
    setError(null);
    const res = await fetch(`${API_BASE}/api/internal/docufill/field-library/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(item),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save field library item");
      return;
    }
    setStatus("Saved shared field.");
    await loadBootstrap();
  }

  function addLibraryFieldToPackage(libraryField: FieldLibraryItem) {
    updateSelectedPackage((pkg) => {
      const existingField = pkg.fields.find((field) => field.libraryFieldId === libraryField.id);
      if (existingField) {
        setSelectedFieldId(existingField.id);
        setStatus("That shared field is already in this package.");
        return pkg;
      }
      const field: FieldItem = {
        id: newId("field"),
        libraryFieldId: libraryField.id,
        name: libraryField.label,
        color: pickFieldColor(pkg.fields.map((f) => f.color), libraryField.sensitive),
        type: libraryField.type,
      optionsMode: "inherit",
        interviewVisible: true,
        adminOnly: false,
        defaultValue: "",
        source: libraryField.source,
        sensitive: libraryField.sensitive,
        required: libraryField.required,
        validationType: libraryField.validationType,
        validationPattern: libraryField.validationPattern ?? "",
        validationMessage: libraryField.validationMessage ?? "",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [...pkg.fields, field] };
    });
    goBuilderStep("mapping");
  }

  function goBuilderStep(step: BuilderStep) {
    setBuilderStep(step);
    setTab(step === "mapping" ? "mapper" : "packages");
  }

  function updateSelectedPackage(updater: (pkg: PackageItem) => PackageItem) {
    if (!selectedPackage) return;
    setPackages((prev) => prev.map((pkg) => pkg.id === selectedPackage.id ? updater(pkg) : pkg));
  }

  function evictDocumentPreview(packageId: number, docId: string) {
    const cacheKey = `${packageId}:${docId}`;
    const cachedUrl = documentPreviewCache.current[cacheKey];
    if (cachedUrl) URL.revokeObjectURL(cachedUrl);
    delete documentPreviewCache.current[cacheKey];
    documentPreviewCacheOrder.current = documentPreviewCacheOrder.current.filter((key) => key !== cacheKey);
  }

  function clearPackageDocumentPreviews(packageId: number) {
    Object.entries(documentPreviewCache.current).forEach(([cacheKey, previewUrl]) => {
      if (!cacheKey.startsWith(`${packageId}:`)) return;
      URL.revokeObjectURL(previewUrl);
      delete documentPreviewCache.current[cacheKey];
    });
    documentPreviewCacheOrder.current = documentPreviewCacheOrder.current.filter((cacheKey) => !cacheKey.startsWith(`${packageId}:`));
  }

  function mergeServerDocumentUpdate(updatedPackage: PackageItem, removedDocumentId?: string) {
    setPackages((prev) => prev.map((pkg) => {
      if (pkg.id !== updatedPackage.id) return pkg;
      return {
        ...pkg,
        ...updatedPackage,
        fields: pkg.fields,
        mappings: removedDocumentId ? pkg.mappings.filter((mapping) => mapping.documentId !== removedDocumentId) : pkg.mappings,
      };
    }));
  }

  function addDocument() {
    updateSelectedPackage((pkg) => {
      const doc: DocItem = { id: newId("doc"), title: `Document ${pkg.documents.length + 1}`, pages: 1 };
      setSelectedDocumentId(doc.id);
      return { ...pkg, documents: [...pkg.documents, doc] };
    });
  }

  function getPdfFiles(files: FileList | File[]) {
    return Array.from(files).filter((file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
  }

  async function persistDocumentPdf(file: File, documentId?: string) {
    if (!selectedPackage) return null;
    const endpoint = documentId
      ? `${API_BASE}/api/internal/docufill/packages/${selectedPackage.id}/documents/${documentId}/pdf`
      : `${API_BASE}/api/internal/docufill/packages/${selectedPackage.id}/documents`;
    const res = await fetch(endpoint, {
      method: documentId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/pdf",
        "X-File-Name": file.name,
        "X-Document-Title": file.name.replace(/\.pdf$/i, ""),
        ...getAuthHeaders(),
      },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not upload PDF");
    if (documentId) {
      evictDocumentPreview(selectedPackage.id, documentId);
    }
    const loadedPackages = normalizePackages([data.package]);
    const updatedPackage = loadedPackages[0];
    if (updatedPackage) {
      mergeServerDocumentUpdate(updatedPackage);
      const latestDoc = documentId
        ? updatedPackage.documents.find((doc) => doc.id === documentId)
        : updatedPackage.documents[updatedPackage.documents.length - 1];
      setSelectedDocumentId(latestDoc?.id ?? null);
    }
    return updatedPackage;
  }

  async function uploadDocument(file: File, documentId?: string) {
    if (!selectedPackage) return;
    setIsUploadingDocument(true);
    setError(null);
    try {
      await persistDocumentPdf(file, documentId);
      setStatus(documentId ? "Replaced PDF." : "Uploaded PDF.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload PDF");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function uploadDocuments(files: FileList | File[]) {
    if (!selectedPackage) return;
    const pdfFiles = getPdfFiles(files);
    if (pdfFiles.length === 0) {
      setError("Choose or drop one or more PDF files.");
      return;
    }
    setIsUploadingDocument(true);
    setError(null);
    try {
      for (const file of pdfFiles) {
        await persistDocumentPdf(file);
      }
      setStatus(`Uploaded ${pdfFiles.length} PDF${pdfFiles.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload PDFs");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function removeDocument(docId: string) {
    const doc = selectedPackage?.documents.find((item) => item.id === docId);
    if (selectedPackage && doc?.pdfStored) {
      setIsSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/internal/docufill/packages/${selectedPackage.id}/documents/${docId}`, {
          method: "DELETE",
          headers: { ...getAuthHeaders() },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not remove document");
        const loadedPackages = normalizePackages([data.package]);
        const updatedPackage = loadedPackages[0];
        if (updatedPackage) {
          evictDocumentPreview(selectedPackage.id, docId);
          mergeServerDocumentUpdate(updatedPackage, docId);
          setSelectedDocumentId(updatedPackage.documents[0]?.id ?? null);
        }
        setStatus("Removed document.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove document");
      } finally {
        setIsSaving(false);
      }
      return;
    }
    updateSelectedPackage((pkg) => ({
      ...pkg,
      documents: pkg.documents.filter((doc) => doc.id !== docId),
      mappings: pkg.mappings.filter((m) => m.documentId !== docId),
    }));
    setSelectedDocumentId(null);
  }

  function moveDocument(docId: string, direction: -1 | 1) {
    updateSelectedPackage((pkg) => {
      const docs = [...pkg.documents];
      const index = docs.findIndex((doc) => doc.id === docId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= docs.length) return pkg;
      const [item] = docs.splice(index, 1);
      docs.splice(next, 0, item);
      return { ...pkg, documents: docs };
    });
  }

  function moveDocumentToIndex(docId: string, targetIndex: number) {
    updateSelectedPackage((pkg) => {
      const docs = [...pkg.documents];
      const index = docs.findIndex((doc) => doc.id === docId);
      if (index < 0) return pkg;
      const boundedTarget = Math.max(0, Math.min(targetIndex, docs.length - 1));
      if (index === boundedTarget) return pkg;
      const [item] = docs.splice(index, 1);
      docs.splice(boundedTarget, 0, item);
      return { ...pkg, documents: docs };
    });
  }

  function addField() {
    updateSelectedPackage((pkg) => {
      const field: FieldItem = {
        id: newId("field"),
        libraryFieldId: "",
        name: `Field ${pkg.fields.length + 1}`,
        color: pickFieldColor(pkg.fields.map((f) => f.color), false),
        type: "text",
        options: [],
        interviewVisible: true,
        adminOnly: false,
        defaultValue: "",
        source: "interview",
        sensitive: false,
        required: false,
        validationType: "none",
        validationPattern: "",
        validationMessage: "",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [...pkg.fields, field] };
    });
  }

  function updateSelectedField(patch: Partial<FieldItem>) {
    if (!selectedField) return;
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.map((field) => field.id === selectedField.id ? { ...field, ...patch } : field),
    }));
  }

  function unlinkSelectedFieldFromLibrary() {
    if (!selectedField?.libraryFieldId) return;
    updateSelectedField({ libraryFieldId: "", optionsMode: undefined });
  }

  function removeField(fieldId: string) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.filter((field) => field.id !== fieldId),
      mappings: pkg.mappings.filter((m) => m.fieldId !== fieldId),
    }));
    setSelectedFieldId(null);
    setSelectedMappingId(null);
  }

  function moveField(fieldId: string, direction: -1 | 1) {
    updateSelectedPackage((pkg) => {
      const fields = [...pkg.fields];
      const index = fields.findIndex((field) => field.id === fieldId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= fields.length) return pkg;
      const [item] = fields.splice(index, 1);
      fields.splice(next, 0, item);
      return { ...pkg, fields };
    });
  }

  function placeField() {
    if (!selectedField || !selectedDocument) return;
    addMappingForField(selectedField, 18 + (selectedPackage?.mappings.length ?? 0) % 5 * 12, 20 + (selectedPackage?.mappings.length ?? 0) % 8 * 8);
  }

  function addMappingForField(field: FieldItem, x: number, y: number) {
    if (!selectedDocument) return;
    const mappingId = newId("map");
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: [...pkg.mappings, {
        id: mappingId,
        fieldId: field.id,
        documentId: selectedDocument.id,
        page: selectedPage,
        x: clampPercent(x, 0, 74),
        y: clampPercent(y, 0, 94),
        w: 26,
        h: 6,
        fontSize: 9,
        align: "left",
        format: defaultMappingFormat(field),
      }],
    }));
    setSelectedMappingId(mappingId);
    setSelectedFieldId(field.id);
    setFormatMenu(null);
  }

  function dropFieldOnPage(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!selectedPackage || !selectedDocument) return;
    const fieldId = e.dataTransfer.getData("text/field");
    const field = selectedPackage.fields.find((item) => item.id === fieldId);
    const frame = pageFrameRef.current;
    if (!field || !frame) return;
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    addMappingForField(field, x, y);
  }

  function updateSelectedMapping(patch: Partial<MappingItem>) {
    if (!selectedMapping) return;
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: pkg.mappings.map((mapping) => mapping.id === selectedMapping.id ? { ...mapping, ...patch } : mapping),
    }));
  }

  function chooseMappingFormat(mappingId: string, format: MappingFormat) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: pkg.mappings.map((mapping) => mapping.id === mappingId ? { ...mapping, format } : mapping),
    }));
    setSelectedMappingId(mappingId);
    setFormatMenu(null);
  }

  function removeSelectedMapping() {
    if (!selectedMapping) return;
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: pkg.mappings.filter((mapping) => mapping.id !== selectedMapping.id),
    }));
    setSelectedMappingId(null);
  }

  function beginMappingPointer(e: ReactPointerEvent<HTMLElement>, mapping: MappingItem, mode: "move" | "resize") {
    const frame = pageFrameRef.current;
    if (!frame) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedMappingId(mapping.id);
    setSelectedFieldId(mapping.fieldId);
    const rect = frame.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const original = { ...mapping };
    const onMove = (event: PointerEvent) => {
      const dx = ((event.clientX - startX) / rect.width) * 100;
      const dy = ((event.clientY - startY) / rect.height) * 100;
      updateSelectedPackage((pkg) => ({
        ...pkg,
        mappings: pkg.mappings.map((item) => {
          if (item.id !== original.id) return item;
          if (mode === "resize") {
            return {
              ...item,
              w: clampPercent((original.w ?? 26) + dx, 3, 100),
              h: clampPercent((original.h ?? 6) + dy, 2, 100),
            };
          }
          const width = original.w ?? 26;
          const height = original.h ?? 6;
          return {
            ...item,
            x: clampPercent((original.x ?? 0) + dx, 0, 100 - width),
            y: clampPercent((original.y ?? 0) + dy, 0, 100 - height),
          };
        }),
      }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function validateInterviewAnswers(): string | null {
    if (!session) return null;
    const visibleFields = session.fields.filter((field) => field.interviewVisible);
    for (const field of visibleFields) {
      const value = interviewFieldValue(field, answers, session.prefill).trim();
      if (field.required && !value) return `${field.name} is required.`;
      if (!value) continue;
      const validationType = field.validationType ?? "none";
      if (validationType === "name" && !/^[a-z ,.'-]+$/i.test(value)) return field.validationMessage || `${field.name} must be a valid name.`;
      if (validationType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return field.validationMessage || `${field.name} must be a valid email.`;
      if (validationType === "phone" && value.replace(/\D+/g, "").length < 10) return field.validationMessage || `${field.name} must be a valid phone number.`;
      if (validationType === "number" && Number.isNaN(Number(value.replace(/,/g, "")))) return field.validationMessage || `${field.name} must be a number.`;
      if (validationType === "currency" && Number.isNaN(Number(value.replace(/[$,]/g, "")))) return field.validationMessage || `${field.name} must be a currency amount.`;
      if (validationType === "date" && Number.isNaN(new Date(value).getTime())) return field.validationMessage || `${field.name} must be a valid date.`;
      if (validationType === "ssn" && !/^\d{3}-?\d{2}-?\d{4}$/.test(value)) return field.validationMessage || `${field.name} must be a valid SSN format.`;
      if (validationType === "custom" && field.validationPattern) {
        try {
          if (!new RegExp(field.validationPattern).test(value)) return field.validationMessage || `${field.name} is not in the expected format.`;
        } catch {
          return `${field.name} has an invalid validation pattern.`;
        }
      }
    }
    return null;
  }

  async function saveAnswers(nextStatus = "in_progress"): Promise<boolean> {
    if (!session) return false;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${sessionBasePath}/${session.token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeaders },
        body: JSON.stringify({ answers, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save interview");
      setSession((prev) => prev ? { ...prev, status: data.session.status, answers } : prev);
      setStatus("Interview saved.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save interview");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function generatePacket() {
    if (!session) return;
    const validationError = validateInterviewAnswers();
    if (validationError) {
      setError(validationError);
      return;
    }
    const saved = await saveAnswers("answered");
    if (!saved) return;
    const res = await fetch(`${API_BASE}${sessionBasePath}/${session.token}/generate`, {
      method: "POST",
      headers: { ...sessionHeaders },
    });
    const data = await res.json();
    if (res.ok) {
      setGeneratedUrl(data.downloadUrl);
      setDriveUrl(data.drive?.url ?? null);
      setDriveWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setSession((prev) => prev ? { ...prev, status: "generated", generated_pdf_url: data.drive?.url ?? prev.generated_pdf_url } : prev);
      setStatus(data.drive?.url ? "Packet generated and saved to Drive." : "Packet generated.");
    } else {
      setError(data.missingFields?.length ? `Missing required fields: ${data.missingFields.join(", ")}` : data.error ?? "Could not generate packet");
    }
  }

  async function downloadGeneratedPacket() {
    if (!generatedUrl || !session) return;
    setIsDownloading(true);
    setError(null);
    try {
      const url = generatedUrl.startsWith("http") ? generatedUrl : `${API_BASE}${generatedUrl}`;
      const res = await fetch(url, { headers: sessionHeaders });
      if (!res.ok) throw new Error("Could not download packet PDF");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${session.package_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "docufill"}-packet.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download packet PDF");
    } finally {
      setIsDownloading(false);
    }
  }

  async function launchStandaloneInterview() {
    const packageId = Number(standalonePackageId);
    if (!packageId) {
      setError("Select an active package first.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId,
          transactionScope: packages.find((pkg) => pkg.id === packageId)?.transaction_scope,
          source: "staff_docufill",
          prefill: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not launch interview");
      navigate(`/internal/docufill?session=${data.token}`);
      setStatus("Interview session created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch interview");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6 text-[#0F1C3F]">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold">DocuFill</h1>
          <p className="text-sm text-[#6B7A99] mt-1">{isPublicSession ? "Complete your secure paperwork interview for West Hills Capital." : "Set up custodial packages once, then launch clean interviews from Deal Builder."}</p>
        </div>
        {!isPublicSession && <div className="flex rounded border border-[#DDD5C4] overflow-hidden bg-white">
          <button onClick={() => goBuilderStep(builderStep)} className={`px-3 py-2 text-sm ${tab === "packages" || tab === "mapper" ? "bg-[#C49A38] text-black" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}>Package Builder</button>
          <button onClick={() => setTab("interview")} className={`px-3 py-2 text-sm ${tab === "interview" ? "bg-[#C49A38] text-black" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}>Interviews</button>
        </div>}
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>}
      {status && <div className="mb-4 rounded border border-green-200 bg-green-50 text-green-800 px-3 py-2 text-sm">{status}</div>}

      {!isPublicSession && (tab === "packages" || tab === "mapper") && (
        <div className="mb-5 rounded-xl border border-[#DDD5C4] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold">{selectedPackage?.name ?? "Create a reusable paperwork package"}</div>
              <div className="text-xs text-[#6B7A99]">
                {selectedPackage ? `${selectedPackage.documents.length} document${selectedPackage.documents.length === 1 ? "" : "s"} · ${selectedPackage.fields.length} field${selectedPackage.fields.length === 1 ? "" : "s"} · ${selectedPackage.mappings.length} PDF placement${selectedPackage.mappings.length === 1 ? "" : "s"} · ${selectedPackage.status}` : "Build once, then future customers or reps answer a clean interview."}
              </div>
            </div>
            {selectedPackage && <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} variant="outline">Save Package</Button>}
          </div>
          <div className="grid md:grid-cols-5 gap-2">
            {BUILDER_STEPS.map((step) => (
              <button
                key={step.value}
                type="button"
                onClick={() => goBuilderStep(step.value)}
                className={`rounded-lg border px-3 py-2 text-left ${builderStep === step.value ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4] bg-[#F8F6F0] hover:border-[#C49A38]/60"}`}
              >
                <div className="text-xs font-semibold">{step.label}</div>
                <div className="text-[11px] text-[#6B7A99]">{step.helper}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "packages" && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-5">
          <aside className="bg-white border border-[#DDD5C4] rounded-lg p-4 space-y-3">
            <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-3 space-y-3">
              <div>
                <div className="text-sm font-semibold">Add package</div>
                <p className="text-[11px] text-[#6B7A99]">Name the paperwork package first. Custodian and depository are optional.</p>
              </div>
              <label className="block text-xs text-[#6B7A99]">
                Package name
                <Input
                  value={newPackageName}
                  onChange={(e) => setNewPackageName(e.target.value)}
                  placeholder="e.g. New Direction IRA Rollover"
                  className="mt-1 h-9 bg-white text-sm"
                />
              </label>
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-[#0F1C3F]">Optional custodian/depository</summary>
                <div className="mt-3 space-y-3">
                  <label className="block text-xs text-[#6B7A99]">
                    Custodian
                    <select value={newPackageCustodianId} onChange={(e) => setNewPackageCustodianId(e.target.value)} className="mt-1 w-full rounded border border-[#D4C9B5] bg-white px-3 py-2 text-sm">
                      <option value="">None</option>
                      {custodians.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-[#6B7A99]">
                    Depository
                    <select value={newPackageDepositoryId} onChange={(e) => setNewPackageDepositoryId(e.target.value)} className="mt-1 w-full rounded border border-[#D4C9B5] bg-white px-3 py-2 text-sm">
                      <option value="">None</option>
                      {depositories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </label>
                </div>
              </details>
              <Button onClick={createPackage} disabled={isSaving || !newPackageName.trim()} className="w-full bg-[#0F1C3F] hover:bg-[#182B5F]">Add Package</Button>
            </div>
            <div className="space-y-2 max-h-[560px] overflow-y-auto">
              {packages.map((pkg) => (
                  <div key={pkg.id} className={`rounded border px-3 py-2 ${selectedPackage?.id === pkg.id ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4] bg-white"}`}>
                    <button type="button" onClick={() => setSelectedPackageId(pkg.id)} className="w-full text-left">
                      <div className="font-medium text-sm">{pkg.name}</div>
                      <div className="text-xs text-[#6B7A99]">{pkg.custodian_name ?? "No custodian"} · {pkg.depository_name ?? "No depository"}</div>
                      <div className="text-[11px] text-[#8A9BB8]">v{pkg.version} · {pkg.status}</div>
                    </button>
                    <button type="button" onClick={() => deletePackage(pkg)} disabled={isDeletingPackage} className="mt-2 text-[11px] text-red-600 disabled:opacity-50">Delete package</button>
                  </div>
              ))}
            </div>
          </aside>

          <section className="bg-white border border-[#DDD5C4] rounded-lg p-5">
            {!selectedPackage ? <EmptyState message="Create a package to begin." /> : (
              <div className="space-y-5">
                <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                  <h2 className="text-lg font-semibold">{BUILDER_STEPS.find((step) => step.value === builderStep)?.label}</h2>
                  <p className="text-sm text-[#6B7A99] mt-1">
                    {builderStep === "documents" && "Start where Sally starts: add the documents that belong in this package and put them in the right order."}
                    {builderStep === "mapping" && "Use the document list on the left, the PDF page in the center, and the field list on the right to build the package questionnaire."}
                    {builderStep === "interview" && "This is the interview the system will generate from mapped fields that still need input."}
                    {builderStep === "finalize" && "Activate the package when documents, mappings, rules, and interview questions are ready for repeated use."}
                  </p>
                </div>
                {builderStep === "documents" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[#DDD5C4] bg-white p-4">
                      <LabeledInput
                        label="Package name"
                        value={selectedPackage.name}
                        onChange={(value) => updateSelectedPackage((pkg) => ({ ...pkg, name: value }))}
                      />
                      <p className="mt-2 text-xs text-[#8A9BB8]">This is the reusable package name staff will choose later when launching a customer interview.</p>
                    </div>
                    <details className="rounded-lg border border-[#DDD5C4] bg-white p-4">
                      <summary className="cursor-pointer text-sm font-semibold">Optional package routing and notes</summary>
                      <p className="mt-1 text-xs text-[#8A9BB8]">Custodian and depository are optional. Leave them blank for paperwork that does not require either one.</p>
                      <div className="mt-4 grid md:grid-cols-2 gap-4">
                        <label className="block text-sm">
                          <span className="block text-xs text-[#6B7A99] mb-1">Status</span>
                          <select value={selectedPackage.status} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, status: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="block text-xs text-[#6B7A99] mb-1">Custodian</span>
                          <select value={selectedPackage.custodian_id ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, custodian_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                            <option value="">None</option>
                            {custodians.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </label>
                        <label className="block text-sm">
                          <span className="block text-xs text-[#6B7A99] mb-1">Depository</span>
                          <select value={selectedPackage.depository_id ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, depository_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                            <option value="">None</option>
                            {depositories.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="mt-4 block text-sm">
                        <span className="block text-xs text-[#6B7A99] mb-1">Transaction type</span>
                        <select value={selectedPackage.transaction_scope} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, transaction_scope: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                          {transactionTypes.filter((item) => item.active || item.scope === selectedPackage.transaction_scope).map((item) => <option key={item.scope} value={item.scope}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="mt-4 block">
                        <span className="block text-xs text-[#6B7A99] mb-1">Description / interview notes</span>
                        <Textarea value={selectedPackage.description ?? ""} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, description: e.target.value }))} />
                      </label>
                    </details>
                    <details className="rounded-lg border border-[#DDD5C4] bg-white p-4">
                      <summary className="cursor-pointer text-sm font-semibold">Advanced lists and reusable fields</summary>
                      <p className="mt-1 text-xs text-[#8A9BB8]">Use these only when you need to manage custodians, depositories, transaction types, or the shared field library.</p>
                      <div className="mt-4 grid md:grid-cols-2 gap-4">
                        <EntityPanel
                          title="Custodians"
                          items={custodians}
                          onAdd={() => createEntity("custodians")}
                          onChange={(id, patch) => updateEntityLocal("custodians", id, patch)}
                          onSave={(item) => saveEntity("custodians", item)}
                        />
                        <EntityPanel
                          title="Depositories"
                          items={depositories}
                          onAdd={() => createEntity("depositories")}
                          onChange={(id, patch) => updateEntityLocal("depositories", id, patch)}
                          onSave={(item) => saveEntity("depositories", item)}
                        />
                      </div>
                      <div className="mt-4 space-y-4">
                        <TransactionTypesPanel
                          items={transactionTypes}
                          onAdd={createTransactionType}
                          onChange={updateTransactionTypeLocal}
                          onSave={saveTransactionType}
                        />
                        <FieldLibraryPanel
                          items={fieldLibrary}
                          onAdd={createFieldLibraryItem}
                          onChange={updateFieldLibraryLocal}
                          onSave={saveFieldLibraryItem}
                          onUse={addLibraryFieldToPackage}
                        />
                      </div>
                    </details>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">Package documents</h2>
                        <p className="text-xs text-[#8A9BB8]">The order below becomes the order of the generated paperwork packet.</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={addDocument} className="rounded border border-[#D4C9B5] px-3 py-2 text-sm text-[#6B7A99]">Add placeholder</button>
                        <label className="rounded bg-[#0F1C3F] px-3 py-2 text-sm text-white cursor-pointer">
                          Upload PDFs
                          <input
                            type="file"
                            accept="application/pdf"
                            multiple
                            className="sr-only"
                            onChange={(e) => {
                              if (e.target.files?.length) uploadDocuments(e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>
                    <div
                      onDragEnter={(e: ReactDragEvent<HTMLDivElement>) => {
                        e.preventDefault();
                        setIsDocumentDropActive(true);
                      }}
                      onDragOver={(e: ReactDragEvent<HTMLDivElement>) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                        setIsDocumentDropActive(true);
                      }}
                      onDragLeave={(e: ReactDragEvent<HTMLDivElement>) => {
                        e.preventDefault();
                        setIsDocumentDropActive(false);
                      }}
                      onDrop={(e: ReactDragEvent<HTMLDivElement>) => {
                        e.preventDefault();
                        setIsDocumentDropActive(false);
                        uploadDocuments(e.dataTransfer.files);
                      }}
                      className={`rounded-xl border-2 border-dashed p-6 text-center transition ${isDocumentDropActive ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#D4C9B5] bg-[#F8F6F0]"}`}
                    >
                      <div className="text-sm font-semibold text-[#0F1C3F]">Drag and drop multiple PDFs here</div>
                      <p className="mt-1 text-xs text-[#6B7A99]">Drop all paperwork documents at once. DocuFill will upload them in order and add each file to this package.</p>
                      <label className="mt-3 inline-flex cursor-pointer rounded border border-[#D4C9B5] bg-white px-3 py-2 text-xs font-medium text-[#0F1C3F]">
                        Browse PDF files
                        <input
                          type="file"
                          accept="application/pdf"
                          multiple
                          className="sr-only"
                          onChange={(e) => {
                            if (e.target.files?.length) uploadDocuments(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {isUploadingDocument && <div className="text-xs text-[#6B7A99]">Uploading PDF documents…</div>}
                    {selectedPackage.documents.length === 0 ? (
                      <EmptyState message="Upload the New Direction PDFs here, then arrange them into the order West Hills wants customers to receive them." />
                    ) : (
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {selectedPackage.documents.map((doc, index) => (
                          <div
                            key={doc.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("text/doc", doc.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              moveDocumentToIndex(e.dataTransfer.getData("text/doc"), index);
                            }}
                            className={`rounded-lg border p-3 ${selectedDocument?.id === doc.id ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4] bg-white"}`}
                          >
                            <DocumentPreviewTile
                              packageId={selectedPackage.id}
                              doc={doc}
                              order={index + 1}
                              selected={selectedDocument?.id === doc.id}
                              getAuthHeaders={getAuthHeaders}
                              previewCache={documentPreviewCache}
                              previewCacheOrder={documentPreviewCacheOrder}
                              onSelect={() => { setSelectedDocumentId(doc.id); setSelectedPage(1); }}
                            />
                            <Input value={doc.title} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, documents: pkg.documents.map((d) => d.id === doc.id ? { ...d, title: e.target.value } : d) }))} className="mt-2 h-8 text-xs" />
                            <div className="mt-1 text-[10px] text-[#8A9BB8] truncate">{doc.fileName ?? "Metadata only"} · {doc.pages} page{doc.pages === 1 ? "" : "s"}</div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <button onClick={() => moveDocument(doc.id, -1)} disabled={index === 0} className="text-[11px] text-[#6B7A99] disabled:opacity-40">Move up</button>
                              <button onClick={() => moveDocument(doc.id, 1)} disabled={index === selectedPackage.documents.length - 1} className="text-[11px] text-[#6B7A99] disabled:opacity-40">Move down</button>
                              <label className="text-[11px] text-[#C49A38] cursor-pointer">
                                Replace PDF
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadDocument(file, doc.id);
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              <button onClick={() => removeDocument(doc.id)} className="ml-auto text-[11px] text-red-600">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Save Document Order</Button>
                      <Button onClick={() => goBuilderStep("mapping")} variant="outline" disabled={selectedPackage.documents.length === 0}>Continue to Mapping</Button>
                    </div>
                  </div>
                )}
                {builderStep === "interview" && (
                  <div className="grid lg:grid-cols-[1fr_320px] gap-4">
                    <div className="rounded-lg border border-[#DDD5C4] bg-white p-4">
                      <h2 className="text-sm font-semibold mb-1">Generated interview questions</h2>
                      <p className="text-xs text-[#8A9BB8] mb-3">DocuFill will ask only for fields marked “Show in interview.” One answer can still fill many PDF placements.</p>
                      {packageInterviewFields.length === 0 ? <EmptyState message="No interview questions yet. Go back to Mapping Rules and mark fields that require customer or sales rep input." /> : (
                        <div className="space-y-2">
                          {packageInterviewFields.map((field, index) => (
                            <div key={field.id} className="rounded border border-[#EFE8D8] bg-[#F8F6F0] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-medium">{index + 1}. {field.name}</div>
                                  <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.required ? "required" : "optional"}{field.validationType && field.validationType !== "none" ? ` · validates as ${field.validationType}` : ""}{field.sensitive ? " · masked" : ""}</div>
                                </div>
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => moveField(field.id, -1)} className="rounded border border-[#D4C9B5] px-1.5 py-0.5 text-[10px]">Up</button>
                                  <button type="button" onClick={() => moveField(field.id, 1)} className="rounded border border-[#D4C9B5] px-1.5 py-0.5 text-[10px]">Down</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-[#DDD5C4] bg-white p-4">
                        <h3 className="text-sm font-semibold">Fixed, internal, or omitted</h3>
                        <p className="text-xs text-[#8A9BB8] mb-3">These can still print on PDFs from defaults/prefill, but they will not become customer questions unless shown in the interview.</p>
                        <div className="space-y-2 text-xs">
                          {packageFixedOrHiddenFields.length === 0 ? <div className="text-[#8A9BB8]">None yet.</div> : packageFixedOrHiddenFields.map((field) => (
                            <div key={field.id} className="rounded border border-[#EFE8D8] px-2 py-1">
                              <div className="font-medium">{field.name}</div>
                              <div className="text-[#6B7A99]">{field.interviewVisible ? "Shown" : "Omitted"}{field.defaultValue ? " · fixed/default value" : ""}{field.adminOnly ? " · admin only" : ""}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => goBuilderStep("mapping")} variant="outline">Edit Mapping Rules</Button>
                        <Button onClick={() => goBuilderStep("finalize")} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Continue to Finalize</Button>
                      </div>
                    </div>
                  </div>
                )}
                {builderStep === "finalize" && (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-3">
                      <SummaryCard label="Documents" value={String(selectedPackage.documents.length)} detail="Uploaded and ordered" />
                      <SummaryCard label="Fields" value={String(selectedPackage.fields.length)} detail={`${packageInterviewFields.length} interview questions`} />
                      <SummaryCard label="Placements" value={String(selectedPackage.mappings.length)} detail="PDF print locations" />
                      <SummaryCard label="Unmapped fields" value={String(unmappedPackageFields.length)} detail={unmappedPackageFields.length ? "Review before activating" : "Ready"} />
                    </div>
                    <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                      <h2 className="text-sm font-semibold mb-2">Package status</h2>
                      <p className="text-xs text-[#8A9BB8] mb-3">Set the package to Active when this paperwork workflow should be available in the Interviews tab and Deal Builder.</p>
                      <select value={selectedPackage.status} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, status: e.target.value }))} className="w-full max-w-sm border border-[#D4C9B5] rounded px-3 py-2 bg-white">
                        <option value="draft">Draft — not ready for staff/customer interviews</option>
                        <option value="active">Active — reusable interview can be launched</option>
                        <option value="inactive">Inactive — hidden from new interview launchers</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => savePackage({ ...selectedPackage, status: "active" })} disabled={isSaving || selectedPackage.documents.length === 0 || selectedPackage.mappings.length === 0} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Finalize and Activate Package</Button>
                      <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} variant="outline">Save Current Status</Button>
                      {selectedPackage.status === "active" && <Button onClick={() => { setStandalonePackageId(String(selectedPackage.id)); setTab("interview"); }} variant="outline">Go to Interview Launcher</Button>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "mapper" && (
        !selectedPackage ? <EmptyState message="Create or select a package first." /> : (
          <div className="grid lg:grid-cols-[190px_1fr_260px] gap-4 min-h-[720px]">
            <section className="bg-white border border-[#DDD5C4] rounded-lg p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Documents</h2>
                <label className="text-xs text-[#C49A38] cursor-pointer">
                  Add
                  <input
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      uploadDocument(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1">
                {selectedPackage.documents.map((doc, index) => (
                  <div
                    key={doc.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/doc", doc.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      moveDocumentToIndex(e.dataTransfer.getData("text/doc"), index);
                    }}
                    className={`border rounded p-2 ${selectedDocument?.id === doc.id ? "border-[#C49A38] bg-[#C49A38]/10" : "border-[#DDD5C4]"}`}
                  >
                    <DocumentPreviewTile
                      packageId={selectedPackage.id}
                      doc={doc}
                      order={index + 1}
                      selected={selectedDocument?.id === doc.id}
                      getAuthHeaders={getAuthHeaders}
                      previewCache={documentPreviewCache}
                      previewCacheOrder={documentPreviewCacheOrder}
                      onSelect={() => { setSelectedDocumentId(doc.id); setSelectedPage(1); }}
                    />
                    <Input value={doc.title} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, documents: pkg.documents.map((d) => d.id === doc.id ? { ...d, title: e.target.value } : d) }))} className="mt-2 h-8 text-xs" />
                    <div className="mt-1 text-[10px] text-[#8A9BB8] truncate">{doc.fileName ?? "Metadata only"}</div>
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => moveDocument(doc.id, -1)} className="text-[11px] text-[#6B7A99]">Up</button>
                      <button onClick={() => moveDocument(doc.id, 1)} className="text-[11px] text-[#6B7A99]">Down</button>
                      <label className="text-[11px] text-[#C49A38] cursor-pointer">
                        Replace
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadDocument(file, doc.id);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <button onClick={() => removeDocument(doc.id)} className="ml-auto text-[11px] text-red-600">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-[#DDD5C4] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Assign Package Fields and Rules</h2>
                  <p className="text-xs text-[#8A9BB8]">Place fields on PDFs, then decide which are required, fixed/defaulted, validated, or omitted from the generated interview.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelectedPage((page) => Math.max(1, page - 1))} disabled={!selectedDocument || selectedPage <= 1} className="text-xs border border-[#D4C9B5] rounded px-2 py-1 disabled:opacity-40">Prev</button>
                  <span className="text-xs text-[#6B7A99]">Page {selectedPage} of {Math.max(selectedDocument?.pages ?? 1, 1)}</span>
                  <button type="button" onClick={() => setSelectedPage((page) => Math.min(Math.max(selectedDocument?.pages ?? 1, 1), page + 1))} disabled={!selectedDocument || selectedPage >= Math.max(selectedDocument.pages, 1)} className="text-xs border border-[#D4C9B5] rounded px-2 py-1 disabled:opacity-40">Next</button>
                  <Button onClick={placeField} disabled={!selectedField || !selectedDocument} className="bg-[#C49A38] hover:bg-[#b58c31] text-black">Add Field to Page</Button>
                </div>
              </div>
              {isUploadingDocument && <div className="mb-2 text-xs text-[#6B7A99]">Uploading PDF…</div>}
              <div className="relative mx-auto bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner h-[620px] max-w-[720px] overflow-hidden flex items-center justify-center p-4">
                <div
                  ref={pageFrameRef}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={dropFieldOnPage}
                  onClick={() => setFormatMenu(null)}
                  className="relative bg-white border border-[#D4C9B5] shadow-sm max-w-full max-h-full overflow-hidden"
                  style={{ aspectRatio: selectedPageAspect, height: "100%" }}
                >
                  {documentPreviewUrl ? (
                    <object data={`${documentPreviewUrl}#page=${selectedPage}&toolbar=0&navpanes=0&view=FitH`} type="application/pdf" className="absolute inset-0 w-full h-full pointer-events-none">
                      <iframe title={selectedDocument?.title ?? "PDF preview"} src={documentPreviewUrl} className="w-full h-full" />
                    </object>
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
                  {pageMappings.map((m) => {
                    const field = selectedPackage.fields.find((f) => f.id === m.fieldId);
                    const isSelected = selectedMapping?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onPointerDown={(e) => beginMappingPointer(e, m, "move")}
                        onClick={() => { setSelectedMappingId(m.id); setSelectedFieldId(m.fieldId); }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedMappingId(m.id); setSelectedFieldId(m.fieldId); setFormatMenu({ mappingId: m.id, x: e.clientX, y: e.clientY }); }}
                        className={`absolute border-2 bg-white/90 rounded px-2 py-1 text-left shadow cursor-move ${isSelected ? "ring-2 ring-[#C49A38]/50" : ""}`}
                        style={{
                          left: `${m.x}%`,
                          top: `${m.y}%`,
                          width: `${m.w}%`,
                          height: `${m.h}%`,
                          minHeight: "20px",
                          borderColor: field?.color ?? "#C49A38",
                          fontSize: `${m.fontSize ?? 9}px`,
                          textAlign: m.align ?? "left",
                        }}
                      >
                        <span className="pointer-events-none block leading-tight">{field?.name ?? "Field"}</span>
                        <span className="pointer-events-none block text-[9px] uppercase tracking-wide text-[#6B7A99]">{labelForMappingFormat(m.format)}</span>
                        {isSelected && (
                          <span
                            onPointerDown={(e) => beginMappingPointer(e, m, "resize")}
                            className="absolute bottom-0 right-0 h-3 w-3 translate-x-1 translate-y-1 rounded-sm border border-[#0F1C3F] bg-[#C49A38] cursor-nwse-resize"
                          />
                        )}
                      </button>
                    );
                  })}
                  {formatMenu && (() => {
                    const mapping = selectedPackage.mappings.find((item) => item.id === formatMenu.mappingId);
                    const field = mapping ? selectedPackage.fields.find((item) => item.id === mapping.fieldId) : undefined;
                    const options = mappingFormatOptionsForField(field);
                    return mapping ? (
                      <div
                        className="fixed z-50 w-44 rounded-lg border border-[#D4C9B5] bg-white shadow-xl p-2"
                        style={{ left: Math.min(formatMenu.x, window.innerWidth - 190), top: Math.min(formatMenu.y, window.innerHeight - 330) }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="px-2 pb-1 text-[11px] font-semibold text-[#0F1C3F]">Print this as</div>
                        <div className="max-h-72 overflow-y-auto">
                          {options.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => chooseMappingFormat(mapping.id, option.value)}
                              className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8F6F0] ${mapping.format === option.value ? "bg-[#F8F6F0] text-[#0F1C3F] font-semibold" : "text-[#334155]"}`}
                            >
                              <span>{option.label}</span>
                              <span className="ml-1 text-[10px] text-[#8A9BB8]">{option.group}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Save {selectedPackage.fields.length} Fields / {selectedPackage.mappings.length} Placements</Button>
                <Button onClick={() => goBuilderStep("interview")} variant="outline">Review Generated Interview</Button>
              </div>
            </section>

            <section className="bg-white border border-[#DDD5C4] rounded-lg p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Fields</h2>
                <button onClick={addField} className="text-xs text-[#C49A38]">Add</button>
              </div>
              {fieldLibrary.filter((item) => item.active).length > 0 && (
                <label className="block mb-2">
                  <span className="block text-[11px] text-[#6B7A99] mb-1">Add from shared library</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const libraryField = fieldLibrary.find((item) => item.id === e.target.value);
                      if (libraryField) addLibraryFieldToPackage(libraryField);
                    }}
                    className="w-full border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white"
                  >
                    <option value="">Select reusable field</option>
                    {fieldLibrary.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.label} · {item.category}</option>)}
                  </select>
                </label>
              )}
              <div className="space-y-2 overflow-y-auto flex-1">
                {selectedPackage.fields.map((field, index) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/field", field.id)}
                    className={`w-full text-left border-2 rounded px-3 py-2 bg-white cursor-grab ${selectedField?.id === field.id ? "ring-2 ring-[#C49A38]/30" : ""}`}
                    style={{ borderColor: field.color }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => setSelectedFieldId(field.id)} className="text-left flex-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span>{field.name}</span>
                          {field.libraryFieldId && <span className="text-[10px] uppercase tracking-wide rounded bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8] px-1.5 py-0.5">Shared</span>}
                          {field.sensitive && <span className="text-[10px] uppercase tracking-wide rounded bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5">Sensitive</span>}
                        </div>
                        <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.interviewVisible ? "Interview" : "Admin default"}{field.required ? " · required" : ""}{field.sensitive ? " · masked" : ""}</div>
                      </button>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveField(field.id, -1)} disabled={index === 0} className="rounded border border-[#DDD5C4] px-1.5 py-0.5 text-[10px] disabled:opacity-40">Up</button>
                        <button type="button" onClick={() => moveField(field.id, 1)} disabled={index === selectedPackage.fields.length - 1} className="rounded border border-[#DDD5C4] px-1.5 py-0.5 text-[10px] disabled:opacity-40">Down</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {selectedField && (
                <div className="border-t border-[#DDD5C4] pt-3 mt-3 space-y-2">
                  <Input value={selectedField.name} onChange={(e) => updateSelectedField({ name: e.target.value })} disabled={selectedFieldIsShared} />
                  {selectedField.libraryFieldId && (
                    <div className="rounded border border-[#EFE8D8] bg-[#F8F6F0] px-2 py-1 text-[11px] text-[#6B7A99]">
                      <div>Linked to shared field: {fieldLibrary.find((item) => item.id === selectedField.libraryFieldId)?.label ?? selectedField.libraryFieldId}</div>
                      <button type="button" onClick={unlinkSelectedFieldFromLibrary} className="mt-1 text-[#C49A38]">Unlink for this package</button>
                    </div>
                  )}
                  <Input type="color" value={selectedField.color} onChange={(e) => updateSelectedField({ color: e.target.value })} />
                  <select value={selectedField.type} onChange={(e) => updateSelectedField({ type: e.target.value as FieldItem["type"] })} disabled={selectedFieldIsShared} className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm disabled:opacity-60">
                    <option value="text">Text box</option>
                    <option value="date">Date</option>
                    <option value="radio">Radio buttons</option>
                    <option value="checkbox">Checkboxes</option>
                    <option value="dropdown">Dropdown</option>
                  </select>
                  {selectedField.libraryFieldId && (
                    <label className="flex items-center gap-2 rounded border border-[#EFE8D8] bg-[#F8F6F0] px-2 py-1 text-[11px] text-[#6B7A99]">
                      <input
                        type="checkbox"
                        checked={selectedField.optionsMode === "inherit"}
                        onChange={(e) => updateSelectedField(e.target.checked ? { optionsMode: "inherit", options: undefined } : { optionsMode: "override", options: selectedField.options ?? [] })}
                      />
                      Inherit options from shared library
                    </label>
                  )}
                  <Textarea
                    placeholder={selectedField.optionsMode === "inherit" ? "Using shared library options" : "Package override options, one per line"}
                    value={(selectedField.options ?? []).join("\n")}
                    onChange={(e) => updateSelectedField({ optionsMode: "override", options: e.target.value.split("\n").filter(Boolean) })}
                    disabled={selectedField.optionsMode === "inherit"}
                  />
                  <Input type={selectedField.sensitive ? "password" : "text"} placeholder="Default/admin value" value={selectedField.defaultValue} onChange={(e) => updateSelectedField({ defaultValue: e.target.value })} />
                  <div className="rounded border border-[#EFE8D8] bg-[#F8F6F0] p-2 space-y-2">
                    <div className="text-xs font-semibold">Validation</div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedField.required === true} onChange={(e) => updateSelectedField({ required: e.target.checked })} disabled={selectedFieldIsShared} /> Required before packet generation</label>
                    <select value={selectedField.validationType ?? "none"} onChange={(e) => updateSelectedField({ validationType: e.target.value as FieldItem["validationType"] })} disabled={selectedFieldIsShared} className="w-full border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white disabled:opacity-60">
                      <option value="none">No format rule</option>
                      <option value="name">Name</option>
                      <option value="number">Number</option>
                      <option value="currency">Currency</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="date">Date</option>
                      <option value="ssn">SSN</option>
                      <option value="custom">Custom pattern</option>
                    </select>
                    {selectedField.validationType === "custom" && <Input placeholder="Regex pattern" value={selectedField.validationPattern ?? ""} onChange={(e) => updateSelectedField({ validationPattern: e.target.value })} disabled={selectedFieldIsShared} className="h-8 text-xs bg-white" />}
                    <Input placeholder="Custom validation message" value={selectedField.validationMessage ?? ""} onChange={(e) => updateSelectedField({ validationMessage: e.target.value })} disabled={selectedFieldIsShared} className="h-8 text-xs bg-white" />
                    {selectedFieldIsShared && <div className="text-[11px] text-[#8A9BB8]">Shared field rules are edited in the Shared Field Library. This package can still control options, visibility, defaults, color, mappings, and document placement.</div>}
                  </div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedField.interviewVisible} onChange={(e) => updateSelectedField({ interviewVisible: e.target.checked })} /> Show in interview</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedField.sensitive} onChange={(e) => updateSelectedField({ sensitive: e.target.checked })} disabled={selectedFieldIsShared} /> Sensitive — mask in internal summaries</label>
                  <button onClick={() => removeField(selectedField.id)} className="text-xs text-red-600">Remove field</button>
                </div>
              )}
              {selectedMapping && (
                <div className="border-t border-[#DDD5C4] pt-3 mt-3 space-y-2">
                  <div>
                    <h3 className="text-xs font-semibold">Selected placement</h3>
                    <p className="text-[11px] text-[#8A9BB8]">Drag on the PDF to move. Right-click the field to choose First, Last, Initials, or another print variant.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" min={5} max={24} value={selectedMapping.fontSize ?? 9} onChange={(e) => updateSelectedMapping({ fontSize: Number(e.target.value) })} className="h-8 text-xs" />
                    <select value={selectedMapping.align ?? "left"} onChange={(e) => updateSelectedMapping({ align: e.target.value as MappingItem["align"] })} className="border border-[#D4C9B5] rounded px-2 py-1 text-xs">
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                  <label className="block">
                    <span className="block text-[11px] text-[#6B7A99] mb-1">What should this placement print?</span>
                    <select value={selectedMapping.format ?? "as-entered"} onChange={(e) => updateSelectedMapping({ format: e.target.value as MappingItem["format"] })} className="w-full border border-[#D4C9B5] rounded px-2 py-1 text-xs">
                      {Array.from(new Set(selectedMappingFormatOptions.map((option) => option.group))).map((group) => (
                        <optgroup key={group} label={group}>
                          {selectedMappingFormatOptions.filter((option) => option.group === group).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </optgroup>
                      ))}
                  </select>
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    <Input type="number" value={Math.round(selectedMapping.x)} onChange={(e) => updateSelectedMapping({ x: clampPercent(Number(e.target.value), 0, 100) })} className="h-8 text-xs" />
                    <Input type="number" value={Math.round(selectedMapping.y)} onChange={(e) => updateSelectedMapping({ y: clampPercent(Number(e.target.value), 0, 100) })} className="h-8 text-xs" />
                    <Input type="number" value={Math.round(selectedMapping.w)} onChange={(e) => updateSelectedMapping({ w: clampPercent(Number(e.target.value), 3, 100) })} className="h-8 text-xs" />
                    <Input type="number" value={Math.round(selectedMapping.h)} onChange={(e) => updateSelectedMapping({ h: clampPercent(Number(e.target.value), 2, 100) })} className="h-8 text-xs" />
                  </div>
                  <div className="text-[10px] text-[#8A9BB8]">X · Y · W · H are saved as page percentages so placements survive different PDF sizes.</div>
                  <button type="button" onClick={removeSelectedMapping} className="text-xs text-red-600">Remove placement</button>
                </div>
              )}
            </section>
          </div>
        )
      )}

      {tab === "interview" && (
        <section className="bg-white border border-[#DDD5C4] rounded-lg p-5 max-w-4xl mx-auto">
          {!session ? (
            isPublicSession ? <EmptyState message="This interview link is invalid or expired." /> : (
              <div className="space-y-4">
                <EmptyState message="Launch a DocuFill package from Deal Builder, use a session link, or start a staff interview below." />
                <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                  <h2 className="text-sm font-semibold mb-2">Start a staff interview</h2>
                  <p className="text-xs text-[#8A9BB8] mb-3">Use this for workflows that do not originate from Deal Builder.</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select value={standalonePackageId} onChange={(e) => setStandalonePackageId(e.target.value)} className="flex-1 border border-[#D4C9B5] rounded px-3 py-2 text-sm bg-white">
                      <option value="">Select active package</option>
                      {activePackages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {labelForTransactionScope(pkg.transaction_scope)}</option>)}
                    </select>
                    <Button onClick={launchStandaloneInterview} disabled={!standalonePackageId || isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Start Interview</Button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">{session.package_name}</h2>
                <p className="text-sm text-[#6B7A99]">{session.custodian_name ?? "No custodian"} · {session.depository_name ?? "No depository"} · {labelForTransactionScope(session.transaction_scope)}</p>
                <p className="text-xs text-[#8A9BB8] mt-1">{answeredFieldCount} of {visibleInterviewFields.length} interview fields answered. Your progress is saved when you click Save Interview.</p>
              </div>
              {missingRequiredFields.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-semibold mb-1">Missing required fields</div>
                  <div className="flex flex-wrap gap-1">
                    {missingRequiredFields.map((name) => <span key={name} className="rounded bg-white border border-amber-200 px-2 py-0.5 text-xs">{name}</span>)}
                  </div>
                </div>
              )}
              <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                <h3 className="text-sm font-semibold mb-2">Prefilled from Deal Builder</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#6B7A99]">
                  {Object.entries(session.prefill ?? {}).filter(([, value]) => String(value ?? "").trim()).map(([key, value]) => (
                    <div key={key}><span className="font-medium text-[#0F1C3F]">{key}:</span> {getDocuFillPrefillDisplayValue(key, value, session.fields)}</div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {visibleInterviewFields.map((field) => (
                  <label key={field.id} className="block border rounded p-3" style={{ borderColor: field.color }}>
                    <span className="flex items-center justify-between gap-2 text-sm font-medium mb-1">
                      <span>{field.name}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${field.required ? "bg-red-50 text-red-700 border border-red-100" : "bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8]"}`}>{field.required ? "Required" : "Optional"}</span>
                    </span>
                    {field.type === "dropdown" ? (
                      <select value={interviewFieldValue(field, answers, session.prefill)} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                        <option value="">Select</option>
                        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <div className="space-y-1">{((field.options ?? []).length ? field.options ?? [] : ["Yes"]).map((option) => <label key={option} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={interviewFieldValue(field, answers, session.prefill).split(", ").includes(option)} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.checked ? [...interviewFieldValue(field, prev, session.prefill).split(", ").filter(Boolean), option].join(", ") : interviewFieldValue(field, prev, session.prefill).split(", ").filter((v) => v !== option).join(", ") }))} /> {option}</label>)}</div>
                    ) : (
                      <Input type={field.sensitive ? "password" : field.type === "date" ? "date" : "text"} value={interviewFieldValue(field, answers, session.prefill)} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} />
                    )}
                  </label>
                ))}
              </div>
              <div className="rounded border border-[#DDD5C4] bg-white p-4">
                <h3 className="text-sm font-semibold mb-2">Preview before send</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#6B7A99]">
                  {visibleInterviewFields.map((field) => {
                    const value = interviewFieldValue(field, answers, session.prefill).trim();
                    return <div key={field.id}><span className="font-medium text-[#0F1C3F]">{field.name}:</span> {value ? safeInterviewDisplayValue(field, value) : <span className="text-[#B58B2B]">{field.required ? "Missing" : "Not provided"}</span>}</div>;
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => saveAnswers()} disabled={isSaving} variant="outline">Save Interview</Button>
                <Button onClick={generatePacket} disabled={isSaving || missingRequiredFields.length > 0} className="bg-[#0F1C3F] hover:bg-[#182B5F] disabled:opacity-60">Generate Packet</Button>
                {generatedUrl && (
                  <button type="button" onClick={downloadGeneratedPacket} disabled={isDownloading} className="text-sm text-[#C49A38] underline disabled:opacity-60">
                    {isDownloading ? "Downloading…" : "Download packet PDF"}
                  </button>
                )}
                {driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" className="text-sm text-[#C49A38] underline">Open saved Drive packet</a>}
              </div>
              {driveWarnings.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{driveWarnings.join(" ")}</div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded border border-dashed border-[#D4C9B5] bg-white p-8 text-center text-sm text-[#6B7A99]">{message}</div>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#DDD5C4] bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-[#6B7A99]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-[#8A9BB8]">{detail}</div>
    </div>
  );
}

function DocumentPreviewTile({
  packageId,
  doc,
  order,
  selected,
  getAuthHeaders,
  previewCache,
  previewCacheOrder,
  onSelect,
}: {
  packageId: number;
  doc: DocItem;
  order: number;
  selected: boolean;
  getAuthHeaders: () => HeadersInit;
  previewCache: { current: Record<string, string> };
  previewCacheOrder: { current: string[] };
  onSelect: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    setFailed(false);
    if (!doc.pdfStored) return;
    const cacheKey = `${packageId}:${doc.id}`;
    const cachedUrl = previewCache.current[cacheKey];
    if (cachedUrl) {
      setPreviewUrl(cachedUrl);
      return;
    }
    fetch(`${API_BASE}/api/internal/docufill/packages/${packageId}/documents/${doc.id}.pdf`, { headers: { ...getAuthHeaders() } })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load document preview");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        previewCacheOrder.current = previewCacheOrder.current.filter((key) => key !== cacheKey);
        previewCacheOrder.current.push(cacheKey);
        previewCache.current[cacheKey] = objectUrl;
        while (previewCacheOrder.current.length > 24) {
          const oldestKey = previewCacheOrder.current.shift();
          if (!oldestKey) break;
          const oldestUrl = previewCache.current[oldestKey];
          if (oldestUrl) URL.revokeObjectURL(oldestUrl);
          delete previewCache.current[oldestKey];
        }
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [packageId, doc.id, doc.pdfStored, getAuthHeaders, previewCache, previewCacheOrder]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`relative w-full h-28 overflow-hidden rounded border bg-[#F8F6F0] text-left focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 ${selected ? "border-[#C49A38]" : "border-[#DDD5C4]"}`}
    >
      {previewUrl ? (
        <iframe
          title={`${doc.title} preview`}
          src={`${previewUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          className="absolute inset-0 h-[170%] w-full origin-top pointer-events-none bg-white"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center text-xs text-[#6B7A99]">
          <div className="font-semibold text-[#0F1C3F]">{order}</div>
          <div>{doc.pages} page(s)</div>
          <div>{failed ? "Preview unavailable" : doc.pdfStored ? "Loading preview" : "No PDF"}</div>
        </div>
      )}
      <div className="absolute left-1.5 top-1.5 rounded bg-white/90 border border-[#DDD5C4] px-1.5 py-0.5 text-[10px] font-semibold text-[#0F1C3F] shadow-sm">{order}</div>
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 border-t border-[#DDD5C4] px-2 py-1 text-[10px] text-[#6B7A99]">
        {doc.pages} page{doc.pages === 1 ? "" : "s"} · {doc.pdfStored ? "PDF preview" : "No PDF"}
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-[#6B7A99] mb-1">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function EntityPanel({
  title,
  items,
  onAdd,
  onChange,
  onSave,
}: {
  title: string;
  items: Entity[];
  onAdd: () => void;
  onChange: (id: number, patch: Partial<Entity>) => void;
  onSave: (item: Entity) => void;
}) {
  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button onClick={onAdd} className="text-xs text-[#C49A38]">Add</button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
        {items.map((item) => (
          <div key={item.id} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.name} onChange={(e) => onChange(item.id, { name: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Phone" value={item.phone ?? ""} onChange={(e) => onChange(item.id, { phone: e.target.value })} className="h-8 text-xs bg-white" />
              <Input placeholder="Email" value={item.email ?? ""} onChange={(e) => onChange(item.id, { email: e.target.value })} className="h-8 text-xs bg-white" />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-[#6B7A99]">
                <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} />
                Active
              </label>
              <button onClick={() => onSave(item)} className="text-[11px] text-[#C49A38]">Save</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">None yet.</div>}
      </div>
    </div>
  );
}

function TransactionTypesPanel({
  items,
  onAdd,
  onChange,
  onSave,
}: {
  items: TransactionType[];
  onAdd: () => void;
  onChange: (scope: string, patch: Partial<TransactionType>) => void;
  onSave: (item: TransactionType) => void;
}) {
  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Transaction Types</h3>
          <p className="text-[11px] text-[#8A9BB8]">Manage the active workflows available to packages and interview launchers.</p>
        </div>
        <button onClick={onAdd} className="text-xs text-[#C49A38]">Add</button>
      </div>
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <div key={item.scope} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.label} onChange={(e) => onChange(item.scope, { label: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-[#6B7A99]">
                <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.scope, { active: e.target.checked })} />
                Active
              </label>
              <button onClick={() => onSave(item)} className="text-[11px] text-[#C49A38]">Save</button>
            </div>
            <div className="text-[10px] text-[#8A9BB8]">{item.scope}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldLibraryPanel({
  items,
  onAdd,
  onChange,
  onSave,
  onUse,
}: {
  items: FieldLibraryItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<FieldLibraryItem>) => void;
  onSave: (item: FieldLibraryItem) => void;
  onUse: (item: FieldLibraryItem) => void;
}) {
  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Shared Field Library</h3>
          <p className="text-[11px] text-[#8A9BB8]">Define common customer, IRA, beneficiary, and signature fields once, then reuse them in custodian packages.</p>
        </div>
        <button onClick={onAdd} className="text-xs text-[#C49A38]">Add</button>
      </div>
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <div key={item.id} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.label} onChange={(e) => onChange(item.id, { label: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Category" value={item.category} onChange={(e) => onChange(item.id, { category: e.target.value })} className="h-8 text-xs bg-white" />
              <Input placeholder="Prefill source" value={item.source} onChange={(e) => onChange(item.id, { source: e.target.value })} className="h-8 text-xs bg-white" />
            </div>
            <Input
              type="number"
              placeholder="Sort order"
              value={item.sortOrder}
              onChange={(e) => onChange(item.id, { sortOrder: Number(e.target.value || 100) })}
              className="h-8 text-xs bg-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={item.type} onChange={(e) => onChange(item.id, { type: e.target.value as FieldItem["type"] })} className="border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white">
                <option value="text">Text</option>
                <option value="date">Date</option>
                <option value="radio">Radio</option>
                <option value="checkbox">Checkbox</option>
                <option value="dropdown">Dropdown</option>
              </select>
              <select value={item.validationType ?? "none"} onChange={(e) => onChange(item.id, { validationType: e.target.value as FieldItem["validationType"] })} className="border border-[#D4C9B5] rounded px-2 py-1 text-xs bg-white">
                <option value="none">No rule</option>
                <option value="name">Name</option>
                <option value="number">Number</option>
                <option value="currency">Currency</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="date">Date</option>
                <option value="ssn">SSN</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <Textarea placeholder="Options, one per line" value={item.options.join("\n")} onChange={(e) => onChange(item.id, { options: e.target.value.split("\n").filter(Boolean) })} className="min-h-16 text-xs bg-white" />
            {item.validationType === "custom" && <Input placeholder="Regex pattern" value={item.validationPattern ?? ""} onChange={(e) => onChange(item.id, { validationPattern: e.target.value })} className="h-8 text-xs bg-white" />}
            <Input placeholder="Validation message" value={item.validationMessage ?? ""} onChange={(e) => onChange(item.id, { validationMessage: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7A99]">
              <label className="flex items-center gap-1"><input type="checkbox" checked={item.active} onChange={(e) => onChange(item.id, { active: e.target.checked })} /> Active</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={item.required} onChange={(e) => onChange(item.id, { required: e.target.checked })} /> Required</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={item.sensitive} onChange={(e) => onChange(item.id, { sensitive: e.target.checked })} /> Sensitive</label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#8A9BB8]">{item.id}</span>
              <div className="flex gap-2">
                <button onClick={() => onUse(item)} className="text-[11px] text-[#6B7A99]">Use in package</button>
                <button onClick={() => onSave(item)} className="text-[11px] text-[#C49A38]">Save</button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">No shared fields yet.</div>}
      </div>
    </div>
  );
}
