import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { useLocation, useParams, useSearch } from "wouter";
import { useInternalAuth } from "@/hooks/useInternalAuth";
import { useDocuFillConfig } from "@/hooks/useDocuFillConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDocuFillPrefillDisplayValue } from "@/lib/docufill-redaction";
import { sessionToCsv, packageTemplateToCsv, downloadCsv, parseCsvString, batchResultsToCsv } from "@/lib/docufill-csv";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;

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

type FieldInterviewMode = "required" | "optional" | "readonly" | "omitted";

type FieldItem = {
  id: string;
  libraryFieldId?: string;
  name: string;
  color: string;
  type: "text" | "radio" | "checkbox" | "dropdown" | "date";
  options?: string[];
  optionsMode?: "inherit" | "override";
  interviewMode: FieldInterviewMode;
  defaultValue: string;
  source: string;
  sensitive: boolean;
  validationType?: "none" | "string" | "name" | "number" | "currency" | "email" | "phone" | "date" | "time" | "zip" | "zip4" | "ssn" | "percent" | "custom";
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

type AcroAnnotation = {
  fieldName: string;
  rect: [number, number, number, number];
  fieldType: string;
};

type MappingFormat =
  | "as-entered"
  | "uppercase"
  | "lowercase"
  | "first-name"
  | "middle-name"
  | "last-name"
  | "last-first-m"
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
  format?: MappingFormat | string;
  recipientId?: string;
  multiLine?: boolean;
};

type RecipientItem = {
  id: string;
  label: string;
  color: string;
  type: "customer" | "custodian" | "depository" | "custom";
  refId?: number;
  email?: string;
};

type BuilderStep = "documents" | "mapping" | "interview" | "finalize";

const BUILDER_STEPS: Array<{ value: BuilderStep; label: string; helper: string }> = [
  { value: "documents", label: "1. Document View", helper: "Add and order package PDFs" },
  { value: "mapping", label: "2. Data + Fields View", helper: "Drag fields onto documents" },
  { value: "interview", label: "3. Questionnaire & Output", helper: "Order questions and activate" },
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
  recipients: RecipientItem[];
  enable_interview: boolean;
  enable_csv: boolean;
  enable_customer_link: boolean;
};

type Session = {
  token: string;
  package_id?: number | string;
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
  if ((field.type === "radio" || field.type === "checkbox") && field.options && field.options.length > 0) return `checkbox-option:${field.options[0]}`;
  if (field.type === "checkbox") return "checkbox-yes";
  return "as-entered";
}

const FIELD_COLOR_PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#6366F1", "#8B5CF6", "#D946EF", "#F43F5E",
];

function pickFieldColor(usedColors: string[], sensitive: boolean): string {
  if (sensitive) return "#DC2626";
  const available = FIELD_COLOR_PALETTE.filter((c) => !usedColors.includes(c));
  const pool = available.length > 0 ? available : FIELD_COLOR_PALETTE;
  return pool[Math.floor(Math.random() * pool.length)];
}

const RECIPIENT_COLOR_PALETTE = [
  "#3B82F6", "#10B981", "#8B5CF6", "#F59E0B",
  "#EC4899", "#06B6D4", "#EF4444", "#84CC16",
];

function pickRecipientColor(usedColors: string[]): string {
  const available = RECIPIENT_COLOR_PALETTE.filter((c) => !usedColors.includes(c));
  return available.length > 0 ? available[0] : RECIPIENT_COLOR_PALETTE[usedColors.length % RECIPIENT_COLOR_PALETTE.length];
}

function newRecipientId(): string {
  return `recip_${Math.random().toString(36).slice(2, 10)}`;
}

function validationTypeHint(vt: FieldItem["validationType"], message?: string): string {
  switch (vt) {
    case "phone":    return "555-123-4567";
    case "ssn":      return "XXX-XX-XXXX";
    case "email":    return "user@example.com";
    case "currency": return "1234.56";
    case "number":   return "Numeric";
    case "date":     return "MM/DD/YYYY";
    case "time":     return "HH:MM";
    case "zip":      return "12345";
    case "zip4":     return "12345-6789";
    case "percent":  return "0–100";
    case "name":     return "Text (name format)";
    case "string":   return "Any text";
    case "custom":   return message && message.trim() ? message.trim() : "Custom format";
    default:         return "Any text";
  }
}

function validateCellValue(field: FieldItem, value: string): "ok" | "empty-required" | "invalid" {
  if (field.interviewMode === "omitted" || field.interviewMode === "readonly") return "ok";
  const trimmed = value.trim();
  if (trimmed === "") {
    return field.interviewMode === "required" ? "empty-required" : "ok";
  }
  if (field.type === "dropdown" || field.type === "radio") {
    const opts = field.options ?? [];
    if (opts.length > 0 && !opts.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return "invalid";
    return "ok";
  }
  if (field.type === "checkbox") {
    const opts = field.options ?? [];
    if (opts.length > 0) {
      const tokens = trimmed.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      if (tokens.some((t) => !opts.some((o) => o.toLowerCase() === t.toLowerCase()))) return "invalid";
    }
    return "ok";
  }
  if (field.type === "date") return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed) ? "ok" : "invalid";
  const vt = field.validationType;
  if (!vt || vt === "none" || vt === "string" || vt === "name") return "ok";
  if (vt === "email")    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "phone")    return /^[\d\s\-()+.]{7,}$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "date")     return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "ssn")      return /^\d{3}-\d{2}-\d{4}$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "zip")      return /^\d{5}$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "zip4")     return /^\d{5}-\d{4}$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "number")   return /^\d+(\.\d+)?$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "currency") return /^\d+(\.\d{1,2})?$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "percent")  { const n = Number(trimmed); return (!isNaN(n) && n >= 0 && n <= 100) ? "ok" : "invalid"; }
  if (vt === "time")     return /^\d{1,2}:\d{2}(:\d{2})?(\s?[APap][Mm])?$/.test(trimmed) ? "ok" : "invalid";
  if (vt === "custom") {
    if (field.validationPattern) {
      try { return new RegExp(field.validationPattern).test(trimmed) ? "ok" : "invalid"; } catch { return "ok"; }
    }
    return "ok";
  }
  return "ok";
}

