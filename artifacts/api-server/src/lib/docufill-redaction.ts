export type DocuFillFieldItem = {
  id: string;
  libraryFieldId?: string;
  name?: string;
  label?: string;
  category?: string;
  type?: string;
  options?: unknown[];
  optionsMode?: "inherit" | "override";
  source?: string;
  defaultValue?: unknown;
  sensitive?: boolean;
  interviewVisible?: boolean;
  required?: boolean;
  validationType?: "none" | "name" | "number" | "currency" | "email" | "phone" | "date" | "ssn" | "custom";
  validationPattern?: string;
  validationMessage?: string;
};

export type DocuFillMappingFormat =
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

export type DocuFillMappingItem = {
  format?: DocuFillMappingFormat | string;
};

export type DocuFillPacketSummary = {
  packageName: unknown;
  packageVersion: unknown;
  custodian: unknown;
  depository: unknown;
  documentCount: number;
  mappingCount: number;
  sensitiveFieldCount: number;
  valuePolicy: string;
  sourceDocuments: Array<{
    documentId: string;
    title: string;
    fileName?: string;
    pages: number;
    byteSize?: number;
  }>;
  generatedAt: string;
};

type DocItem = {
  id: string;
  title: string;
  pages: number;
  fileName?: string;
  byteSize?: number;
  pdfStored?: boolean;
};

type SummaryRow = {
  key: string;
  label: string;
  displayValue: string;
  sensitive: boolean;
};

const SENSITIVE_KEY_PATTERN = /\b(ssn|social\s*security|dob|date\s*of\s*birth|tax\s*id|tin|ein|account\s*number|routing|bank\s*account|passport|driver.?s?\s*license)\b/i;

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parseDocuments(value: unknown): DocItem[] {
  return Array.isArray(value) ? value.filter((item): item is DocItem => {
    return Boolean(item && typeof item === "object" && typeof (item as DocItem).id === "string");
  }) : [];
}

export function parseDocuFillFields(value: unknown): DocuFillFieldItem[] {
  return Array.isArray(value) ? value.filter((item): item is DocuFillFieldItem => {
    return Boolean(item && typeof item === "object" && typeof (item as DocuFillFieldItem).id === "string");
  }) : [];
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function combineNameParts(prefill: Record<string, unknown>): string {
  const first = cleanText(prefill.firstName);
  const last = cleanText(prefill.lastName);
  return [first, last].filter(Boolean).join(" ");
}

function normalizeValidationType(value: unknown): DocuFillFieldItem["validationType"] {
  const text = cleanText(value);
  const valid = new Set(["none", "name", "number", "currency", "email", "phone", "date", "ssn", "custom"]);
  return valid.has(text) ? text as DocuFillFieldItem["validationType"] : "none";
}

export function hydratePackageFields(fields: unknown, library: Array<Record<string, unknown> & { id: string }>): DocuFillFieldItem[] {
  const byId = new Map(library.map((field) => [field.id, field]));
  return parseDocuFillFields(fields).map((field) => {
    const rawLibraryId = cleanText(field.libraryFieldId) || cleanText((field as Record<string, unknown>).library_field_id);
    const libraryField = rawLibraryId ? byId.get(rawLibraryId) : undefined;
    if (!libraryField) return field;
    const hasPackageOptions = Array.isArray(field.options) && field.options.length > 0;
    const optionsMode = field.optionsMode === "override" || (!field.optionsMode && hasPackageOptions) ? "override" : "inherit";
    return {
      ...field,
      libraryFieldId: libraryField.id,
      optionsMode,
      name: String(libraryField.label ?? field.name ?? ""),
      label: String(libraryField.label ?? field.label ?? ""),
      category: String(libraryField.category ?? field.category ?? ""),
      type: String(libraryField.type ?? field.type ?? "text"),
      source: String(libraryField.source ?? field.source ?? "interview"),
      options: optionsMode === "inherit" ? Array.isArray(libraryField.options) ? libraryField.options : [] : Array.isArray(field.options) ? field.options : [],
      sensitive: libraryField.sensitive === true,
      required: libraryField.required === true,
      validationType: normalizeValidationType(libraryField.validationType ?? field.validationType),
      validationPattern: cleanText(libraryField.validationPattern),
      validationMessage: cleanText(libraryField.validationMessage),
    };
  });
}

export function isSensitiveField(field: DocuFillFieldItem): boolean {
  if (field.sensitive === true) return true;
  return [field.name, field.label, field.source].some((value) => typeof value === "string" && SENSITIVE_KEY_PATTERN.test(value));
}

export function maskSensitiveValue(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const visible = text.replace(/\s+/g, "").length > 4 ? text.slice(-4) : "";
  return visible ? `••••${visible}` : "••••";
}

export function sensitivePrefillKeys(fields: DocuFillFieldItem[], prefill: Record<string, unknown>): Set<string> {
  const keys = new Set<string>();
  fields.filter(isSensitiveField).forEach((field) => {
    [field.source, field.name, field.label].forEach((candidate) => {
      if (typeof candidate === "string" && candidate.trim()) keys.add(candidate);
    });
  });
  Object.keys(prefill).forEach((key) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) keys.add(key);
  });
  return keys;
}

