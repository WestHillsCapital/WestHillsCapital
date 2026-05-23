import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { toast } from "@/hooks/use-toast";
import { useDocupleteStore } from "@/stores/useDocupleteStore";
import { useShallow } from "zustand/react/shallow";
import { Info, ChevronLeft, ChevronRight } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { DndContext, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { useLocation, useParams, useSearch } from "wouter";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { useUpgradeModal } from "@/hooks/useUpgradeModal";
import { useDocupleteConfig } from "@/hooks/useDocupleteConfig";
import { getCachedOrg } from "@/hooks/useOrgSettings";
import { getCachedProductOrg } from "@/hooks/useProductOrgSettings";
import { formatOrgTime } from "@/lib/orgDateFormat";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDocupletePrefillDisplayValue, ESIGN_FIELD_ID_SIGNATURE, ESIGN_FIELD_ID_INITIALS, ESIGN_FIELD_ID_DATE, isSystemEsignFieldId } from "@/lib/docuplete-redaction";
import { sessionToCsv, packageTemplateToCsv, downloadCsv, parseCsvString, batchResultsToCsv } from "@/lib/docuplete-csv";
import { validateFieldValue, fieldFormatHint } from "@/lib/validateField";
import * as pdfjsLib from "pdfjs-dist";
import {
  type FieldInterviewMode,
  type FieldCondition,
  type FieldItem,
  type MappingFormat,
  type MappingItem,
  type RecipientItem,
  type BrokenReference,
  type BrokenReferenceKind,
} from "@/lib/docuplete-types";
import { useDocupletePointer } from "@/hooks/useDocupletePointer";
import { MappingButton } from "@/components/MappingButton";
import { FieldCard } from "@/components/FieldCard";
import { PlacementModal } from "@/components/PlacementModal";
import { DocumentPreviewTile } from "@/components/DocumentPreviewTile";
import { EmptyState, SummaryCard, LabeledInput, EntityPanel, TransactionTypesPanel, FieldLibraryPanel, FieldGroupsPanel, ComplianceTagsPanel } from "@/components/DocupletePanels";
import type { Entity, TransactionType, DocItem, FieldLibraryItem, FieldVersionRow, FieldAnalytics, FieldGroup, PackageItem, ComplianceTag } from "@/lib/docuplete-local-types";
import { FieldEditorModal, type FieldEditorDraft } from "@/components/FieldEditorModal";
import { TagChipInput, PackagePickerWithTags, ScrollPageCanvas, EmbedSnippetPanel } from "@/components/DocupleteWidgets";
import { PackagePickerSidebar, type BuilderStep, BUILDER_STEPS } from "@/components/PackagePickerSidebar";
import { SortableItem, SmartPointerSensor, DragGuideLines, ResizeDimTooltip, type SortableItemRenderProps } from "@/components/DocupleteDndHelpers";
import { DemoWelcomeBanner } from "@/components/DemoWelcomeBanner";
import {
  MAPPING_FORMAT_OPTIONS,
  NAME_MAPPING_FORMATS,
  labelForMappingFormat,
  inferFieldCategory,
  sampleValueForMapping,
  mappingFormatOptionsForField,
  clampPercent,
  defaultMappingFormat,
  OPTION_COLORS,
} from "@/lib/docuplete-mapping-utils";
import {
  validationTypeHint,
  validateCellValue,
  tryReformatDate,
  tryAutoFix,
  autoFixLabel,
} from "@/lib/docuplete-field-utils";
import { DocupleteBuilderPanel } from "./DocupleteBuilderPanel";
import { DocupleteMapperPanel } from "./DocupleteMapperPanel";
import { DocupleteInterviewPanel } from "./DocupleteInterviewPanel";
import { DocupleteCsvPanel } from "./DocupleteCsvPanel";
import AppHelp from "@/pages/app/AppHelp";
import { AcroFieldReviewOverlay, type PendingAnnotation, type RowChoice } from "@/components/AcroFieldReviewOverlay";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
const PDFJS_STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

// In dev mode, always use the Vite proxy (relative "") so requests go to the
// local API server. In production, use the Railway URL from VITE_API_URL.
// We use import.meta.env.DEV (a Vite-native constant) rather than checking
// VITE_API_URL itself, because VITE_API_URL can be set in the dev environment
// and would otherwise be picked up by Vite's automatic VITE_* injection.
const API_BASE = import.meta.env.DEV
  ? ""
  : ((import.meta.env.VITE_API_URL as string | undefined) ?? "");
const CSV_BATCH_MAX = 100;
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
  if (!scope) return "";
  return DOCUFILL_TRANSACTION_TYPES.find((item) => item.value === scope)?.label ?? scope;
}

function normalizeTransactionScope(scope: string | null | undefined) {
  if (!scope) return "";
  if (DOCUFILL_TRANSACTION_TYPES.some((item) => item.value === scope)) return scope as string;
  const text = scope.toLowerCase();
  if (text.includes("contribution")) return "ira_contribution";
  if (text.includes("distribution")) return "ira_distribution";
  if (text.includes("cash")) return "cash_purchase";
  if (text.includes("storage")) return "storage_change";
  if (text.includes("beneficiary")) return "beneficiary_update";
  if (/^[a-z0-9_]{2,48}$/.test(scope)) return scope;
  return "";
}

type AcroAnnotation = {
  fieldName: string;
  rect: [number, number, number, number];
  fieldType: string;
  page: number;
};

type ComplianceAuditEntry = {
  fieldId: string;
  label: string;
  tags: string[];
};
type ComplianceAuditPackageRow = {
  packageId: number;
  packageName: string;
  status: string;
  present: ComplianceAuditEntry[];
  missing: ComplianceAuditEntry[];
  requiredMissingCount: number;
  hasGap: boolean;
};
type ComplianceAuditReport = {
  tags: Array<{ name: string; color: string; is_required: boolean }>;
  report: ComplianceAuditPackageRow[];
};

// ─── E-Sign system field sidebar definitions (IDs imported from shared lib) ──
const SYSTEM_ESIGN_FIELDS: Array<{ id: string; name: string; type: FieldItem["type"]; description: string }> = [
  { id: ESIGN_FIELD_ID_SIGNATURE, name: "Signature",   type: "text",     description: "Drawn or typed signature" },
  { id: ESIGN_FIELD_ID_INITIALS,  name: "Initials",    type: "initials", description: "Drawn or typed initials" },
  { id: ESIGN_FIELD_ID_DATE,      name: "Signer Date", type: "date",     description: "Auto-filled with today's date" },
];

function makeSystemEsignFieldItem(id: string, usedColors: string[]): FieldItem {
  const def = SYSTEM_ESIGN_FIELDS.find((f) => f.id === id);
  const color = "#9CA3AF";
  return {
    id,
    name: def?.name ?? id,
    color,
    type: def?.type ?? "text",
    interviewMode: "omitted",
    defaultValue: "",
    source: "esign-system",
    sensitive: false,
    validationType: "none",
  };
}
// ─────────────────────────────────────────────────────────────────────────────