const MAPPING_FORMAT_OPTIONS: Array<{ value: MappingFormat; label: string; group: string }> = [
  { value: "first-name", label: "First", group: "Name" },
  { value: "middle-name", label: "Middle", group: "Name" },
  { value: "last-name", label: "Last", group: "Name" },
  { value: "last-first-m", label: "Last, First M.", group: "Name" },
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

const NAME_MAPPING_FORMATS: MappingFormat[] = ["first-name", "middle-name", "last-name", "last-first-m", "first-last", "initials"];

function labelForMappingFormat(format: MappingFormat | string | undefined) {
  const fmt = format ?? "as-entered";
  if (fmt.startsWith("checkbox-option:")) return `Option: ${fmt.slice("checkbox-option:".length).trim()}`;
  return MAPPING_FORMAT_OPTIONS.find((option) => option.value === fmt)?.label ?? "Whole answer";
}

function inferFieldCategory(field: FieldItem): "name" | "first" | "last" | "address" | "city" | "state" | "zip" | "phone" | "email" | "ssn" | "dob" | "account" | "relationship" | "share" | "date" | "signature" | "general" {
  const hay = [field.name, field.source, field.validationType ?? ""].join(" ").toLowerCase().replace(/[_-]/g, " ");
  if (/\bssn\b|social.?sec/i.test(hay)) return "ssn";
  if (/\bdob\b|date.?of.?birth|birth.?date/i.test(hay)) return "dob";
  if (/\bzip\b|postal/i.test(hay)) return "zip";
  if (/\bstate\b/.test(hay)) return "state";
  if (/\bcity\b|town/.test(hay)) return "city";
  if (/\baddress\b|street|addr/.test(hay)) return "address";
  if (/\bphone\b|mobile|cell|fax/.test(hay)) return "phone";
  if (/\bemail\b/.test(hay)) return "email";
  if (/\baccount.?(num|#|no)\b/.test(hay)) return "account";
  if (/\brelation(ship)?\b/.test(hay)) return "relationship";
  if (/\bshare\b|percent|%/.test(hay)) return "share";
  if (/\bsignature\b/.test(hay)) return "signature";
  if (/\bfirst.?name\b/.test(hay)) return "first";
  if (/\blast.?name\b/.test(hay)) return "last";
  if (/\b(full.?)?name\b|client.?name/.test(hay)) return "name";
  if (field.validationType === "name") return "name";
  if (field.validationType === "phone") return "phone";
  if (field.validationType === "email") return "email";
  if (field.validationType === "ssn") return "ssn";
  if (field.validationType === "date") return "date";
  return "general";
}

function sampleValueForMapping(field: FieldItem | undefined, format: MappingFormat | string | undefined): string {
  if (!field) return "…";
  const fmt = format ?? "as-entered";

  const FALSE_LIKE = /^(no|false|0|off|n)$/i;

  if (fmt.startsWith("checkbox-option:")) {
    const optionValue = fmt.slice("checkbox-option:".length).trim();
    const sample = field.defaultValue?.trim() || (field.options?.[0] ?? "");
    return sample.split(",").map((s) => s.trim()).includes(optionValue) ? "X" : "";
  }

  if (field.defaultValue) {
    if (fmt === "checkbox-yes") return FALSE_LIKE.test(field.defaultValue.trim()) ? "" : (field.defaultValue.trim() ? "X" : "");
    if (fmt === "first-name") return field.defaultValue.trim().split(/\s+/)[0] ?? field.defaultValue;
    if (fmt === "last-name") { const parts = field.defaultValue.trim().split(/\s+/); return parts[parts.length - 1] ?? field.defaultValue; }
    if (fmt === "middle-name") { const parts = field.defaultValue.trim().split(/\s+/); return parts.length >= 3 ? parts[1] : ""; }
    if (fmt === "first-last") { const parts = field.defaultValue.trim().split(/\s+/); return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : field.defaultValue; }
    if (fmt === "last-first-m") { const parts = field.defaultValue.trim().split(/\s+/); if (parts.length < 2) return field.defaultValue; const last = parts[parts.length - 1]; const first = parts[0]; const mid = parts.length >= 3 ? ` ${parts[1][0]?.toUpperCase()}.` : ""; return `${last}, ${first}${mid}`; }
    if (fmt === "initials") return field.defaultValue.trim().split(/\s+/).map((p) => p[0]?.toUpperCase() ?? "").filter(Boolean).join(".") + ".";
    if (fmt === "uppercase") return field.defaultValue.toUpperCase();
    if (fmt === "lowercase") return field.defaultValue.toLowerCase();
    if (fmt === "digits-only") return field.defaultValue.replace(/\D/g, "");
    if (fmt === "last-four") return field.defaultValue.replace(/\D/g, "").slice(-4);
    if (fmt === "currency") { const n = parseFloat(field.defaultValue.replace(/[^\d.]/g, "")); return isNaN(n) ? field.defaultValue : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
    if (fmt === "date-mm-dd-yyyy") return field.defaultValue;
    return field.defaultValue;
  }

  if (field.type === "checkbox") return "X";
  if (field.type === "date" || fmt === "date-mm-dd-yyyy" || field.validationType === "date") return "04/22/1965";
  if ((field.type === "radio" || field.type === "dropdown") && field.options && field.options.length > 0) return field.options[0];

  if (fmt === "first-name") return "Alice";
  if (fmt === "last-name") return "Smith";
  if (fmt === "middle-name") return "B.";
  if (fmt === "last-first-m") return "Smith, Alice B.";
  if (fmt === "first-last") return "Alice Smith";
  if (fmt === "initials") return "A.B.S.";
  if (fmt === "digits-only") return "123456789";
  if (fmt === "last-four") return "1234";
  if (fmt === "currency") return "$50,000.00";
  if (fmt === "checkbox-yes") return "X";

  const isUpper = fmt === "uppercase";
  const isLower = fmt === "lowercase";
  const cat = inferFieldCategory(field);
  if (cat === "first") return isUpper ? "ALICE" : isLower ? "alice" : "Alice";
  if (cat === "last") return isUpper ? "SMITH" : isLower ? "smith" : "Smith";
  if (cat === "name" || cat === "signature") return isUpper ? "ALICE B. SMITH" : isLower ? "alice b. smith" : "Alice B. Smith";
  if (cat === "address") return "123 Main St";
  if (cat === "city") return "Wichita";
  if (cat === "state") return "KS";
  if (cat === "zip") return "67206";
  if (cat === "phone") return "(316) 555-1234";
  if (cat === "email") return "client@example.com";
  if (cat === "ssn") return "123-45-6789";
  if (cat === "dob") return "04/22/1965";
  if (cat === "account") return "1234567890";
  if (cat === "relationship") return "Spouse";
  if (cat === "share") return "100%";
  if (cat === "date") return "04/22/2026";
  return isUpper ? "ALICE B. SMITH" : isLower ? "alice b. smith" : "Alice B. Smith";
}

function isNameLikeField(field: FieldItem | undefined) {
  if (!field) return false;
  const text = [field.name, field.source, field.validationType].join(" ").toLowerCase();
  return /\b(name|firstname|lastname|fullname|clientname)\b/.test(text.replace(/[_-]/g, " "));
}

function mappingFormatOptionsForField(field: FieldItem | undefined): Array<{ value: MappingFormat; label: string; group: string }> {
  if (!field) return MAPPING_FORMAT_OPTIONS;
  const vt = field.validationType ?? "none";
  const type = field.type;
  if (type === "checkbox" || type === "radio") return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Checks");
  if (type === "date" || vt === "date") return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Dates");
  if (vt === "currency") return MAPPING_FORMAT_OPTIONS.filter((o) => o.value === "currency" || o.group === "Text");
  if (vt === "number") return MAPPING_FORMAT_OPTIONS.filter((o) => o.value === "digits-only" || o.value === "last-four");
  if (vt === "phone") return MAPPING_FORMAT_OPTIONS.filter((o) => o.value === "digits-only");
  if (vt === "ssn") return MAPPING_FORMAT_OPTIONS.filter((o) => o.value === "digits-only" || o.value === "last-four");
  if (vt === "email") return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Text");
  if (["zip", "zip4", "percent", "time", "string", "custom"].includes(vt)) return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Text");
  if (vt === "name" || isNameLikeField(field)) return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Name" || o.group === "Text");
  return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Text");
}

function normalizePackages(items: PackageItem[]): PackageItem[] {
  return items.map((pkg) => ({
    ...pkg,
    transaction_scope: normalizeTransactionScope(pkg.transaction_scope),
    documents: Array.isArray(pkg.documents) ? pkg.documents : [],
    fields: Array.isArray(pkg.fields) ? pkg.fields.map((field) => {
      const raw = field as FieldItem & { interviewVisible?: boolean; adminOnly?: boolean; required?: boolean };
      const validModes: FieldInterviewMode[] = ["required", "optional", "readonly", "omitted"];
      const legacyMode: FieldInterviewMode = (!raw.interviewVisible || raw.adminOnly) ? "omitted" : raw.required ? "required" : "optional";
      return {
        ...field,
        libraryFieldId: field.libraryFieldId ?? "",
        sensitive: field.sensitive === true,
        interviewMode: validModes.includes(raw.interviewMode) ? raw.interviewMode : legacyMode,
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

type SortableItemRenderProps = {
  handleProps: React.HTMLAttributes<HTMLElement>;
  wrapperRef: (el: HTMLElement | null) => void;
  wrapperStyle: React.CSSProperties;
  isDragging: boolean;
};

function SortableItem({ id, children }: { id: string; children: (props: SortableItemRenderProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <>{children({
    handleProps: { ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement>,
    wrapperRef: setNodeRef,
    wrapperStyle: { transform: DndCSS.Transform.toString(transform), transition },
    isDragging,
  })}</>;
}

function isInteractiveElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (["button", "input", "textarea", "select", "option", "label", "a"].includes(tag)) return true;
  return isInteractiveElement(el.parentElement);
}

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
        return !isInteractiveElement(nativeEvent.target as Element);
      },
    },
  ];
}

export default function DocuFill() {
  const search = useSearch();
  const params = useParams<{ token?: string }>();
  const [, navigate] = useLocation();
  const publicSessionToken = params.token ?? null;
  const sessionToken = publicSessionToken ?? new URLSearchParams(search).get("session");
  const isPublicSession = Boolean(publicSessionToken);
  const { getAuthHeaders: defaultGetAuthHeaders } = useInternalAuth();
  const docufillConfig = useDocuFillConfig();
  const getAuthHeaders = docufillConfig?.getAuthHeaders ?? defaultGetAuthHeaders;
  const docufillApiPath = docufillConfig?.apiPath ?? "/api/internal/docufill";
  const [tab, setTab] = useState<"packages" | "mapper" | "interview" | "csv">(sessionToken ? "interview" : "packages");
  const [builderStep, setBuilderStep] = useState<BuilderStep>("documents");
  const [custodians, setCustodians] = useState<Entity[]>([]);
  const [depositories, setDepositories] = useState<Entity[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [fieldLibrary, setFieldLibrary] = useState<FieldLibraryItem[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [standalonePackageId, setStandalonePackageId] = useState("");
  const [customerLinkPackageId, setCustomerLinkPackageId] = useState("");
  const [customerLinkFirstName, setCustomerLinkFirstName] = useState("");
  const [customerLinkLastName, setCustomerLinkLastName] = useState("");
  const [customerLinkEmail, setCustomerLinkEmail] = useState("");
  const [generatedCustomerLink, setGeneratedCustomerLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [newPackageName, setNewPackageName] = useState("");
  const [newPackageCustodianId, setNewPackageCustodianId] = useState("");
  const [newPackageDepositoryId, setNewPackageDepositoryId] = useState("");
  const [addingPackage, setAddingPackage] = useState(false);
  const [interviewOutputTab, setInterviewOutputTab] = useState<"staff" | "customerLink">("staff");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
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
  const [fieldEditorDraft, setFieldEditorDraft] = useState<{
    name: string; color: string; type: FieldItem["type"]; options: string[];
    interviewMode: FieldInterviewMode; hasDefault: boolean; defaultValue: string;
    validationType: FieldItem["validationType"]; validationPattern: string; validationMessage: string; packageOnly: boolean;
  }>({ name: "", color: "#C49A38", type: "text", options: [], interviewMode: "optional", hasDefault: false, defaultValue: "", validationType: "none", validationPattern: "", validationMessage: "", packageOnly: false });
  const sortSensors = useSensors(useSensor(SmartPointerSensor, { activationConstraint: { distance: 6 } }));
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
  const mappingUndoStack = useRef<MappingItem[][]>([]);
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const mapperContainerRef = useRef<HTMLElement | null>(null);
  const [mapperContainerWidth, setMapperContainerWidth] = useState(800);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [acroAnnotations, setAcroAnnotations] = useState<AcroAnnotation[]>([]);
  const [showAcroLayer, setShowAcroLayer] = useState(true);
  const [mapperTextMode, setMapperTextMode] = useState(true);
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
  type BatchResult = { rowIndex: number; token: string | null; status: "generated" | "error" | "processing"; pdfUrl?: string; error?: string };
  const [csvBatchResults, setCsvBatchResults] = useState<BatchResult[] | null>(null);
  const [csvBatchError, setCsvBatchError] = useState<string | null>(null);
  const csvBatchFileInputRef = useRef<HTMLInputElement | null>(null);
  const csvBatchBreakdownRef = useRef<HTMLDivElement | null>(null);
  const csvCorrectedDownloadedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (csvCorrectedDownloadedTimerRef.current) clearTimeout(csvCorrectedDownloadedTimerRef.current); }, []);
  const csvEditNavigatingRef = useRef(false);
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
  const selectedFieldIsShared = Boolean(selectedField?.libraryFieldId);
  const selectedMapping = selectedPackage?.mappings.find((mapping) => mapping.id === selectedMappingId) ?? null;
  const selectedMappingField = selectedMapping ? selectedPackage?.fields.find((field) => field.id === selectedMapping.fieldId) : undefined;
  const selectedMappingFormatOptions = mappingFormatOptionsForField(selectedMappingField);
  const selectedPageSize = selectedDocument?.pageSizes?.[selectedPage - 1] ?? selectedDocument?.pageSizes?.[0];
  const labelForTransactionScope = (scope: string | null | undefined) => transactionTypes.find((item) => item.scope === scope)?.label ?? transactionScopeLabel(scope);
  const selectedPageAspect = selectedPageSize && selectedPageSize.width > 0 && selectedPageSize.height > 0
    ? `${selectedPageSize.width} / ${selectedPageSize.height}`
    : "612 / 792";
  const nativePageW = selectedPageSize?.width && selectedPageSize.width > 0 ? selectedPageSize.width : 612;
  const nativePageH = selectedPageSize?.height && selectedPageSize.height > 0 ? selectedPageSize.height : 792;
  const mapperMaxH = Math.round(viewportHeight * 0.88);
  const mapperMaxW = Math.max(320, mapperContainerWidth - 2);
  const mapperScale = Math.min(mapperMaxH / nativePageH, mapperMaxW / nativePageW);
  const mapperFrameW = Math.round(nativePageW * mapperScale);
  const mapperFrameH = Math.round(nativePageH * mapperScale);
  const pageMappings = useMemo(() => {
    if (!selectedPackage || !selectedDocument) return [];
    return selectedPackage.mappings.filter((m) => m.documentId === selectedDocument.id && (m.page ?? 1) === selectedPage);
  }, [selectedPackage, selectedDocument, selectedPage]);
  const fieldInInterview = (f: { interviewMode?: string; interviewVisible?: boolean }) =>
    f.interviewMode ? f.interviewMode !== "omitted" : f.interviewVisible !== false;
  const fieldIsRequired = (f: { interviewMode?: string; required?: boolean; interviewVisible?: boolean }) =>
    f.interviewMode === "required" || (f.interviewMode === undefined && f.required === true && f.interviewVisible !== false);
  const visibleInterviewFields = useMemo(() => {
    const fields = session?.fields.filter(fieldInInterview) ?? [];
    if (selectedPackage && selectedPackage.fields.length > 0) {
      const orderMap = new Map(selectedPackage.fields.map((f, i) => [f.id, i]));
      return [...fields].sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
    }
    return fields;
  }, [session, selectedPackage]);
  const missingRequiredFields = useMemo(() => {
    if (!session) return [];
    return visibleInterviewFields.filter((field) => fieldIsRequired(field) && !interviewFieldValue(field, answers, session.prefill).trim()).map((field) => field.name ?? field.id);
  }, [session, visibleInterviewFields, answers]);
  const answeredFieldCount = visibleInterviewFields.filter((field) => field.interviewMode !== "readonly" && interviewFieldValue(field, answers, session?.prefill).trim()).length;
  const sessionBasePath = isPublicSession ? "/api/docufill/public/sessions" : `${docufillApiPath}/sessions`;
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
    if (packages.length > 0 && csvBatchPackageId && !activePackages.some((pkg) => pkg.id === csvBatchPackageId)) {
      setCsvBatchPackageId("");
    }
  }, [packages]);
  const packageInterviewFields = selectedPackage?.fields.filter((field) => field.interviewMode !== "omitted") ?? [];
  const packageFixedOrHiddenFields = selectedPackage?.fields.filter((field) => field.interviewMode === "omitted") ?? [];
  const packageMappedFieldIds = new Set(selectedPackage?.mappings.map((mapping) => mapping.fieldId) ?? []);
  const unmappedPackageFields = selectedPackage?.fields.filter((field) => !packageMappedFieldIds.has(field.id)) ?? [];

  async function loadBootstrap() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}${docufillApiPath}/bootstrap`, { headers: { ...getAuthHeaders() } });
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
    const url = `${API_BASE}${docufillApiPath}/packages/${selectedPackage.id}/documents/${selectedDocument.id}.pdf`;
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
      const prev = mappingUndoStack.current.pop();
      if (prev !== undefined) {
        updateSelectedPackage((pkg) => ({ ...pkg, mappings: prev }));
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

    // ← / →: navigate PDF pages in mapper
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

    // 1–3: jump to builder step
    if ((tab === "packages" || tab === "mapper") && ["1", "2", "3"].includes(e.key)) {
      const step = BUILDER_STEPS[parseInt(e.key, 10) - 1];
      if (step) goBuilderStep(step.value);
      return;
    }

    // Tab: cycle through interview answer fields
    if (e.key === "Tab" && tab === "interview") {
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
  useEffect(() => {
    if (!isMapperVisible || !documentPreviewUrl) { setAcroAnnotations([]); return; }
    let cancelled = false;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    setIsPdfRendering(true);
    setPdfRenderError(null);
    (async () => {
      try {
        let doc = pdfDocRef.current;
        if (!doc || pdfUrlRef.current !== documentPreviewUrl) {
          if (doc) { doc.destroy().catch(() => {}); pdfDocRef.current = null; }
          const loadingTask = pdfjsLib.getDocument(documentPreviewUrl);
          doc = await loadingTask.promise;
          if (cancelled) { doc.destroy(); return; }
          pdfDocRef.current = doc;
          pdfUrlRef.current = documentPreviewUrl;
        }
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
          widgets.push({ fieldName: String(a["fieldName"] ?? a["alternativeText"] ?? ""), rect: [x1, y1, x2, y2], fieldType: String(a["fieldType"] ?? "") });
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
  }, [isMapperVisible, documentPreviewUrl, selectedPage]);

  async function savePackage(pkg: PackageItem) {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/packages/${pkg.id}`, {
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
          recipients: pkg.recipients ?? [],
          enableInterview: pkg.enable_interview,
          enableCsv: pkg.enable_csv,
          enableCustomerLink: pkg.enable_customer_link,
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

  async function createPackage() {
    const trimmedName = newPackageName.trim();
    if (!trimmedName) {
      setError("Enter a package name before adding it.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/packages`, {
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
      const res = await fetch(`${API_BASE}${docufillApiPath}/packages/${pkg.id}`, {
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
    setStatus(msg);
    setTimeout(() => setStatus(""), 3000);
  }

  async function createEntity(type: "custodians" | "depositories"): Promise<string | null> {
    const count = type === "custodians" ? custodians.length + 1 : depositories.length + 1;
    const label = type === "custodians" ? `New Custodian ${count}` : `New Depository ${count}`;
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: label, active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create record";
      await loadBootstrap();
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
      const res = await fetch(`${API_BASE}${docufillApiPath}/${type}/${item.id}`, {
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
      await loadBootstrap();
      return null;
    } catch {
      return "Network error — could not save record";
    }
  }

  async function createTransactionType(): Promise<string | null> {
    const label = `New transaction type ${transactionTypes.length + 1}`;
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/transaction-types`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ label, active: true, sortOrder: (transactionTypes.length + 1) * 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create transaction type";
      await loadBootstrap();
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
      const res = await fetch(`${API_BASE}${docufillApiPath}/transaction-types/${item.scope}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          label: item.label,
          active: item.active,
          sortOrder: item.sort_order,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not save transaction type";
      flashStatus("Saved.");
      await loadBootstrap();
      return null;
    } catch {
      return "Network error — could not save transaction type";
    }
  }

  async function createFieldLibraryItem(): Promise<string | null> {
    const label = `Reusable field ${fieldLibrary.length + 1}`;
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/field-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ label, category: "General", type: "text", source: "interview", active: true, sortOrder: (fieldLibrary.length + 1) * 10 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not create field";
      await loadBootstrap();
      return null;
    } catch {
      return "Network error — could not create field";
    }
  }

  function updateFieldLibraryLocal(id: string, patch: Partial<FieldLibraryItem>) {
    setFieldLibrary((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function saveFieldLibraryItem(item: FieldLibraryItem): Promise<string | null> {
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/field-library/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(item),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Could not save field library item";
      flashStatus("Saved.");
      await loadBootstrap();
      return null;
    } catch {
      return "Network error — could not save field library item";
    }
  }

  function addLibraryFieldToPackage(libraryField: FieldLibraryItem) {
    updateSelectedPackage((pkg) => {
      const existingField = pkg.fields.find((field) => field.libraryFieldId === libraryField.id);
      if (existingField) {
        setSelectedFieldId(existingField.id);
        flashStatus("That shared field is already in this package.");
        return pkg;
      }
      const field: FieldItem = {
        id: newId("field"),
        libraryFieldId: libraryField.id,
        name: libraryField.label,
        color: pickFieldColor(pkg.fields.map((f) => f.color), libraryField.sensitive),
        type: libraryField.type,
        optionsMode: "inherit",
        interviewMode: libraryField.required ? "required" : "optional",
        defaultValue: "",
        source: libraryField.source,
        sensitive: libraryField.sensitive,
        validationType: libraryField.validationType,
        validationPattern: libraryField.validationPattern ?? "",
        validationMessage: libraryField.validationMessage ?? "",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [...pkg.fields, field] };
    });
    goBuilderStep("mapping");
  }

  function sortFieldsByPdfPosition(pkg: PackageItem): PackageItem {
    const docIndexMap = new Map(pkg.documents.map((d, i) => [d.id, i]));
    const firstMappingScore = (fieldId: string): number => {
      let best = Infinity;
      for (const m of pkg.mappings) {
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
      ? `${API_BASE}${docufillApiPath}/packages/${selectedPackage.id}/documents/${documentId}/pdf`
      : `${API_BASE}${docufillApiPath}/packages/${selectedPackage.id}/documents`;
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
      flashStatus(documentId ? "Replaced PDF." : "Uploaded PDF.");
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
      flashStatus(`Uploaded ${pdfFiles.length} PDF${pdfFiles.length === 1 ? "" : "s"}.`);
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
        const res = await fetch(`${API_BASE}${docufillApiPath}/packages/${selectedPackage.id}/documents/${docId}`, {
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
        interviewMode: "optional",
        defaultValue: "",
        source: "interview",
        sensitive: false,
        validationType: "none",
        validationPattern: "",
        validationMessage: "",
      };
      setSelectedFieldId(field.id);
      return { ...pkg, fields: [...pkg.fields, field] };
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
      packageOnly: false,
    });
    setFieldEditorModal({ mode: "add", fieldId: null });
  }

  function openFieldEditorForEdit(fieldId: string) {
    const field = selectedPackage?.fields.find((f) => f.id === fieldId);
    if (!field) return;
    setFieldEditorDraft({
      name: field.name, color: field.color, type: field.type,
      options: field.options ?? [],
      interviewMode: field.interviewMode,
      hasDefault: Boolean(field.defaultValue),
      defaultValue: field.defaultValue ?? "",
      validationType: field.validationType ?? "none",
      validationPattern: field.validationPattern ?? "",
      validationMessage: field.validationMessage ?? "",
      packageOnly: false,
    });
    setSelectedFieldId(fieldId);
    setFieldEditorModal({ mode: "edit", fieldId });
  }

  function saveFieldFromModal() {
    if (!fieldEditorModal || !selectedPackage) return;
    const { name, color, type, options, interviewMode, hasDefault, defaultValue, validationType, validationPattern, validationMessage } = fieldEditorDraft;
    if (fieldEditorModal.mode === "add") {
      updateSelectedPackage((pkg) => {
        const field: FieldItem = {
          id: newId("field"), libraryFieldId: "",
          name: name.trim() || `Field ${pkg.fields.length + 1}`,
          color, type, options: options.filter(Boolean), optionsMode: "override",
          interviewMode, defaultValue: hasDefault ? defaultValue : "",
          source: "interview", sensitive: false,
          validationType: validationType ?? "none", validationPattern, validationMessage,
        };
        setSelectedFieldId(field.id);
        return { ...pkg, fields: [...pkg.fields, field] };
      });
    } else if (fieldEditorModal.fieldId) {
      const fid = fieldEditorModal.fieldId;
      updateSelectedPackage((pkg) => ({
        ...pkg,
        fields: pkg.fields.map((f) => f.id === fid ? {
          ...f, name: name.trim() || f.name, color, type,
          options: options.filter(Boolean), optionsMode: "override" as const,
          interviewMode, defaultValue: hasDefault ? defaultValue : "",
          validationType: validationType ?? "none", validationPattern, validationMessage,
        } : f),
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
    updateSelectedPackage((pkg) => ({
      ...pkg,
      fields: pkg.fields.filter((field) => field.id !== fieldId),
      mappings: pkg.mappings.filter((m) => m.fieldId !== fieldId),
    }));
    setSelectedFieldId(null);
    setSelectedMappingId(null);
  }

  function copyField(sourceFieldId: string) {
    const snapX = clampPercent((placementModal?.pdfX ?? 20) + 3, 0, 74);
    const snapY = clampPercent((placementModal?.pdfY ?? 20) + 3, 0, 94);
    if (selectedPackage) {
      mappingUndoStack.current = [...mappingUndoStack.current, [...selectedPackage.mappings]].slice(-20);
    }
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
          h: 6,
          fontSize: 11,
          align: "left",
          format: defaultMappingFormat(copy),
        };
        setSelectedFieldId(copy.id);
        setSelectedMappingId(mappingId);
        return { ...pkg, fields: [...pkg.fields, copy], mappings: [...pkg.mappings, newMapping] };
      }
      setSelectedFieldId(copy.id);
      return { ...pkg, fields: [...pkg.fields, copy] };
    });
    setPlacementModal(null);
  }

  function duplicateMapping(sourceMappingId: string) {
    const snapX = clampPercent((placementModal?.pdfX ?? 20) + 3, 0, 74);
    const snapY = clampPercent((placementModal?.pdfY ?? 20) + 3, 0, 94);
    if (selectedPackage) {
      mappingUndoStack.current = [...mappingUndoStack.current, [...selectedPackage.mappings]].slice(-20);
    }
    updateSelectedPackage((pkg) => {
      const srcMap = pkg.mappings.find((m) => m.id === sourceMappingId);
      if (!srcMap) return pkg;
      const srcField = srcMap.fieldId ? pkg.fields.find((f) => f.id === srcMap.fieldId) : undefined;
      const newField: FieldItem | undefined = srcField ? {
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
        x: snapX,
        y: snapY,
      };
      const fields = newField ? [...pkg.fields, newField] : pkg.fields;
      if (newField) setSelectedFieldId(newField.id);
      setSelectedMappingId(newMapping.id);
      return { ...pkg, fields, mappings: [...pkg.mappings, newMapping] };
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
    addMappingForField(selectedField, 18 + (selectedPackage?.mappings.length ?? 0) % 5 * 12, 20 + (selectedPackage?.mappings.length ?? 0) % 8 * 8);
  }

  function addMappingForField(field: FieldItem, x: number, y: number) {
    if (!selectedDocument) return;
    if (selectedPackage) {
      mappingUndoStack.current = [...mappingUndoStack.current, [...selectedPackage.mappings]].slice(-20);
    }
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
        fontSize: 11,
        align: "left",
        format: defaultMappingFormat(field),
      }],
    }));
    setSelectedMappingId(mappingId);
    setSelectedFieldId(field.id);
    setPlacementModal(null);
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

  function chooseMappingFormat(mappingId: string, format: MappingFormat | string) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: pkg.mappings.map((mapping) => mapping.id === mappingId ? { ...mapping, format } : mapping),
    }));
    setSelectedMappingId(mappingId);
  }

  function removeSelectedMapping() {
    if (!selectedMapping) return;
    updateSelectedPackage((pkg) => ({
      ...pkg,
      mappings: pkg.mappings.filter((mapping) => mapping.id !== selectedMapping.id),
    }));
    setSelectedMappingId(null);
  }

  function addRecipient(recipient: RecipientItem) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      recipients: [...(pkg.recipients ?? []), recipient],
    }));
    setRecipientPickerOpen(false);
  }

  function removeRecipient(recipientId: string) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      recipients: (pkg.recipients ?? []).filter((r) => r.id !== recipientId),
      mappings: pkg.mappings.map((m) => m.recipientId === recipientId ? { ...m, recipientId: undefined } : m),
    }));
  }

  function updateRecipient(recipientId: string, patch: Partial<RecipientItem>) {
    updateSelectedPackage((pkg) => ({
      ...pkg,
      recipients: (pkg.recipients ?? []).map((r) => r.id === recipientId ? { ...r, ...patch } : r),
    }));
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
    const activeFields = session.fields.filter((f) => fieldInInterview(f) && f.interviewMode !== "readonly");
    for (const field of activeFields) {
      const value = interviewFieldValue(field, answers, session.prefill).trim();
      const label = field.name ?? field.id;
      if (fieldIsRequired(field) && !value) return `${label} is required.`;
      if (!value) continue;
      const vt = field.validationType ?? "none";
      if (vt === "name" && !/^[a-z ,.'-]+$/i.test(value)) return field.validationMessage || `${label} must be a valid name.`;
      if (vt === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return field.validationMessage || `${label} must be a valid email address.`;
      if (vt === "phone" && value.replace(/\D+/g, "").length < 10) return field.validationMessage || `${label} must be a valid phone number.`;
      if (vt === "number" && Number.isNaN(Number(value.replace(/,/g, "")))) return field.validationMessage || `${label} must be a number.`;
      if (vt === "currency" && Number.isNaN(Number(value.replace(/[$,]/g, "")))) return field.validationMessage || `${label} must be a currency amount.`;
      if (vt === "percent" && (Number.isNaN(Number(value.replace(/%/g, ""))) || Number(value.replace(/%/g, "")) < 0 || Number(value.replace(/%/g, "")) > 100)) return field.validationMessage || `${label} must be a percent between 0 and 100.`;
      if (vt === "date" && Number.isNaN(new Date(value).getTime())) return field.validationMessage || `${label} must be a valid date.`;
      if (vt === "time" && !/^([01]?\d|2[0-3]):[0-5]\d(\s?(AM|PM))?$/i.test(value)) return field.validationMessage || `${label} must be a valid time (e.g. 2:30 PM).`;
      if (vt === "zip" && !/^\d{5}$/.test(value.replace(/\s/g, ""))) return field.validationMessage || `${label} must be a 5-digit ZIP code.`;
      if (vt === "zip4" && !/^\d{5}-\d{4}$/.test(value.replace(/\s/g, ""))) return field.validationMessage || `${label} must be ZIP+4 format (12345-6789).`;
      if (vt === "ssn" && !/^\d{3}-?\d{2}-?\d{4}$/.test(value)) return field.validationMessage || `${label} must be a valid SSN format.`;
      if (vt === "custom" && field.validationPattern) {
        try {
          if (!new RegExp(field.validationPattern).test(value)) return field.validationMessage || `${label} is not in the expected format.`;
        } catch {
          return `${label} has an invalid validation pattern.`;
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
    const validationError = validateInterviewAnswers();
    if (validationError) {
      setError(validationError);
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

  async function launchTestInterview(pkg: PackageItem) {
    if (!pkg.id) {
      setError("Save the package before launching a test interview.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/sessions`, {
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
      navigate(`/internal/docufill?session=${data.token}`);
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
      const res = await fetch(`${API_BASE}${docufillApiPath}/sessions`, {
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
    try {
      const prefill: Record<string, string> = {};
      if (customerLinkFirstName.trim()) prefill.firstName = customerLinkFirstName.trim();
      if (customerLinkLastName.trim()) prefill.lastName = customerLinkLastName.trim();
      if (customerLinkEmail.trim()) prefill.email = customerLinkEmail.trim();
      const res = await fetch(`${API_BASE}${docufillApiPath}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          packageId,
          transactionScope: packages.find((p) => p.id === packageId)?.transaction_scope,
          source: "customer_link",
          prefill,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate customer link");
      const link = `${window.location.origin}/docufill/public/${data.token}`;
      setGeneratedCustomerLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate customer link");
    } finally {
      setIsGeneratingLink(false);
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
    downloadCsv(csv, `docufill-${safeName}-${date}.csv`);
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

  async function handleCsvBatchImport() {
    const pkgId = Number(csvBatchPackageId);
    if (!pkgId || csvBatchRows.length === 0) return;
    setCsvBatchIsImporting(true);
    setCsvBatchError(null);
    setCsvBatchResults(csvBatchRows.map((_, i) => ({ rowIndex: i, token: null, status: "processing" as const })));
    try {
      const res = await fetch(`${API_BASE}${docufillApiPath}/csv-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ packageId: pkgId, rows: csvBatchRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Batch import failed");
      setCsvBatchResults(data.results);
    } catch (err) {
      setCsvBatchError(err instanceof Error ? err.message : "Batch import failed");
      setCsvBatchResults(null);
    } finally {
      setCsvBatchIsImporting(false);
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
          <button onClick={() => setTab("csv")} className={`px-3 py-2 text-sm ${tab === "csv" ? "bg-[#C49A38] text-black" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}>Batch CSV</button>
        </div>}
      </div>
      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">{error}</div>}
      {status && <div className="mb-4 rounded border border-green-200 bg-green-50 text-green-800 px-3 py-2 text-sm">{status}</div>}

      {!isPublicSession && (tab === "packages" || tab === "mapper") && (
        <div className="mb-5 rounded-xl border border-[#DDD5C4] bg-white p-3">
          {/* Package switcher row */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <select
                value={selectedPackageId ?? ""}
                onChange={(e) => { setSelectedPackageId(e.target.value ? Number(e.target.value) : null); setAddingPackage(false); }}
                className="flex-1 min-w-0 max-w-xs border border-[#D4C9B5] rounded-lg px-3 py-1.5 text-sm bg-white font-medium text-[#0F1C3F]"
              >
                <option value="">{packages.length === 0 ? "No packages yet" : "Select a package…"}</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}{pkg.status !== "active" ? ` · ${pkg.status}` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setAddingPackage((v) => !v); setSelectedPackageId(null); }}
                className={`shrink-0 text-xs border rounded-lg px-3 py-1.5 transition-colors ${addingPackage ? "border-[#C49A38] bg-[#C49A38]/10 text-[#8A6A20]" : "border-[#DDD5C4] text-[#6B7A99] hover:border-[#C49A38]/60 hover:text-[#0F1C3F]"}`}
              >
                + New Package
              </button>
            </div>
            {selectedPackage && <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} variant="outline" className="shrink-0">{isSaving ? "Saving…" : "Save Package"}</Button>}
          </div>

          {/* Inline add-package form */}
          {addingPackage && (
            <div className="mb-3 rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-3 space-y-3">
              <div className="text-sm font-semibold text-[#0F1C3F]">New package</div>
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
              <div className="flex gap-2">
                <Button onClick={createPackage} disabled={isSaving || !newPackageName.trim()} className="bg-[#0F1C3F] hover:bg-[#182B5F]">Add Package</Button>
                <Button type="button" onClick={() => setAddingPackage(false)} variant="outline">Cancel</Button>
              </div>
            </div>
          )}

          {/* Stats row — shown when a package is selected */}
          {selectedPackage && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <SummaryCard label="Documents" value={String(selectedPackage.documents.length)} detail="Uploaded and ordered" />
              <SummaryCard label="Fields" value={String(selectedPackage.fields.length)} detail={`${packageInterviewFields.length} interview questions`} />
              <SummaryCard label="Placements" value={String(selectedPackage.mappings.length)} detail="PDF print locations" />
              <SummaryCard label="Unmapped" value={String(unmappedPackageFields.length)} detail={unmappedPackageFields.length ? "Review before activating" : "All placed ✓"} />
            </div>
          )}

          {/* Builder step nav */}
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
        <div>
          <section className="bg-white border border-[#DDD5C4] rounded-lg p-5">
            {!selectedPackage ? <EmptyState message="Create a package to begin." /> : (
              <div className="space-y-5">
                <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                  <h2 className="text-lg font-semibold">{BUILDER_STEPS.find((step) => step.value === builderStep)?.label}</h2>
                  <p className="text-sm text-[#6B7A99] mt-1">
                    {builderStep === "documents" && "Start where Sally starts: add the documents that belong in this package and put them in the right order."}
                    {builderStep === "mapping" && "Use the document list on the left, the PDF page in the center, and the field list on the right to build the package questionnaire."}
                    {(builderStep === "interview" || builderStep === "finalize") && "Review and reorder the questions staff will be asked, preview how the interview looks, then choose output formats and activate."}
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
                      <label className={`mt-3 inline-flex rounded border border-[#D4C9B5] bg-white px-3 py-2 text-xs font-medium text-[#0F1C3F] ${isUploadingDocument ? "opacity-50 pointer-events-none cursor-not-allowed" : "cursor-pointer"}`}>
                        {isUploadingDocument ? "Uploading…" : "Browse PDF files"}
                        <input
                          type="file"
                          accept="application/pdf"
                          multiple
                          disabled={isUploadingDocument}
                          className="sr-only"
                          onChange={(e) => {
                            if (e.target.files?.length) uploadDocuments(e.target.files);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {isUploadingDocument && <div className="text-xs text-[#6B7A99]">Uploading PDF documents, please wait…</div>}
                    {selectedPackage.documents.length === 0 ? (
                      <EmptyState message="Upload the New Direction PDFs here, then arrange them into the order West Hills wants customers to receive them." />
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
                                      docufillApiPath={docufillApiPath}
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
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">{isSaving ? "Saving…" : "Save Document Order"}</Button>
                      <Button onClick={() => goBuilderStep("mapping")} variant="outline" disabled={selectedPackage.documents.length === 0}>Continue to Mapping</Button>
                    </div>
                  </div>
                )}
                {(builderStep === "interview" || builderStep === "finalize") && (() => {
                  const unmappedInterviewFields = packageInterviewFields.filter((f) => !packageMappedFieldIds.has(f.id));
                  return (
                  <div className="space-y-6">
                    {/* ── Interview order + live preview ── */}
                    <div className="grid lg:grid-cols-2 gap-4">
                      {/* Left: drag-to-reorder */}
                      <div className="rounded-lg border border-[#DDD5C4] bg-white p-4 flex flex-col gap-3 overflow-y-auto max-h-[520px]">
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
                              if (!over || active.id === over.id) return;
                              updateSelectedPackage((pkg) => {
                                const oldIdx = pkg.fields.findIndex((f) => f.id === active.id);
                                const newIdx = pkg.fields.findIndex((f) => f.id === over.id);
                                if (oldIdx < 0 || newIdx < 0) return pkg;
                                return { ...pkg, fields: arrayMove(pkg.fields, oldIdx, newIdx) };
                              });
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
                                <div key={field.id} className="rounded border border-[#EFE8D8] px-2 py-1">
                                  <div className="font-medium">{field.name}</div>
                                  <div className="text-[#6B7A99]">Omitted{field.defaultValue ? " · has default value" : " · no default"}{field.sensitive ? " · masked" : ""}</div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        <div className="pt-1">
                          <Button onClick={() => goBuilderStep("mapping")} variant="outline" className="text-xs">Edit Mapping Rules</Button>
                        </div>
                      </div>

                      {/* Right: live preview */}
                      <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4 flex flex-col gap-3 overflow-y-auto max-h-[520px]">
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

                    {/* ── Divider ── */}
                    <div className="border-t border-[#DDD5C4]" />

                    {/* ── Output & activation ── */}
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
                        <p className="text-xs text-[#8A9BB8] mb-3">Choose how completed interviews are delivered. PDF generation is always included. Toggle channels on or off per package.</p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {/* PDF Packet — always on */}
                          <div className="rounded-lg border-2 border-[#C49A38] bg-white p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className="w-4 h-4 text-[#C49A38] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                              <span className="text-sm font-semibold">Filled PDF Packet</span>
                              <span className="ml-auto text-[10px] bg-[#FDF8EE] text-[#8A6A20] border border-[#C49A38]/40 rounded px-1.5 py-0.5 shrink-0">Always on</span>
                            </div>
                            <p className="text-xs text-[#6B7A99]">Generates a completed, print-ready PDF packet when any interview on this package is submitted.</p>
                          </div>
                          {/* Staff Interview — toggleable */}
                          <button
                            type="button"
                            onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_interview: !pkg.enable_interview }))}
                            className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_interview ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_interview ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                              <span className={`text-sm font-semibold ${selectedPackage.enable_interview ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Staff Interview</span>
                              <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_interview ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>
                                {selectedPackage.enable_interview ? "Enabled" : "Off"}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7A99]">Staff can launch guided interviews from the Interviews tab and Deal Builder. History and past sessions stay in the Interviews tab.</p>
                          </button>
                          {/* Batch CSV — toggleable */}
                          <button
                            type="button"
                            onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_csv: !pkg.enable_csv }))}
                            className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_csv ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_csv ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>
                              <span className={`text-sm font-semibold ${selectedPackage.enable_csv ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Batch CSV</span>
                              <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_csv ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>
                                {selectedPackage.enable_csv ? "Enabled" : "Off"}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7A99]">Staff can fill many packets at once by uploading a CSV. Full run history stays in the Batch CSV tab.</p>
                          </button>
                          {/* Google Drive — optional */}
                          <div className="rounded-lg border border-[#DDD5C4] bg-white p-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className="w-4 h-4 text-[#6B7A99] shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 17.01a5.09 5.09 0 01-3.6-1.49A5.12 5.12 0 011.1 12a5.07 5.07 0 011.49-3.6A5.07 5.07 0 016.18 6.9h2.18V9H6.18a3.01 3.01 0 000 6.02h2.18v2.09H6.18zm11.64 0h-2.18v-2.09h2.18a3.01 3.01 0 000-6.02h-2.18V6.9h2.18a5.07 5.07 0 013.6 1.49A5.09 5.09 0 0122.91 12a5.12 5.12 0 01-1.49 3.52 5.07 5.07 0 01-3.6 1.49zM8.09 13.09v-2.18h7.82v2.18H8.09z" /></svg>
                              <span className="text-sm font-semibold">Google Drive</span>
                              <span className="ml-auto text-[10px] bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8] rounded px-1.5 py-0.5 shrink-0">Optional</span>
                            </div>
                            <p className="text-xs text-[#6B7A99]">Automatically push the completed packet to a connected Google Drive folder after submission.</p>
                          </div>
                          {/* Customer Link — toggleable */}
                          <button
                            type="button"
                            onClick={() => updateSelectedPackage((pkg) => ({ ...pkg, enable_customer_link: !pkg.enable_customer_link }))}
                            className={`text-left rounded-lg border-2 p-3 transition-colors ${selectedPackage.enable_customer_link ? "border-[#0F1C3F] bg-white" : "border-[#DDD5C4] bg-[#F8F6F0]"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className={`w-4 h-4 shrink-0 ${selectedPackage.enable_customer_link ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                              <span className={`text-sm font-semibold ${selectedPackage.enable_customer_link ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Customer Link</span>
                              <span className={`ml-auto text-[10px] rounded px-1.5 py-0.5 shrink-0 border ${selectedPackage.enable_customer_link ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-[#F8F6F0] text-[#8A9BB8] border-[#EFE8D8]"}`}>
                                {selectedPackage.enable_customer_link ? "Enabled" : "Off"}
                              </span>
                            </div>
                            <p className="text-xs text-[#6B7A99]">Send a time-limited, branded link directly to the customer. They fill it out on their own device — no login needed.</p>
                          </button>
                          {/* Webhook — coming soon */}
                          <div className="rounded-lg border border-dashed border-[#DDD5C4] bg-[#F8F6F0] p-3 opacity-60 cursor-not-allowed">
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className="w-4 h-4 shrink-0 text-[#8A9BB8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" /></svg>
                              <span className="text-sm font-semibold text-[#8A9BB8]">Webhook</span>
                              <span className="ml-auto text-[10px] bg-[#EFE8D8] text-[#8A9BB8] border border-[#DDD5C4] rounded px-1.5 py-0.5 shrink-0">Coming soon</span>
                            </div>
                            <p className="text-xs text-[#8A9BB8]">Fire a POST request to any URL when an interview or customer form is completed. Connects to your CRM, Zapier, or any automation platform.</p>
                          </div>
                          {/* Embed — coming soon */}
                          <div className="rounded-lg border border-dashed border-[#DDD5C4] bg-[#F8F6F0] p-3 opacity-60 cursor-not-allowed">
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className="w-4 h-4 shrink-0 text-[#8A9BB8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                              <span className="text-sm font-semibold text-[#8A9BB8]">Embed</span>
                              <span className="ml-auto text-[10px] bg-[#EFE8D8] text-[#8A9BB8] border border-[#DDD5C4] rounded px-1.5 py-0.5 shrink-0">Coming soon</span>
                            </div>
                            <p className="text-xs text-[#8A9BB8]">Drop a JavaScript snippet onto any webpage. Customers complete the form inline without leaving your site.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4">
                        <h3 className="text-sm font-semibold mb-1">Package status</h3>
                        <p className="text-xs text-[#8A9BB8] mb-3">Set to Active when this package is ready for staff to use in the Interviews tab and Deal Builder.</p>
                        <select value={selectedPackage.status} onChange={(e) => updateSelectedPackage((pkg) => ({ ...pkg, status: e.target.value }))} className="w-full max-w-sm border border-[#D4C9B5] rounded px-3 py-2 bg-white">
                          <option value="draft">Draft — not ready for staff/customer interviews</option>
                          <option value="active">Active — reusable interview can be launched</option>
                          <option value="inactive">Inactive — hidden from new interview launchers</option>
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => savePackage({ ...selectedPackage, status: "active" })} disabled={isSaving || selectedPackage.documents.length === 0 || selectedPackage.mappings.length === 0} className="bg-[#0F1C3F] hover:bg-[#182B5F]">{isSaving ? "Saving…" : "Activate Package"}</Button>
                        <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} variant="outline">{isSaving ? "Saving…" : "Save"}</Button>
                        {selectedPackage.status !== "active" && selectedPackage.id && (
                          <Button onClick={() => launchTestInterview(selectedPackage)} disabled={isSaving || selectedPackage.documents.length === 0} variant="outline" className="text-[#6B7A99] border-dashed">
                            Test Interview (Draft)
                          </Button>
                        )}
                        {selectedPackage.status === "active" && <Button onClick={() => { setStandalonePackageId(String(selectedPackage.id)); setTab("interview"); }} variant="outline">Go to Interview Launcher</Button>}
                        {selectedPackage.id && (
                          <button type="button" onClick={() => deletePackage(selectedPackage)} disabled={isDeletingPackage} className="ml-auto text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors">
                            {isDeletingPackage ? "Deleting…" : "Delete package"}
                          </button>
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
      )}

      {tab === "mapper" && (
        !selectedPackage ? <EmptyState message="Create or select a package first." /> : (
          <div className="grid lg:grid-cols-[190px_1fr_260px] gap-4 min-h-[720px]">
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
                    {(selectedPackage.recipients ?? []).length === 0 ? (
                      <p className="text-[11px] text-[#8A9BB8] italic px-1">No recipients yet.</p>
                    ) : (
                      (selectedPackage.recipients ?? []).map((r) => (
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
                        if (!file) {
                          return;
                        }
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

            <section ref={setMapperContainerEl} className="bg-white border border-[#DDD5C4] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold">Assign Package Fields and Rules</h2>
                  <p className="text-xs text-[#8A9BB8]">Place fields on PDFs, then decide which are required, fixed/defaulted, validated, or omitted from the generated interview.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => setSelectedPage((page) => Math.max(1, page - 1))} disabled={!selectedDocument || selectedPage <= 1} className="text-xs border border-[#D4C9B5] rounded px-2 py-1 disabled:opacity-40">Prev</button>
                  <span className="text-xs text-[#6B7A99]">Page {selectedPage} of {Math.max(selectedDocument?.pages ?? 1, 1)}</span>
                  <button type="button" onClick={() => setSelectedPage((page) => Math.min(Math.max(selectedDocument?.pages ?? 1, 1), page + 1))} disabled={!selectedDocument || selectedPage >= Math.max(selectedDocument.pages, 1)} className="text-xs border border-[#D4C9B5] rounded px-2 py-1 disabled:opacity-40">Next</button>
                  <div className="h-4 w-px bg-[#DDD5C4]" />
                  <div className="flex rounded border border-[#D4C9B5] overflow-hidden text-xs">
                    <button type="button" onClick={() => setMapperTextMode(true)} className={`px-2 py-1 leading-none ${mapperTextMode ? "bg-[#C49A38] text-black font-medium" : "text-[#6B7A99] hover:bg-[#F8F6F0]"}`}>Text</button>
                    <button type="button" onClick={() => setMapperTextMode(false)} className={`px-2 py-1 leading-none border-l border-[#D4C9B5] ${!mapperTextMode ? "bg-[#C49A38] text-black font-medium" : "text-[#6B7A99] hover:bg-[#F8F6F0]"}`}>Labels</button>
                  </div>
                  {documentPreviewUrl && acroAnnotations.length > 0 && (
                    <button type="button" onClick={() => setShowAcroLayer((v) => !v)} className={`text-xs border rounded px-2 py-1 leading-none transition-colors ${showAcroLayer ? "border-blue-300 bg-blue-50 text-blue-700" : "border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]"}`}>
                      PDF Fields {showAcroLayer ? "on" : "off"}
                    </button>
                  )}
                </div>
              </div>
              {isUploadingDocument && <div className="mb-2 text-xs text-[#6B7A99]">Uploading PDF…</div>}
              <div
                className="relative bg-[#F8F6F0] border border-[#DDD5C4] shadow-inner overflow-hidden"
                style={{ width: mapperFrameW, height: mapperFrameH }}
              >
                <div
                  ref={pageFrameRef}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={dropFieldOnPage}
                  onClick={() => setPlacementModal(null)}
                  className="absolute top-0 left-0 bg-white border border-[#D4C9B5] shadow-sm overflow-hidden"
                  style={{
                    width: nativePageW,
                    height: nativePageH,
                    transform: `scale(${mapperScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {documentPreviewUrl ? (
                    <>
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: nativePageW, height: nativePageH }}
                      />
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
                  {pageMappings.map((m) => {
                    const field = selectedPackage.fields.find((f) => f.id === m.fieldId);
                    const isSelected = selectedMapping?.id === m.id;
                    const mFontSize = m.fontSize ?? 11;
                    const isCheckboxMark = m.format === "checkbox-yes" || String(m.format ?? "").startsWith("checkbox-option:");
                    const recipient = m.recipientId ? (selectedPackage.recipients ?? []).find((r) => r.id === m.recipientId) : undefined;
                    const fieldColor = recipient?.color ?? field?.color ?? "#C49A38";
                    const flexJustify = isCheckboxMark ? "justify-center" : "justify-end";
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onPointerDown={(e) => beginMappingPointer(e, m, "move")}
                        onClick={() => { setSelectedMappingId(m.id); setSelectedFieldId(m.fieldId); }}
                        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedMappingId(m.id); setSelectedFieldId(m.fieldId); setPlacementModal({ mappingId: m.id, pdfX: m.x, pdfY: m.y }); setPlacementModalPos(null); }}
                        className={`absolute rounded cursor-move flex flex-col overflow-hidden ${flexJustify} ${mapperTextMode ? (isSelected ? "ring-2 shadow" : "hover:ring-1") : "border-2 bg-white/90 shadow"} ${isSelected ? "ring-[#C49A38]/70" : "ring-[#C49A38]/30"}`}
                        style={{
                          left: `${m.x}%`,
                          top: `${m.y}%`,
                          width: `${m.w}%`,
                          height: `${m.h}%`,
                          minHeight: "20px",
                          border: mapperTextMode ? `1px ${isSelected ? "solid" : "dashed"} ${fieldColor}${isSelected ? "" : "80"}` : `2px solid ${fieldColor}`,
                          backgroundColor: mapperTextMode ? (isSelected ? fieldColor + "18" : "transparent") : "rgba(255,255,255,0.9)",
                          fontSize: `${mFontSize}px`,
                          textAlign: m.align ?? "left",
                          paddingBottom: !isCheckboxMark ? "2px" : undefined,
                          paddingLeft: "2px",
                          paddingRight: "2px",
                          zIndex: 2,
                        }}
                      >
                        {mapperTextMode ? (
                          <span className="block leading-none select-none pointer-events-none truncate" style={{ color: "#111", fontFamily: "Helvetica, Arial, sans-serif" }}>
                            {sampleValueForMapping(field, m.format) || "\u00A0"}
                          </span>
                        ) : (
                          <>
                            <div className="pointer-events-none w-full">
                              <span className="block leading-tight">{field?.name ?? "Field"}</span>
                              <span className="block text-[9px] uppercase tracking-wide text-[#6B7A99]">{labelForMappingFormat(m.format)}</span>
                              <span className="block leading-tight italic truncate" style={{ color: "#9AAAC0", opacity: 0.85 }}>{sampleValueForMapping(field, m.format)}</span>
                              <div style={{ borderBottom: "0.4px solid #c8c8c8", marginTop: "1px" }} />
                            </div>
                          </>
                        )}
                        {isSelected && (
                          <span
                            onPointerDown={(e) => beginMappingPointer(e, m, "resize")}
                            className="absolute bottom-0 right-0 h-3 w-3 translate-x-1 translate-y-1 rounded-sm border border-[#0F1C3F] bg-[#C49A38] cursor-nwse-resize"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button onClick={() => savePackage(selectedPackage)} disabled={isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F]">{isSaving ? "Saving…" : `Save ${selectedPackage.fields.length} Fields / ${selectedPackage.mappings.length} Placements`}</Button>
                <Button onClick={() => goBuilderStep("interview", { autoSort: true })} variant="outline">Review Generated Interview</Button>
              </div>
            </section>

            <section className="bg-white border border-[#DDD5C4] rounded-lg p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Fields</h2>
                <button onClick={openFieldEditorForAdd} className="text-xs text-[#C49A38]">Add</button>
              </div>
              {(() => {
                const usedLibraryIds = new Set(selectedPackage.fields.map((f) => f.libraryFieldId).filter(Boolean));
                const availableLibraryFields = fieldLibrary.filter((item) => item.active && !usedLibraryIds.has(item.id));
                if (availableLibraryFields.length === 0) return null;
                return (
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
                      {availableLibraryFields.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.category}</option>)}
                    </select>
                  </label>
                );
              })()}
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
                  <div className="space-y-2 overflow-y-auto max-h-[52vh]">
                    {selectedPackage.fields.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 px-3 text-center gap-2">
                        <svg className="w-6 h-6 text-[#C49A38]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        <p className="text-xs text-[#8A9BB8] leading-snug italic">No fields yet. Click <strong className="not-italic font-semibold text-[#C49A38]">Add</strong> above to create your first field, then drag it onto the document to place it.</p>
                      </div>
                    )}
                    {selectedPackage.fields.map((field) => (
                      <SortableItem key={field.id} id={field.id}>
                        {({ handleProps, wrapperRef, wrapperStyle, isDragging }) => (
                          <div
                            ref={wrapperRef}
                            style={{ ...wrapperStyle, borderColor: field.color }}
                            draggable
                            onDragStart={(e) => {
                              if (fieldDragFromHandle.current) { e.preventDefault(); return; }
                              e.dataTransfer.setData("text/field", field.id);
                            }}
                            onDoubleClick={() => openFieldEditorForEdit(field.id)}
                            className={`w-full text-left border-2 rounded px-3 py-2 bg-white transition-shadow cursor-alias ${isDragging ? "opacity-40 shadow-lg" : ""} ${selectedField?.id === field.id ? "ring-2 ring-[#C49A38]/30" : ""}`}
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
                                    {field.libraryFieldId && <span className="text-[10px] uppercase tracking-wide rounded bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8] px-1.5 py-0.5">Shared</span>}
                                    {field.sensitive && <span className="text-[10px] uppercase tracking-wide rounded bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5">Sensitive</span>}
                                    {!packageMappedFieldIds.has(field.id) && <span className="text-[10px] uppercase tracking-wide rounded bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5">No placement</span>}
                                  </div>
                                  <div className="text-[11px] text-[#6B7A99]">{field.type} · {field.interviewMode ?? "optional"}{field.sensitive ? " · masked" : ""}</div>
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                                className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] text-red-500 hover:bg-red-50 hover:border-red-300 flex-shrink-0"
                                title="Remove field"
                              >✕</button>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          </div>
        )
      )}

      {tab === "interview" && (
        <section className="bg-white border border-[#DDD5C4] rounded-lg p-5 max-w-4xl mx-auto">
          {!session ? (
            isPublicSession ? <EmptyState message="This interview link is invalid or expired." /> : (
              <div className="space-y-4">
                {/* Output type selector cards */}
                {(() => {
                  const hasStaff = activePackages.some((p) => p.enable_interview);
                  const hasCustomerLink = activePackages.some((p) => p.enable_customer_link);
                  if (!hasStaff && !hasCustomerLink) {
                    return <EmptyState message="No active packages have an output channel enabled. Go to Package Builder → Step 3 to enable Staff Interview or Customer Link." />;
                  }
                  return (
                    <>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {hasStaff && (
                          <button
                            type="button"
                            onClick={() => setInterviewOutputTab("staff")}
                            className={`text-left rounded-lg border-2 p-4 transition-colors ${interviewOutputTab === "staff" ? "border-[#0F1C3F] bg-white shadow-sm" : "border-[#DDD5C4] bg-[#F8F6F0] hover:border-[#0F1C3F]/40"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className={`w-4 h-4 shrink-0 ${interviewOutputTab === "staff" ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                              <span className={`text-sm font-semibold ${interviewOutputTab === "staff" ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Staff Interview</span>
                              {interviewOutputTab === "staff" && <svg className="w-3.5 h-3.5 ml-auto text-[#0F1C3F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <p className="text-xs text-[#6B7A99]">Walk a client through their paperwork step-by-step. Staff fills the interview on their behalf.</p>
                          </button>
                        )}
                        {hasCustomerLink && (
                          <button
                            type="button"
                            onClick={() => setInterviewOutputTab("customerLink")}
                            className={`text-left rounded-lg border-2 p-4 transition-colors ${interviewOutputTab === "customerLink" ? "border-[#0F1C3F] bg-white shadow-sm" : "border-[#DDD5C4] bg-[#F8F6F0] hover:border-[#0F1C3F]/40"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <svg className={`w-4 h-4 shrink-0 ${interviewOutputTab === "customerLink" ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                              <span className={`text-sm font-semibold ${interviewOutputTab === "customerLink" ? "text-[#0F1C3F]" : "text-[#8A9BB8]"}`}>Customer Link</span>
                              {interviewOutputTab === "customerLink" && <svg className="w-3.5 h-3.5 ml-auto text-[#0F1C3F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <p className="text-xs text-[#6B7A99]">Send a secure link directly to the customer. They complete the form on their own device — no login needed.</p>
                          </button>
                        )}
                      </div>

                      {/* Staff Interview panel */}
                      {interviewOutputTab === "staff" && hasStaff && (
                        <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4 space-y-3">
                          <div>
                            <p className="text-xs text-[#8A9BB8]">Select a package, then start the interview. You can also launch directly from Deal Builder for a pre-filled session.</p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <select value={standalonePackageId} onChange={(e) => setStandalonePackageId(e.target.value)} className="flex-1 border border-[#D4C9B5] rounded-lg px-3 py-2 text-sm bg-white">
                              <option value="">Select package…</option>
                              {activePackages.filter((p) => p.enable_interview).map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}{pkg.transaction_scope ? ` · ${labelForTransactionScope(pkg.transaction_scope)}` : ""}</option>)}
                            </select>
                            <Button onClick={launchStandaloneInterview} disabled={!standalonePackageId || isSaving} className="bg-[#0F1C3F] hover:bg-[#182B5F] shrink-0">{isSaving ? "Launching…" : "Start Interview"}</Button>
                          </div>
                        </div>
                      )}

                      {/* Customer Link panel */}
                      {interviewOutputTab === "customerLink" && hasCustomerLink && (
                        <div className="rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-4 space-y-3">
                          <p className="text-xs text-[#8A9BB8]">Select a package and optionally pre-fill the customer's name and email. The link expires after 90 days.</p>
                          <div className="space-y-2">
                            <select value={customerLinkPackageId} onChange={(e) => { setCustomerLinkPackageId(e.target.value); setGeneratedCustomerLink(null); }} className="w-full border border-[#D4C9B5] rounded-lg px-3 py-2 text-sm bg-white">
                              <option value="">Select package…</option>
                              {activePackages.filter((p) => p.enable_customer_link).map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name}{pkg.transaction_scope ? ` · ${labelForTransactionScope(pkg.transaction_scope)}` : ""}</option>)}
                            </select>
                            <div className="grid sm:grid-cols-3 gap-2">
                              <Input placeholder="First name (optional)" value={customerLinkFirstName} onChange={(e) => setCustomerLinkFirstName(e.target.value)} className="text-sm" />
                              <Input placeholder="Last name (optional)" value={customerLinkLastName} onChange={(e) => setCustomerLinkLastName(e.target.value)} className="text-sm" />
                              <Input placeholder="Email (optional)" value={customerLinkEmail} onChange={(e) => setCustomerLinkEmail(e.target.value)} className="text-sm" />
                            </div>
                          </div>
                          <Button onClick={generateCustomerLink} disabled={!customerLinkPackageId || isGeneratingLink} className="bg-[#0F1C3F] hover:bg-[#182B5F]">
                            {isGeneratingLink ? "Generating…" : "Generate Link"}
                          </Button>
                          {generatedCustomerLink && (
                            <div className="rounded border border-green-200 bg-green-50 p-3 space-y-2">
                              <div className="text-xs font-semibold text-green-800">Link ready — copy and send to your customer</div>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs bg-white border border-green-200 rounded px-2 py-1.5 text-[#0F1C3F] break-all">{generatedCustomerLink}</code>
                                <button
                                  type="button"
                                  onClick={copyCustomerLink}
                                  className="shrink-0 text-xs border border-green-300 bg-white text-green-800 rounded px-3 py-1.5 hover:bg-green-100 transition-colors"
                                >
                                  {linkCopied ? "Copied ✓" : "Copy"}
                                </button>
                              </div>
                              <p className="text-[11px] text-green-700">This link expires in 90 days. When the customer submits, you'll receive the completed packet.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
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
                {visibleInterviewFields.map((field) => {
                  const mode = field.interviewMode ?? (fieldIsRequired(field) ? "required" : "optional");
                  const isReadonly = mode === "readonly";
                  const currentValue = interviewFieldValue(field, answers, session.prefill);
                  return (
                  <label key={field.id} className={`block border rounded p-3 ${isReadonly ? "opacity-75" : ""}`} style={{ borderColor: field.color }}>
                    <span className="flex items-center justify-between gap-2 text-sm font-medium mb-1">
                      <span>{field.name}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        mode === "required" ? "bg-red-50 text-red-700 border border-red-100"
                        : mode === "readonly" ? "bg-blue-50 text-blue-700 border border-blue-100"
                        : "bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8]"
                      }`}>{mode === "required" ? "Required" : mode === "readonly" ? "Read only" : "Optional"}</span>
                    </span>
                    {isReadonly ? (
                      <div className="px-3 py-2 text-sm bg-[#F8F6F0] rounded border border-[#DDD5C4] text-[#334155]">
                        {currentValue || <span className="text-[#8A9BB8] italic">—</span>}
                      </div>
                    ) : field.type === "dropdown" ? (
                      <select data-interview-input value={currentValue} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2">
                        <option value="">{mode === "required" ? "— select —" : "Select"}</option>
                        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.type === "radio" ? (
                      <div className="space-y-1 pt-1">
                        {((field.options ?? []).length ? field.options ?? [] : []).map((option) => (
                          <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              data-interview-input
                              type="radio"
                              name={field.id}
                              value={option}
                              checked={currentValue === option}
                              onChange={() => setAnswers((prev) => ({ ...prev, [field.id]: option }))}
                            />
                            {option}
                          </label>
                        ))}
                        {currentValue && (
                          <button type="button" onClick={() => setAnswers((prev) => ({ ...prev, [field.id]: "" }))} className="text-[11px] text-[#8A9BB8] hover:text-[#334155]">Clear selection</button>
                        )}
                      </div>
                    ) : field.type === "checkbox" ? (
                      <div className="space-y-1 pt-1">{((field.options ?? []).length ? field.options ?? [] : ["Yes"]).map((option) => {
                        const parseChecked = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
                        return (
                          <label key={option} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              data-interview-input
                              type="checkbox"
                              checked={parseChecked(currentValue).includes(option)}
                              onChange={(e) => setAnswers((prev) => {
                                const existing = parseChecked(interviewFieldValue(field, prev, session.prefill));
                                const updated = e.target.checked ? [...existing.filter((v) => v !== option), option] : existing.filter((v) => v !== option);
                                return { ...prev, [field.id]: updated.join(", ") };
                              })}
                            />
                            {option}
                          </label>
                        );
                      })}</div>
                    ) : (
                      <Input data-interview-input type={field.sensitive ? "password" : field.type === "date" ? "date" : "text"} value={currentValue} onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))} />
                    )}
                  </label>
                  );
                })}
              </div>
              <div className="rounded border border-[#DDD5C4] bg-white p-4">
                <h3 className="text-sm font-semibold mb-2">Preview before send</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#6B7A99]">
                  {visibleInterviewFields.map((field) => {
                    const value = interviewFieldValue(field, answers, session.prefill).trim();
                    return <div key={field.id}><span className="font-medium text-[#0F1C3F]">{field.name}:</span> {value ? safeInterviewDisplayValue(field, value) : <span className="text-[#B58B2B]">{field.interviewMode === "required" ? "Missing" : "Not provided"}</span>}</div>;
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => saveAnswers()} disabled={isSaving} variant="outline">{isSaving ? "Saving…" : "Save Interview"}</Button>
                <Button onClick={generatePacket} disabled={isSaving || missingRequiredFields.length > 0} className="bg-[#0F1C3F] hover:bg-[#182B5F] disabled:opacity-60">{isSaving ? "Generating…" : "Generate Packet"}</Button>
                <Button onClick={handleDownloadInterviewCsv} variant="outline" className="text-[#6B7A99] border-[#DDD5C4]">Download CSV</Button>
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

      {!isPublicSession && tab === "csv" && (
        <section className="bg-white border border-[#DDD5C4] rounded-lg p-5 max-w-4xl mx-auto space-y-5">
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
                  setCsvBatchResults(null);
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
                  <option key={pkg.id} value={pkg.id}>{pkg.name} · {labelForTransactionScope(pkg.transaction_scope)}</option>
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
                    downloadCsv(csv, `docufill-template-${safeName}-${date}.csv`);
                  }}
                  className="text-sm text-[#C49A38] underline hover:text-[#b58c31]"
                >
                  Download blank template
                </button>

                {/* Field Reference Key */}
                {(() => {
                  const keyFields = [...csvBatchFieldMap.values()];
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
                            <thead className="bg-[#EFE8D8]">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-[#6B7A99] whitespace-nowrap">Field Name (CSV column header)</th>
                                <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Required?</th>
                                <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Type</th>
                                <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">Accepted Values</th>
                              </tr>
                            </thead>
                            <tbody>
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
                for (const { row, idx } of allDisplayedRows) {
                  for (const hh of visibleHeaders) {
                    const isMetadata = hh === "__package_id__" || hh === "__package_name__";
                    const matchedField = csvBatchPackageId ? csvBatchFieldMap.get(hh.toLowerCase().trim()) : undefined;
                    const willSkip = csvBatchPackageId && !isMetadata && !matchedField;
                    const cellVal = row[hh] ?? "";
                    const validity = matchedField ? validateCellValue(matchedField, cellVal) : "ok";
                    if (!willSkip && (validity === "invalid" || validity === "empty-required")) {
                      allEditableCells.push({ rowIdx: idx, header: hh });
                    }
                  }
                }

                const renderBodyRow = (row: Record<string, string>, rowIdx: number, isErrorRow: boolean) => (
                  <tr key={rowIdx} className={`border-b border-[#EFE8D8] last:border-0${isErrorRow ? " bg-[#FAFAF8]" : ""}`}>
                    <td className="px-2 py-1 text-[#9AAAC0] font-mono text-[10px] text-right select-none border-r border-[#EFE8D8] whitespace-nowrap">
                      {rowIdx + 1}
                    </td>
                    {visibleHeaders.map((h) => {
                      const isMetadata = h === "__package_id__" || h === "__package_name__";
                      const matchedField = csvBatchPackageId ? csvBatchFieldMap.get(h.toLowerCase().trim()) : undefined;
                      const willSkip = csvBatchPackageId && !isMetadata && !matchedField;
                      const cellVal = row[h] ?? "";
                      const validity = matchedField ? validateCellValue(matchedField, cellVal) : "ok";
                      const isEditing = csvEditingCell?.rowIdx === rowIdx && csvEditingCell?.header === h;
                      const originalCellVal = csvBatchOriginalRows.length > 0 ? (csvBatchOriginalRows[rowIdx]?.[h] ?? "") : cellVal;
                      const isCellModified = csvBatchOriginalRows.length > 0 && originalCellVal !== cellVal;
                      const isEditable = !willSkip && (validity === "invalid" || validity === "empty-required" || isCellModified);

                      const revertCell = (e: React.MouseEvent | React.KeyboardEvent) => {
                        e.stopPropagation();
                        const newRows = csvBatchRows.map((r, i) => {
                          if (i !== rowIdx) return r;
                          return { ...r, [h]: originalCellVal };
                        });
                        setCsvBatchRows(newRows);
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
                            title={
                              hasIssues
                                ? `${invalidCount > 0 ? `${invalidCount} invalid value${invalidCount === 1 ? "" : "s"}` : ""}${invalidCount > 0 && emptyRequiredCount > 0 ? ", " : ""}${emptyRequiredCount > 0 ? `${emptyRequiredCount} empty required` : ""} — click to see in breakdown`
                                : willSkip
                                  ? "This column will be skipped on import"
                                  : matchedField?.interviewMode === "required"
                                    ? "Required field"
                                    : undefined
                            }
                            {...(hasIssues ? {
                              role: "button",
                              tabIndex: 0,
                              onClick: handleHeaderClick,
                              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleHeaderClick(); } },
                            } : {})}
                          >
                            <span className="inline-flex items-center gap-1 flex-wrap">
                              <span>{h}</span>
                              {matchedField?.interviewMode === "required" && !willSkip && (
                                <span className="text-red-500 font-bold" title="Required field">*</span>
                              )}
                              {invalidCount > 0 && (
                                <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-1.5 py-0.5 min-w-[16px]" title={`${invalidCount} invalid value${invalidCount === 1 ? "" : "s"}`}>
                                  {invalidCount}
                                </span>
                              )}
                              {emptyRequiredCount > 0 && (
                                <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none px-1.5 py-0.5 min-w-[16px]" title={`${emptyRequiredCount} empty required`}>
                                  {emptyRequiredCount}
                                </span>
                              )}
                            </span>
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
                              <td
                                colSpan={colCount}
                                className="px-3 py-1.5 text-[10px] font-semibold text-[#6B7A99] bg-[#F3F0E8] border-t border-b border-[#DDD5C4] tracking-wide"
                              >
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
                                    {f.invalid.length <= 20
                                      ? f.invalid.join(", ")
                                      : f.invalid.slice(0, 20).join(", ") + ` … +${f.invalid.length - 20} more`}
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
                                    {f.emptyRequired.length <= 20
                                      ? f.emptyRequired.join(", ")
                                      : f.emptyRequired.slice(0, 20).join(", ") + ` … +${f.emptyRequired.length - 20} more`}
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

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleCsvBatchImport}
              disabled={!csvBatchPackageId || csvBatchRows.length === 0 || csvBatchIsImporting}
              className="bg-[#0F1C3F] hover:bg-[#182B5F] disabled:opacity-60"
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
                ) : (
                  "Download corrected CSV"
                )}
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
                  : `Results — ${csvBatchResults.filter((r) => r.status === "generated").length} generated · ${csvBatchResults.filter((r) => r.status === "error").length} failed`
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
                      <th className="px-3 py-2 text-left font-medium text-[#6B7A99]">PDF</th>
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
                            : result.status === "generated"
                              ? <span className="text-green-700 font-medium">Generated</span>
                              : <span className="text-red-700 font-medium">Error</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-[#6B7A99] font-mono text-[10px] max-w-[160px] truncate">{result.token ?? "—"}</td>
                        <td className="px-3 py-2">
                          {result.status === "generated" && result.token
                            ? <a href={`/internal/docufill?session=${result.token}`} target="_blank" rel="noreferrer" className="text-[#C49A38] underline">Open session</a>
                            : <span className="text-[#8A9BB8]">—</span>
                          }
                        </td>
                        <td className="px-3 py-2">
                          {result.pdfUrl
                            ? <a href={`${API_BASE}${result.pdfUrl}`} target="_blank" rel="noreferrer" className="text-[#C49A38] underline">Download PDF</a>
                            : <span className="text-[#8A9BB8]">—</span>
                          }
                        </td>
                        <td className="px-3 py-2 text-red-700 max-w-[300px] truncate">{result.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!csvBatchIsImporting && (
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const dateStr = new Date().toISOString().slice(0, 10);
                      downloadCsv(batchResultsToCsv(csvBatchResults, API_BASE, csvBatchHeaders, csvBatchRows), `docufill-batch-results-${dateStr}.csv`);
                    }}
                    className="border-[#DDD5C4] text-[#0F1C3F] hover:bg-[#F8F6F0]"
                  >
                    Download Results CSV
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {placementModal && selectedPackage && (() => {
        const mapping = selectedPackage.mappings.find((item) => item.id === placementModal.mappingId);
        const field = mapping ? selectedPackage.fields.find((item) => item.id === mapping.fieldId) : undefined;
        const formatOptions = mappingFormatOptionsForField(field);
        if (!mapping) return null;
        const assignedRecipient = mapping.recipientId ? (selectedPackage.recipients ?? []).find((r) => r.id === mapping.recipientId) : undefined;
        const fieldInterviewMode: FieldInterviewMode = field?.interviewMode ?? "optional";
        const isMasked = field?.sensitive === true;
        const isMultiLine = mapping.multiLine === true;

        function setInterviewMode(mode: FieldInterviewMode) {
          if (!field) return;
          updateFieldInPackage(field.id, { interviewMode: mode });
        }
        function toggleMask() {
          if (!field) return;
          updateFieldInPackage(field.id, { sensitive: !isMasked });
        }
        function toggleMultiLine() {
          updateSelectedMapping({ multiLine: !isMultiLine });
        }

        const interviewModes: { value: FieldInterviewMode; label: string; color: string; textClass: string }[] = [
          { value: "optional",  label: "Optional",  color: "#0F1C3F", textClass: "text-[#0F1C3F]" },
          { value: "required",  label: "Required",  color: "#dc2626", textClass: "text-red-600" },
          { value: "readonly",  label: "Read-only", color: "#2563eb", textClass: "text-blue-600" },
          { value: "omitted",   label: "Omit",      color: "#6B7A99", textClass: "text-[#6B7A99]" },
        ];

        function startModalDrag(e: React.PointerEvent<HTMLElement>) {
          e.preventDefault();
          const card = document.getElementById("placement-modal-card");
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const startX = e.clientX, startY = e.clientY;
          const startLeft = rect.left, startTop = rect.top;
          function onMove(ev: PointerEvent) {
            setPlacementModalPos({ x: startLeft + (ev.clientX - startX), y: startTop + (ev.clientY - startY) });
          }
          function onUp() { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); }
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }

        return (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0" onClick={() => setPlacementModal(null)} />
            <div
              id="placement-modal-card"
              className="absolute bg-white rounded-xl shadow-2xl w-72 max-h-[90vh] overflow-y-auto"
              style={placementModalPos
                ? { top: placementModalPos.y, left: placementModalPos.x }
                : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" }
              }
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b border-[#DDD5C4] cursor-move select-none"
                onPointerDown={startModalDrag}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-3 h-3 text-[#C4B89A]" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.1"/><circle cx="11" cy="4" r="1.1"/><circle cx="5" cy="8" r="1.1"/><circle cx="11" cy="8" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="11" cy="12" r="1.1"/></svg>
                  <h2 className="text-xs font-semibold text-[#0F1C3F] uppercase tracking-wide">Placement</h2>
                </div>
                <button type="button" onClick={() => setPlacementModal(null)} className="text-[#8A9BB8] hover:text-[#0F1C3F]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">

                {field && (
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => updateFieldInPackage(field.id, { name: e.target.value })}
                    className="w-full border border-[#D4C9B5] rounded px-2.5 py-1.5 text-xs text-[#0F1C3F] focus:outline-none focus:ring-1 focus:ring-[#C49A38] focus:border-[#C49A38]"
                    placeholder="Field name"
                  />
                )}

                {(selectedPackage.recipients ?? []).length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1">Recipient</div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => updateSelectedMapping({ recipientId: undefined })}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors ${!assignedRecipient ? "border-[#0F1C3F] bg-[#0F1C3F] text-white" : "border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
                      >
                        <span className="w-2 h-2 rounded-full border border-current inline-block" />
                        <span>None</span>
                      </button>
                      {(selectedPackage.recipients ?? []).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => updateSelectedMapping({ recipientId: r.id })}
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] border transition-colors ${mapping.recipientId === r.id ? "border-[#0F1C3F] bg-[#0F1C3F] text-white" : "border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
                        >
                          <span className="w-2 h-2 rounded-full inline-block flex-shrink-0 border-2" style={{ borderColor: r.color }} />
                          <span>{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {field && (
                  <div>
                    <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1">Interview</div>
                    <div className="flex rounded overflow-hidden border border-[#D4C9B5]">
                      {interviewModes.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setInterviewMode(m.value)}
                          className={`flex-1 py-1.5 text-[11px] font-medium border-r last:border-r-0 border-[#D4C9B5] transition-colors ${fieldInterviewMode === m.value ? `${m.textClass} bg-white` : "text-[#6B7A99] hover:bg-[#F8F6F0]"}`}
                          style={fieldInterviewMode === m.value ? { boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {fieldInterviewMode === "omitted" && (
                      <p className="mt-1 text-[10px] text-[#6B7A99]">Field prints on the PDF but won't appear as a question — needs a default value or prefill.</p>
                    )}
                  </div>
                )}

                {field && (
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={isMasked} onChange={toggleMask} className="w-3 h-3 accent-[#C49A38] cursor-pointer" />
                      <span className="text-xs text-[#334155]">Mask</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={isMultiLine} onChange={toggleMultiLine} className="w-3 h-3 accent-[#C49A38] cursor-pointer" />
                      <span className="text-xs text-[#334155]">Multi-line</span>
                    </label>
                  </div>
                )}

                {formatOptions.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-[#6B7A99] uppercase tracking-wide mb-1">Orientation</div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {formatOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => chooseMappingFormat(mapping.id, option.value)}
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-[#F8F6F0] ${mapping.format === option.value ? "bg-[#F8F6F0] text-[#0F1C3F] font-semibold" : "text-[#334155]"}`}
                        >
                          <span>{option.label}</span>
                          <span className="text-[10px] text-[#8A9BB8]">{option.group}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 border-t border-[#EFE8D8] pt-2.5">
                  {field && (
                    <button type="button" onClick={() => copyField(field.id)} className="flex-1 rounded border border-[#D4C9B5] px-2 py-1.5 text-[11px] text-[#334155] hover:bg-[#F8F6F0] text-center">
                      Copy field
                    </button>
                  )}
                  <button type="button" onClick={() => duplicateMapping(mapping.id)} className="flex-1 rounded border border-[#D4C9B5] px-2 py-1.5 text-[11px] text-[#334155] hover:bg-[#F8F6F0] text-center">
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => { removeSelectedMapping(); setPlacementModal(null); }}
                    className="flex-1 rounded border border-red-200 px-2 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 hover:border-red-300 text-center"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {recipientPickerOpen && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRecipientPickerOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDD5C4]">
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
                  disabled={(selectedPackage.recipients ?? []).some((r) => r.type === "customer")}
                  onClick={() => addRecipient({ id: newRecipientId(), label: "Customer", color: pickRecipientColor((selectedPackage.recipients ?? []).map((r) => r.color)), type: "customer" })}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#334155] hover:bg-[#F8F6F0] border border-[#EFE8D8] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="w-3.5 h-3.5 text-[#8A9BB8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Customer
                  {(selectedPackage.recipients ?? []).some((r) => r.type === "customer") && <span className="ml-auto text-[10px] text-[#8A9BB8]">already added</span>}
                </button>
              </div>
              {custodians.filter((c) => c.active !== false).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wide mb-2">Custodians</div>
                  <div className="space-y-1">
                    {custodians.filter((c) => c.active !== false).map((c) => {
                      const already = (selectedPackage.recipients ?? []).some((r) => r.type === "custodian" && r.refId === c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={already}
                          onClick={() => addRecipient({ id: newRecipientId(), label: c.name, color: pickRecipientColor((selectedPackage.recipients ?? []).map((r) => r.color)), type: "custodian", refId: c.id })}
                          className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#334155] hover:bg-[#F8F6F0] border border-[#EFE8D8] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5 text-[#8A9BB8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 8v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {c.name}
                          {already && <span className="ml-auto text-[10px] text-[#8A9BB8]">already added</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {depositories.filter((d) => d.active !== false).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wide mb-2">Depositories</div>
                  <div className="space-y-1">
                    {depositories.filter((d) => d.active !== false).map((d) => {
                      const already = (selectedPackage.recipients ?? []).some((r) => r.type === "depository" && r.refId === d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={already}
                          onClick={() => addRecipient({ id: newRecipientId(), label: d.name, color: pickRecipientColor((selectedPackage.recipients ?? []).map((r) => r.color)), type: "depository", refId: d.id })}
                          className="flex w-full items-center gap-2 rounded px-3 py-2 text-xs text-[#334155] hover:bg-[#F8F6F0] border border-[#EFE8D8] disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5 text-[#8A9BB8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                          {d.name}
                          {already && <span className="ml-auto text-[10px] text-[#8A9BB8]">already added</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fieldEditorModal && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setFieldEditorModal(null)} style={{ cursor: fieldEditorIsDragging ? "grabbing" : "default" }}>
          <div
            ref={fieldEditorPanelRef}
            className="absolute bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            style={{ left: "50%", top: "50%", transform: `translate(calc(-50% + ${fieldEditorPos.x}px), calc(-50% + ${fieldEditorPos.y}px))` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-[#DDD5C4] select-none"
              style={{ cursor: fieldEditorIsDragging ? "grabbing" : "grab" }}
              onMouseDown={handleFieldEditorDragStart}
              onTouchStart={handleFieldEditorTouchStart}
            >
              <h2 className="text-sm font-semibold">{fieldEditorModal.mode === "add" ? "New Field" : "Edit Field"}</h2>
              <button type="button" onClick={() => setFieldEditorModal(null)} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="text-[#8A9BB8] hover:text-[#0F1C3F]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#6B7A99] mb-1">Field Name</label>
                <Input value={fieldEditorDraft.name} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Borrower Full Name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7A99] mb-1.5">Field Color</label>
                <div className="grid grid-cols-5 gap-1 mb-2">
                  {FIELD_COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      onClick={() => setFieldEditorDraft((d) => ({ ...d, color }))}
                      className="w-full h-5 rounded-sm"
                      style={{
                        backgroundColor: color,
                        outline: fieldEditorDraft.color.toUpperCase() === color.toUpperCase() ? `2px solid ${color}` : "none",
                        outlineOffset: "2px",
                        boxShadow: fieldEditorDraft.color.toUpperCase() === color.toUpperCase() ? "0 0 0 1px white inset" : "none",
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fieldEditorDraft.color}
                    onChange={(e) => setFieldEditorDraft((d) => ({ ...d, color: e.target.value }))}
                    className="h-7 w-9 rounded cursor-pointer border border-[#D4C9B5] p-0.5 flex-shrink-0"
                    title="Custom color"
                  />
                  <span className="text-xs text-[#8A9BB8] font-mono">{fieldEditorDraft.color.toUpperCase()}</span>
                  <span className="text-[10px] text-[#B0BAD0] ml-auto">custom</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7A99] mb-1">Field Type</label>
                <select value={fieldEditorDraft.type} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, type: e.target.value as FieldItem["type"] }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm bg-white">
                  <option value="text">Text box</option>
                  <option value="date">Date</option>
                  <option value="radio">Radio buttons</option>
                  <option value="checkbox">Checkboxes</option>
                  <option value="dropdown">Dropdown</option>
                </select>
              </div>
              {(fieldEditorDraft.type === "radio" || fieldEditorDraft.type === "checkbox" || fieldEditorDraft.type === "dropdown") && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-[#6B7A99]">Options</label>
                    <button type="button" onClick={() => setFieldEditorDraft((d) => ({ ...d, options: [...d.options, ""] }))} className="text-xs text-[#C49A38] hover:underline">+ Add option</button>
                  </div>
                  <div className="space-y-1.5">
                    {fieldEditorDraft.options.map((opt, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/optionIdx", String(i)); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = Number(e.dataTransfer.getData("text/optionIdx"));
                          if (from === i) return;
                          setFieldEditorDraft((d) => {
                            const opts = [...d.options];
                            const [item] = opts.splice(from, 1);
                            opts.splice(i, 0, item);
                            return { ...d, options: opts };
                          });
                        }}
                        className="flex items-center gap-2 bg-[#F8F6F0] rounded px-2 py-1.5 border border-[#EFE8D8]"
                      >
                        <span className="text-[#C4B99A] cursor-grab select-none text-sm">⠿</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFieldEditorDraft((d) => { const opts = [...d.options]; opts[i] = v; return { ...d, options: opts }; });
                          }}
                          className="flex-1 bg-transparent text-sm outline-none border-b border-[#D4C9B5] py-0.5 min-w-0"
                          placeholder={`Option ${i + 1}`}
                        />
                        <button type="button" onClick={() => setFieldEditorDraft((d) => ({ ...d, options: d.options.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 text-base leading-none px-1">×</button>
                      </div>
                    ))}
                    {fieldEditorDraft.options.length === 0 && <p className="text-xs text-[#8A9BB8] italic py-1">No options yet — click "+ Add option" above</p>}
                  </div>
                </div>
              )}
              <div className="space-y-2 rounded border border-[#EFE8D8] bg-[#F8F6F0] px-3 py-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={fieldEditorDraft.interviewMode === "omitted"} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, interviewMode: e.target.checked ? "omitted" : "optional" }))} className="rounded" />
                  <span className="text-sm">Omit from interview</span>
                </label>
                {fieldEditorDraft.interviewMode !== "omitted" && (
                  <div>
                    <label className="block text-xs text-[#6B7A99] mb-1">Interview behavior</label>
                    <select value={fieldEditorDraft.interviewMode} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, interviewMode: e.target.value as FieldInterviewMode }))} className="w-full border border-[#D4C9B5] rounded px-2 py-1.5 text-xs bg-white">
                      <option value="optional">Optional — staff fills in during interview</option>
                      <option value="required">Required — must answer before generating</option>
                      <option value="readonly">Read only — shown but not editable</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={fieldEditorDraft.hasDefault} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, hasDefault: e.target.checked }))} className="rounded" />
                  <span className="text-sm">Set a default value</span>
                </label>
                {fieldEditorDraft.hasDefault && (
                  <Input placeholder="Default value" value={fieldEditorDraft.defaultValue} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, defaultValue: e.target.value }))} />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7A99] mb-1">Validation format</label>
                <select value={fieldEditorDraft.validationType ?? "none"} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, validationType: e.target.value as FieldItem["validationType"] }))} className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm bg-white">
                  <option value="none">No format rule</option>
                  <option value="string">String (any text)</option>
                  <option value="name">Name</option>
                  <option value="number">Number</option>
                  <option value="currency">Currency ($)</option>
                  <option value="percent">Percent (0–100)</option>
                  <option value="email">Email address</option>
                  <option value="phone">Phone</option>
                  <option value="date">Date</option>
                  <option value="time">Time (HH:MM AM/PM)</option>
                  <option value="zip">ZIP code (5 digits)</option>
                  <option value="zip4">US ZIP+4 (12345-6789)</option>
                  <option value="ssn">SSN (###-##-####)</option>
                  <option value="custom">Custom pattern</option>
                </select>
                {fieldEditorDraft.validationType === "custom" && (
                  <Input className="mt-2 text-sm" placeholder="Regex pattern, e.g. ^[A-Z]{2}$" value={fieldEditorDraft.validationPattern} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, validationPattern: e.target.value }))} />
                )}
              </div>
              {fieldEditorModal.mode === "add" && (
                <label className="flex items-center gap-2 rounded border border-[#DDD5C4] bg-[#F8F6F0] px-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={fieldEditorDraft.packageOnly} onChange={(e) => setFieldEditorDraft((d) => ({ ...d, packageOnly: e.target.checked }))} className="rounded" />
                  <span className="text-sm text-[#6B7A99]">Package only — don't save to shared library</span>
                </label>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#DDD5C4] flex items-center justify-between gap-2">
              {fieldEditorModal.mode === "edit" && fieldEditorModal.fieldId && (
                <button type="button" onClick={() => { removeField(fieldEditorModal.fieldId!); setFieldEditorModal(null); }} className="text-xs text-red-600 hover:underline">Remove field</button>
              )}
              <div className="flex gap-2 ml-auto">
                <button type="button" onClick={() => setFieldEditorModal(null)} className="text-sm px-4 py-2 rounded border border-[#D4C9B5] text-[#6B7A99] hover:bg-[#F8F6F0]">Cancel</button>
                <button type="button" onClick={saveFieldFromModal} className="text-sm px-4 py-2 rounded bg-[#C49A38] hover:bg-[#b58c31] text-black font-medium">
                  {fieldEditorModal.mode === "add" ? "Add Field" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
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
  docufillApiPath,
  previewCache,
  previewCacheOrder,
  onSelect,
  previewHeight = "h-28",
}: {
  packageId: number;
  doc: DocItem;
  order: number;
  selected: boolean;
  getAuthHeaders: () => HeadersInit;
  docufillApiPath: string;
  previewCache: { current: Record<string, string> };
  previewCacheOrder: { current: string[] };
  onSelect: () => void;
  previewHeight?: string;
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
    fetch(`${API_BASE}${docufillApiPath}/packages/${packageId}/documents/${doc.id}.pdf`, { headers: { ...getAuthHeaders() } })
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
      className={`relative w-full ${previewHeight} overflow-hidden rounded border bg-[#F8F6F0] text-left focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 ${selected ? "border-[#C49A38]" : "border-[#DDD5C4]"}`}
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
  onAdd: () => Promise<string | null>;
  onChange: (id: number, patch: Partial<Entity>) => void;
  onSave: (item: Entity) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: Entity) {
    setSavingId(item.id);
    setPanelError(null);
    setSavedId(null);
    const err = await onSave(item);
    setSavingId(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
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
              <button
                type="button"
                onClick={() => handleSave(item)}
                disabled={savingId === item.id}
                className="text-[11px] text-[#C49A38] disabled:opacity-50"
              >
                {savingId === item.id ? "Saving…" : savedId === item.id ? "✓ Saved" : "Save"}
              </button>
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
  onAdd: () => Promise<string | null>;
  onChange: (scope: string, patch: Partial<TransactionType>) => void;
  onSave: (item: TransactionType) => Promise<string | null>;
}) {
  const [adding, setAdding] = useState(false);
  const [savingScope, setSavingScope] = useState<string | null>(null);
  const [savedScope, setSavedScope] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: TransactionType) {
    setSavingScope(item.scope);
    setPanelError(null);
    setSavedScope(null);
    const err = await onSave(item);
    setSavingScope(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedScope(item.scope);
      setTimeout(() => setSavedScope(null), 2000);
    }
  }

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Transaction Types</h3>
          <p className="text-[11px] text-[#8A9BB8]">Manage the active workflows available to packages and interview launchers.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
      <div className="grid md:grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <div key={item.scope} className="rounded bg-[#F8F6F0] border border-[#EFE8D8] p-2 space-y-2">
            <Input value={item.label} onChange={(e) => onChange(item.scope, { label: e.target.value })} className="h-8 text-xs bg-white" />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[11px] text-[#6B7A99]">
                <input type="checkbox" checked={item.active} onChange={(e) => onChange(item.scope, { active: e.target.checked })} />
                Active
              </label>
              <button
                type="button"
                onClick={() => handleSave(item)}
                disabled={savingScope === item.scope}
                className="text-[11px] text-[#C49A38] disabled:opacity-50"
              >
                {savingScope === item.scope ? "Saving…" : savedScope === item.scope ? "✓ Saved" : "Save"}
              </button>
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
  onAdd: () => Promise<string | null>;
  onChange: (id: string, patch: Partial<FieldLibraryItem>) => void;
  onSave: (item: FieldLibraryItem) => Promise<string | null>;
  onUse: (item: FieldLibraryItem) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  async function handleAdd() {
    setAdding(true);
    setPanelError(null);
    const err = await onAdd();
    setAdding(false);
    if (err) setPanelError(err);
  }

  async function handleSave(item: FieldLibraryItem) {
    setSavingId(item.id);
    setPanelError(null);
    setSavedId(null);
    const err = await onSave(item);
    setSavingId(null);
    if (err) {
      setPanelError(err);
    } else {
      setSavedId(item.id);
      setTimeout(() => setSavedId(null), 2000);
    }
  }

  return (
    <div className="border border-[#DDD5C4] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Shared Field Library</h3>
          <p className="text-[11px] text-[#8A9BB8]">Define common customer, IRA, beneficiary, and signature fields once, then reuse them in custodian packages.</p>
        </div>
        <button type="button" onClick={handleAdd} disabled={adding} className="text-xs text-[#C49A38] disabled:opacity-50">
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {panelError && <div className="mb-2 rounded bg-red-50 border border-red-200 text-red-700 px-2 py-1 text-[11px]">{panelError}</div>}
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
                <button type="button" onClick={() => onUse(item)} className="text-[11px] text-[#6B7A99]">Use in package</button>
                <button
                  type="button"
                  onClick={() => handleSave(item)}
                  disabled={savingId === item.id}
                  className="text-[11px] text-[#C49A38] disabled:opacity-50"
                >
                  {savingId === item.id ? "Saving…" : savedId === item.id ? "✓ Saved" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-[#8A9BB8]">No shared fields yet.</div>}
      </div>
    </div>
  );
}