export function fieldAnswerValue(field: DocuFillFieldItem, answers: Record<string, unknown>, prefill: Record<string, unknown>): string {
  const synthesizedName = field.source === "clientName" || field.source === "fullName" || field.source === "name" ? combineNameParts(prefill) : "";
  const candidates = [
    answers[field.id],
    field.source ? prefill[field.source] : undefined,
    field.name ? prefill[field.name] : undefined,
    field.label ? prefill[field.label] : undefined,
    synthesizedName,
    field.defaultValue,
  ];
  const value = candidates.find((candidate) => candidate !== undefined && candidate !== null && String(candidate).trim() !== "");
  return value === undefined || value === null ? "" : String(value);
}

export function formatDocuFillMappedValue(value: string, mapping: DocuFillMappingItem): string {
  const format = String(mapping.format ?? "as-entered");
  const text = String(value ?? "").trim();
  if (!text) return "";
  const nameParts = text.split(/\s+/).filter(Boolean);
  if (format === "uppercase") return text.toUpperCase();
  if (format === "lowercase") return text.toLowerCase();
  if (format === "first-name") return nameParts[0] ?? text;
  if (format === "middle-name") return nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
  if (format === "last-name") return nameParts.length > 1 ? nameParts[nameParts.length - 1] : text;
  if (format === "first-last") return nameParts.length > 1 ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}` : text;
  if (format === "initials") return nameParts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  if (format === "digits-only") return text.replace(/\D+/g, "");
  if (format === "last-four") return text.replace(/\D+/g, "").slice(-4);
  if (format === "currency") {
    const numeric = Number(text.replace(/[$,]/g, ""));
    return Number.isFinite(numeric) ? numeric.toLocaleString("en-US", { style: "currency", currency: "USD" }) : text;
  }
  if (format === "date-mm-dd-yyyy") {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const yyyy = String(date.getUTCFullYear());
      return `${mm}/${dd}/${yyyy}`;
    }
  }
  if (format === "checkbox-yes") return /^(true|yes|y|1|checked)$/i.test(text) ? "X" : "";
  return text;
}

export function buildDocuFillPacketSummary(session: Record<string, unknown>, generatedAt = new Date().toISOString()): DocuFillPacketSummary {
  const documents = parseDocuments(session.documents);
  const fields = parseDocuFillFields(session.fields);
  const mappings = Array.isArray(session.mappings) ? session.mappings : [];
  return {
    packageName: session.package_name,
    packageVersion: session.package_version,
    custodian: session.custodian_name,
    depository: session.depository_name,
    documentCount: documents.length,
    mappingCount: mappings.length,
    sensitiveFieldCount: fields.filter(isSensitiveField).length,
    valuePolicy: "Sensitive answers are omitted from generated summaries and only applied to mapped packet fields.",
    sourceDocuments: documents.filter((doc) => doc.pdfStored).map((doc) => ({
      documentId: doc.id,
      title: doc.title,
      fileName: doc.fileName,
      pages: doc.pages,
      byteSize: doc.byteSize,
    })),
    generatedAt,
  };
}

export function buildDocuFillFallbackSummaryRows(session: Record<string, unknown>): { prefillRows: SummaryRow[]; answerRows: SummaryRow[] } {
  const answers = getRecord(session.answers);
  const prefill = getRecord(session.prefill);
  const fields = parseDocuFillFields(session.fields);
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const sensitivePrefill = sensitivePrefillKeys(fields, prefill);
  const prefillRows = Object.entries(prefill).map(([key, value]) => {
    const sensitive = sensitivePrefill.has(key);
    return {
      key,
      label: key,
      displayValue: sensitive ? maskSensitiveValue(value) : String(value ?? ""),
      sensitive,
    };
  });
  const answerRows = Object.entries(answers).map(([key, value]) => {
    const field = fieldsById.get(key);
    const sensitive = field ? isSensitiveField(field) : false;
    return {
      key,
      label: field?.name || field?.label || key,
      displayValue: sensitive ? maskSensitiveValue(value) : String(value ?? ""),
      sensitive,
    };
  });
  return { prefillRows, answerRows };
}