type Session = {
  token: string;
  package_id?: number | string;
  package_name: string;
  group_name: string | null;
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
  link_emailed_at?: string | null;
  link_email_recipient?: string | null;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function brokenRefKindLabel(kind: BrokenReferenceKind): string {
  switch (kind) {
    case "condition":        return "visibility condition (primary)";
    case "condition2":       return "visibility condition (secondary)";
    case "copyFrom_trigger": return "auto-fill trigger";
    case "copyFrom_source":  return "auto-fill source field";
  }
}

function scanFieldDeps(fieldId: string, fieldName: string, fields: FieldItem[]): BrokenReference[] {
  const refs: BrokenReference[] = [];
  for (const f of fields) {
    if (f.id === fieldId) continue;
    if (f.condition?.fieldId === fieldId)
      refs.push({ id: newId("bref"), deletedFieldId: fieldId, deletedFieldName: fieldName, kind: "condition",        affectedFieldId: f.id, affectedFieldName: f.name });
    if (f.condition2?.fieldId === fieldId)
      refs.push({ id: newId("bref"), deletedFieldId: fieldId, deletedFieldName: fieldName, kind: "condition2",       affectedFieldId: f.id, affectedFieldName: f.name });
    if (f.copyFrom?.whenFieldId === fieldId)
      refs.push({ id: newId("bref"), deletedFieldId: fieldId, deletedFieldName: fieldName, kind: "copyFrom_trigger", affectedFieldId: f.id, affectedFieldName: f.name });
    if (f.copyFrom?.fieldId === fieldId)
      refs.push({ id: newId("bref"), deletedFieldId: fieldId, deletedFieldName: fieldName, kind: "copyFrom_source",  affectedFieldId: f.id, affectedFieldName: f.name });
  }
  return refs;
}

function loadBrokenRefs(pkgId: number): BrokenReference[] {
  try {
    const s = localStorage.getItem(`docuplete:brokenRefs:${pkgId}`);
    return s ? (JSON.parse(s) as BrokenReference[]) : [];
  } catch { return []; }
}

function saveBrokenRefs(pkgId: number, refs: BrokenReference[]): void {
  try {
    if (refs.length === 0) localStorage.removeItem(`docuplete:brokenRefs:${pkgId}`);
    else localStorage.setItem(`docuplete:brokenRefs:${pkgId}`, JSON.stringify(refs));
  } catch {}
}

// ─── Field-name fuzzy scoring (shared by AcroForm auto-map + library match) ───
const SCORE_MODIFIER_WORDS = new Set([
  "client", "mailing", "physical", "account", "applicant", "signer",
  "legal", "primary", "secondary", "billing", "home", "work", "middle",
  "holder", "registered", "beneficial", "joint", "co", "current",
]);
const SCORE_STOP_WORDS = new Set(["the", "a", "an", "of", "in", "for", "to", "on", "at", "by", "or", "and", "if"]);
const SCORE_FORMAT_HINTS = /\s*(mm[\/-]?dd[\/-]?yyyy|mmddyyyy|yyyymmdd|mm\/dd\/yy|\(mm\/dd\/yyyy\))\s*/gi;

function scoreNorm(name: string): string {
  return name
    .toLowerCase()
    .replace(SCORE_FORMAT_HINTS, " ")
    .replace(/\s+-\s+.*$/, "")
    .replace(/_\d+$/, "")
    .replace(/\s+\d+$/, "")
    .replace(/_/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function scoreStripMods(name: string): string {
  return name.split(" ").filter((w) => !SCORE_MODIFIER_WORDS.has(w)).join(" ").trim();
}
function scoreAcronym(name: string): string {
  return name.split(/\s+/).map((w) => w[0] ?? "").join("").toLowerCase();
}
function scoreMeaningfulWords(name: string): Set<string> {
  return new Set(name.split(/\s+/).filter((w) => w.length >= 2 && !SCORE_STOP_WORDS.has(w)));
}
function fieldNameScore(fieldName: string, pdfName: string): number {
  const nf = scoreNorm(fieldName); const np = scoreNorm(pdfName);
  if (nf === np) return 100;
  const sf = scoreStripMods(nf); const sp = scoreStripMods(np);
  if (sf === np || nf === sp || sf === sp) return 90;
  if (sf.length >= 2 && np.includes(sf)) return 75;
  if (sp.length >= 2 && nf.includes(sp)) return 75;
  if (nf.includes(np) || np.includes(nf)) return 70;
  if (sf.includes(sp) || sp.includes(sf)) return 70;
  const wf = scoreMeaningfulWords(sf); const wp = scoreMeaningfulWords(sp);
  if (wf.size > 0 && wp.size > 0) {
    const inter = [...wf].filter((w) => wp.has(w)).length;
    const union = new Set([...wf, ...wp]).size;
    const j = inter / union;
    if (j >= 0.5) return Math.round(40 + j * 30);
  }
  const acf = scoreAcronym(nf); const acp = scoreAcronym(np);
  if (acf.length >= 2 && acf === np) return 60;
  if (acp.length >= 2 && acp === nf) return 60;
  return 0;
}
const FIELD_NAME_SCORE_THRESHOLD = 35;


const FIELD_COLOR_PALETTE = [
  "#C48787", "#C4997A", "#C4A96A", "#8FAF82", "#6BAFA0",
  "#6B9EC4", "#7680C4", "#9474C4", "#B474C4", "#C474A4",
  "#C4A06B", "#7A9E82", "#7490C4", "#A08EC4", "#C49A38",
];

function isSensitiveValidationType(validationType: string | undefined | null): boolean {
  return validationType === "ssn" || validationType === "dob";
}

function pickFieldColor(usedColors: string[], sensitive: boolean): string {
  if (sensitive) return "#DC2626";
  const palette = getCachedProductOrg()?.field_palette ?? FIELD_COLOR_PALETTE;
  const available = palette.filter((c) => !usedColors.includes(c));
  const pool = available.length > 0 ? available : palette;
  return pool[Math.floor(Math.random() * pool.length)];
}

const RECIPIENT_COLOR_PALETTE = [
  "#7490C4", "#7AAF8F", "#9474C4", "#C4A06B",
  "#C47EA8", "#6BAFA0", "#C48787", "#8FAF82",
];

function pickRecipientColor(usedColors: string[]): string {
  const available = RECIPIENT_COLOR_PALETTE.filter((c) => !usedColors.includes(c));
  return available.length > 0 ? available[0] : RECIPIENT_COLOR_PALETTE[usedColors.length % RECIPIENT_COLOR_PALETTE.length];
}

function newRecipientId(): string {
  return `recip_${Math.random().toString(36).slice(2, 10)}`;
}


function normalizePackages(items: PackageItem[]): PackageItem[] {
  return items.map((pkg) => ({
    ...pkg,
    group_ids: Array.isArray((pkg as PackageItem & { group_ids?: unknown }).group_ids)
      ? ((pkg as PackageItem & { group_ids?: unknown }).group_ids as unknown[]).map(Number).filter(Boolean)
      : pkg.group_id ? [pkg.group_id] : [],
    transaction_scope: normalizeTransactionScope(pkg.transaction_scope),
    documents: Array.isArray(pkg.documents) ? pkg.documents : [],
    fields: Array.isArray(pkg.fields) ? pkg.fields.map((field) => {
      const raw = field as FieldItem & { interviewVisible?: boolean; adminOnly?: boolean; required?: boolean };
      const validModes: FieldInterviewMode[] = ["required", "optional", "readonly", "omitted"];
      const legacyMode: FieldInterviewMode = (!raw.interviewVisible || raw.adminOnly) ? "omitted" : raw.required ? "required" : "optional";
      return {
        ...field,
        libraryFieldId: field.libraryFieldId ? String(field.libraryFieldId) : "",
        sensitive: field.sensitive === true || isSensitiveValidationType(field.validationType),
        interviewMode: isSystemEsignFieldId(field.id) ? "omitted" : (validModes.includes(raw.interviewMode) ? raw.interviewMode : legacyMode),
        options: Array.isArray(field.options) ? field.options : undefined,
        optionsMode: field.optionsMode === "inherit" || field.optionsMode === "override" ? field.optionsMode : field.libraryFieldId && (!Array.isArray(field.options) || field.options.length === 0) ? "inherit" : "override",
        validationType: field.validationType ?? "none",
        validationPattern: field.validationPattern ?? "",
        validationMessage: field.validationMessage ?? "",
      };
    }) : [],
    mappings: Array.isArray(pkg.mappings) ? pkg.mappings.map((mapping) => ({
      ...mapping,
      fontSize: Number(mapping.fontSize ?? 11),
      align: mapping.align ?? "left",
      format: mapping.format ?? "as-entered",
    })) : [],
    recipients: Array.isArray(pkg.recipients) ? pkg.recipients : [],
    enable_interview: pkg.enable_interview !== false,
    enable_csv: pkg.enable_csv !== false,
    enable_customer_link: pkg.enable_customer_link === true,
    webhook_enabled: (pkg as PackageItem & Record<string, unknown>).webhook_enabled === true,
    webhook_url: typeof (pkg as PackageItem & Record<string, unknown>).webhook_url === "string" ? (pkg as PackageItem & Record<string, unknown>).webhook_url as string : null,
    slack_notifications_enabled: (pkg as PackageItem & Record<string, unknown>).slack_notifications_enabled === true,
    notify_staff_on_submit: (pkg as PackageItem & Record<string, unknown>).notify_staff_on_submit === true,
    notify_client_on_submit: (pkg as PackageItem & Record<string, unknown>).notify_client_on_submit === true,
    enable_embed: (pkg as PackageItem & Record<string, unknown>).enable_embed === true,
    embed_key: typeof (pkg as PackageItem & Record<string, unknown>).embed_key === "string" ? (pkg as PackageItem & Record<string, unknown>).embed_key as string : null,
    enable_gdrive: (pkg as PackageItem & Record<string, unknown>).enable_gdrive === true,
    enable_hubspot: (pkg as PackageItem & Record<string, unknown>).enable_hubspot === true,
    auth_level: (pkg as PackageItem & Record<string, unknown>).auth_level === "email_otp" ? "email_otp" as const : "none" as const,
    require_preview: (pkg as PackageItem & Record<string, unknown>).require_preview === true,
    require_scroll_confirmation: (pkg as PackageItem & Record<string, unknown>).require_scroll_confirmation === true,
    tags: Array.isArray((pkg as PackageItem & { tags?: unknown }).tags)
      ? ((pkg as PackageItem & { tags?: unknown }).tags as unknown[]).map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
      : [],
  }));
}

function normalizeFieldLibrary(items: FieldLibraryItem[]): FieldLibraryItem[] {
  return Array.isArray(items) ? items.map((item) => {
    // isGlobal means account_id IS NULL in the DB — platform-level seed fields.
    // These are fully editable defaults, NOT read-only. Only enterprise parent-inherited
    // fields (item.inherited = true from the API) remain read-only.
    const raw = item as FieldLibraryItem & { isGlobal?: boolean };
    return {
      ...item,
      // Numeric DB ids (account-created fields) must be coerced to strings so that
      // strict-equality comparisons against libraryFieldId (always a string) work.
      id: String((item as FieldLibraryItem & { id: unknown }).id ?? ""),
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
      inherited: item.inherited === true,
      inheritedFrom: item.inheritedFrom,
      locked: raw.locked === true,
    };
  }) : [];
}

const SEMANTIC_PREFILL_LABELS: Record<string, string> = {
  "email": "email", "email address": "email", "client email": "email", "e-mail": "email", "e-mail address": "email",
  "first name": "firstName", "client first name": "firstName", "given name": "firstName",
  "last name": "lastName", "client last name": "lastName", "surname": "lastName", "family name": "lastName",
  "full name": "fullName", "name": "fullName", "client name": "fullName",
  "date of birth": "dateOfBirth", "client date of birth": "dateOfBirth", "dob": "dateOfBirth", "birth date": "dateOfBirth", "birthday": "dateOfBirth",
  "phone": "phone", "phone number": "phone", "mobile": "phone", "mobile number": "phone", "cell phone": "phone", "telephone": "phone",
  "address": "addressLine1", "street address": "addressLine1", "address line 1": "addressLine1", "address 1": "addressLine1", "client address": "addressLine1",
  "city": "city", "state": "state",
  "zip": "zip", "zip code": "zip", "postal code": "zip",
};

function interviewFieldValue(field: FieldItem, answers: Record<string, string>, prefill: Record<string, string> | undefined) {
  const labelKey = SEMANTIC_PREFILL_LABELS[(field.name ?? "").toLowerCase().trim()];
  const ciLookup = (key: string | undefined) => {
    if (!key || !prefill) return undefined;
    const lower = key.toLowerCase();
    const match = Object.keys(prefill).find((k) => k.toLowerCase() === lower);
    return match ? prefill[match] : undefined;
  };
  return String(
    answers[field.id]
    ?? (field.source ? prefill?.[field.source] : undefined)
    ?? prefill?.[field.name]
    ?? ciLookup(field.name)
    ?? ciLookup(field.name)
    ?? (labelKey ? prefill?.[labelKey] : undefined)
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


export default function Docuplete() {
  const search = useSearch();
  const params = useParams<{ token?: string }>();
  const [, navigate] = useLocation();
  const publicSessionToken = params.token ?? null;
  const sessionToken = publicSessionToken ?? new URLSearchParams(search).get("session");
  const isPublicSession = Boolean(publicSessionToken);
  const { getAuthHeaders: defaultGetAuthHeaders } = useInternalAuth();
  const { show: showUpgrade } = useUpgradeModal();
  const docupleteConfig = useDocupleteConfig();
  const getAuthHeaders = docupleteConfig?.getAuthHeaders ?? defaultGetAuthHeaders;
  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;
  const docupleteApiPath = docupleteConfig?.apiPath ?? "/api/internal/docuplete";
  const interviewBasePath = docupleteConfig?.interviewBasePath ?? "/internal/docuplete";
  const isAdmin = docupleteConfig?.isAdmin ?? true;

  // Capture deep-link URL params on first mount (before they are cleared)
  const _initSp = new URLSearchParams(search);
  const initialUrlAction = useRef(_initSp.get("action"));
  const initialUrlPkgId = useRef<number | null>((() => {
    const n = parseInt(_initSp.get("packageId") ?? "", 10);
    return isNaN(n) ? null : n;
  })());
  const urlParamsApplied = useRef(false);

  const [tab, setTab] = useState<"packages" | "mapper" | "sessions" | "batch" | "library" | "help">(() => {
    if (sessionToken) return "sessions";
    if (_initSp.get("tab") === "sessions") return "sessions";
    try {
      const saved = sessionStorage.getItem("docuplete:tab");
      if (saved === "packages" || saved === "mapper" || saved === "sessions" || saved === "batch" || saved === "library") return saved;
    } catch { /* sessionStorage unavailable */ }
    return "packages";
  });
  const [builderStep, setBuilderStep] = useState<BuilderStep>(() => {
    try {
      const saved = sessionStorage.getItem("docuplete:builderStep");
      if (saved === "documents" || saved === "mapping" || saved === "interview") return saved;
    } catch { /* sessionStorage unavailable */ }
    return "documents";
  });
  const [librarySubTab, setLibrarySubTab] = useState<"fields" | "field-groups" | "types" | "groups" | "compliance" | "tags">("fields");
  const [libraryOpenFieldId, setLibraryOpenFieldId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Entity[]>([]);
  const [custodians, setCustodians] = useState<Entity[]>([]);
  const [depositories, setDepositories] = useState<Entity[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [inlineAddTypeOpen, setInlineAddTypeOpen] = useState(false);
  const [inlineAddTypeName, setInlineAddTypeName] = useState("");
  const [inlineAddTypeLoading, setInlineAddTypeLoading] = useState(false);
  const [inlineAddTypeError, setInlineAddTypeError] = useState<string | null>(null);
  const [inlineAddGroupOpen, setInlineAddGroupOpen] = useState(false);
  const [inlineAddGroupName, setInlineAddGroupName] = useState("");
  const [inlineAddGroupLoading, setInlineAddGroupLoading] = useState(false);
  const [inlineAddGroupError, setInlineAddGroupError] = useState<string | null>(null);
  const [fieldModalSaving, setFieldModalSaving] = useState(false);
  const [typeManageOpen, setTypeManageOpen] = useState(false);
  const [typeDeletingScope, setTypeDeletingScope] = useState<string | null>(null);
  const [fieldLibrary, setFieldLibrary] = useState<FieldLibraryItem[]>([]);
  const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([]);
  const [complianceTags, setComplianceTags] = useState<ComplianceTag[]>([]);
  const [complianceAudit, setComplianceAudit] = useState<ComplianceAuditReport | null>(null);
  const [complianceAuditLoading, setComplianceAuditLoading] = useState(false);
  const [complianceAuditError, setComplianceAuditError] = useState<string | null>(null);
  const [bootstrapLoaded, setBootstrapLoaded] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [demoUiState, setDemoUiState] = useState<"try" | "open" | "dismissed">(() => {
    try {
      const v = localStorage.getItem("docuplete:demo-ui");
      if (v === "open" || v === "dismissed") return v as "open" | "dismissed";
    } catch { /* localStorage unavailable */ }
    return "try";
  });
  const [demoSessionLoading, setDemoSessionLoading] = useState(false);
  const [standalonePackageId, setStandalonePackageId] = useState("");
  const [customerLinkPackageId, setCustomerLinkPackageId] = useState("");
  const [customerLinkFirstName, setCustomerLinkFirstName] = useState("");
  const [customerLinkLastName, setCustomerLinkLastName] = useState("");
  const [customerLinkEmail, setCustomerLinkEmail] = useState("");
  const [generatedCustomerLink, setGeneratedCustomerLink] = useState<string | null>(null);
  const [generatedCustomerLinkToken, setGeneratedCustomerLinkToken] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showSendLinkForm, setShowSendLinkForm] = useState(false);
  const [sendLinkEmail, setSendLinkEmail] = useState("");
  const [sendLinkName, setSendLinkName] = useState("");
  const [sendLinkMessage, setSendLinkMessage] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkEmailSent, setLinkEmailSent] = useState<string | null>(null);
  const [linkEmailError, setLinkEmailError] = useState<string | null>(null);
  const [showRecipientOverride, setShowRecipientOverride] = useState(false);
  // Send-for-signature (from staff interview, sensitive fields deferred to signer)
  const [sigLink, setSigLink] = useState<string | null>(null);
  const [sigLinkToken, setSigLinkToken] = useState<string | null>(null);
  const [sigLinkCopied, setSigLinkCopied] = useState(false);
  const [isSendingForSig, setIsSendingForSig] = useState(false);
  const [showSigSendForm, setShowSigSendForm] = useState(false);
  const [sigSendEmail, setSigSendEmail] = useState("");
  const [sigSendName, setSigSendName] = useState("");
  const [sigSendMessage, setSigSendMessage] = useState("");
  const [sigSendEmailSent, setSigSendEmailSent] = useState<string | null>(null);
  const [sigSendError, setSigSendError] = useState<string | null>(null);
  const [isSendingSigEmail, setIsSendingSigEmail] = useState(false);
  const [newPackageName, setNewPackageName] = useState("");
  const [newPackageGroupId, setNewPackageGroupId] = useState("");
  const [addingPackage, setAddingPackage] = useState(() => initialUrlAction.current === "new-package");
  const newPackageInputRef = useRef<HTMLInputElement | null>(null);
  const [interviewOutputTab, setInterviewOutputTab] = useState<"staff" | "customerLink">("staff");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [mappingStartedDocIds, setMappingStartedDocIds] = useState<Set<string>>(() => new Set());
  const selectedFieldId = useDocupleteStore((s) => s.selectedFieldId);
  const setSelectedFieldId = useDocupleteStore((s) => s.setSelectedFieldId);
  const selectedMappingId = useDocupleteStore((s) => s.selectedMappingId);
  const setSelectedMappingId = useDocupleteStore((s) => s.setSelectedMappingId);
  const packages = useDocupleteStore((s) => s.packages);
  const selectedPackageId = useDocupleteStore((s) => s.selectedPackageId);
  const setPackages = useDocupleteStore((s) => s.setPackages);
  const setSelectedPackageId = useDocupleteStore((s) => s.setSelectedPackageId);
  const updateSelectedPackage = useDocupleteStore((s) => s.updateSelectedPackage);
  const [inspectorMode, setInspectorMode] = useState<"panel" | "modal">(() => {
    const stored = localStorage.getItem("docuplete-inspector-mode");
    return stored === "modal" ? "modal" : "panel";
  });
  const [fieldEditorModal, setFieldEditorModal] = useState<{ mode: "add" | "edit"; fieldId: string | null } | null>(null);
  const [fieldEditorPos, setFieldEditorPos] = useState({ x: 0, y: 0 });
  const [fieldEditorIsDragging, setFieldEditorIsDragging] = useState(false);
  const fieldEditorDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const fieldEditorPanelRef = useRef<HTMLDivElement>(null);
  const fieldEditorDragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { fieldEditorDragCleanupRef.current?.(); }, []);
  const isFieldEditorOpen = !!fieldEditorModal;
  useEffect(() => {
    if (isFieldEditorOpen) setFieldEditorPos({ x: 0, y: 0 });
  }, [isFieldEditorOpen]);
  useEffect(() => {
    if (!isFieldEditorOpen) return;
    const onResize = () => {
      const panel = fieldEditorPanelRef.current;
      if (!panel) return;
      const { width, height } = panel.getBoundingClientRect();
      const maxX = (window.innerWidth - width) / 2;
      const maxY = (window.innerHeight - height) / 2;
      setFieldEditorPos(prev => ({
        x: Math.max(-maxX, Math.min(maxX, prev.x)),
        y: Math.max(-maxY, Math.min(maxY, prev.y)),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isFieldEditorOpen]);
  const handleFieldEditorDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    fieldEditorDragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: fieldEditorPos.x, startPosY: fieldEditorPos.y };
    setFieldEditorIsDragging(true);
    const onMove = (ev: MouseEvent) => {
      if (!fieldEditorDragRef.current) return;
      const dx = ev.clientX - fieldEditorDragRef.current.startX;
      const dy = ev.clientY - fieldEditorDragRef.current.startY;
      const newX = fieldEditorDragRef.current.startPosX + dx;
      const newY = fieldEditorDragRef.current.startPosY + dy;
      const panel = fieldEditorPanelRef.current;
      if (panel) {
        const { width, height } = panel.getBoundingClientRect();
        const maxX = (window.innerWidth - width) / 2;
        const maxY = (window.innerHeight - height) / 2;
        setFieldEditorPos({ x: Math.max(-maxX, Math.min(maxX, newX)), y: Math.max(-maxY, Math.min(maxY, newY)) });
      } else {
        setFieldEditorPos({ x: newX, y: newY });
      }
    };
    const cleanup = () => {
      fieldEditorDragRef.current = null;
      setFieldEditorIsDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      fieldEditorDragCleanupRef.current = null;
    };
    const onUp = cleanup;
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    fieldEditorDragCleanupRef.current = cleanup;
  }, [fieldEditorPos.x, fieldEditorPos.y]);

  const handleFieldEditorTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    fieldEditorDragRef.current = { startX: touch.clientX, startY: touch.clientY, startPosX: fieldEditorPos.x, startPosY: fieldEditorPos.y };
    setFieldEditorIsDragging(true);
    const onMove = (ev: TouchEvent) => {
      if (!fieldEditorDragRef.current || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      const dx = t.clientX - fieldEditorDragRef.current.startX;
      const dy = t.clientY - fieldEditorDragRef.current.startY;
      const newX = fieldEditorDragRef.current.startPosX + dx;
      const newY = fieldEditorDragRef.current.startPosY + dy;
      const panel = fieldEditorPanelRef.current;
      if (panel) {
        const { width, height } = panel.getBoundingClientRect();
        const maxX = (window.innerWidth - width) / 2;
        const maxY = (window.innerHeight - height) / 2;
        setFieldEditorPos({ x: Math.max(-maxX, Math.min(maxX, newX)), y: Math.max(-maxY, Math.min(maxY, newY)) });
      } else {
        setFieldEditorPos({ x: newX, y: newY });
      }
    };
    const cleanup = () => {
      fieldEditorDragRef.current = null;
      setFieldEditorIsDragging(false);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      fieldEditorDragCleanupRef.current = null;
    };
    const onEnd = cleanup;
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    fieldEditorDragCleanupRef.current = cleanup;
  }, [fieldEditorPos.x, fieldEditorPos.y]);
  const [fieldEditorDraft, setFieldEditorDraft] = useState<FieldEditorDraft>({ name: "", color: "#C49A38", type: "text", options: [], interviewMode: "optional", hasDefault: false, defaultValue: "", validationType: "none", validationPattern: "", validationMessage: "", packageOnly: false, condition: null, condition2: null, conditionOperator: "and", sumGroup: "", copyFrom: null });
  const sortSensors = useSensors(useSensor(SmartPointerSensor, { activationConstraint: { distance: 6 } }));
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<null | { ok: boolean; message: string }>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookSecretLoading, setWebhookSecretLoading] = useState(false);
  const [webhookSecretRevealed, setWebhookSecretRevealed] = useState(false);
  const [webhookSecretCopied, setWebhookSecretCopied] = useState(false);
  const [webhookDeliveries, setWebhookDeliveries] = useState<Array<{ id: number; event_type: string; attempt_number: number; http_status: number | null; response_body: string; duration_ms: number; created_at: string; has_payload: boolean; }>>([]);
  const [webhookDeliveriesLoading, setWebhookDeliveriesLoading] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<number | null>(null);
  const [retryingDelivery, setRetryingDelivery] = useState<number | null>(null);
  const [isDeletingPackage, setIsDeletingPackage] = useState(false);
  const [brokenRefs, setBrokenRefs] = useState<BrokenReference[]>([]);
  const [deleteGuard, setDeleteGuard] = useState<{
    fieldId: string; fieldName: string; deps: BrokenReference[]; replacementFieldId: string;
  } | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [isDocumentDropActive, setIsDocumentDropActive] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [driveWarnings, setDriveWarnings] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [placementModal, setPlacementModal] = useState<{ mappingId: string; pdfX: number; pdfY: number } | null>(null);
  const [placementModalPos, setPlacementModalPos] = useState<{ x: number; y: number } | null>(null);
  const fieldDragFromHandle = useRef(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientsExpanded, setRecipientsExpanded] = useState(true);
  const [selectedPage, setSelectedPage] = useState(1);
  const pageFrameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  // Scroll-mode PDF doc as React state so ScrollPageCanvas re-renders when it's ready.
  const [scrollPdfDoc, setScrollPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const pushUndo = useDocupleteStore((s) => s.pushUndo);
  const popUndo = useDocupleteStore((s) => s.popUndo);
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const mapperContainerRef = useRef<HTMLElement | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveEnabledRef = useRef(false);
  const prevPackageContentRef = useRef<{ fields: unknown; documents: unknown; pkgId: number | null } | null>(null);
  const [mapperContainerWidth, setMapperContainerWidth] = useState(800);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [acroAnnotations, setAcroAnnotations] = useState<AcroAnnotation[]>([]);
  const [showAcroLayer, setShowAcroLayer] = useState(true);
  const [pendingAcroReview, setPendingAcroReview] = useState<{
    documentId: string;
    docTitle: string;
    annotations: PendingAnnotation[];
  } | null>(null);
  const [pendingAcroReviewQueue, setPendingAcroReviewQueue] = useState<Array<{
    documentId: string;
    docTitle: string;
    annotations: PendingAnnotation[];
  }>>([]);
  const [pendingAcroReviewTotal, setPendingAcroReviewTotal] = useState(0);
  const mapperTextMode = useDocupleteStore((s) => s.mapperTextMode);
  const setMapperTextMode = useDocupleteStore((s) => s.setMapperTextMode);
  const [snapGrid, setSnapGrid] = useState<boolean>(() => {
    try { return localStorage.getItem("docuplete-snap-grid") === "true"; } catch { return false; }
  });
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);
  const shortcutsPopoverRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showShortcutsPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (shortcutsPopoverRef.current && !shortcutsPopoverRef.current.contains(e.target as Node)) {
        setShowShortcutsPopover(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowShortcutsPopover(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [showShortcutsPopover]);
  useEffect(() => {
    try { localStorage.setItem("docuplete-snap-grid", snapGrid ? "true" : "false"); } catch { /* ignore */ }
  }, [snapGrid]);
  const [mapperScrollMode, setMapperScrollMode] = useState<boolean>(() => {
    try { return localStorage.getItem("docuplete-mapper-scroll") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("docuplete-mapper-scroll", mapperScrollMode ? "true" : "false"); } catch { /* ignore */ }
  }, [mapperScrollMode]);
  const [userZoom, setUserZoom] = useState(1.0);
  const [isPdfRendering, setIsPdfRendering] = useState(false);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);
  const documentPreviewCache = useRef<Record<string, string>>({});
  const documentPreviewCacheOrder = useRef<string[]>([]);
  const [csvBatchPackageId, setCsvBatchPackageId] = useState<string>(() => {
    try { return localStorage.getItem("csvBatchPackageId") ?? ""; } catch { return ""; }
  });
  useEffect(() => {
    try { localStorage.setItem("csvBatchPackageId", csvBatchPackageId); } catch { /* ignore */ }
  }, [csvBatchPackageId]);
  const [csvBatchFile, setCsvBatchFile] = useState<File | null>(null);
  const [csvBatchHeaders, setCsvBatchHeaders] = useState<string[]>([]);
  const [csvBatchRows, setCsvBatchRows] = useState<Record<string, string>[]>([]);
  const [csvBatchOriginalRows, setCsvBatchOriginalRows] = useState<Record<string, string>[]>([]);
  const [csvBatchMismatch, setCsvBatchMismatch] = useState(false);
  const [csvBatchIsImporting, setCsvBatchIsImporting] = useState(false);
  const [csvBatchHasEdits, setCsvBatchHasEdits] = useState(false);
  const [csvCorrectedDownloaded, setCsvCorrectedDownloaded] = useState(false);
  type BatchResult = { rowIndex: number; token: string | null; status: "created" | "error" | "processing"; error?: string };
  const [csvBatchResults, setCsvBatchResults] = useState<BatchResult[] | null>(null);
  const [csvBatchError, setCsvBatchError] = useState<string | null>(null);
  const csvBatchFileInputRef = useRef<HTMLInputElement | null>(null);
  const csvBatchBreakdownRef = useRef<HTMLDivElement | null>(null);
  const csvCorrectedDownloadedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (csvCorrectedDownloadedTimerRef.current) clearTimeout(csvCorrectedDownloadedTimerRef.current); }, []);
  const csvEditNavigatingRef = useRef(false);
  const prevSelectedPackageIdRef = useRef<number | null>(null);
  const [csvBreakdownHighlightedField, setCsvBreakdownHighlightedField] = useState<string | null>(null);
  const [showCsvFieldKey, setShowCsvFieldKey] = useState(false);
  const [csvBatchFieldBreakdownOpen, setCsvBatchFieldBreakdownOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("csvBatchFieldBreakdownOpen") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("csvBatchFieldBreakdownOpen", csvBatchFieldBreakdownOpen ? "true" : "false"); } catch { /* ignore */ }
  }, [csvBatchFieldBreakdownOpen]);
  const [csvColumnsExpanded, setCsvColumnsExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem("csvColumnsExpanded") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("csvColumnsExpanded", csvColumnsExpanded ? "true" : "false"); } catch { /* ignore */ }
  }, [csvColumnsExpanded]);
  const [csvEditingCell, setCsvEditingCell] = useState<{ rowIdx: number; header: string } | null>(null);
  const [csvInviteOpen, setCsvInviteOpen] = useState(false);
  const [csvInviteMessage, setCsvInviteMessage] = useState("");
  const [csvInviteSending, setCsvInviteSending] = useState(false);
  const [csvInviteResults, setCsvInviteResults] = useState<Record<string, { status: "sent" | "error"; sentTo?: string; error?: string }>>({});
  const [csvDashboardTab, setCsvDashboardTab] = useState<"import" | "dashboard">("import");
  const [csvDashBatchRuns, setCsvDashBatchRuns] = useState<Array<{ batch_run_id: string; run_started_at: string; package_name: string; package_id: number; total: string; pending: string; completed: string; emailed: string }>>([]);
  const [csvDashLoading, setCsvDashLoading] = useState(false);
  const [csvDashError, setCsvDashError] = useState<string | null>(null);
  const [csvDashExpanded, setCsvDashExpanded] = useState<string | null>(null);
  const [csvDashRunSessions, setCsvDashRunSessions] = useState<Record<string, Array<{ token: string; status: string; submitted_at: string | null; link_emailed_at: string | null; link_email_recipient: string | null; signer_name: string | null }>>>({});
  const [csvDashRunLoading, setCsvDashRunLoading] = useState<Record<string, boolean>>({});
  const [interviewSubTab, setInterviewSubTab] = useState<"interviews" | "dashboard">("interviews");
  type PortalSession = { token: string; package_id: number; package_name: string; status: string; source: string; created_at: string; signer_name: string | null; signer_email: string | null; signed_at: string | null; submitted_at: string | null; link_emailed_at: string | null; link_email_recipient: string | null; signing_scroll_required: boolean | null; signing_scroll_confirmed_at: string | null; };
  const [portalSessions, setPortalSessions] = useState<PortalSession[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalTotal, setPortalTotal] = useState(0);

  useEffect(() => {
    if (tab !== "batch" || csvDashboardTab !== "dashboard") return;
    setCsvDashLoading(true);
    setCsvDashError(null);
    fetch(`${API_BASE}${docupleteApiPath}/batch-runs?limit=50`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d: { runs: typeof csvDashBatchRuns }) => setCsvDashBatchRuns(d.runs ?? []))
      .catch((e) => setCsvDashError(e instanceof Error ? e.message : "Failed to load batch runs"))
      .finally(() => setCsvDashLoading(false));
  }, [tab, csvDashboardTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "sessions" || isPublicSession) return;
    setPortalLoading(true);
    setPortalError(null);
    fetch(`${API_BASE}${docupleteApiPath}/sessions/portal-list?excludeSource=csv_batch&limit=100`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d: { sessions: PortalSession[]; total: number }) => { setPortalSessions(d.sessions ?? []); setPortalTotal(d.total ?? 0); })
      .catch((e) => setPortalError(e instanceof Error ? e.message : "Failed to load sessions"))
      .finally(() => setPortalLoading(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to top whenever the active tab changes (e.g. moving from package
  // creation to the mapper step) or when the user selects a different document.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  useEffect(() => {
    if (selectedDocumentId) window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedDocumentId]);

  useEffect(() => {
    setCsvBreakdownHighlightedField(null);
  }, [csvBatchRows, csvBatchPackageId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (selectedMappingId) {
        e.preventDefault();
        removeSelectedMapping();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMappingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0] ?? null;
  const selectedDocument = selectedPackage?.documents.find((doc) => doc.id === selectedDocumentId) ?? selectedPackage?.documents[0] ?? null;
  const selectedField = selectedPackage?.fields.find((field) => field.id === selectedFieldId) ?? selectedPackage?.fields[0] ?? null;

  useEffect(() => {
    if (!selectedPackage) { setBrokenRefs([]); return; }
    setBrokenRefs(loadBrokenRefs(selectedPackage.id));
  }, [selectedPackage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedPackage || !brokenRefs.length) return;
    const surviving = brokenRefs.filter((ref) => {
      const f = selectedPackage.fields.find((ff) => ff.id === ref.affectedFieldId);
      if (!f) return false;
      if (ref.kind === "condition")        return f.condition?.fieldId === ref.deletedFieldId;
      if (ref.kind === "condition2")       return f.condition2?.fieldId === ref.deletedFieldId;
      if (ref.kind === "copyFrom_trigger") return f.copyFrom?.whenFieldId === ref.deletedFieldId;
      if (ref.kind === "copyFrom_source")  return f.copyFrom?.fieldId === ref.deletedFieldId;
      return false;
    });
    if (surviving.length !== brokenRefs.length) {
      setBrokenRefs(surviving);
      saveBrokenRefs(selectedPackage.id, surviving);
    }
  }, [selectedPackage, brokenRefs]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedFieldIsShared = Boolean(selectedField?.libraryFieldId);
  const storeMappings = useDocupleteStore((s) => s.mappings);
  const storeRecipientList = useDocupleteStore((s) => s.recipientList);
  const selectedPageSize = selectedDocument?.pageSizes?.[selectedPage - 1] ?? selectedDocument?.pageSizes?.[0];
  const labelForTransactionScope = (scope: string | null | undefined) => transactionTypes.find((item) => item.scope === scope)?.label ?? transactionScopeLabel(scope);
  const selectedPageAspect = selectedPageSize && selectedPageSize.width > 0 && selectedPageSize.height > 0
    ? `${selectedPageSize.width} / ${selectedPageSize.height}`
    : "612 / 792";
  const nativePageW = selectedPageSize?.width && selectedPageSize.width > 0 ? selectedPageSize.width : 612;
  const nativePageH = selectedPageSize?.height && selectedPageSize.height > 0 ? selectedPageSize.height : 792;
  // Viewport bounds: width fills the available column; height caps the scrollable area.
  const mapperMaxW = Math.max(320, mapperContainerWidth - 2);
  const mapperMaxH = Math.max(400, viewportHeight - 220);
  // Scale to fill the column width — portrait PDFs scroll vertically inside the viewport.
  const mapperScale = nativePageW > 0 ? mapperMaxW / nativePageW : 1;
  const effectiveScale = mapperScale * userZoom;
  // Outer container dimensions grow with zoom up to the available space, then scroll.
  const mapperViewW = Math.min(Math.round(nativePageW * effectiveScale), mapperMaxW);
  const mapperViewH = Math.min(Math.round(nativePageH * effectiveScale), mapperMaxH);
  // Return only primitive IDs so useShallow can compare with Object.is (string equality).
  // Returning objects caused getSnapshot to see new references every call → React error #185.
  const { beginMappingPointer } = useDocupletePointer({
    pageFrameRef,
    snapGrid,
    nativePageW,
    nativePageH,
  });
  useEffect(() => {
    if (!selectedDocument) return;
    const docId = selectedDocument.id;
    if (mappingStartedDocIds.has(docId)) return;
    if (storeMappings.some((m) => m.documentId === docId)) {
      setMappingStartedDocIds((prev) => new Set([...prev, docId]));
    }
  }, [selectedDocument, storeMappings, mappingStartedDocIds]);
  const fieldInInterview = (f: { interviewMode?: string; interviewVisible?: boolean }) =>
    f.interviewMode ? f.interviewMode !== "omitted" : f.interviewVisible !== false;
  const fieldIsRequired = (f: { interviewMode?: string; required?: boolean; interviewVisible?: boolean }) =>
    f.interviewMode === "required" || (f.interviewMode === undefined && f.required === true && f.interviewVisible !== false);
  function evaluateFieldCondition(condition: FieldCondition | null | undefined, ans: Record<string, string>, fields?: FieldItem[]): boolean {
    if (!condition || !condition.fieldId) return true;
    let triggerValue = (ans[condition.fieldId] ?? "").trim();
    // Name-based fallback: if the stored field ID has no value, check any field
    // with the same name. Handles stale IDs after a field is re-added.
    if (!triggerValue && fields) {
      const named = fields.find((f) => f.id === condition.fieldId);
      if (named?.name) {
        const name = named.name.toLowerCase().trim();
        for (const f of fields) {
          if (f.id === condition.fieldId) continue;
          if ((f.name ?? "").toLowerCase().trim() === name) {
            const v = (ans[f.id] ?? "").trim();
            if (v) { triggerValue = v; break; }
          }
        }
      }
    }
    switch (condition.operator) {
      case "equals":          return triggerValue.toLowerCase() === (condition.value ?? "").toLowerCase();
      case "not_equals":      return triggerValue.toLowerCase() !== (condition.value ?? "").toLowerCase();
      case "is_answered":     return triggerValue !== "";
      case "is_not_answered": return triggerValue === "";
      default:                return true;
    }
  }
  function evaluateFieldConditions(f: { condition?: FieldCondition | null; condition2?: FieldCondition | null; conditionOperator?: "and" | "or" }, ans: Record<string, string>, fields?: FieldItem[]): boolean {
    const c1 = evaluateFieldCondition(f.condition, ans, fields);
    if (!f.condition2?.fieldId) return c1;
    const c2 = evaluateFieldCondition(f.condition2, ans, fields);
    return (f.conditionOperator ?? "and") === "or" ? c1 || c2 : c1 && c2;
  }
  const visibleInterviewFields = useMemo(() => {
    const sessionFields = session?.fields ?? [];
    const fields = sessionFields.filter((f) => fieldInInterview(f) && evaluateFieldConditions(f, answers, sessionFields));
    if (selectedPackage && selectedPackage.fields.length > 0) {
      const orderMap = new Map(selectedPackage.fields.map((f, i) => [f.id, i]));
      return [...fields].sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
    }
    return fields;
  }, [session, selectedPackage, answers]);
  const missingRequiredFields = useMemo(() => {
    if (!session) return [];
    return visibleInterviewFields.filter((field) => fieldIsRequired(field) && !interviewFieldValue(field, answers, session.prefill).trim()).map((field) => field.name ?? field.id);
  }, [session, visibleInterviewFields, answers]);
  const answeredFieldCount = visibleInterviewFields.filter((field) => field.interviewMode !== "readonly" && interviewFieldValue(field, answers, session?.prefill).trim()).length;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useEffect(() => { setFieldErrors({}); }, [session?.token]);

  useEffect(() => {
    if (!session) return;
    const prefill = (session.prefill ?? {}) as Record<string, string>;
    const updates: Record<string, string> = {};
    for (const field of session.fields) {
      if (!field.copyFrom?.fieldId || !field.copyFrom.whenFieldId) continue;
      const { fieldId, whenFieldId, whenValue } = field.copyFrom;
      const whenField = session.fields.find((f) => f.id === whenFieldId);
      let triggerVal = whenField
        ? interviewFieldValue(whenField, answers, prefill)
        : (answers[whenFieldId] ?? String(prefill[whenFieldId] ?? ""));
      // Fallback: if the stored field ID has no value, also check any field with
      // the same name. This handles stale IDs when a field was re-added after
      // copyFrom was configured (new ID assigned, old ID still in session.fields).
      if (!triggerVal && whenField?.name) {
        const whenName = whenField.name.toLowerCase().trim();
        for (const f of session.fields) {
          if (f.id === whenFieldId) continue;
          if ((f.name ?? "").toLowerCase().trim() === whenName) {
            const v = interviewFieldValue(f, answers, prefill);
            if (v) { triggerVal = v; break; }
          }
        }
      }
      const conditionMet = triggerVal.toLowerCase().trim() === whenValue.toLowerCase().trim();
      if (conditionMet) {
        const sourceField = session.fields.find((f) => f.id === fieldId);
        let sourceVal = sourceField
          ? interviewFieldValue(sourceField, answers, prefill)
          : (answers[fieldId] ?? String(prefill[fieldId] ?? ""));
        // Same name-based fallback for source field.
        if (!sourceVal && sourceField?.name) {
          const srcName = sourceField.name.toLowerCase().trim();
          for (const f of session.fields) {
            if (f.id === fieldId) continue;
            if ((f.name ?? "").toLowerCase().trim() === srcName) {
              const v = interviewFieldValue(f, answers, prefill);
              if (v) { sourceVal = v; break; }
            }
          }
        }
        if (sourceVal && answers[field.id] !== sourceVal) updates[field.id] = sourceVal;
      }
    }
    if (Object.keys(updates).length > 0) {
      setAnswers((prev) => ({ ...prev, ...updates }));
    }
  }, [session, answers]);

  // Pre-fill the "Send by email" email field from session prefill so the staff
  // doesn't have to re-type the client email they already have on file.
  useEffect(() => {
    if (!session || sigSendEmail) return;
    const prefillEmail = Object.entries(session.prefill ?? {})
      .find(([k]) => k.toLowerCase().includes("email"))?.[1]?.trim() ?? "";
    if (prefillEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefillEmail)) {
      setSigSendEmail(prefillEmail);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const sessionBasePath = isPublicSession ? "/api/v1/docuplete/public/sessions" : `${docupleteApiPath}/sessions`;
  const csvBatchFieldMap = useMemo<Map<string, FieldItem>>(() => {
    if (!csvBatchPackageId) return new Map();
    const pkg = packages.find((p) => String(p.id) === csvBatchPackageId);
    if (!pkg) return new Map();
    const map = new Map<string, FieldItem>();
    for (const f of pkg.fields) {
      if (f.interviewMode !== "omitted") map.set(f.name.toLowerCase().trim(), f);
    }
    return map;
  }, [csvBatchPackageId, packages]);

  const csvBatchValidationSummary = useMemo(() => {
    if (!csvBatchPackageId || csvBatchRows.length === 0 || csvBatchFieldMap.size === 0) return null;
    const invalidRows: number[] = [];
    const emptyRequiredRows: number[] = [];
    const fieldBreakdown = new Map<string, { label: string; invalid: number[]; emptyRequired: number[] }>();
    for (const [, field] of csvBatchFieldMap) {
      fieldBreakdown.set(field.name, { label: field.name, invalid: [], emptyRequired: [] });
    }
    for (let i = 0; i < csvBatchRows.length; i++) {
      const row = csvBatchRows[i];
      const normalizedRowKeys = new Map(Object.keys(row).map((k) => [k.toLowerCase().trim(), k]));
      let hasInvalid = false;
      let hasEmptyRequired = false;
      for (const [header, field] of csvBatchFieldMap) {
        const originalKey = normalizedRowKeys.get(header) ?? "";
        const cellVal = originalKey ? (row[originalKey] ?? "") : "";
        const result = validateCellValue(field, cellVal);
        if (result === "invalid") {
          hasInvalid = true;
          fieldBreakdown.get(field.name)!.invalid.push(i + 1);
        }
        if (result === "empty-required") {
          hasEmptyRequired = true;
          fieldBreakdown.get(field.name)!.emptyRequired.push(i + 1);
        }
      }
      if (hasInvalid) invalidRows.push(i + 1);
      if (hasEmptyRequired) emptyRequiredRows.push(i + 1);
    }
    const fieldIssues = Array.from(fieldBreakdown.values()).filter((f) => f.invalid.length > 0 || f.emptyRequired.length > 0);
    return { total: csvBatchRows.length, invalidRows, emptyRequiredRows, fieldIssues };
  }, [csvBatchPackageId, csvBatchRows, csvBatchFieldMap]);
  const sessionHeaders = isPublicSession ? {} : { ...getAuthHeaders() };
  const activePackages = packages.filter((pkg) => pkg.status === "active");
  useEffect(() => {
    if (packages.length > 0 && csvBatchPackageId && !activePackages.some((pkg) => String(pkg.id) === csvBatchPackageId)) {
      setCsvBatchPackageId("");
    }
  }, [packages]);
  const packageInterviewFields = selectedPackage?.fields.filter((field) => field.interviewMode !== "omitted") ?? [];
  const packageFixedOrHiddenFields = selectedPackage?.fields.filter((field) => field.interviewMode === "omitted") ?? [];
  const packageMappedFieldIds = new Set(storeMappings.map((mapping) => mapping.fieldId));
  const unmappedPackageFields = selectedPackage?.fields.filter((field) => !packageMappedFieldIds.has(field.id)) ?? [];

  useEffect(() => {
    const prevId = prevSelectedPackageIdRef.current;
    const nextId = selectedPackage?.id ?? null;
    // Before loading a new package into the store, flush live edits back to the old package so
    // that switching away and returning preserves in-progress changes.
    if (prevId !== null && prevId !== nextId) {
      const { mappings: liveMappings, recipientList: liveRecipients } = useDocupleteStore.getState();
      setPackages((prev) =>
        prev.map((pkg) =>
          pkg.id === prevId ? { ...pkg, mappings: liveMappings, recipients: liveRecipients } : pkg,
        ),
      );
    }
    prevSelectedPackageIdRef.current = nextId;
    if (selectedPackage) {
      useDocupleteStore.getState().setMappings(selectedPackage.mappings);
      useDocupleteStore.getState().setRecipientList(selectedPackage.recipients ?? []);
      useDocupleteStore.getState().clearUndo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackage?.id]);

  async function loadBootstrap() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}${docupleteApiPath}/bootstrap`, { headers: { ...getAuthHeaders() } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {};
      try { data = await res.json(); } catch { /* non-JSON body (e.g. 401 HTML redirect) */ }
      if (!res.ok) throw new Error((data?.error as string | undefined) ?? `Could not load Docuplete data (${res.status})`);
      const loadedPackages = normalizePackages(data.packages ?? []);
      setGroups(data.groups ?? []);
      setCustodians(data.custodians ?? []);
      setDepositories(data.depositories ?? []);
      setTransactionTypes(Array.isArray(data.transactionTypes) && data.transactionTypes.length ? data.transactionTypes : DOCUFILL_TRANSACTION_TYPES.map((item, index) => ({ scope: item.value, label: item.label, active: true, sort_order: (index + 1) * 10 })));
      setFieldLibrary(normalizeFieldLibrary(data.fieldLibrary ?? []));
      setFieldGroups(Array.isArray(data.fieldGroups) ? data.fieldGroups as FieldGroup[] : []);
      setSlackConnected(data.slackConnected === true);
      void loadComplianceTags();
      void loadComplianceAudit();
      setPackages(loadedPackages);
      setSelectedPackageId((current) => {
        // Keep the current selection if it still exists in the freshly loaded packages.
        // Otherwise fall back to the first package (handles deleted package edge case).
        if (current !== null && loadedPackages.some((p) => p.id === current)) return current;
        return loadedPackages[0]?.id ?? null;
      });
      setBootstrapLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Docuplete data");
      setBootstrapLoaded(true);
    }
  }

  // Reload only the field library and field groups from the server without
  // touching packages — safe to call while the user has unsaved mapper work.
  async function reloadFieldLibraryOnly() {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/bootstrap`, { headers: { ...getAuthHeaders() } });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFieldLibrary(normalizeFieldLibrary(data.fieldLibrary ?? []));
        setFieldGroups(Array.isArray(data.fieldGroups) ? data.fieldGroups as FieldGroup[] : []);
      }
    } catch { /* silently ignore — field list will refresh on next full load */ }
  }

  async function handleSeedDemo() {
    setSeedingDemo(true);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/seed-demo`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to load sample package");
      }
      await loadBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sample package");
    } finally {
      setSeedingDemo(false);
    }
  }

  async function handleOpenDemoInterview() {
    setDemoSessionLoading(true);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/demo-session`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to create demo session");
      }
      const data = await res.json() as { token: string };
      const basePath = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
      const interviewUrl = `${window.location.origin}${basePath}/docuplete/public/${data.token}`;
      window.open(interviewUrl, "_blank");
      setDemoUiState("open");
      try { localStorage.setItem("docuplete:demo-ui", "open"); } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create demo session");
    } finally {
      setDemoSessionLoading(false);
    }
  }

  function dismissDemoUi() {
    setDemoUiState("dismissed");
    try { localStorage.setItem("docuplete:demo-ui", "dismissed"); } catch { /* ignore */ }
  }

  async function loadComplianceTags() {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/compliance-tags`, { headers: { ...getAuthHeaders() } });
      if (!res.ok) return;
      const data = await res.json() as { tags: ComplianceTag[] };
      setComplianceTags(data.tags ?? []);
    } catch { /* non-fatal */ }
  }

  async function loadComplianceAudit() {
    setComplianceAuditLoading(true);
    setComplianceAuditError(null);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/compliance-audit`, { headers: { ...getAuthHeaders() } });
      const data = await res.json().catch(() => ({})) as { error?: string } & Partial<ComplianceAuditReport>;
      if (!res.ok) throw new Error(data.error ?? "Failed to load audit report");
      setComplianceAudit(data as ComplianceAuditReport);
    } catch (err) {
      setComplianceAuditError(err instanceof Error ? err.message : "Failed to load audit report");
    } finally {
      setComplianceAuditLoading(false);
    }
  }

  async function setFieldComplianceTags(fieldId: string, tags: string[]): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/${fieldId}/compliance-tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ complianceTags: tags }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; field?: { complianceTags?: string[] } };
      if (!res.ok) return data.error ?? "Failed to update compliance tags";
      // Update local field library state
      setFieldLibrary((prev) => prev.map((f) => f.id === fieldId ? { ...f, complianceTags: data.field?.complianceTags ?? tags } : f));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to update compliance tags";
    }
  }

  async function createComplianceTag(tag: { name: string; color: string; description?: string; isRequired: boolean }): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/compliance-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(tag),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; tag?: ComplianceTag };
      if (!res.ok) return data.error ?? "Failed to create tag";
      if (data.tag) setComplianceTags((prev) => [...prev, data.tag!]);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to create tag";
    }
  }

  async function updateComplianceTag(id: number, patch: { name?: string; color?: string; description?: string | null; isRequired?: boolean }): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/compliance-tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; tag?: ComplianceTag };
      if (!res.ok) return data.error ?? "Failed to update tag";
      if (data.tag) setComplianceTags((prev) => prev.map((t) => t.id === id ? { ...t, ...data.tag } : t));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to update tag";
    }
  }

  async function deleteComplianceTag(id: number): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/compliance-tags/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) return data.error ?? "Failed to delete tag";
      setComplianceTags((prev) => prev.filter((t) => t.id !== id));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to delete tag";
    }
  }

  useEffect(() => {
    if (isPublicSession) return;
    loadBootstrap();
  }, [isPublicSession]);

  // Enable auto-save 500 ms after bootstrap settles so the initial data load
  // doesn't immediately trigger a redundant save.
  useEffect(() => {
    if (!bootstrapLoaded) return;
    const t = setTimeout(() => { autoSaveEnabledRef.current = true; }, 500);
    return () => clearTimeout(t);
  }, [bootstrapLoaded]);

  // Watch Zustand store for mapping / recipient changes → schedule auto-save.
  useEffect(() => {
    if (!bootstrapLoaded) return;
    const unsubStore = useDocupleteStore.subscribe((state, prev) => {
      if (!autoSaveEnabledRef.current) return;
      if (state.mappings !== prev.mappings || state.recipientList !== prev.recipientList) {
        scheduleAutoSave();
      }
    });
    return () => {
      unsubStore();
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveFadeTimerRef.current) clearTimeout(autoSaveFadeTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapLoaded]);

  // Watch selected package fields / documents for reorder or field edits.
  // Reset the tracker whenever the selected package switches.
  useEffect(() => {
    prevPackageContentRef.current = null;
  }, [selectedPackageId]);

  useEffect(() => {
    if (!autoSaveEnabledRef.current || !selectedPackage) return;
    const curr = { fields: selectedPackage.fields, documents: selectedPackage.documents, pkgId: selectedPackage.id };
    const prev = prevPackageContentRef.current;
    prevPackageContentRef.current = curr;
    if (!prev || prev.pkgId !== curr.pkgId) return; // first run for this package
    if (curr.fields !== prev.fields || curr.documents !== prev.documents) {
      scheduleAutoSave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPackage?.fields, selectedPackage?.documents, selectedPackage?.id]);

  // Clear deep-link URL params from the address bar immediately on mount so
  // they don't persist or show up if the user copies the URL.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const hasDeepLink = sp.has("action") || sp.has("packageId") || sp.has("tab");
    if (hasDeepLink) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // React to action=new-package even when the component is already mounted
  // (wouter navigation changes `search` without unmounting the route component).
  useEffect(() => {
    const sp = new URLSearchParams(search);
    if (sp.get("action") === "new-package") {
      setTab("packages");
      setAddingPackage(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [search]);

  // When the new-package form opens, focus the name input and scroll it into view.
  useEffect(() => {
    if (!addingPackage) return;
    const t = setTimeout(() => {
      newPackageInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      newPackageInputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [addingPackage]);

  // Persist builder UI state to sessionStorage so it survives remounts.
  useEffect(() => {
    try { sessionStorage.setItem("docuplete:builderStep", builderStep); } catch { /* ignore */ }
  }, [builderStep]);

  useEffect(() => {
    try { sessionStorage.setItem("docuplete:tab", tab); } catch { /* ignore */ }
  }, [tab]);

  useEffect(() => {
    try {
      if (selectedPackageId !== null) sessionStorage.setItem("docuplete:selectedPackageId", String(selectedPackageId));
    } catch { /* ignore */ }
  }, [selectedPackageId]);

  // After packages have loaded, apply any packageId deep-link param.
  // We use a ref flag to ensure this only runs once.
  useEffect(() => {
    if (urlParamsApplied.current || packages.length === 0) return;
    urlParamsApplied.current = true;
    const pkgId = initialUrlPkgId.current;
    if (pkgId !== null && packages.some((p) => p.id === pkgId)) {
      setSelectedPackageId(pkgId);
    }
  }, [packages]);

  useEffect(() => {
    // Reset all per-document/field/mapping selection when switching packages so
    // stale IDs from the previous package never bleed onto the new one.
    setSelectedDocumentId(null);
    setSelectedFieldId(null);
    setSelectedMappingId(null);
    setPlacementModal(null);
    setPlacementModalPos(null);
    // Reset page to 1 — the previous package may have been on a higher page that
    // doesn't exist in the new package's documents, which causes PDF.js to throw
    // and leaves pdfRenderError set. Clear both together so the canvas starts clean.
    setSelectedPage(1);
    setPdfRenderError(null);
    setIsPdfRendering(false);
    setWebhookTestStatus(null);
    setWebhookSecret(null);
    setWebhookSecretLoading(false);
    setWebhookSecretRevealed(false);
    setWebhookSecretCopied(false);
    setWebhookDeliveries([]);
    setExpandedDelivery(null);
    const pkg = packages.find((p) => p.id === selectedPackageId);
    if (pkg?.webhook_enabled && selectedPackageId) {
      void fetchWebhookDeliveries(selectedPackageId);
    }
  }, [selectedPackageId]);

  useEffect(() => {
    if (!sessionToken) return;
    const headers = isPublicSession ? {} : { ...getAuthHeadersRef.current() };
    fetch(`${API_BASE}${sessionBasePath}/${sessionToken}`, { headers })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Could not load interview")))
      .then((data: { session: Session }) => {
        setSession(data.session);
        setAnswers(data.session.answers ?? {});
        setDriveUrl(data.session.generated_pdf_url ?? null);
        setGeneratedUrl(data.session.status === "generated" ? `${API_BASE}${sessionBasePath}/${sessionToken}/packet.pdf` : null);
        setTab("sessions");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load interview"));
  }, [sessionToken, sessionBasePath, isPublicSession]);

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
    let cancelled = false;
    setDocumentPreviewUrl(null);
    if (!selectedPackage || !selectedDocument?.pdfStored) return;
    const cacheKey = `${selectedPackage.id}:${selectedDocument.id}`;
    const cachedUrl = documentPreviewCache.current[cacheKey];
    if (cachedUrl) {
      setDocumentPreviewUrl(cachedUrl);
      return;
    }
    const url = `${API_BASE}${docupleteApiPath}/packages/${selectedPackage.id}/documents/${selectedDocument.id}.pdf`;
    fetch(url, { headers: { ...getAuthHeadersRef.current() } })
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
  }, [selectedPackage?.id, selectedDocument?.id, selectedDocument?.pdfStored]);

  useEffect(() => {
    return () => {
      Object.values(documentPreviewCache.current).forEach((url) => URL.revokeObjectURL(url));
      documentPreviewCache.current = {};
      documentPreviewCacheOrder.current = [];
      useDocupleteStore.getState().setSelectedMappingId(null);
      useDocupleteStore.getState().setSelectedFieldId(null);
      useDocupleteStore.getState().setResizeDim(null);
      useDocupleteStore.getState().setDragGuides(null);
      useDocupleteStore.getState().clearUndo();
    };
  }, []);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keyboard shortcuts — ref pattern keeps the handler current without re-registering
  keyHandlerRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;

    // Esc: close placement modal
    if (e.key === "Escape") {
      if (placementModal) { setPlacementModal(null); setPlacementModalPos(null); }
      return;
    }

    // Ctrl/⌘ + S: save current package
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (selectedPackage && !isSaving) void savePackage(selectedPackage);
      return;
    }

    // Ctrl/⌘ + Z: undo last field placement
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      const prev = popUndo();
      if (prev !== undefined) {
        useDocupleteStore.getState().setMappings(prev);
        setSelectedMappingId(null);
        setPlacementModal(null);
        setPlacementModalPos(null);
        flashStatus("Undo: field placement removed.");
      }
      return;
    }

    if (isTyping) return;

    // Delete / Backspace: remove selected placed field
    if ((e.key === "Delete" || e.key === "Backspace") && selectedMappingId && isMapperVisible) {
      e.preventDefault();
      removeSelectedMapping();
      setPlacementModal(null);
      return;
    }

    // Arrow keys: nudge selected mapping (1pt) or Shift+Arrow (10pt); fall through to page nav
    if (isMapperVisible && selectedMappingId && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dxPct = (step / nativePageW) * 100;
      const dyPct = (step / nativePageH) * 100;
      const capturedKey = e.key;
      useDocupleteStore.getState().updateMapping(selectedMappingId, (m) => {
        if (capturedKey === "ArrowLeft")  return { ...m, x: clampPercent((m.x ?? 0) - dxPct, 0, 100 - (m.w ?? 26)) };
        if (capturedKey === "ArrowRight") return { ...m, x: clampPercent((m.x ?? 0) + dxPct, 0, 100 - (m.w ?? 26)) };
        if (capturedKey === "ArrowUp")    return { ...m, y: clampPercent((m.y ?? 0) - dyPct, 0, 100 - (m.h ?? 6)) };
        if (capturedKey === "ArrowDown")  return { ...m, y: clampPercent((m.y ?? 0) + dyPct, 0, 100 - (m.h ?? 6)) };
        return m;
      });
      return;
    }

    // ← / →: navigate PDF pages in mapper (only when no mapping is selected)
    if (isMapperVisible) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedPage((p) => Math.max(1, p - 1));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedPage((p) => Math.min(Math.max(selectedDocument?.pages ?? 1, 1), p + 1));
        return;
      }
    }

    // +/= zoom in, - zoom out, S snap toggle (mapper only)
    if (isMapperVisible) {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setUserZoom((z) => Math.min(4, parseFloat((z + 0.25).toFixed(2))));
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        setUserZoom((z) => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))));
        return;
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSnapGrid((v) => !v);
        return;
      }
    }

    // 1–3: jump to builder step
    if ((tab === "packages" || tab === "mapper") && ["1", "2", "3"].includes(e.key)) {
      const step = BUILDER_STEPS[parseInt(e.key, 10) - 1];
      if (step) goBuilderStep(step.value);
      return;
    }

    // Tab: cycle through interview answer fields
    if (e.key === "Tab" && tab === "sessions") {
      const inputs = Array.from(document.querySelectorAll<HTMLElement>("[data-interview-input]"));
      if (inputs.length === 0) return;
      const focusedIdx = inputs.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
      e.preventDefault();
      if (focusedIdx === -1) {
        inputs[0].focus();
      } else {
        const next = e.shiftKey
          ? (focusedIdx - 1 + inputs.length) % inputs.length
          : (focusedIdx + 1) % inputs.length;
        inputs[next].focus();
      }
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
      if (pdfDocRef.current) { pdfDocRef.current.destroy().catch(() => {}); pdfDocRef.current = null; }
    };
  }, []);

  const mapperRoRef = useRef<ResizeObserver | null>(null);
  const setMapperContainerEl = useCallback((el: HTMLElement | null) => {
    mapperContainerRef.current = el;
    if (mapperRoRef.current) { mapperRoRef.current.disconnect(); mapperRoRef.current = null; }
    if (!el) return;
    setMapperContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setMapperContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    mapperRoRef.current = ro;
  }, []);

  const isMapperVisible = tab === "mapper";
  // True while the AcroFieldReviewOverlay is covering the mapper for the current doc.
  // The mapper panel (and its <canvas>) is unmounted during this time, so the PDF
  // render effect must not try to draw — and must re-fire when the overlay closes so
  // it can paint the freshly-mounted canvas.
  const isMapperBlocked = !!(pendingAcroReview && pendingAcroReview.documentId === selectedDocumentId);
  useEffect(() => {
    if (!isMapperVisible || isMapperBlocked || !documentPreviewUrl) { setAcroAnnotations([]); setScrollPdfDoc(null); return; }
    let cancelled = false;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    setIsPdfRendering(true);
    setPdfRenderError(null);
    (async () => {
      try {
        // Always load the PDF document — needed by both single-page canvas and ScrollPageCanvas.
        let doc = pdfDocRef.current;
        if (!doc || pdfUrlRef.current !== documentPreviewUrl) {
          if (doc) { doc.destroy().catch(() => {}); pdfDocRef.current = null; }
          const loadingTask = pdfjsLib.getDocument({ url: documentPreviewUrl, standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL });
          doc = await loadingTask.promise;
          if (cancelled) { doc.destroy(); return; }
          pdfDocRef.current = doc;
          pdfUrlRef.current = documentPreviewUrl;
        }
        // Scroll mode: expose the loaded doc as React state so ScrollPageCanvas
        // re-renders and renders each page. No canvas rendering needed here.
        if (mapperScrollMode) {
          if (!cancelled) {
            setScrollPdfDoc(doc);
            setIsPdfRendering(false);
            // Fetch annotations for ALL pages so the PDF Fields overlay works in scroll mode
            const allWidgets: AcroAnnotation[] = [];
            for (let p = 1; p <= doc.numPages; p++) {
              if (cancelled) break;
              const pg = await doc.getPage(p);
              const rawAnnotations = await pg.getAnnotations();
              if (cancelled) break;
              for (const ann of rawAnnotations) {
                const a = ann as Record<string, unknown>;
                if (a["subtype"] !== "Widget") continue;
                const r = a["rect"];
                if (!Array.isArray(r) || r.length < 4) continue;
                const [x1, y1, x2, y2] = r.map(Number);
                if (x2 - x1 < 2 || y2 - y1 < 2) continue;
                allWidgets.push({ fieldName: String(a["fieldName"] ?? a["alternativeText"] ?? ""), rect: [x1, y1, x2, y2], fieldType: String(a["fieldType"] ?? ""), page: p });
              }
            }
            if (!cancelled) setAcroAnnotations(allWidgets);
          }
          return;
        }
        // Single-page mode: render the selected page to the main canvas.
        setScrollPdfDoc(null);
        const page = await doc.getPage(selectedPage);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) { setIsPdfRendering(false); return; }
        const viewport = page.getViewport({ scale: 1.0 });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) { setIsPdfRendering(false); return; }
        const renderTask = page.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        if (cancelled) return;
        setIsPdfRendering(false);
        const rawAnnotations = await page.getAnnotations();
        if (cancelled) return;
        const widgets: AcroAnnotation[] = [];
        for (const ann of rawAnnotations) {
          const a = ann as Record<string, unknown>;
          if (a["subtype"] !== "Widget") continue;
          const r = a["rect"];
          if (!Array.isArray(r) || r.length < 4) continue;
          const [x1, y1, x2, y2] = r.map(Number);
          if (x2 - x1 < 2 || y2 - y1 < 2) continue;
          widgets.push({ fieldName: String(a["fieldName"] ?? a["alternativeText"] ?? ""), rect: [x1, y1, x2, y2], fieldType: String(a["fieldType"] ?? ""), page: selectedPage });
        }
        setAcroAnnotations(widgets);
      } catch (err) {
        if (!cancelled) {
          setIsPdfRendering(false);
          setPdfRenderError(err instanceof Error ? err.message : "Failed to render PDF preview");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [isMapperVisible, isMapperBlocked, documentPreviewUrl, selectedPage, mapperScrollMode]);

  async function savePackage(pkg: PackageItem) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeadersRef.current() },
        body: JSON.stringify({
          name: pkg.name,
          groupIds: pkg.group_ids ?? [],
          groupId: pkg.group_id,
          custodianId: pkg.custodian_id,
          depositoryId: pkg.depository_id,
          transactionScope: pkg.transaction_scope,
          description: pkg.description,
          status: pkg.status,
          documents: pkg.documents,
          fields: pkg.fields,
          mappings: useDocupleteStore.getState().mappings,
          recipients: useDocupleteStore.getState().recipientList,
          enableInterview: pkg.enable_interview,
          enableCsv: pkg.enable_csv,
          enableCustomerLink: pkg.enable_customer_link,
          webhookEnabled: pkg.webhook_enabled,
          webhookUrl: pkg.webhook_url ?? null,
          slackNotificationsEnabled: pkg.slack_notifications_enabled,
          tags: pkg.tags ?? [],
          notifyStaffOnSubmit: pkg.notify_staff_on_submit,
          notifyClientOnSubmit: pkg.notify_client_on_submit,
          enableEmbed: pkg.enable_embed,
          enableGdrive: pkg.enable_gdrive,
          enableHubspot: pkg.enable_hubspot,
          authLevel: pkg.auth_level,
          requirePreview: pkg.require_preview,
          requireScrollConfirmation: pkg.require_scroll_confirmation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save package");
      flashStatus("Saved package.");
      await loadBootstrap();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save package");
    } finally {
      setIsSaving(false);
    }
  }

  // Lightweight background save — does NOT call loadBootstrap so it never
  // wipes unsaved mapper state. Used exclusively by the auto-save system.
  async function autoSavePackage(pkg: PackageItem): Promise<boolean> {
    if (isSaving) return false; // let the in-progress manual save finish
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeadersRef.current() },
        body: JSON.stringify({
          name: pkg.name,
          groupIds: pkg.group_ids ?? [],
          groupId: pkg.group_id,
          custodianId: pkg.custodian_id,
          depositoryId: pkg.depository_id,
          transactionScope: pkg.transaction_scope,
          description: pkg.description,
          status: pkg.status,
          documents: pkg.documents,
          fields: pkg.fields,
          mappings: useDocupleteStore.getState().mappings,
          recipients: useDocupleteStore.getState().recipientList,
          enableInterview: pkg.enable_interview,
          enableCsv: pkg.enable_csv,
          enableCustomerLink: pkg.enable_customer_link,
          webhookEnabled: pkg.webhook_enabled,
          webhookUrl: pkg.webhook_url ?? null,
          slackNotificationsEnabled: pkg.slack_notifications_enabled,
          tags: pkg.tags ?? [],
          notifyStaffOnSubmit: pkg.notify_staff_on_submit,
          notifyClientOnSubmit: pkg.notify_client_on_submit,
          enableEmbed: pkg.enable_embed,
          enableGdrive: pkg.enable_gdrive,
          enableHubspot: pkg.enable_hubspot,
          authLevel: pkg.auth_level,
          requirePreview: pkg.require_preview,
          requireScrollConfirmation: pkg.require_scroll_confirmation,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function scheduleAutoSave() {
    if (!autoSaveEnabledRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus("pending");
    autoSaveTimerRef.current = setTimeout(() => {
      const storeState = useDocupleteStore.getState();
      const pkg = storeState.packages.find((p) => p.id === storeState.selectedPackageId);
      if (!pkg) return;
      setAutoSaveStatus("saving");
      void autoSavePackage(pkg).then((ok) => {
        if (autoSaveFadeTimerRef.current) clearTimeout(autoSaveFadeTimerRef.current);
        setAutoSaveStatus(ok ? "saved" : "error");
        if (ok) {
          // Fade the "saved" indicator after 2.5 s.
          autoSaveFadeTimerRef.current = setTimeout(
            () => setAutoSaveStatus((s) => (s === "saved" ? "idle" : s)),
            2500,
          );
        } else {
          // Keep the "error" badge visible and retry in 15 s so a temporary
          // server restart doesn't silently discard unsaved mapper work.
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => scheduleAutoSave(), 15_000);
        }
      });
    }, 2000);
  }

  async function fetchWebhookSecret(pkgId: number) {
    setWebhookSecretLoading(true);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkgId}/webhook-secret`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json() as { webhook_secret: string | null };
      setWebhookSecret(data.webhook_secret ?? null);
    } catch {
      // non-fatal
    } finally {
      setWebhookSecretLoading(false);
    }
  }

  async function fetchWebhookDeliveries(pkgId: number) {
    setWebhookDeliveriesLoading(true);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkgId}/webhook-deliveries`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json() as { deliveries: typeof webhookDeliveries };
      setWebhookDeliveries(data.deliveries ?? []);
    } catch {
      // non-fatal
    } finally {
      setWebhookDeliveriesLoading(false);
    }
  }

  async function retryDelivery(pkgId: number, deliveryId: number) {
    setRetryingDelivery(deliveryId);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkgId}/webhook-deliveries/${deliveryId}/retry`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        flashStatus(`Retry failed: ${data.error ?? `HTTP ${res.status}`}`);
      } else {
        flashStatus("Delivery retried.");
        void fetchWebhookDeliveries(pkgId);
      }
    } catch {
      flashStatus("Retry request failed.");
    } finally {
      setRetryingDelivery(null);
    }
  }

  async function sendTestWebhook(pkgId: number) {
    setWebhookTestStatus(null);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkgId}/test-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        const msg = data.error ?? `HTTP ${res.status}`;
        setWebhookTestStatus({ ok: false, message: msg });
        flashStatus(`Webhook test failed: ${msg}`);
      } else {
        flashStatus("Test webhook delivered.");
        setWebhookTestStatus({ ok: true, message: "Delivered" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setWebhookTestStatus({ ok: false, message: msg });
      flashStatus(`Webhook test failed: ${msg}`);
    }
    // Refresh delivery log regardless of outcome
    void fetchWebhookDeliveries(pkgId);
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
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          name: trimmedName,
          groupId: newPackageGroupId ? Number(newPackageGroupId) : null,
          transactionScope: "",
          status: "draft",
          documents: [],
          fields: [],
          mappings: [],
        }),
      });
      const data = await res.json() as { error?: string; upgrade_required?: boolean; limit_type?: string; required_plan?: string; package?: { id: number } };
      if (res.status === 402 && data.upgrade_required) {
        showUpgrade({ limitType: (data.limit_type as "packages" | "submissions" | "seats") ?? "packages", requiredPlan: (data.required_plan as "pro" | "enterprise") ?? "pro" });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not create package");
      await loadBootstrap();
      if (data.package) setSelectedPackageId(data.package.id);
      setNewPackageName("");
      setNewPackageGroupId("");
      setAddingPackage(false);
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
      const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${pkg.id}`, {
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
      flashStatus("Deleted package.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete package");
    } finally {
      setIsDeletingPackage(false);
    }
  }

  function flashStatus(msg: string) {
    toast({ title: msg, duration: 2500 });
  }

  async function createGroup(): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create group";
      if (data.group) setGroups((prev) => [...prev, data.group as Entity]);
      return null;
    } catch {
      return "Network error — could not create group";
    }
  }

  function updateGroupLocal(id: number, patch: Partial<Entity>) {
    setGroups((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function saveGroup(item: Entity): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/groups/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: item.name, kind: item.kind ?? "general", email: item.email, phone: item.phone, notes: item.notes, active: item.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not save group";
      setGroups((prev) => prev.map((g) => g.id === item.id ? { ...g, ...(data.group as Entity | undefined) } : g));
      return null;
    } catch {
      return "Network error — could not save group";
    }
  }

  async function deleteGroup(id: number): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/groups/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not delete group";
      setGroups((prev) => prev.filter((g) => g.id !== id));
      return null;
    } catch {
      return "Network error — could not delete group";
    }
  }

  async function deleteFieldLibraryItem(id: string): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/${id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not delete field";
      setFieldLibrary((prev) => prev.filter((f) => f.id !== id));
      return null;
    } catch {
      return "Network error — could not delete field";
    }
  }

  async function exportFieldLibrary(format: "json" | "csv"): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/export?format=${format}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const ts = new Date().toISOString().slice(0, 10);
      const filename = `field-library-${ts}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    } catch {
      alert("Network error — could not export field library.");
    }
  }

  async function importFieldLibrary(
    data: import("@/components/DocupletePanels").FieldLibraryImportPayload,
  ): Promise<import("@/components/DocupletePanels").FieldLibraryImportResult | string> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(data),
      });
      const responseData = await res.json().catch(() => ({}));
      if (!res.ok) return (responseData as { error?: string }).error ?? "Import failed";
      // Reload only the field library — do not call loadBootstrap() which would
      // wipe all unsaved package/mapper state.
      void reloadFieldLibraryOnly();
      return responseData as import("@/components/DocupletePanels").FieldLibraryImportResult;
    } catch {
      return "Network error — import failed";
    }
  }

  async function createEntity(type: "custodians" | "depositories"): Promise<string | null> {
    const count = type === "custodians" ? custodians.length + 1 : depositories.length + 1;
    const label = type === "custodians" ? `New Custodian ${count}` : `New Depository ${count}`;
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: label, active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create record";
      if (type === "custodians" && data.custodian) setCustodians((prev) => [...prev, data.custodian as Entity]);
      if (type === "depositories" && data.depository) setDepositories((prev) => [...prev, data.depository as Entity]);
      return null;
    } catch {
      return "Network error — could not create record";
    }
  }

  function updateEntityLocal(type: "custodians" | "depositories", id: number, patch: Partial<Entity>) {
    const updater = (item: Entity) => item.id === id ? { ...item, ...patch } : item;
    if (type === "custodians") setCustodians((prev) => prev.map(updater));
    if (type === "depositories") setDepositories((prev) => prev.map(updater));
  }

  async function saveEntity(type: "custodians" | "depositories", item: Entity): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/${type}/${item.id}`, {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not save record";
      flashStatus("Saved.");
      const updater = (e: Entity) => e.id === item.id ? { ...e, ...(data.custodian ?? data.depository ?? {}) as Entity } : e;
      if (type === "custodians") setCustodians((prev) => prev.map(updater));
      else setDepositories((prev) => prev.map(updater));
      return null;
    } catch {
      return "Network error — could not save record";
    }
  }

  async function deleteTransactionType(scope: string): Promise<string | null> {
    // Capture the target package ID synchronously before any awaits so that
    // if the user switches packages while the request is in-flight the updater
    // is still applied to the package that was selected at action-initiation time.
    const targetId = selectedPackageId ?? undefined;
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/transaction-types/${scope}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not delete type";
      setTransactionTypes((prev) => prev.filter((t) => t.scope !== scope));
      if (selectedPackage?.transaction_scope === scope) {
        updateSelectedPackage((pkg) => ({ ...pkg, transaction_scope: "" }), targetId);
      }
      return null;
    } catch {
      return "Network error — could not delete type";
    }
  }

  async function createTransactionTypeNamed(label: string): Promise<{ scope: string } | string> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/transaction-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ label: label.trim(), active: true, sortOrder: (transactionTypes.length + 1) * 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create type";
      if (data.transactionType) setTransactionTypes((prev) => [...prev, data.transactionType as TransactionType]);
      return { scope: data.transactionType?.scope ?? "" };
    } catch {
      return "Network error — could not create type";
    }
  }

  async function createGroupNamed(name: string): Promise<{ id: number } | string> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: name.trim(), active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create group";
      if (data.group) setGroups((prev) => [...prev, data.group as Entity]);
      return { id: data.id ?? data.group?.id };
    } catch {
      return "Network error — could not create group";
    }
  }

  async function createTransactionType(): Promise<string | null> {
    const label = `New type ${transactionTypes.length + 1}`;
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/transaction-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ label, active: true, sortOrder: (transactionTypes.length + 1) * 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create transaction type";
      if (data.transactionType) setTransactionTypes((prev) => [...prev, data.transactionType as TransactionType]);
      return null;
    } catch {
      return "Network error — could not create transaction type";
    }
  }

  function updateTransactionTypeLocal(scope: string, patch: Partial<TransactionType>) {
    setTransactionTypes((prev) => prev.map((item) => item.scope === scope ? { ...item, ...patch } : item));
  }

  async function saveTransactionType(item: TransactionType): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/transaction-types/${item.scope}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          label: item.label,
          active: item.active,
          sortOrder: item.sort_order,
          groupIds: item.group_ids ?? [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not save transaction type";
      flashStatus("Saved.");
      setTransactionTypes((prev) => prev.map((t) => t.scope === item.scope ? { ...t, ...(data.transactionType as TransactionType | undefined) } : t));
      return null;
    } catch {
      return "Network error — could not save transaction type";
    }
  }

  async function createFieldLibraryItem(): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      // Use a fresh random suffix on every attempt so label/id collisions auto-resolve.
      const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
      const label = `New Field ${suffix}`;
      try {
        const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ label, category: "General", type: "text", source: "interview", active: true, sortOrder: (fieldLibrary.length + 1) * 10 }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          // Append just the new field — do NOT call loadBootstrap() here,
          // which would reload all packages from the server and wipe any
          // unsaved local changes (placed fields, document order, etc.).
          if (data.field) {
            setFieldLibrary((prev) => [...normalizeFieldLibrary([data.field]), ...prev]);
          }
          return null;
        }
        if (res.status === 409) continue; // label or id collision — retry with new random suffix
        return data.error ?? "Could not create field";
      } catch {
        return "Network error — could not create field";
      }
    }
    return "Could not create a unique field — please try again";
  }

  function updateFieldLibraryLocal(id: string, patch: Partial<FieldLibraryItem>) {
    setFieldLibrary((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function saveFieldLibraryItem(item: FieldLibraryItem): Promise<string | null> {
    try {
      // ── Impact check: warn if other packages/sessions will be affected ────────
      // Returns "__cancelled__" if the admin dismisses the confirmation so the
      // caller (FieldLibraryPanel.handleSave) can suppress both the error UI and
      // the success "✓ Saved" tick — the field editor stays open, no state change.
      try {
        const impactRes = await fetch(
          `${API_BASE}${docupleteApiPath}/field-library/${item.id}/impact`,
          { headers: getAuthHeaders() },
        );
        if (impactRes.ok) {
          const impact = await impactRes.json() as { packageCount?: number; sessionCount?: number };
          const pkgs  = impact.packageCount  ?? 0;
          const sess  = impact.sessionCount  ?? 0;
          if (pkgs > 0) {
            const pkgLabel  = pkgs  === 1 ? "1 package"  : `${pkgs} packages`;
            const sessLabel = sess  === 1 ? " and 1 active session"
              : ` and ${sess} active sessions`;
            const confirmed = window.confirm(
              `This field is used in ${pkgLabel}${sessLabel}. Saving will update all of them.\n\nProceed?`,
            );
            if (!confirmed) return "__cancelled__";
          }
        } else {
          // Impact endpoint unavailable — ask the admin whether to proceed anyway
          // rather than silently saving or hard-blocking the edit flow.
          const proceed = window.confirm(
            "Could not check how many packages use this field.\n\nProceed with save anyway?",
          );
          if (!proceed) return "__cancelled__";
        }
      } catch {
        // Network error — same best-effort fallback
        const proceed = window.confirm(
          "Could not reach the server to check impact.\n\nProceed with save anyway?",
        );
        if (!proceed) return "__cancelled__";
      }
      // ─────────────────────────────────────────────────────────────────────────

      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(item),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not save field library item";
      flashStatus("Saved.");
      // Update just this field in local state — do not call loadBootstrap()
      // which would wipe unsaved package/mapper changes.
      setFieldLibrary((prev) => prev.map((f) => f.id === item.id ? { ...f, ...normalizeFieldLibrary([{ ...item, ...data }])[0] } : f));
      return null;
    } catch {
      return "Network error — could not save field library item";
    }
  }

  async function loadFieldVersions(fieldId: string): Promise<FieldVersionRow[] | string> {
    try {
      const res = await fetch(
        `${API_BASE}${docupleteApiPath}/field-library/${fieldId}/versions`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) return "Could not load version history";
      const data = await res.json().catch(() => ({})) as { versions?: FieldVersionRow[] };
      return data.versions ?? [];
    } catch {
      return "Network error — could not load version history";
    }
  }

  async function loadFieldAnalytics(fieldId: string): Promise<FieldAnalytics | string> {
    try {
      const res = await fetch(
        `${API_BASE}${docupleteApiPath}/field-library/${fieldId}/analytics`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) return "Could not load analytics";
      const data = await res.json().catch(() => ({})) as FieldAnalytics;
      return data;
    } catch {
      return "Network error — could not load analytics";
    }
  }

  async function restoreFieldVersion(fieldId: string, versionId: number): Promise<string | null> {
    try {
      const res = await fetch(
        `${API_BASE}${docupleteApiPath}/field-library/${fieldId}/versions/${versionId}/restore`,
        { method: "POST", headers: getAuthHeaders() },
      );
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) return (data.error as string | undefined) ?? "Could not restore version";
      flashStatus("Restored.");
      // Reload only the field library, not the full bootstrap — preserves unsaved mapper state.
      void reloadFieldLibraryOnly();
      return null;
    } catch {
      return "Network error — could not restore version";
    }
  }

  async function createFieldGroup(): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({})) as { fieldGroup?: FieldGroup; error?: string };
      if (!res.ok) return data.error ?? "Could not create field group";
      if (data.fieldGroup) setFieldGroups((prev) => [...prev, data.fieldGroup!]);
      return null;
    } catch {
      return "Network error — could not create field group";
    }
  }

  function updateFieldGroupLocal(id: number, patch: Partial<FieldGroup>) {
    setFieldGroups((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g));
  }

  async function saveFieldGroup(item: FieldGroup): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/groups/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: item.name, description: item.description, fieldIds: item.fieldIds }),
      });
      const data = await res.json().catch(() => ({})) as { fieldGroup?: FieldGroup; error?: string };
      if (!res.ok) return data.error ?? "Could not save field group";
      if (data.fieldGroup) setFieldGroups((prev) => prev.map((g) => g.id === item.id ? data.fieldGroup! : g));
      return null;
    } catch {
      return "Network error — could not save field group";
    }
  }

  async function deleteFieldGroup(id: number): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library/groups/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) return data.error ?? "Could not delete field group";
      setFieldGroups((prev) => prev.filter((g) => g.id !== id));
      return null;
    } catch {
      return "Network error — could not delete field group";
    }
  }

  function addGroupToPackage(group: FieldGroup) {
    const groupFields = group.fieldIds
      .map((id) => fieldLibrary.find((f) => f.id === id))
      .filter((f): f is FieldLibraryItem => Boolean(f));

    // Pre-check: does this group contribute at least one new field to the current package?
    const existingBeforeAdd = new Set(
      (selectedPackage?.fields ?? []).map((f) => f.libraryFieldId).filter(Boolean),
    );
    const willAddFields = groupFields.some((lf) => !existingBeforeAdd.has(lf.id));

    updateSelectedPackage((pkg) => {
      const existingLibraryIds = new Set(pkg.fields.map((f) => f.libraryFieldId).filter(Boolean));
      const toAdd = groupFields.filter((lf) => !existingLibraryIds.has(lf.id));
      if (toAdd.length === 0) {
        flashStatus("All group fields are already in this package.");
        return pkg;
      }
      const usedColors = pkg.fields.map((f) => f.color);
      const newFields = toAdd.map((lf): FieldItem => {
        const sensitive = lf.sensitive || isSensitiveValidationType(lf.validationType);
        const color = pickFieldColor(usedColors, sensitive);
        usedColors.push(color);
        return {
          id: newId("field"),
          libraryFieldId: lf.id,
          name: lf.label,
          color,
          type: lf.type,
          optionsMode: "inherit",
          interviewMode: lf.required ? "required" : "optional",
          defaultValue: "",
          source: lf.source,
          sensitive,
          validationType: lf.validationType,
          validationPattern: lf.validationPattern ?? "",
          validationMessage: lf.validationMessage ?? "",
        };
      });
      flashStatus(`Added ${toAdd.length} field${toAdd.length !== 1 ? "s" : ""} from "${group.name}".`);
      return { ...pkg, fields: [...pkg.fields, ...newFields] };
    });
    // Persist the application event only when at least one field was actually added (best-effort)
    void (async () => {
      if (!willAddFields) return;
      const selectedPkg = packages.find((p) => p.id === selectedPackageId);
      if (!selectedPkg?.id) return;
      try {
        const applyRes = await fetch(`${API_BASE}${docupleteApiPath}/field-library/groups/${group.id}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ packageId: selectedPkg.id }),
        });
        // Only update local usagePackages state when the server confirmed the record was written
        if (applyRes.ok) {
          setFieldGroups((prev) => prev.map((g) => {
            if (g.id !== group.id) return g;
            const alreadyTracked = g.usagePackages?.some((p) => p.id === selectedPkg.id);
            if (alreadyTracked) return g;
            return { ...g, usagePackages: [...(g.usagePackages ?? []), { id: selectedPkg.id, name: selectedPkg.name }] };
          }));
        }
      } catch { /* silent — usage tracking is best-effort */ }
    })();
    goBuilderStep("mapping");
  }

  function addLibraryFieldToPackage(libraryField: FieldLibraryItem) {
    updateSelectedPackage((pkg) => {
      const existingField = pkg.fields.find((field) => field.libraryFieldId === libraryField.id);
      if (existingField) {
        setSelectedFieldId(existingField.id);
        flashStatus("That shared field is already in this package.");
        return pkg;
      }
      const libSensitive = libraryField.sensitive || isSensitiveValidationType(libraryField.validationType);
      const field: FieldItem = {
        id: newId("field"),
        libraryFieldId: libraryField.id,
        name: libraryField.label,
        color: pickFieldColor(pkg.fields.map((f) => f.color), libSensitive),
        type: libraryField.type,
        optionsMode: "inherit",
        interviewMode: libraryField.required ? "required" : "optional",
        defaultValue: "",
        source: libraryField.source,
        sensitive: libSensitive,
        validationType: libraryField.validationType,
        validationPattern: libraryField.validationPattern ?? "",
        validationMessage: libraryField.validationMessage ?? "",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [field, ...pkg.fields] };
    });
    goBuilderStep("mapping");
  }

  /**
   * Auto-map AcroForm annotations against the current package + the shared
   * field library. For each PDF widget:
   *   1. Try to match an existing package field (existing scoring)
   *   2. If no package match, try to match a library field — if found, add
   *      that library field to the package automatically
   *   3. Anything still unmatched is left as a PDF widget for the user to
   *      drag in the mapper
   * Returns counts so the caller can show a friendly status message.
   */
  function autoMapAnnotationsWithLibrary(
    annotations: PendingAnnotation[],
    documentId: string,
  ): { mapped: number; addedFromLibrary: number; unmatched: number } {
    if (!selectedPackage || annotations.length === 0) {
      return { mapped: 0, addedFromLibrary: 0, unmatched: 0 };
    }

    const existingFields = selectedPackage.fields;
    const usedPackageFieldIds = new Set<string>();
    const usedLibraryIds = new Set<string>();
    const newFields: FieldItem[] = [];

    type Resolved = { ann: PendingAnnotation; fieldId: string | null };
    const resolutions: Resolved[] = [];

    // Library fields already represented in the package (by libraryFieldId)
    // shouldn't be re-added — but we should still allow matching to them via
    // the existing package-field path.
    const libraryIdsInPackage = new Set(
      existingFields.map((f) => f.libraryFieldId).filter((v): v is string => Boolean(v)),
    );

    for (const ann of annotations) {
      if (!ann.fieldName) { resolutions.push({ ann, fieldId: null }); continue; }

      // 1) Best existing package field
      let bestPkgField: FieldItem | undefined;
      let bestPkgScore = 0;
      for (const f of existingFields) {
        if (usedPackageFieldIds.has(f.id)) continue;
        const s = fieldNameScore(f.name, ann.fieldName);
        if (s >= FIELD_NAME_SCORE_THRESHOLD && s > bestPkgScore) {
          bestPkgScore = s; bestPkgField = f;
        }
      }

      // 2) Best library field (only if not already in package, not already used this run)
      let bestLib: FieldLibraryItem | undefined;
      let bestLibScore = 0;
      for (const lib of fieldLibrary) {
        if (!lib.active) continue;
        if (libraryIdsInPackage.has(lib.id)) continue;
        if (usedLibraryIds.has(lib.id)) continue;
        const s = fieldNameScore(lib.label, ann.fieldName);
        if (s >= FIELD_NAME_SCORE_THRESHOLD && s > bestLibScore) {
          bestLibScore = s; bestLib = lib;
        }
      }

      // Prefer existing package field on ties; library wins only if strictly better
      if (bestPkgField && bestPkgScore >= bestLibScore) {
        usedPackageFieldIds.add(bestPkgField.id);
        resolutions.push({ ann, fieldId: bestPkgField.id });
      } else if (bestLib) {
        usedLibraryIds.add(bestLib.id);
        const newField: FieldItem = {
          id: newId("field"),
          libraryFieldId: bestLib.id,
          name: bestLib.label,
          color: pickFieldColor(
            [...existingFields.map((f) => f.color), ...newFields.map((f) => f.color)],
            bestLib.sensitive,
          ),
          type: bestLib.type,
          optionsMode: "inherit",
          interviewMode: bestLib.required ? "required" : "optional",
          defaultValue: "",
          source: bestLib.source,
          sensitive: bestLib.sensitive,
          validationType: bestLib.validationType,
          validationPattern: bestLib.validationPattern ?? "",
          validationMessage: bestLib.validationMessage ?? "",
        };
        newFields.push(newField);
        resolutions.push({ ann, fieldId: newField.id });
      } else {
        resolutions.push({ ann, fieldId: null });
      }
    }

    // Build new mappings
    const currentMappings = useDocupleteStore.getState().mappings;
    pushUndo([...currentMappings]);
    const newMappings = [...currentMappings];

    const fieldLookup = new Map<string, FieldItem>();
    existingFields.forEach((f) => fieldLookup.set(f.id, f));
    newFields.forEach((f) => fieldLookup.set(f.id, f));

    let mapped = 0;
    for (const r of resolutions) {
      if (!r.fieldId) continue;
      const ann = r.ann;
      const [x1, y1, x2, y2] = ann.rect;
      const xPct = clampPercent((x1 / ann.pageW) * 100, 0, 98);
      const yPct = clampPercent(((ann.pageH - y2) / ann.pageH) * 100, 0, 98);
      const wPct = Math.max(((x2 - x1) / ann.pageW) * 100, 1);
      const hPct = Math.max(((y2 - y1) / ann.pageH) * 100, 0.5);
      const alreadyMapped = newMappings.some(
        (m) => m.fieldId === r.fieldId && m.documentId === documentId &&
               m.page === ann.page && Math.abs(m.x - xPct) < 3 && Math.abs(m.y - yPct) < 3,
      );
      if (alreadyMapped) continue;
      const field = fieldLookup.get(r.fieldId);
      if (!field) continue;
      newMappings.push({
        id: newId("map"),
        fieldId: r.fieldId,
        documentId,
        page: ann.page,
        x: xPct, y: yPct, w: wPct, h: hPct,
        fontSize: 11, align: "left",
        format: defaultMappingFormat(field),
      });
      mapped++;
    }

    if (newFields.length > 0) {
      updateSelectedPackage((pkg) => ({ ...pkg, fields: [...newFields, ...pkg.fields] }));
    }
    if (mapped > 0) {
      useDocupleteStore.getState().setMappings(newMappings);
    } else if (newFields.length === 0) {
      popUndo();
    }

    const unmatched = resolutions.filter((r) => r.fieldId === null).length;
    return { mapped, addedFromLibrary: newFields.length, unmatched };
  }

  function sortFieldsByPdfPosition(pkg: PackageItem): PackageItem {
    const docIndexMap = new Map(pkg.documents.map((d, i) => [d.id, i]));
    const storeMappingsForSort = useDocupleteStore.getState().mappings;
    const firstMappingScore = (fieldId: string): number => {
      let best = Infinity;
      for (const m of storeMappingsForSort) {
        if (m.fieldId !== fieldId) continue;
        const docIdx = docIndexMap.get(m.documentId ?? "") ?? 999;
        const score = docIdx * 1_000_000 + (m.page ?? 1) * 10_000 + Math.round((m.y ?? 50) * 100);
        if (score < best) best = score;
      }
      return best;
    };
    const scored = pkg.fields.map((f) => ({ f, score: firstMappingScore(f.id) }));
    scored.sort((a, b) => a.score - b.score);
    return { ...pkg, fields: scored.map((item) => item.f) };
  }

  function goBuilderStep(step: BuilderStep, opts: { autoSort?: boolean; saveFirst?: boolean } = {}) {
    const resolvedStep: BuilderStep = step === "finalize" ? "interview" : step;
    if (resolvedStep === "interview" && opts.autoSort && selectedPackage) {
      updateSelectedPackage((pkg) => sortFieldsByPdfPosition(pkg));
    }
    if (opts.saveFirst && selectedPackage) {
      void savePackage(selectedPackage);
    }
    setBuilderStep(resolvedStep);
    setTab(resolvedStep === "mapping" ? "mapper" : "packages");
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
    if (removedDocumentId && updatedPackage.id === selectedPackageId) {
      const filtered = useDocupleteStore.getState().mappings.filter(
        (m) => m.documentId !== removedDocumentId,
      );
      useDocupleteStore.getState().setMappings(filtered);
    }
    setPackages((prev) => prev.map((pkg) => {
      if (pkg.id !== updatedPackage.id) return pkg;
      const pkgMappings = removedDocumentId
        ? pkg.mappings.filter((mapping) => mapping.documentId !== removedDocumentId)
        : pkg.mappings;
      return { ...pkg, ...updatedPackage, fields: pkg.fields, mappings: pkgMappings };
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

  async function extractAcroFromFile(file: File): Promise<PendingAnnotation[]> {
    const url = URL.createObjectURL(file);
    try {
      const doc = await pdfjsLib.getDocument({ url, standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL }).promise;
      const results: PendingAnnotation[] = [];
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const rawAnnotations = await page.getAnnotations();
        for (const ann of rawAnnotations) {
          const a = ann as Record<string, unknown>;
          if (a["subtype"] !== "Widget") continue;
          const r = a["rect"];
          if (!Array.isArray(r) || r.length < 4) continue;
          const [x1, y1, x2, y2] = r.map(Number);
          if (x2 - x1 < 2 || y2 - y1 < 2) continue;
          results.push({
            fieldName: String(a["fieldName"] ?? a["alternativeText"] ?? ""),
            rect: [x1, y1, x2, y2],
            fieldType: String(a["fieldType"] ?? ""),
            page: pageNum,
            pageW: viewport.width,
            pageH: viewport.height,
            prefillValue: String(a["fieldValue"] ?? ""),
          });
        }
      }
      await doc.destroy();
      return results;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function persistDocumentPdf(file: File, documentId?: string) {
    if (!selectedPackage) return null;
    const endpoint = documentId
      ? `${API_BASE}${docupleteApiPath}/packages/${selectedPackage.id}/documents/${documentId}/pdf`
      : `${API_BASE}${docupleteApiPath}/packages/${selectedPackage.id}/documents`;
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
      const updatedPackage = await persistDocumentPdf(file, documentId);
      flashStatus(documentId ? "Replaced PDF." : "Uploaded PDF.");
      // After upload, scan the PDF for AcroForm fields, then auto-map against
      // the package + shared field library. Anything unmatched is left as a
      // PDF widget the user can drag in the mapper.
      try {
        const annotations = await extractAcroFromFile(file);
        if (annotations.length > 0) {
          const targetDoc = documentId
            ? updatedPackage?.documents.find((d) => d.id === documentId)
            : updatedPackage?.documents[updatedPackage.documents.length - 1];
          if (targetDoc) {
            // Show the review overlay so the user can verify/adjust matches before
            // auto-mapping commits them. The overlay's onConfirm calls
            // autoMapAnnotationsWithLibrary to pull library fields and place mappings.
            // IMPORTANT: setSelectedDocumentId must be called BEFORE setPendingAcroReview
            // so the mapper tab condition (pendingAcroReview.documentId === selectedDocumentId)
            // evaluates true when the tab renders. Without this, the overlay is silently
            // skipped if the user already had a different document selected.
            setSelectedDocumentId(targetDoc.id);
            setPendingAcroReview({ documentId: targetDoc.id, docTitle: targetDoc.title, annotations });
            goBuilderStep("mapping");
          }
        } else {
          setPendingAcroReview(null);
          flashStatus("PDF uploaded — no AcroForm fields detected. Map fields manually in the mapper.");
        }
      } catch (scanErr) {
        console.error("[AcroScan] Failed to scan PDF for form fields:", scanErr);
        setPendingAcroReview(null);
        flashStatus("PDF uploaded. Could not scan for AcroForm fields — map manually in the mapper.");
      }
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
    type ReviewEntry = { documentId: string; docTitle: string; annotations: PendingAnnotation[] };
    const reviewQueue: ReviewEntry[] = [];
    try {
      for (const file of pdfFiles) {
        const updatedPackage = await persistDocumentPdf(file);
        // Scan each uploaded PDF for AcroForm fields.
        // If fields are found, queue a review overlay so the user can verify matches
        // before mappings are committed. Pre-filled fields (those with an existing value)
        // are detected here and shown as protected in the review overlay.
        try {
          const annotations = await extractAcroFromFile(file);
          const targetDoc = updatedPackage?.documents[updatedPackage.documents.length - 1];
          if (annotations.length > 0 && targetDoc) {
            reviewQueue.push({ documentId: targetDoc.id, docTitle: targetDoc.title, annotations });
          }
        } catch (scanErr) {
          console.error("[AcroScan] Failed to scan PDF for form fields:", scanErr);
        }
      }
      const baseMsg = `Uploaded ${pdfFiles.length} PDF${pdfFiles.length === 1 ? "" : "s"}.`;
      if (reviewQueue.length > 0) {
        // Show review overlay for each document one at a time. The first is shown
        // immediately; the rest are queued and will appear as each review is confirmed.
        setPendingAcroReviewTotal(reviewQueue.length);
        setSelectedDocumentId(reviewQueue[0].documentId);
        setPendingAcroReview(reviewQueue[0]);
        setPendingAcroReviewQueue(reviewQueue.slice(1));
        goBuilderStep("mapping");
        flashStatus(`${baseMsg} Review AcroForm fields to confirm field mappings.`);
      } else {
        setPendingAcroReview(null);
        setPendingAcroReviewQueue([]);
        flashStatus(`${baseMsg} No AcroForm fields detected — map fields manually in the mapper.`);
      }
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
        const res = await fetch(`${API_BASE}${docupleteApiPath}/packages/${selectedPackage.id}/documents/${docId}`, {
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
        flashStatus("Removed document.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not remove document");
      } finally {
        setIsSaving(false);
      }
      return;
    }
    useDocupleteStore.getState().setMappings(
      useDocupleteStore.getState().mappings.filter((m) => m.documentId !== docId),
    );
    updateSelectedPackage((pkg) => ({
      ...pkg,
      documents: pkg.documents.filter((doc) => doc.id !== docId),
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
        interviewMode: "optional",
        defaultValue: "",
        source: "interview",
        sensitive: false,
        validationType: "none",
        validationPattern: "",
        validationMessage: "",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [field, ...pkg.fields] };
    });
  }

  function openFieldEditorForAdd() {
    if (!selectedPackage) return;
    setFieldEditorDraft({
      name: `Field ${selectedPackage.fields.length + 1}`,
      color: pickFieldColor(selectedPackage.fields.map((f) => f.color), false),
      type: "text", options: [], interviewMode: "optional",
      hasDefault: false, defaultValue: "",
      validationType: "none", validationPattern: "", validationMessage: "",
      packageOnly: false, condition: null, condition2: null, conditionOperator: "and", sumGroup: "", copyFrom: null,
    });
    setFieldEditorModal({ mode: "add", fieldId: null });
  }

  function openFieldEditorForEdit(fieldId: string) {
    const field = selectedPackage?.fields.find((f) => f.id === fieldId);
    if (!field) return;
    if (isSystemEsignFieldId(fieldId)) return; // system e-sign fields are read-only
    // For library-linked fields, the real options may live in the library record.
    // Strategy 1: exact ID match (IDs already coerced to strings by normalizers).
    // Strategy 2: if ID lookup misses (stale/missing libraryFieldId) and the package
    //             field has no options of its own, fall back to matching by label+type
    //             so that fields like "Primary/Contingent" in new packages automatically
    //             pick up the library options without the user having to re-enter them.
    const packageOpts = field.options ?? [];
    const isChoiceField = field.type === "radio" || field.type === "checkbox" || field.type === "dropdown";
    let libField = field.libraryFieldId
      ? fieldLibrary.find((f) => f.id === field.libraryFieldId)
      : undefined;
    if (!libField && isChoiceField && packageOpts.length === 0) {
      libField = fieldLibrary.find(
        (f) =>
          f.label.toLowerCase() === field.name.toLowerCase() &&
          f.type === field.type &&
          (f.options?.length ?? 0) > 0,
      );
    }
    const effectiveOptions =
      libField?.options?.length && (field.optionsMode === "inherit" || packageOpts.length === 0)
        ? libField.options
        : packageOpts;
    setFieldEditorDraft({
      name: field.name, color: field.color, type: field.type,
      options: effectiveOptions,
      interviewMode: field.interviewMode,
      hasDefault: Boolean(field.defaultValue),
      defaultValue: field.defaultValue ?? "",
      validationType: field.validationType ?? "none",
      validationPattern: field.validationPattern ?? "",
      validationMessage: field.validationMessage ?? "",
      packageOnly: false, condition: field.condition ?? null, condition2: field.condition2 ?? null, conditionOperator: field.conditionOperator ?? "and",
      sumGroup: field.sumGroup ?? "",
      copyFrom: field.copyFrom ?? null,
    });
    setSelectedFieldId(fieldId);
    setFieldEditorModal({ mode: "edit", fieldId });
  }

  function autoPlacementsForOptions(fieldId: string, opts: string[], existingMappings: MappingItem[], allOptions?: string[], fieldType?: FieldItem["type"]): MappingItem[] {
    if (!selectedDocument || opts.length === 0) return [];
    const existingFormats = new Set(
      existingMappings
        .filter((m) => m.fieldId === fieldId && m.documentId === selectedDocument.id && m.page === selectedPage)
        .map((m) => m.format),
    );
    const newOpts = opts.filter((opt) => !existingFormats.has(`checkbox-option:${opt}`));
    const existingCount = existingMappings.filter((m) => m.fieldId === fieldId && m.documentId === selectedDocument.id && m.page === selectedPage).length;
    const defaultMark = fieldType === "radio" ? "●" : "X";
    return newOpts.map((opt, i) => {
      const colorIndex = allOptions ? allOptions.indexOf(opt) : (existingCount + i);
      return {
        id: newId("map"),
        fieldId,
        documentId: selectedDocument.id,
        page: selectedPage,
        x: clampPercent(15, 0, 96),
        y: clampPercent(15 + (existingCount + i) * 5, 0, 96),
        w: 3.5,
        h: 3.5,
        fontSize: 0,
        align: "center" as const,
        format: `checkbox-option:${opt}`,
        optionColor: OPTION_COLORS[colorIndex % OPTION_COLORS.length],
        mark: defaultMark,
      };
    });
  }

  /**
   * Multi-strategy fuzzy matcher for auto-map.
   *
   * Strategies (highest score wins, minimum 35 to accept):
   *   100 — exact match after normalization
   *    90 — exact after stripping common modifier words from the field name
   *    75 — one contains the other after stripping
   *    70 — one contains the other (normalized only)
   *   40–70 — word overlap (Jaccard ≥ 0.5 on non-trivial words)
   *    60 — acronym match (e.g. SSN ↔ Social Security Number)
   *
   * alreadyMatchedInThisRun lets _2/_3 PDF suffixed fields prefer a different
   * package field than the one just matched (e.g. City_2 → "Mailing city"
   * after City → "Client city"), while still falling back if no other option exists.
   */
  function findBestFieldForAnnotation(
    ann: AcroAnnotation,
    fields: FieldItem[],
    alreadyMatchedInThisRun: Set<string>,
  ): FieldItem | undefined {
    if (!ann.fieldName) return undefined;

    const candidates = fields
      .map((f) => ({ field: f, score: fieldNameScore(f.name, ann.fieldName) }))
      .filter((c) => c.score >= FIELD_NAME_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) return undefined;

    // Prefer a field not yet matched in this run — handles _2 suffix disambiguation.
    // Only override if the unmatched candidate is within 15 pts of the best overall.
    const unmatched = candidates.filter((c) => !alreadyMatchedInThisRun.has(c.field.id));
    if (unmatched.length > 0 && unmatched[0].score >= candidates[0].score - 15) {
      return unmatched[0].field;
    }
    return candidates[0].field;
  }

  function applyAnnotationMappingsForReview(annotations: PendingAnnotation[]) {
    if (!selectedDocument || !selectedPackage || !annotations.length) return;
    let placed = 0;
    const alreadyMatchedInThisRun = new Set<string>();
    const currentMappings = useDocupleteStore.getState().mappings;
    pushUndo([...currentMappings]);
    let newMappings = [...currentMappings];
    for (const ann of annotations) {
      const [x1, y1, x2, y2] = ann.rect;
      const xPct = clampPercent((x1 / ann.pageW) * 100, 0, 98);
      const yPct = clampPercent(((ann.pageH - y2) / ann.pageH) * 100, 0, 98);
      const wPct = Math.max(((x2 - x1) / ann.pageW) * 100, 1);
      const hPct = Math.max(((y2 - y1) / ann.pageH) * 100, 0.5);
      const field = findBestFieldForAnnotation(ann, selectedPackage.fields, alreadyMatchedInThisRun);
      if (!field) continue;
      const alreadyMapped = newMappings.some(
        (m) => m.fieldId === field.id && m.documentId === selectedDocument.id &&
               m.page === ann.page && Math.abs(m.x - xPct) < 3 && Math.abs(m.y - yPct) < 3,
      );
      if (alreadyMapped) continue;
      alreadyMatchedInThisRun.add(field.id);
      newMappings = [...newMappings, {
        id: newId("map"),
        fieldId: field.id,
        documentId: selectedDocument.id,
        page: ann.page,
        x: xPct, y: yPct, w: wPct, h: hPct,
        fontSize: 11, align: "left",
        format: defaultMappingFormat(field),
      }];
      placed++;
    }
    if (placed > 0) {
      useDocupleteStore.getState().setMappings(newMappings);
      flashStatus(`Auto-mapped ${placed} field${placed === 1 ? "" : "s"} from AcroForm PDF.`);
    } else {
      popUndo();
    }
  }

  function applyReviewChoices(
    documentId: string,
    annotations: PendingAnnotation[],
    choices: RowChoice[],
  ): { mapped: number; addedFromLibrary: number } {
    if (!selectedPackage) return { mapped: 0, addedFromLibrary: 0 };

    // Plan library fields to add (pre-compute IDs so we can reference them in mappings immediately)
    const libAdditions = new Map<string, { fieldId: string; field: FieldItem }>();
    for (const choice of choices) {
      if (choice.source !== "library") continue;
      if (libAdditions.has(choice.libraryId)) continue;
      const lib = fieldLibrary.find((f) => f.id === choice.libraryId);
      if (!lib) continue;
      const existing = selectedPackage.fields.find((f) => f.libraryFieldId === lib.id);
      if (existing) {
        libAdditions.set(lib.id, { fieldId: existing.id, field: existing });
      } else {
        const fieldId = newId("field");
        const usedColors = [
          ...selectedPackage.fields.map((f) => f.color),
          ...Array.from(libAdditions.values()).map((a) => a.field.color),
        ];
        const newField: FieldItem = {
          id: fieldId,
          libraryFieldId: lib.id,
          name: lib.label,
          color: pickFieldColor(usedColors, lib.sensitive),
          type: lib.type,
          optionsMode: "inherit",
          interviewMode: lib.required ? "required" : "optional",
          defaultValue: "",
          source: lib.source,
          sensitive: lib.sensitive,
          validationType: lib.validationType,
          validationPattern: lib.validationPattern ?? "",
          validationMessage: lib.validationMessage ?? "",
        };
        libAdditions.set(lib.id, { fieldId, field: newField });
      }
    }

    // Batch-add brand-new library fields to the package in one update
    const newFields = Array.from(libAdditions.values())
      .filter(({ field }) => !selectedPackage.fields.find((f) => f.id === field.id))
      .map(({ field }) => field);
    if (newFields.length > 0) {
      updateSelectedPackage((pkg) => ({ ...pkg, fields: [...pkg.fields, ...newFields] }));
    }

    // Build mappings using the resolved field IDs
    const currentMappings = useDocupleteStore.getState().mappings;
    pushUndo([...currentMappings]);
    const newMappings = [...currentMappings];
    let mapped = 0;

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      if (!choice || choice.source === "none" || choice.source === "mapper") continue;
      const ann = annotations[i];
      if (!ann) continue;

      let fieldId: string;
      if (choice.source === "package") {
        fieldId = choice.fieldId;
      } else {
        const addition = libAdditions.get(choice.libraryId);
        if (!addition) continue;
        fieldId = addition.fieldId;
      }

      const [x1, y1, x2, y2] = ann.rect;
      const xPct = clampPercent((x1 / ann.pageW) * 100, 0, 98);
      const yPct = clampPercent(((ann.pageH - y2) / ann.pageH) * 100, 0, 98);
      const wPct = Math.max(((x2 - x1) / ann.pageW) * 100, 1);
      const hPct = Math.max(((y2 - y1) / ann.pageH) * 100, 0.5);

      const pkgField = [...selectedPackage.fields, ...newFields].find((f) => f.id === fieldId);
      newMappings.push({
        id: newId("map"),
        fieldId,
        documentId,
        page: ann.page,
        x: xPct, y: yPct, w: wPct, h: hPct,
        fontSize: 11,
        align: "left",
        format: pkgField ? defaultMappingFormat(pkgField) : "",
      });
      mapped++;
    }

    if (mapped > 0) {
      useDocupleteStore.getState().setMappings(newMappings);
    } else {
      popUndo();
    }

    return { mapped, addedFromLibrary: newFields.length };
  }

  function autoMapFromPdfFields() {
    if (!selectedDocument || !selectedPackage || !acroAnnotations.length) return;
    // Only auto-map fields on the currently visible page
    const pageAnnotations = acroAnnotations.filter((a) => a.page === selectedPage);
    if (!pageAnnotations.length) return;
    let placed = 0;
    let skipped = 0;
    // Track which fields were matched in this run for _2/_3 disambiguation.
    const alreadyMatchedInThisRun = new Set<string>();
    // Track resolved selections to surface in the status message.
    const resolvedNames: string[] = [];
    const currentMappings = useDocupleteStore.getState().mappings;
    pushUndo([...currentMappings]);
    let newMappings = [...currentMappings];
    for (const ann of pageAnnotations) {
      const [x1, y1, x2, y2] = ann.rect;
      // Convert from PDF coords (bottom-left origin) to percentage (top-left origin)
      const xPct = clampPercent((x1 / nativePageW) * 100, 0, 98);
      const yPct = clampPercent(((nativePageH - y2) / nativePageH) * 100, 0, 98);
      const wPct = Math.max(((x2 - x1) / nativePageW) * 100, 1);
      const hPct = Math.max(((y2 - y1) / nativePageH) * 100, 0.5);
      // Only match against fields that already exist in this package — never
      // create new fields automatically. PDF form fields often have many
      // semantically-equivalent names (Printed Name, Signer Name, Account Holder)
      // that all represent the same Docuplete field. Creating a new field for
      // each unmatched annotation would pollute the interview with duplicates.
      const field = findBestFieldForAnnotation(ann, selectedPackage.fields, alreadyMatchedInThisRun);
      if (!field) { skipped++; continue; }
      // Skip if this field already has a mapping very close to this position on this page
      const alreadyMapped = newMappings.some(
        (m) =>
          m.fieldId === field.id &&
          m.documentId === selectedDocument.id &&
          m.page === selectedPage &&
          Math.abs(m.x - xPct) < 3 &&
          Math.abs(m.y - yPct) < 3,
      );
      if (alreadyMapped) { skipped++; continue; }
      alreadyMatchedInThisRun.add(field.id);
      resolvedNames.push(field.name);
      newMappings = [
        ...newMappings,
        {
          id: newId("map"),
          fieldId: field.id,
          documentId: selectedDocument.id,
          page: selectedPage,
          x: xPct,
          y: yPct,
          w: wPct,
          h: hPct,
          fontSize: 11,
          align: "left",
          format: defaultMappingFormat(field),
        },
      ];
      placed++;
    }
    if (placed > 0) {
      useDocupleteStore.getState().setMappings(newMappings);
    } else {
      popUndo(); // discard the snapshot we just pushed
    }
    if (placed > 0) {
      const skipNote = skipped > 0 ? ` · ${skipped} unmatched` : "";
      const MAX_NAMES = 3;
      const nameList = resolvedNames.length <= MAX_NAMES
        ? resolvedNames.join(", ")
        : `${resolvedNames.slice(0, MAX_NAMES).join(", ")} +${resolvedNames.length - MAX_NAMES} more`;
      flashStatus(`Mapped ${placed} field${placed === 1 ? "" : "s"} from PDF: ${nameList}${skipNote}`);
    } else {
      const pdfNames = pageAnnotations.map((a) => a.fieldName).filter(Boolean).slice(0, 5).join(", ");
      flashStatus(
        skipped === pageAnnotations.length
          ? `No PDF fields matched package fields${pdfNames ? ` (PDF has: ${pdfNames}${pageAnnotations.length > 5 ? "…" : ""})` : ""}. Rename package fields to match, or drag manually.`
          : "All matching PDF fields are already mapped on this page.",
      );
    }
  }

  async function saveFieldFromModal() {
    if (!fieldEditorModal || !selectedPackage) return;
    const { name, color, type, options, interviewMode, hasDefault, defaultValue, validationType, validationPattern, validationMessage, packageOnly, condition, condition2, conditionOperator, sumGroup, copyFrom } = fieldEditorDraft;
    const cleanOpts = options.filter(Boolean);
    const isChoiceType = type === "radio" || type === "checkbox";

    let resolvedLibraryFieldId = "";

    if (fieldEditorModal.mode === "add" && !packageOnly) {
      setFieldModalSaving(true);
      const fieldLabel = name.trim() || `Field ${selectedPackage.fields.length + 1}`;
      try {
        const res = await fetch(`${API_BASE}${docupleteApiPath}/field-library`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({
            label: fieldLabel,
            type,
            options: cleanOpts,
            validationType: validationType ?? "none",
            validationPattern: validationPattern || null,
            validationMessage: validationMessage || null,
            active: true,
            sortOrder: (fieldLibrary.length + 1) * 10,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          resolvedLibraryFieldId = data.field?.id ?? "";
          // Append only the new field — do NOT call loadBootstrap() which would wipe unsaved mapper state.
          if (data.field) setFieldLibrary((prev) => [...normalizeFieldLibrary([data.field]), ...prev]);
        } else if (res.status === 409 && data.fieldId) {
          resolvedLibraryFieldId = data.fieldId;
        }
      } catch {
        // Network error — add to package without library link
      } finally {
        setFieldModalSaving(false);
      }
    }

    if (fieldEditorModal.mode === "add") {
      const fieldId = newId("field");
      const field: FieldItem = {
        id: fieldId, libraryFieldId: resolvedLibraryFieldId,
        name: name.trim() || `Field ${(selectedPackage?.fields.length ?? 0) + 1}`,
        color, type, options: cleanOpts, optionsMode: "override",
        interviewMode, defaultValue: hasDefault ? defaultValue : "",
        source: "interview", sensitive: isSensitiveValidationType(validationType),
        validationType: validationType ?? "none", validationPattern, validationMessage,
        condition: condition ?? undefined,
        condition2: condition2 ?? undefined,
        conditionOperator: conditionOperator,
        nameMode: "inherit",
        ...(sumGroup.trim() ? { sumGroup: sumGroup.trim() } : {}),
        ...(copyFrom?.fieldId ? { copyFrom } : {}),
      };
      setSelectedFieldId(field.id);
      const currentStoreMappings = useDocupleteStore.getState().mappings;
      updateSelectedPackage((pkg) => ({
        ...pkg,
        fields: [field, ...pkg.fields],
        mappings: [...currentStoreMappings],
      }));
    } else if (fieldEditorModal.fieldId) {
      const fid = fieldEditorModal.fieldId;
      const editedField = selectedPackage.fields.find((f) => f.id === fid);
      const libField = editedField?.libraryFieldId ? fieldLibrary.find((f) => f.id === editedField.libraryFieldId) : undefined;
      const savedName = name.trim() || editedField?.name || "";
      const nameMode: "inherit" | "override" = libField && savedName.toLowerCase() !== libField.label.toLowerCase() ? "override" : "inherit";
      const currentStoreMappings = useDocupleteStore.getState().mappings;
      const autoMappings = isChoiceType ? autoPlacementsForOptions(fid, cleanOpts, currentStoreMappings, cleanOpts, type) : [];
      if (autoMappings.length > 0) pushUndo([...currentStoreMappings]);
      autoMappings.forEach((m) => useDocupleteStore.getState().addMapping(m));
      updateSelectedPackage((pkg) => ({
        ...pkg,
        fields: pkg.fields.map((f) => f.id === fid ? {
          ...f, name: name.trim() || f.name, color, type,
          options: cleanOpts, optionsMode: "override" as const,
          interviewMode, defaultValue: hasDefault ? defaultValue : "",
          sensitive: f.sensitive || isSensitiveValidationType(validationType),
          validationType: validationType ?? "none", validationPattern, validationMessage,
          condition: condition ?? undefined,
          condition2: condition2 ?? undefined,
          conditionOperator: conditionOperator,
          nameMode,
          sumGroup: sumGroup.trim() || undefined,
          copyFrom: copyFrom?.fieldId ? copyFrom : undefined,
        } : f),
        mappings: [...currentStoreMappings, ...autoMappings],
      }));
    }
    setFieldEditorModal(null);
  }

  function updateSelectedField(patch: Partial<FieldItem>) {
    if (!selectedField) return;
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.map((field) => field.id === selectedField.id ? { ...field, ...patch } : field),
    }));
  }

  function updateFieldInPackage(fieldId: string, patch: Partial<FieldItem>) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.map((f) => f.id === fieldId ? { ...f, ...patch } : f),
    }));
  }

  function unlinkSelectedFieldFromLibrary() {
    if (!selectedField?.libraryFieldId) return;
    updateSelectedField({ libraryFieldId: "", optionsMode: undefined });
  }

  function removeField(fieldId: string) {
    if (!selectedPackage) return;
    const field = selectedPackage.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const deps = scanFieldDeps(fieldId, field.name, selectedPackage.fields);
    if (deps.length > 0) {
      setDeleteGuard({ fieldId, fieldName: field.name, deps, replacementFieldId: "" });
      return;
    }
    useDocupleteStore.getState().removeMappingsForField(fieldId);
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.filter((f) => f.id !== fieldId),
    }));
    setSelectedFieldId(null);
    setSelectedMappingId(null);
  }

  function confirmDelete() {
    if (!deleteGuard || !selectedPackage) return;
    const { fieldId, deps, replacementFieldId } = deleteGuard;
    if (replacementFieldId) {
      const store = useDocupleteStore.getState();
      store.setMappings(store.mappings.map((m) =>
        m.fieldId === fieldId ? { ...m, fieldId: replacementFieldId } : m
      ));
      updateSelectedPackage((pkg) => ({
        ...pkg,
        fields: pkg.fields
          .map((f) => {
            let u = { ...f };
            if (f.condition?.fieldId === fieldId)
              u = { ...u, condition: { ...f.condition, fieldId: replacementFieldId } };
            if (f.condition2?.fieldId === fieldId)
              u = { ...u, condition2: { ...f.condition2, fieldId: replacementFieldId } };
            if (f.copyFrom?.whenFieldId === fieldId)
              u = { ...u, copyFrom: { ...f.copyFrom!, whenFieldId: replacementFieldId } };
            if (f.copyFrom?.fieldId === fieldId)
              u = { ...u, copyFrom: { ...f.copyFrom!, fieldId: replacementFieldId } };
            return u;
          })
          .filter((f) => f.id !== fieldId),
      }));
    } else {
      useDocupleteStore.getState().removeMappingsForField(fieldId);
      updateSelectedPackage((pkg) => ({
        ...pkg,
        fields: pkg.fields.filter((f) => f.id !== fieldId),
      }));
      const newRefs = [...brokenRefs, ...deps];
      setBrokenRefs(newRefs);
      saveBrokenRefs(selectedPackage.id, newRefs);
    }
    setSelectedFieldId(null);
    setSelectedMappingId(null);
    setDeleteGuard(null);
  }

  function copyField(sourceFieldId: string) {
    const snapX = clampPercent((placementModal?.pdfX ?? 20) + 3, 0, 74);
    const snapY = clampPercent((placementModal?.pdfY ?? 20) + 3, 0, 94);
    pushUndo([...useDocupleteStore.getState().mappings]);
    updateSelectedPackage((pkg) => {
      const source = pkg.fields.find((f) => f.id === sourceFieldId);
      if (!source) return pkg;
      const copy: FieldItem = {
        ...source,
        id: newId("field"),
        libraryFieldId: "",
        name: `${source.name} (copy)`,
        color: pickFieldColor(pkg.fields.map((f) => f.color), source.sensitive),
        interviewMode: "optional",
        defaultValue: "",
      };
      if (selectedDocument) {
        const mappingId = newId("map");
        const newMapping: MappingItem = {
          id: mappingId,
          fieldId: copy.id,
          documentId: selectedDocument.id,
          page: selectedPage,
          x: snapX,
          y: snapY,
          w: 26,
          h: 4,
          fontSize: 11,
          align: "left",
          format: defaultMappingFormat(copy),
        };
        setSelectedFieldId(copy.id);
        setSelectedMappingId(mappingId);
        useDocupleteStore.getState().addMapping(newMapping);
        return { ...pkg, fields: [...pkg.fields, copy] };
      }
      setSelectedFieldId(copy.id);
      return { ...pkg, fields: [...pkg.fields, copy] };
    });
    setPlacementModal(null);
  }

  function duplicateMapping(sourceMappingId: string) {
    const snapX = clampPercent((placementModal?.pdfX ?? 20) + 3, 0, 74);
    const snapY = clampPercent((placementModal?.pdfY ?? 20) + 3, 0, 94);
    pushUndo([...useDocupleteStore.getState().mappings]);
    const srcMap = useDocupleteStore.getState().mappings.find((m) => m.id === sourceMappingId);
    if (!srcMap || !selectedPackage) { setPlacementModal(null); return; }
    updateSelectedPackage((pkg) => {
      const srcField = srcMap.fieldId ? pkg.fields.find((f) => f.id === srcMap.fieldId) : undefined;
      const newField: FieldItem | undefined = srcField && !isSystemEsignFieldId(srcField.id) ? {
        ...srcField,
        id: newId("field"),
        libraryFieldId: "",
        name: `${srcField.name} (copy)`,
        color: pickFieldColor(pkg.fields.map((f) => f.color), srcField.sensitive),
      } : undefined;
      const newMapping: MappingItem = {
        ...srcMap,
        id: newId("mapping"),
        fieldId: newField?.id ?? srcMap.fieldId,
        recipientId: undefined,
        x: snapX,
        y: snapY,
      };
      if (newField) setSelectedFieldId(newField.id);
      setSelectedMappingId(newMapping.id);
      useDocupleteStore.getState().addMapping(newMapping);
      const fields = newField ? [newField, ...pkg.fields] : pkg.fields;
      return { ...pkg, fields };
    });
    setPlacementModal(null);
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
    const n = useDocupleteStore.getState().mappings.length;
    addMappingForField(selectedField, 18 + n % 5 * 12, 20 + n % 8 * 8);
  }

  function addMappingForField(field: FieldItem, x: number, y: number, pageOverride?: number) {
    if (!selectedDocument) return;
    const targetPage = pageOverride ?? selectedPage;
    const isChoiceType = field.type === "radio" || field.type === "checkbox";
    const ownOpts = field.options?.filter(Boolean) ?? [];
    const opts = ownOpts.length > 0
      ? ownOpts
      : field.optionsMode === "inherit" && field.libraryFieldId
        ? (fieldLibrary.find((l) => l.id === field.libraryFieldId)?.options ?? []).filter(Boolean)
        : [];

    if (isChoiceType && opts.length > 0) {
      // Only create slots for options that don't already have a checkbox-option mapping
      // on this document/page — avoids duplicating slots that were auto-placed when
      // the field editor was saved.
      const currentMappings = useDocupleteStore.getState().mappings;
      const existingFormats = new Set(
        currentMappings
          .filter((m) => m.fieldId === field.id && m.documentId === selectedDocument!.id && m.page === targetPage)
          .map((m) => m.format),
      );
      const newOpts = opts.filter((opt) => !existingFormats.has(`checkbox-option:${opt}`));
      if (newOpts.length === 0) {
        flashStatus(`All options for "${field.name}" are already placed on this page`);
        setSelectedFieldId(field.id);
        return;
      }
      pushUndo([...currentMappings]);
      let lastId = "";
      newOpts.forEach((opt, i) => {
        const colorIndex = opts.indexOf(opt);
        const mappingId = newId("map");
        lastId = mappingId;
        useDocupleteStore.getState().addMapping({
          id: mappingId,
          fieldId: field.id,
          documentId: selectedDocument!.id,
          page: targetPage,
          x: clampPercent(x, 0, 96),
          y: clampPercent(y + i * 4.5, 0, 96),
          w: 3.5,
          h: 3.5,
          fontSize: 0,
          align: "center",
          format: `checkbox-option:${opt}`,
          optionColor: OPTION_COLORS[colorIndex % OPTION_COLORS.length],
          mark: field.type === "radio" ? "●" : "X",
        });
      });
      setSelectedMappingId(lastId);
      setSelectedFieldId(field.id);
      setPlacementModal(null);
      return;
    }

    pushUndo([...useDocupleteStore.getState().mappings]);
    const mappingId = newId("map");
    useDocupleteStore.getState().addMapping({
      id: mappingId,
      fieldId: field.id,
      documentId: selectedDocument.id,
      page: targetPage,
      x: clampPercent(x, 0, 74),
      y: clampPercent(y, 0, 94),
      w: 26,
      h: 4,
      fontSize: 11,
      align: "left",
      format: defaultMappingFormat(field),
    });
    setSelectedMappingId(mappingId);
    setSelectedFieldId(field.id);
    setPlacementModal(null);
  }

  function placeFieldAtCoords(
    fieldId: string,
    clientX: number,
    clientY: number,
    frameEl?: HTMLElement | null,
    pageOverride?: number,
  ) {
    if (!selectedPackage || !selectedDocument) return;
    const frame = frameEl ?? pageFrameRef.current;
    if (!frame) return;
    const field = selectedPackage.fields.find((f) => f.id === fieldId);
    if (!field) return;
    const rect = frame.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    addMappingForField(field, x, y, pageOverride);
    flashStatus(`Placed: ${field.name}`);
  }

  function dropFieldOnPage(e: ReactDragEvent<HTMLDivElement>, frameEl?: HTMLElement | null, pageOverride?: number) {
    e.preventDefault();
    if (!selectedPackage || !selectedDocument) return;
    const fieldId = e.dataTransfer.getData("text/field");
    const frame = frameEl ?? pageFrameRef.current;
    if (!fieldId || !frame) return;
    const rect = frame.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    let field = selectedPackage.fields.find((item) => item.id === fieldId);
    // System e-sign fields are auto-created in the package on first drop
    if (!field && isSystemEsignFieldId(fieldId)) {
      field = makeSystemEsignFieldItem(fieldId, selectedPackage.fields.map((f) => f.color));
      const capturedField = field;
      const mappingId = newId("map");
      const targetPage = pageOverride ?? selectedPage;
      pushUndo([...useDocupleteStore.getState().mappings]);
      const needsAutoDate = (fieldId === ESIGN_FIELD_ID_SIGNATURE || fieldId === ESIGN_FIELD_ID_INITIALS);
      updateSelectedPackage((pkg) => {
        let fields = pkg.fields.find((f) => f.id === capturedField.id) ? pkg.fields : [...pkg.fields, capturedField];
        if (needsAutoDate && !fields.find((f) => f.id === ESIGN_FIELD_ID_DATE)) {
          fields = [...fields, makeSystemEsignFieldItem(ESIGN_FIELD_ID_DATE, fields.map((f) => f.color))];
        }
        return { ...pkg, fields };
      });
      useDocupleteStore.getState().addMapping({
        id: mappingId,
        fieldId: capturedField.id,
        documentId: selectedDocument!.id,
        page: targetPage,
        x: clampPercent(x, 0, 74),
        y: clampPercent(y, 0, 94),
        w: capturedField.id === ESIGN_FIELD_ID_SIGNATURE ? 30 : 22,
        h: capturedField.id === ESIGN_FIELD_ID_SIGNATURE ? 8 : 6,
        fontSize: 11,
        align: "left" as const,
        format: defaultMappingFormat(capturedField),
      });
      setSelectedMappingId(mappingId);
      setSelectedFieldId(capturedField.id);
      setPlacementModal(null);
      return;
    }
    if (!field) return;
    addMappingForField(field, x, y, pageOverride);
  }

  function updateSelectedMapping(patch: Partial<MappingItem>) {
    const selectedMapping = useDocupleteStore.getState().mappings.find((m) => m.id === selectedMappingId) ?? null;
    if (!selectedMapping) return;
    useDocupleteStore.getState().updateMapping(selectedMapping.id, (m) => ({ ...m, ...patch }));
  }

  function chooseMappingFormat(mappingId: string, format: MappingFormat | string) {
    useDocupleteStore.getState().updateMapping(mappingId, (m) => ({ ...m, format }));
    setSelectedMappingId(mappingId);
  }

  function removeSelectedMapping() {
    const selectedMapping = useDocupleteStore.getState().mappings.find((m) => m.id === selectedMappingId) ?? null;
    if (!selectedMapping) return;
    useDocupleteStore.getState().removeMapping(selectedMapping.id);
    setSelectedMappingId(null);
  }

  function addRecipient(recipient: RecipientItem) {
    useDocupleteStore.getState().addRecipient(recipient);
    setRecipientPickerOpen(false);
  }

  function removeRecipient(recipientId: string) {
    useDocupleteStore.getState().removeRecipient(recipientId);
    useDocupleteStore.getState().clearRecipientFromMappings(recipientId);
  }

  function updateRecipient(recipientId: string, patch: Partial<RecipientItem>) {
    useDocupleteStore.getState().updateRecipient(recipientId, patch);
  }

  function handleInterviewFieldBlur(field: FieldItem, value: string) {
    const error = validateFieldValue(field, value);
    setFieldErrors((prev) => {
      if (!error) {
        if (!prev[field.id]) return prev;
        const next = { ...prev };
        delete next[field.id];
        return next;
      }
      if (prev[field.id] === error) return prev;
      return { ...prev, [field.id]: error };
    });
  }

  function validateInterviewAnswers(): boolean {
    if (!session) return true;
    const activeFields = session.fields.filter((f) => fieldInInterview(f) && f.interviewMode !== "readonly" && evaluateFieldConditions(f, answers));
    const newErrors: Record<string, string> = {};
    for (const field of activeFields) {
      const value = interviewFieldValue(field, answers, session.prefill);
      const error = validateFieldValue(field, value);
      if (error) newErrors[field.id] = error;
    }
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
      flashStatus("Interview saved.");
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
    const isValid = validateInterviewAnswers();
    if (!isValid) {
      setError("Please fix the highlighted errors before generating the packet.");
      return;
    }
    const saved = await saveAnswers("answered");
    if (!saved) return;
    setIsSaving(true);
    try {
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
        flashStatus(data.drive?.url ? "Packet generated and saved to Drive." : "Packet generated.");
      } else {
        setError(data.missingFields?.length ? `Missing required fields: ${data.missingFields.join(", ")}` : data.error ?? "Could not generate packet");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function sendForSignature(deferredFieldIds: Set<string>) {
    if (!session) return;
    setIsSendingForSig(true);
    setSigLink(null);
    setSigLinkToken(null);
    setSigSendError(null);
    setShowSigSendForm(false);
    setSigSendEmailSent(null);
    setSigLinkCopied(false);
    try {
      // Save current answers first
      const saved = await saveAnswers("in_progress");
      if (!saved) { setIsSendingForSig(false); return; }
      // Build prefill from all staff answers, excluding deferred sensitive fields
      const prefill: Record<string, string> = {};
      for (const field of session.fields) {
        if (deferredFieldIds.has(field.id)) continue;
        const val = interviewFieldValue(field, answers, session.prefill as Record<string, string> | undefined);
        if (val.trim()) prefill[field.id] = val;
      }
      // Also include deal prefill (name, email, etc.)
      for (const [k, v] of Object.entries(session.prefill ?? {})) {
        if (String(v ?? "").trim() && !(k in prefill)) prefill[k] = String(v);
      }
      const res = await fetch(`${API_BASE}${docupleteApiPath}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId: session.package_id,
          transactionScope: session.transaction_scope,
          source: "staff_send_for_signature",
          prefill,
          forceScrollConfirmation: true,
        }),
      });
      const data = await res.json() as { error?: string; upgrade_required?: boolean; limit_type?: string; required_plan?: string; token?: string; feature?: string; interviewUrl?: string };
      if (res.status === 402 && data.upgrade_required) {
        showUpgrade({ feature: data.feature, limitType: (data.limit_type as "packages" | "submissions" | "seats") ?? "submissions", requiredPlan: (data.required_plan as "pro" | "enterprise") ?? "pro" });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not create signing session");
      if (!data.interviewUrl) throw new Error("Server did not return a signing URL");
      setSigLink(data.interviewUrl);
      setSigLinkToken(data.token as string);
    } catch (err) {
      setSigSendError(err instanceof Error ? err.message : "Could not create signing session");
    } finally {
      setIsSendingForSig(false);
    }
  }

  async function handleSigSendByEmail() {
    if (!sigLinkToken || !sigSendEmail.trim()) return;
    setIsSendingSigEmail(true);
    setSigSendError(null);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/sessions/${sigLinkToken}/send-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          recipientEmail: sigSendEmail.trim(),
          recipientName: sigSendName.trim(),
          customMessage: sigSendMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send email");
      setSigSendEmailSent(sigSendEmail.trim());
      setShowSigSendForm(false);
    } catch (err) {
      setSigSendError(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setIsSendingSigEmail(false);
    }
  }

  function copySigLink() {
    if (!sigLink) return;
    navigator.clipboard.writeText(sigLink).then(() => {
      setSigLinkCopied(true);
      setTimeout(() => setSigLinkCopied(false), 2500);
    });
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
      link.download = `${session.package_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "docuplete"}-packet.pdf`;
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

  async function launchTestInterview(pkg: PackageItem) {
    if (!pkg.id) {
      setError("Save the package before launching a test interview.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId: pkg.id,
          transactionScope: pkg.transaction_scope,
          source: "test_mode_admin",
          testMode: true,
          prefill: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not launch test interview");
      navigate(`${interviewBasePath}?session=${data.token}`);
      flashStatus("Test interview session created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch test interview");
    } finally {
      setIsSaving(false);
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
      const res = await fetch(`${API_BASE}${docupleteApiPath}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId,
          transactionScope: packages.find((pkg) => pkg.id === packageId)?.transaction_scope,
          source: "staff_docuplete",
          prefill: {},
        }),
      });
      const data = await res.json() as { error?: string; upgrade_required?: boolean; limit_type?: string; required_plan?: string; token?: string };
      if (res.status === 402 && data.upgrade_required) {
        showUpgrade({ limitType: (data.limit_type as "packages" | "submissions" | "seats") ?? "submissions", requiredPlan: (data.required_plan as "pro" | "enterprise") ?? "pro" });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not launch interview");
      navigate(`${interviewBasePath}?session=${data.token}`);
      flashStatus("Interview session created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not launch interview");
    } finally {
      setIsSaving(false);
    }
  }

  async function generateCustomerLink() {
    const packageId = Number(customerLinkPackageId);
    if (!packageId) { setError("Select a package first."); return; }
    setIsGeneratingLink(true);
    setGeneratedCustomerLink(null);
    setLinkCopied(false);
    setError(null);
    setShowSendLinkForm(false);
    setLinkEmailSent(null);
    setLinkEmailError(null);
    setShowRecipientOverride(false);
    try {
      const prefill: Record<string, string> = {};
      if (customerLinkFirstName.trim()) prefill.firstName = customerLinkFirstName.trim();
      if (customerLinkLastName.trim()) prefill.lastName = customerLinkLastName.trim();
      if (customerLinkEmail.trim()) prefill.email = customerLinkEmail.trim();
      const res = await fetch(`${API_BASE}${docupleteApiPath}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId,
          transactionScope: packages.find((p) => p.id === packageId)?.transaction_scope,
          source: "customer_link",
          prefill,
        }),
      });
      const data = await res.json() as { error?: string; upgrade_required?: boolean; limit_type?: string; required_plan?: string; token?: string; feature?: string; interviewUrl?: string };
      if (res.status === 402 && data.upgrade_required) {
        showUpgrade({ feature: data.feature, limitType: (data.limit_type as "packages" | "submissions" | "seats") ?? "submissions", requiredPlan: (data.required_plan as "pro" | "enterprise") ?? "pro" });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not generate customer link");
      if (!data.interviewUrl) throw new Error("Server did not return an interview URL — please contact support.");
      const link = data.interviewUrl;
      setGeneratedCustomerLink(link);
      setGeneratedCustomerLinkToken(data.token as string);
      setSendLinkEmail(customerLinkEmail.trim());
      setSendLinkName([customerLinkFirstName.trim(), customerLinkLastName.trim()].filter(Boolean).join(" "));
      setSendLinkMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate customer link");
    } finally {
      setIsGeneratingLink(false);
    }
  }

  async function handleSendLinkByEmail() {
    if (!generatedCustomerLinkToken || !sendLinkEmail.trim()) return;
    setIsSendingLink(true);
    setLinkEmailError(null);
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/sessions/${generatedCustomerLinkToken}/send-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          recipientEmail: sendLinkEmail.trim(),
          recipientName:  sendLinkName.trim(),
          customMessage:  sendLinkMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send email");
      setLinkEmailSent(sendLinkEmail.trim());
      setShowSendLinkForm(false);
      setShowRecipientOverride(false);
    } catch (err) {
      setLinkEmailError(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setIsSendingLink(false);
    }
  }

  function copyCustomerLink() {
    if (!generatedCustomerLink) return;
    navigator.clipboard.writeText(generatedCustomerLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  function handleDownloadInterviewCsv() {
    if (!session) return;
    const date = new Date().toISOString().slice(0, 10);
    const safeName = session.package_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const csv = sessionToCsv({
      package_id: session.package_id,
      package_name: session.package_name,
      fields: session.fields,
      answers,
      prefill: session.prefill,
    });
    downloadCsv(csv, `docuplete-${safeName}-${date}.csv`);
  }

  function handleCsvBatchFileChange(file: File | null) {
    setCsvBatchFile(file);
    setCsvBatchHeaders([]);
    setCsvBatchRows([]);
    setCsvBatchOriginalRows([]);
    setCsvBatchMismatch(false);
    setCsvBatchResults(null);
    setCsvBatchError(null);
    setCsvEditingCell(null);
    setCsvBatchHasEdits(false);
    if (csvCorrectedDownloadedTimerRef.current) {
      clearTimeout(csvCorrectedDownloadedTimerRef.current);
      csvCorrectedDownloadedTimerRef.current = null;
    }
    setCsvCorrectedDownloaded(false);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const { headers, rows } = parseCsvString(text);
      setCsvBatchHeaders(headers);
      setCsvBatchRows(rows);
      setCsvBatchOriginalRows(rows.map((r) => ({ ...r })));
      if (csvBatchPackageId) {
        const pkg = packages.find((p) => String(p.id) === csvBatchPackageId);
        if (pkg) {
          const pkgFieldNames = new Set(pkg.fields.filter((f) => f.interviewMode !== "omitted").map((f) => f.name.toLowerCase().trim()));
          const hasMatch = headers.some((h) => {
            const n = h.toLowerCase().trim();
            return n !== "__package_id__" && n !== "__package_name__" && pkgFieldNames.has(n);
          });
          setCsvBatchMismatch(!hasMatch);
        }
      }
    };
    reader.readAsText(file);
  }

  async function handleCsvBatchImport(retryRowIndices?: number[]) {
    const pkgId = Number(csvBatchPackageId);
    if (!pkgId || csvBatchRows.length === 0) return;
    const isRetry = Array.isArray(retryRowIndices) && retryRowIndices.length > 0;
    const rowsToSend = isRetry ? retryRowIndices.map((i) => csvBatchRows[i]) : csvBatchRows;
    setCsvBatchIsImporting(true);
    setCsvBatchError(null);
    if (!isRetry) {
      setCsvInviteOpen(false);
      setCsvInviteResults({});
      setCsvBatchResults(csvBatchRows.map((_, i) => ({ rowIndex: i, token: null, status: "processing" as const })));
    } else {
      setCsvBatchResults((prev) =>
        (prev ?? []).map((r) =>
          retryRowIndices.includes(r.rowIndex) ? { ...r, token: null, status: "processing" as const, error: undefined } : r,
        ),
      );
    }
    try {
      const res = await fetch(`${API_BASE}${docupleteApiPath}/csv-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ packageId: pkgId, rows: rowsToSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Batch import failed");
      if (isRetry) {
        const newByLocalIdx = new Map<number, (typeof data.results)[0]>();
        for (const r of data.results as Array<{ rowIndex: number; token: string | null; status: string; error?: string }>) {
          newByLocalIdx.set(r.rowIndex, r);
        }
        setCsvBatchResults((prev) =>
          (prev ?? []).map((r) => {
            const localIdx = retryRowIndices.indexOf(r.rowIndex);
            if (localIdx === -1) return r;
            const fresh = newByLocalIdx.get(localIdx);
            return fresh ? { ...fresh, rowIndex: r.rowIndex } : r;
          }),
        );
      } else {
        setCsvBatchResults(data.results);
      }
    } catch (err) {
      setCsvBatchError(err instanceof Error ? err.message : "Batch import failed");
      if (!isRetry) setCsvBatchResults(null);
    } finally {
      setCsvBatchIsImporting(false);
    }
  }

  // ── Stable callbacks for PackagePickerSidebar (React.memo won't help if
  //    function identity changes every render). The "latest-ref" pattern keeps
  //    the wrapper identity stable while always calling the current impl. ──────
  const goBuilderStepRef = useRef(goBuilderStep);
  goBuilderStepRef.current = goBuilderStep;
  const stableGoBuilderStep = useCallback(
    (step: BuilderStep, opts?: { autoSort?: boolean; saveFirst?: boolean }) =>
      goBuilderStepRef.current(step, opts),
    [],
  );

  const savePackageRef = useRef(savePackage);
  savePackageRef.current = savePackage;
  const stableSavePackage = useCallback(
    (pkg: PackageItem) => savePackageRef.current(pkg),
    [],
  );

  const createPackageRef = useRef(createPackage);
  createPackageRef.current = createPackage;
  const stableCreatePackage = useCallback(() => createPackageRef.current(), []);
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-screen-2xl mx-auto px-4 py-6 text-[#0F1C3F]">
      <div className="flex flex-wrap items-start gap-3 mb-5">
        {isPublicSession && <p className="text-sm text-[#6B7A99]">Complete your secure paperwork interview.</p>}
        {!isPublicSession && <div className="flex items-stretch">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => goBuilderStep(builderStep)} className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === "packages" || tab === "mapper" ? "border-[#C49A38] text-[#0F1C3F] font-medium" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}>Packages</button>
            </TooltipTrigger>
            <TooltipContent side="bottom">A Package bundles multiple PDF forms into one guided interview session. Configure documents, fields, and automation here.</TooltipContent>
          </Tooltip>
          <div className="w-px self-stretch my-1 bg-[#E2E8F0]" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setTab("sessions")} className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === "sessions" ? "border-[#C49A38] text-[#0F1C3F] font-medium" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}>Sessions</button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Launch a single interview session for one package at a time — staff-guided or via a customer self-service link.</TooltipContent>
          </Tooltip>
          <div className="w-px self-stretch my-1 bg-[#E2E8F0]" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setTab("batch")} className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === "batch" ? "border-[#C49A38] text-[#0F1C3F] font-medium" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}>Batch</button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Upload a CSV to create many sessions at once — one row per client.</TooltipContent>
          </Tooltip>
          <div className="w-px self-stretch my-1 bg-[#E2E8F0]" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setTab("library"); window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${tab === "library" ? "border-[#C49A38] text-[#0F1C3F] font-medium" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}
              >
                Library
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Shared field definitions, field groups, and compliance tags reusable across all packages.</TooltipContent>
          </Tooltip>
          <div className="w-px self-stretch my-1 bg-[#E2E8F0]" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTab("help")}
                className={`px-4 py-2 text-sm border-b-2 transition-colors flex items-center gap-1.5 ${tab === "help" ? "border-[#C49A38] text-[#0F1C3F] font-medium" : "border-transparent text-[#6B7A99] hover:text-[#0F1C3F]"}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Help
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">User guide — step-by-step explanations for every feature.</TooltipContent>
          </Tooltip>
        </div>}
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>}


      <PackagePickerSidebar
        isAdmin={isAdmin}
        isSaving={isSaving}
        tab={tab}
        isPublicSession={isPublicSession}
        addingPackage={addingPackage}
        setAddingPackage={setAddingPackage}
        newPackageName={newPackageName}
        setNewPackageName={setNewPackageName}
        newPackageInputRef={newPackageInputRef}
        builderStep={builderStep}
        goBuilderStep={stableGoBuilderStep}
        savePackage={stableSavePackage}
        createPackage={stableCreatePackage}
        mappingCount={storeMappings.length}
        unmappedCount={unmappedPackageFields.length}
        complianceGapPackageIds={complianceAudit ? new Set(complianceAudit.report.filter((r) => r.hasGap).map((r) => r.packageId)) : undefined}
      />

      {tab === "packages" && (
        <DocupleteBuilderPanel
          selectedPackage={selectedPackage}
          bootstrapLoaded={bootstrapLoaded}
          packages={packages}
          groups={groups}
          transactionTypes={transactionTypes}
          storeMappings={storeMappings}
          packageInterviewFields={packageInterviewFields}
          packageFixedOrHiddenFields={packageFixedOrHiddenFields}
          packageMappedFieldIds={packageMappedFieldIds}
          inlineAddTypeOpen={inlineAddTypeOpen}
          setInlineAddTypeOpen={setInlineAddTypeOpen}
          inlineAddTypeName={inlineAddTypeName}
          setInlineAddTypeName={setInlineAddTypeName}
          inlineAddTypeLoading={inlineAddTypeLoading}
          setInlineAddTypeLoading={setInlineAddTypeLoading}
          inlineAddTypeError={inlineAddTypeError}
          setInlineAddTypeError={setInlineAddTypeError}
          inlineAddGroupOpen={inlineAddGroupOpen}
          setInlineAddGroupOpen={setInlineAddGroupOpen}
          inlineAddGroupName={inlineAddGroupName}
          setInlineAddGroupName={setInlineAddGroupName}
          inlineAddGroupLoading={inlineAddGroupLoading}
          setInlineAddGroupLoading={setInlineAddGroupLoading}
          inlineAddGroupError={inlineAddGroupError}
          setInlineAddGroupError={setInlineAddGroupError}
          typeManageOpen={typeManageOpen}
          setTypeManageOpen={setTypeManageOpen}
          typeDeletingScope={typeDeletingScope}
          setTypeDeletingScope={setTypeDeletingScope}
          fieldLibrary={fieldLibrary}
          isSaving={isSaving}
          isUploadingDocument={isUploadingDocument}
          isDocumentDropActive={isDocumentDropActive}
          setIsDocumentDropActive={setIsDocumentDropActive}
          isDeletingPackage={isDeletingPackage}
          isAdmin={isAdmin}
          builderStep={builderStep}
          seedingDemo={seedingDemo}
          demoUiState={demoUiState}
          demoSessionLoading={demoSessionLoading}
          selectedDocument={selectedDocument}
          selectedDocumentId={selectedDocumentId}
          setSelectedDocumentId={setSelectedDocumentId}
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          addingPackage={addingPackage}
          setAddingPackage={setAddingPackage}
          sortSensors={sortSensors}
          documentPreviewCache={documentPreviewCache}
          documentPreviewCacheOrder={documentPreviewCacheOrder}
          getAuthHeaders={getAuthHeaders}
          docupleteApiPath={docupleteApiPath}
          slackConnected={slackConnected}
          webhookTestStatus={webhookTestStatus}
          webhookSecret={webhookSecret}
          webhookSecretLoading={webhookSecretLoading}
          webhookSecretRevealed={webhookSecretRevealed}
          webhookSecretCopied={webhookSecretCopied}
          setWebhookTestStatus={setWebhookTestStatus}
          setWebhookSecretRevealed={setWebhookSecretRevealed}
          setWebhookSecretCopied={setWebhookSecretCopied}
          webhookDeliveries={webhookDeliveries}
          webhookDeliveriesLoading={webhookDeliveriesLoading}
          expandedDelivery={expandedDelivery}
          setExpandedDelivery={setExpandedDelivery}
          retryingDelivery={retryingDelivery}
          goBuilderStep={stableGoBuilderStep}
          savePackage={stableSavePackage}
          updateSelectedPackage={updateSelectedPackage}
          uploadDocuments={uploadDocuments}
          uploadDocument={uploadDocument}
          addDocument={addDocument}
          removeDocument={removeDocument}
          deletePackage={deletePackage}
          createGroup={createGroup}
          updateGroupLocal={updateGroupLocal}
          saveGroup={saveGroup}
          deleteGroup={deleteGroup}
          createGroupNamed={createGroupNamed}
          createTransactionType={createTransactionType}
          updateTransactionTypeLocal={updateTransactionTypeLocal}
          saveTransactionType={saveTransactionType}
          deleteTransactionType={deleteTransactionType}
          createTransactionTypeNamed={createTransactionTypeNamed}
          createFieldLibraryItem={createFieldLibraryItem}
          updateFieldLibraryLocal={updateFieldLibraryLocal}
          saveFieldLibraryItem={saveFieldLibraryItem}
          deleteFieldLibraryItem={deleteFieldLibraryItem}
          loadFieldLibraryVersions={loadFieldVersions}
          restoreFieldLibraryVersion={restoreFieldVersion}
          loadFieldLibraryAnalytics={loadFieldAnalytics}
          exportFieldLibrary={exportFieldLibrary}
          importFieldLibrary={importFieldLibrary}
          addLibraryFieldToPackage={addLibraryFieldToPackage}
          fieldGroups={fieldGroups}
          createFieldGroup={createFieldGroup}
          updateFieldGroupLocal={updateFieldGroupLocal}
          saveFieldGroup={saveFieldGroup}
          deleteFieldGroup={deleteFieldGroup}
          addGroupToPackage={addGroupToPackage}
          launchTestInterview={launchTestInterview}
          openFieldEditorForAdd={openFieldEditorForAdd}
          openFieldEditorForEdit={openFieldEditorForEdit}
          removeField={removeField}
          setSelectedFieldId={setSelectedFieldId}
          setPackages={setPackages}
          dismissDemoUi={dismissDemoUi}
          handleOpenDemoInterview={handleOpenDemoInterview}
          handleSeedDemo={handleSeedDemo}
          setStandalonePackageId={setStandalonePackageId}
          setTab={setTab}
          allComplianceTags={complianceTags}
          setFieldComplianceTags={setFieldComplianceTags}
          sendTestWebhook={sendTestWebhook}
          fetchWebhookDeliveries={fetchWebhookDeliveries}
          fetchWebhookSecret={fetchWebhookSecret}
          retryDelivery={retryDelivery}
        />
      )}

      {tab === "mapper" && pendingAcroReview && pendingAcroReview.documentId === selectedDocumentId && selectedPackage && (
        <AcroFieldReviewOverlay
          key={pendingAcroReview.documentId}
          annotations={pendingAcroReview.annotations}
          packageFields={selectedPackage.fields}
          fieldLibrary={fieldLibrary}
          documentTitle={pendingAcroReview.docTitle}
          documentIndex={pendingAcroReviewTotal > 0 ? pendingAcroReviewTotal - pendingAcroReviewQueue.length : undefined}
          documentTotal={pendingAcroReviewTotal > 1 ? pendingAcroReviewTotal : undefined}
          pdfUrl={documentPreviewUrl}
          onConfirm={(choices) => {
            const snapshot = { ...pendingAcroReview };
            const result = applyReviewChoices(snapshot.documentId, snapshot.annotations, choices);
            const deferred = choices.filter((c) => c.source === "none" || c.source === "mapper").length;
            const parts: string[] = [];
            if (result.addedFromLibrary > 0) parts.push(`pulled ${result.addedFromLibrary} from library`);
            if (result.mapped > 0) parts.push(`mapped ${result.mapped}`);
            if (deferred > 0) parts.push(`${deferred} deferred — resolve with "Map from PDF" in the mapper`);
            // Advance queue: show next doc or clear
            const next = pendingAcroReviewQueue[0];
            if (next) {
              setPendingAcroReviewQueue((q) => q.slice(1));
              setSelectedDocumentId(next.documentId);
              setPendingAcroReview(next);
              flashStatus(parts.length > 0 ? `AcroForm: ${parts.join("; ")}. Reviewing next document…` : "Reviewing next document…");
            } else {
              setPendingAcroReview(null);
              setPendingAcroReviewQueue([]);
              setPendingAcroReviewTotal(0);
              flashStatus(parts.length > 0 ? `AcroForm scan complete: ${parts.join("; ")}.` : "AcroForm scan complete.");
            }
          }}
          onSkip={() => {
            // Skip this doc's review; still advance the queue
            const next = pendingAcroReviewQueue[0];
            if (next) {
              setPendingAcroReviewQueue((q) => q.slice(1));
              setSelectedDocumentId(next.documentId);
              setPendingAcroReview(next);
            } else {
              setPendingAcroReview(null);
              setPendingAcroReviewQueue([]);
              setPendingAcroReviewTotal(0);
            }
          }}
        />
      )}

      {tab === "mapper" && !(pendingAcroReview && pendingAcroReview.documentId === selectedDocumentId) && (
        !selectedPackage ? (
          <EmptyState message="Create or select a package first." />
        ) : (
          <DocupleteMapperPanel
            selectedPackage={selectedPackage}
            selectedDocument={selectedDocument}
            selectedDocumentId={selectedDocumentId}
            setSelectedDocumentId={setSelectedDocumentId}
            selectedPage={selectedPage}
            setSelectedPage={setSelectedPage}
            nativePageW={nativePageW}
            nativePageH={nativePageH}
            effectiveScale={effectiveScale}
            mapperViewW={mapperViewW}
            mapperViewH={mapperViewH}
            mapperScrollMode={mapperScrollMode}
            setMapperScrollMode={setMapperScrollMode}
            userZoom={userZoom}
            setUserZoom={setUserZoom}
            snapGrid={snapGrid}
            setSnapGrid={setSnapGrid}
            documentPreviewUrl={documentPreviewUrl}
            acroAnnotations={acroAnnotations}
            showAcroLayer={showAcroLayer}
            setShowAcroLayer={setShowAcroLayer}
            isPdfRendering={isPdfRendering}
            pdfRenderError={pdfRenderError}
            fieldLibrary={fieldLibrary}
            inspectorMode={inspectorMode}
            setInspectorMode={setInspectorMode}
            placementModal={placementModal}
            setPlacementModal={setPlacementModal}
            placementModalPos={placementModalPos}
            setPlacementModalPos={setPlacementModalPos}
            recipientsExpanded={recipientsExpanded}
            setRecipientsExpanded={setRecipientsExpanded}
            setRecipientPickerOpen={setRecipientPickerOpen}
            sortSensors={sortSensors}
            isUploadingDocument={isUploadingDocument}
            isSaving={isSaving}
            showShortcutsPopover={showShortcutsPopover}
            setShowShortcutsPopover={setShowShortcutsPopover}
            shortcutsPopoverRef={shortcutsPopoverRef}
            beginMappingPointer={beginMappingPointer}
            mappingStartedDocIds={mappingStartedDocIds}
            selectedField={selectedField}
            fieldDragFromHandle={fieldDragFromHandle}
            setSelectedFieldId={setSelectedFieldId}
            scrollContainerRef={scrollContainerRef}
            scrollPdfDoc={scrollPdfDoc}
            canvasRef={canvasRef}
            pageFrameRef={pageFrameRef}
            setMapperContainerEl={setMapperContainerEl}
            goBuilderStep={stableGoBuilderStep}
            savePackage={stableSavePackage}
            updateSelectedPackage={updateSelectedPackage}
            uploadDocument={uploadDocument}
            removeDocument={removeDocument}
            removeField={removeField}
            removeSelectedMapping={removeSelectedMapping}
            updateSelectedMapping={updateSelectedMapping}
            chooseMappingFormat={chooseMappingFormat}
            duplicateMapping={duplicateMapping}
            openFieldEditorForEdit={openFieldEditorForEdit}
            openFieldEditorForAdd={openFieldEditorForAdd}
            autoMapFromPdfFields={autoMapFromPdfFields}
            dropFieldOnPage={dropFieldOnPage}
            placeFieldAtCoords={placeFieldAtCoords}
            updateFieldInPackage={updateFieldInPackage}
            copyField={copyField}
            addLibraryFieldToPackage={addLibraryFieldToPackage}
            fieldGroups={fieldGroups}
            addGroupToPackage={addGroupToPackage}
            removeRecipient={removeRecipient}
            updateRecipient={updateRecipient}
            getAuthHeaders={getAuthHeaders}
            docupleteApiPath={docupleteApiPath}
            documentPreviewCache={documentPreviewCache}
            documentPreviewCacheOrder={documentPreviewCacheOrder}
            autoSaveStatus={autoSaveStatus}
            brokenRefs={brokenRefs}
          />
        )
      )}

      {tab === "sessions" && (
        <DocupleteInterviewPanel
          session={session}
          isPublicSession={isPublicSession}
          isSaving={isSaving}
          activePackages={activePackages}
          packages={packages}
          standalonePackageId={standalonePackageId}
          setStandalonePackageId={setStandalonePackageId}
          customerLinkPackageId={customerLinkPackageId}
          setCustomerLinkPackageId={setCustomerLinkPackageId}
          customerLinkFirstName={customerLinkFirstName}
          setCustomerLinkFirstName={setCustomerLinkFirstName}
          customerLinkLastName={customerLinkLastName}
          setCustomerLinkLastName={setCustomerLinkLastName}
          customerLinkEmail={customerLinkEmail}
          setCustomerLinkEmail={setCustomerLinkEmail}
          isGeneratingLink={isGeneratingLink}
          generatedCustomerLink={generatedCustomerLink}
          generatedCustomerLinkToken={generatedCustomerLinkToken}
          setGeneratedCustomerLink={setGeneratedCustomerLink}
          setGeneratedCustomerLinkToken={setGeneratedCustomerLinkToken}
          linkCopied={linkCopied}
          linkEmailSent={linkEmailSent}
          setLinkEmailSent={setLinkEmailSent}
          showSendLinkForm={showSendLinkForm}
          setShowSendLinkForm={setShowSendLinkForm}
          showRecipientOverride={showRecipientOverride}
          setShowRecipientOverride={setShowRecipientOverride}
          sendLinkEmail={sendLinkEmail}
          setSendLinkEmail={setSendLinkEmail}
          sendLinkName={sendLinkName}
          setSendLinkName={setSendLinkName}
          sendLinkMessage={sendLinkMessage}
          setSendLinkMessage={setSendLinkMessage}
          linkEmailError={linkEmailError}
          setLinkEmailError={setLinkEmailError}
          isSendingLink={isSendingLink}
          interviewSubTab={interviewSubTab}
          setInterviewSubTab={setInterviewSubTab}
          portalSessions={portalSessions}
          portalLoading={portalLoading}
          portalError={portalError}
          portalTotal={portalTotal}
          answers={answers}
          setAnswers={setAnswers}
          fieldErrors={fieldErrors}
          visibleInterviewFields={visibleInterviewFields}
          missingRequiredFields={missingRequiredFields}
          answeredFieldCount={answeredFieldCount}
          generatedUrl={generatedUrl}
          driveUrl={driveUrl}
          driveWarnings={driveWarnings}
          isDownloading={isDownloading}
          docupleteApiPath={docupleteApiPath}
          labelForTransactionScope={labelForTransactionScope}
          fieldIsRequired={fieldIsRequired}
          goBuilderStep={stableGoBuilderStep}
          setTab={setTab}
          launchStandaloneInterview={launchStandaloneInterview}
          generateCustomerLink={generateCustomerLink}
          copyCustomerLink={copyCustomerLink}
          handleSendLinkByEmail={handleSendLinkByEmail}
          saveAnswers={saveAnswers}
          generatePacket={generatePacket}
          handleDownloadInterviewCsv={handleDownloadInterviewCsv}
          downloadGeneratedPacket={downloadGeneratedPacket}
          handleInterviewFieldBlur={handleInterviewFieldBlur}
          openSession={(token) => navigate(`${interviewBasePath}?session=${token}`)}
          savedAnswers={session?.answers ?? {}}
          clearSession={() => { setSession(null); navigate(interviewBasePath); }}
          sendForSignature={sendForSignature}
          sigLink={sigLink}
          sigLinkCopied={sigLinkCopied}
          isSendingForSig={isSendingForSig}
          showSigSendForm={showSigSendForm}
          setShowSigSendForm={setShowSigSendForm}
          sigSendEmail={sigSendEmail}
          setSigSendEmail={setSigSendEmail}
          sigSendName={sigSendName}
          setSigSendName={setSigSendName}
          sigSendMessage={sigSendMessage}
          setSigSendMessage={setSigSendMessage}
          sigSendEmailSent={sigSendEmailSent}
          sigSendError={sigSendError}
          isSendingSigEmail={isSendingSigEmail}
          handleSigSendByEmail={handleSigSendByEmail}
          copySigLink={copySigLink}
        />
      )}

      {!isPublicSession && tab === "batch" && (
        <DocupleteCsvPanel
          packages={packages}
          activePackages={activePackages}
          csvDashboardTab={csvDashboardTab}
          setCsvDashboardTab={setCsvDashboardTab}
          csvDashLoading={csvDashLoading}
          csvDashError={csvDashError}
          csvDashBatchRuns={csvDashBatchRuns}
          csvDashExpanded={csvDashExpanded}
          setCsvDashExpanded={setCsvDashExpanded}
          csvDashRunSessions={csvDashRunSessions}
          setCsvDashRunSessions={setCsvDashRunSessions}
          csvDashRunLoading={csvDashRunLoading}
          setCsvDashRunLoading={setCsvDashRunLoading}
          csvBatchPackageId={csvBatchPackageId}
          setCsvBatchPackageId={setCsvBatchPackageId}
          csvBatchFieldMap={csvBatchFieldMap}
          csvBatchValidationSummary={csvBatchValidationSummary}
          csvBatchFile={csvBatchFile}
          csvBatchHeaders={csvBatchHeaders}
          csvBatchRows={csvBatchRows}
          setCsvBatchRows={setCsvBatchRows}
          csvBatchOriginalRows={csvBatchOriginalRows}
          csvBatchHasEdits={csvBatchHasEdits}
          setCsvBatchHasEdits={setCsvBatchHasEdits}
          csvBatchMismatch={csvBatchMismatch}
          setCsvBatchMismatch={setCsvBatchMismatch}
          csvBatchError={csvBatchError}
          setCsvBatchError={setCsvBatchError}
          csvBatchResults={csvBatchResults}
          csvBatchIsImporting={csvBatchIsImporting}
          csvEditingCell={csvEditingCell}
          setCsvEditingCell={setCsvEditingCell}
          csvEditNavigatingRef={csvEditNavigatingRef}
          csvBatchFileInputRef={csvBatchFileInputRef}
          csvBatchBreakdownRef={csvBatchBreakdownRef}
          csvCorrectedDownloadedTimerRef={csvCorrectedDownloadedTimerRef}
          csvColumnsExpanded={csvColumnsExpanded}
          setCsvColumnsExpanded={setCsvColumnsExpanded}
          csvBatchFieldBreakdownOpen={csvBatchFieldBreakdownOpen}
          setCsvBatchFieldBreakdownOpen={setCsvBatchFieldBreakdownOpen}
          csvBreakdownHighlightedField={csvBreakdownHighlightedField}
          setCsvBreakdownHighlightedField={setCsvBreakdownHighlightedField}
          csvCorrectedDownloaded={csvCorrectedDownloaded}
          setCsvCorrectedDownloaded={setCsvCorrectedDownloaded}
          showCsvFieldKey={showCsvFieldKey}
          setShowCsvFieldKey={setShowCsvFieldKey}
          csvInviteOpen={csvInviteOpen}
          setCsvInviteOpen={setCsvInviteOpen}
          csvInviteMessage={csvInviteMessage}
          setCsvInviteMessage={setCsvInviteMessage}
          csvInviteSending={csvInviteSending}
          setCsvInviteSending={setCsvInviteSending}
          csvInviteResults={csvInviteResults}
          setCsvInviteResults={setCsvInviteResults}
          labelForTransactionScope={labelForTransactionScope}
          getAuthHeaders={getAuthHeaders}
          docupleteApiPath={docupleteApiPath}
          handleCsvBatchFileChange={handleCsvBatchFileChange}
          handleCsvBatchImport={handleCsvBatchImport}
        />
      )}

      {!isPublicSession && tab === "library" && (
        <section className="bg-white border border-[#E2E8F0] rounded-lg max-w-4xl mx-auto overflow-hidden mt-4">
          <div className="flex border-b border-[#E2E8F0]">
            {(["fields", "field-groups", "types", "groups", "compliance", "tags"] as const).map((sub) => {
              const label = sub === "field-groups" ? "Field Groups" : sub.charAt(0).toUpperCase() + sub.slice(1);
              return (
                <button
                  key={sub}
                  onClick={() => { setLibrarySubTab(sub); if (sub === "compliance") void loadComplianceAudit(); if (sub === "tags" && complianceTags.length === 0) void loadComplianceTags(); }}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${librarySubTab === sub ? "border-[#0F1C3F] text-[#0F1C3F]" : "border-transparent text-[#8A9BB8] hover:text-[#0F1C3F] hover:border-[#E2E8F0]"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="p-5">

          {librarySubTab === "fields" && (
            <FieldLibraryPanel
              items={fieldLibrary}
              allComplianceTags={complianceTags}
              onAdd={createFieldLibraryItem as () => Promise<string | null>}
              onChange={updateFieldLibraryLocal}
              onSave={saveFieldLibraryItem as (item: FieldLibraryItem) => Promise<string | null>}
              onSetComplianceTags={setFieldComplianceTags}
              onUse={addLibraryFieldToPackage}
              onDelete={deleteFieldLibraryItem as (id: string) => Promise<string | null>}
              onLoadVersions={loadFieldVersions}
              onRestoreVersion={restoreFieldVersion}
              onLoadAnalytics={loadFieldAnalytics}
              onExport={exportFieldLibrary}
              onImport={importFieldLibrary}
              openFieldId={libraryOpenFieldId ?? undefined}
              onClearOpenField={() => setLibraryOpenFieldId(null)}
            />
          )}

          {librarySubTab === "field-groups" && (
            <FieldGroupsPanel
              items={fieldGroups}
              fieldLibrary={fieldLibrary}
              onAdd={createFieldGroup}
              onChange={updateFieldGroupLocal}
              onSave={saveFieldGroup}
              onDelete={deleteFieldGroup}
              onUseGroup={addGroupToPackage}
            />
          )}

          {librarySubTab === "types" && (
            <TransactionTypesPanel
              items={transactionTypes}
              groups={groups}
              onAdd={createTransactionType as () => Promise<string | null>}
              onChange={updateTransactionTypeLocal}
              onSave={saveTransactionType as (item: TransactionType) => Promise<string | null>}
              onDelete={deleteTransactionType as (scope: string) => Promise<string | null>}
            />
          )}

          {librarySubTab === "groups" && (
            <EntityPanel
              title="All Groups"
              items={groups}
              onAdd={createGroup as () => Promise<string | null>}
              onChange={(id, patch) => updateGroupLocal(id, patch)}
              onSave={saveGroup as (g: Entity) => Promise<string | null>}
              onDelete={deleteGroup as (id: number) => Promise<string | null>}
            />
          )}

          {librarySubTab === "tags" && (
            <ComplianceTagsPanel
              items={complianceTags}
              onCreate={createComplianceTag}
              onUpdate={updateComplianceTag}
              onDelete={deleteComplianceTag}
            />
          )}

          {librarySubTab === "compliance" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F1C3F]">Compliance Audit</h2>
                  <p className="text-[11px] text-[#8A9BB8]">For each package, shows which required-tagged library fields are present or missing.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void loadComplianceAudit()}
                    disabled={complianceAuditLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-200 bg-white text-[#0F1C3F] hover:border-[#0F1C3F] hover:shadow-sm disabled:opacity-50 transition-all"
                  >
                    <svg className={`w-3 h-3 shrink-0 ${complianceAuditLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {complianceAuditLoading ? "Loading…" : "Refresh"}
                  </button>
                  {complianceAudit && complianceAudit.report.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const headers = ["Package", "Status", "Has Gap", "Required Missing", "Present Fields", "Missing Fields"];
                        const rows = complianceAudit.report.map((row) => [
                          row.packageName,
                          row.status,
                          row.hasGap ? "Yes" : "No",
                          String(row.requiredMissingCount),
                          row.present.map((f) => `${f.label} [${f.tags.join(",")}]`).join("; "),
                          row.missing.map((f) => `${f.label} [${f.tags.join(",")}]`).join("; "),
                        ]);
                        const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "compliance-audit.csv"; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-200 bg-white text-[#0F1C3F] hover:border-[#C49A38] hover:shadow-sm transition-all"
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
              {complianceAuditError && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{complianceAuditError}</div>
              )}
              {!complianceAudit && !complianceAuditLoading && !complianceAuditError && (
                <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#8A9BB8]">
                  Click <strong>Refresh</strong> to generate the compliance audit report.
                </div>
              )}
              {complianceAudit && (
                <div className="space-y-3">
                  {complianceAudit.report.length === 0 && (
                    <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-sm text-[#8A9BB8]">No packages found.</div>
                  )}
                  {complianceAudit.report.map((row) => (
                    <div key={row.packageId} className={`rounded border ${row.hasGap ? "border-amber-200 bg-amber-50/25" : "border-green-200 bg-green-50/20"} p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-semibold text-sm text-[#0F1C3F]">{row.packageName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EBF0FB] text-[#C49A38] font-medium">{row.status}</span>
                        {row.hasGap ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 font-semibold">
                            ⚠️ Non-Compliant · {row.requiredMissingCount} missing
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300 font-semibold">✓ Compliant</span>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-3 text-[11px] max-w-[600px]">
                        <div>
                          <div className="font-semibold text-[#059669] mb-1">Present ({row.present.length})</div>
                          {row.present.length === 0 ? (
                            <span className="text-[#8A9BB8]">None</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {row.present.map((f) => (
                                <li key={f.fieldId} className="flex items-center gap-1 flex-wrap">
                                  <span className="text-[#0F1C3F]">{f.label}</span>
                                  {f.tags.map((t) => {
                                    const tm = complianceAudit.tags.find((x) => x.name === t);
                                    return (
                                      <span key={t} className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium"
                                        style={{ backgroundColor: `${tm?.color ?? "#6B7A99"}22`, color: tm?.color ?? "#6B7A99", border: `1px solid ${tm?.color ?? "#6B7A99"}55` }}>
                                        {t}
                                      </span>
                                    );
                                  })}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-[#DC2626] mb-1">Missing ({row.missing.length})</div>
                          {row.missing.length === 0 ? (
                            <span className="text-[#8A9BB8]">None</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {row.missing.map((f) => {
                                const hasRequired = f.tags.some((t) => complianceAudit.tags.find((x) => x.name === t)?.is_required);
                                return (
                                  <li key={f.fieldId} className="flex items-center gap-1 flex-wrap">
                                    <button
                                      type="button"
                                      title="Jump to this field in the Library"
                                      onClick={() => { setLibrarySubTab("fields"); setLibraryOpenFieldId(f.fieldId); }}
                                      className={`underline underline-offset-2 decoration-dotted hover:decoration-solid transition-colors ${hasRequired ? "text-[#DC2626] font-medium hover:text-[#B91C1C]" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}
                                    >{f.label}</button>
                                    {f.tags.map((t) => {
                                      const tm = complianceAudit.tags.find((x) => x.name === t);
                                      return (
                                        <span key={t} className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium"
                                          style={{ backgroundColor: `${tm?.color ?? "#6B7A99"}22`, color: tm?.color ?? "#6B7A99", border: `1px solid ${tm?.color ?? "#6B7A99"}55` }}>
                                          {t}
                                        </span>
                                      );
                                    })}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </section>
      )}

      {!isPublicSession && tab === "help" && (
        <AppHelp />
      )}

      {inspectorMode === "modal" && placementModal && selectedPackage && (() => {
        const mapping = storeMappings.find((item) => item.id === placementModal.mappingId);
        if (!mapping) return null;
        const field = selectedPackage.fields.find((item) => item.id === mapping.fieldId);
        return (
          <PlacementModal
            mapping={mapping}
            field={field}
            recipients={storeRecipientList}
            modalPos={placementModalPos}
            onClose={() => setPlacementModal(null)}
            onSetModalPos={(pos) => setPlacementModalPos(pos)}
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

      {recipientPickerOpen && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRecipientPickerOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-semibold text-[#0F1C3F]">Add Recipient</h2>
              <button type="button" onClick={() => setRecipientPickerOpen(false)} className="text-[#8A9BB8] hover:text-[#0F1C3F]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wide mb-2">Customer</div>
                <button
                  type="button"
                  disabled={storeRecipientList.some((r) => r.type === "customer")}
                  onClick={() => addRecipient({ id: newRecipientId(), label: "Customer", color: pickRecipientColor(storeRecipientList.map((r) => r.color)), type: "customer" })}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#334155] hover:bg-[#F8FAFC] border border-[#E2E8F0] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5 text-[#8A9BB8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Customer
                  {storeRecipientList.some((r) => r.type === "customer") && <span className="ml-auto text-[10px] text-[#8A9BB8]">already added</span>}
                </button>
              </div>
              {(() => {
                const userGroups = groups.filter((g) => g.active !== false && (!g.kind || g.kind === "general"));
                if (!userGroups.length) return null;
                const icon = <svg className="w-3.5 h-3.5 text-[#8A9BB8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
                return (
                  <div>
                    <div className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wide mb-2">Groups</div>
                    <div className="space-y-1">
                      {userGroups.map((g) => {
                        const already = storeRecipientList.some((r) => r.type === "group" && r.refId === g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            disabled={already}
                            onClick={() => addRecipient({ id: newRecipientId(), label: g.name, color: pickRecipientColor(storeRecipientList.map((r) => r.color)), type: "group", refId: g.id })}
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#334155] hover:bg-[#F8FAFC] border border-[#E2E8F0] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {icon}
                            {g.name}
                            {already && <span className="ml-auto text-[10px] text-[#8A9BB8]">already added</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <FieldEditorModal
        modal={fieldEditorModal}
        draft={fieldEditorDraft}
        setDraft={setFieldEditorDraft}
        onClose={() => setFieldEditorModal(null)}
        pos={fieldEditorPos}
        isDragging={fieldEditorIsDragging}
        panelRef={fieldEditorPanelRef}
        onDragStart={handleFieldEditorDragStart}
        onTouchStart={handleFieldEditorTouchStart}
        saving={fieldModalSaving}
        onSave={saveFieldFromModal}
        onRemove={(fieldId) => { removeField(fieldId); setFieldEditorModal(null); }}
        packageFields={selectedPackage?.fields ?? []}
        colorPalette={getCachedProductOrg()?.field_palette ?? FIELD_COLOR_PALETTE}
      />

      {deleteGuard && selectedPackage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 border border-[#E2E8F0] mx-4">
            <h3 className="text-base font-semibold text-[#0F1C3F] mb-1">Remove "{deleteGuard.fieldName}"?</h3>
            <p className="text-sm text-[#6B7A99] mb-3">
              {deleteGuard.deps.length === 1 ? "1 other field references" : `${deleteGuard.deps.length} other fields reference`} this field.
              Removing it without a replacement will leave those references broken.
            </p>
            <ul className="mb-4 space-y-1.5 max-h-48 overflow-y-auto">
              {deleteGuard.deps.map((dep) => (
                <li key={dep.id} className="flex items-start gap-2 text-sm rounded bg-amber-50 border border-amber-200 px-3 py-1.5">
                  <span className="text-amber-600 mt-px shrink-0">⚠</span>
                  <div>
                    <span className="font-medium text-[#0F1C3F]">{dep.affectedFieldName}</span>
                    <span className="text-[#6B7A99]"> — {brokenRefKindLabel(dep.kind)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mb-4">
              <label className="text-xs font-medium text-[#4A5568] mb-1.5 block">
                Replace references with:
                <span className="font-normal text-[#8A9BB8] ml-1">(leave blank to mark for manual repair)</span>
              </label>
              <select
                value={deleteGuard.replacementFieldId}
                onChange={(e) => setDeleteGuard((g) => g ? { ...g, replacementFieldId: e.target.value } : null)}
                className="w-full border border-[#E2E8F0] rounded-md h-9 px-2.5 text-sm bg-white text-[#0F1C3F] focus:outline-none focus:border-[#C49A38]"
              >
                <option value="">— none, mark for repair later —</option>
                {selectedPackage.fields
                  .filter((f) => f.id !== deleteGuard.fieldId)
                  .map((f) => <option key={f.id} value={f.id}>{f.name}</option>)
                }
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteGuard(null)}
                className="px-4 py-2 text-sm rounded-md border border-[#E2E8F0] text-[#6B7A99] hover:border-[#C49A38] hover:text-[#0F1C3F] transition-colors"
              >Cancel</button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                {deleteGuard.replacementFieldId ? "Replace & Remove" : "Remove & Flag for Repair"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

