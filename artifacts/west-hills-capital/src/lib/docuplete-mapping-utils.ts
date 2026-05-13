import { type FieldItem, type MappingFormat, type MappingItem } from "@/lib/docuplete-types";
import { ESIGN_FIELD_ID_INITIALS, ESIGN_FIELD_ID_SIGNATURE } from "@/lib/docuplete-redaction";

export const MAPPING_FORMAT_OPTIONS: Array<{ value: MappingFormat; label: string; group: string }> = [
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
  { value: "signature", label: "Drawn / typed signature", group: "Signature" },
];

export const NAME_MAPPING_FORMATS: MappingFormat[] = [
  "first-name", "middle-name", "last-name", "last-first-m", "first-last", "initials",
];

export function labelForMappingFormat(format: MappingFormat | string | undefined) {
  const fmt = format ?? "as-entered";
  if (fmt.startsWith("checkbox-option:")) return `Option: ${fmt.slice("checkbox-option:".length).trim()}`;
  return MAPPING_FORMAT_OPTIONS.find((option) => option.value === fmt)?.label ?? "Whole answer";
}

export function inferFieldCategory(field: FieldItem): "name" | "first" | "last" | "address" | "city" | "state" | "zip" | "phone" | "email" | "ssn" | "dob" | "account" | "relationship" | "share" | "date" | "signature" | "general" {
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

export function sampleValueForMapping(field: FieldItem | undefined, format: MappingFormat | string | undefined): string {
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
  if (fmt === "signature") return "~ Signature ~";

  const isUpper = fmt === "uppercase";
  const isLower = fmt === "lowercase";
  const cat = inferFieldCategory(field);
  if (cat === "first") return isUpper ? "ALICE" : isLower ? "alice" : "Alice";
  if (cat === "last") return isUpper ? "SMITH" : isLower ? "smith" : "Smith";
  if (cat === "name" || cat === "signature") return isUpper ? "ALICE B. SMITH" : isLower ? "alice b. smith" : "Alice B. Smith";
  if (cat === "address") return "123 Main St";
  if (cat === "city") return "City";
  if (cat === "state") return "State";
  if (cat === "zip") return "00000";
  if (cat === "phone") return "(555) 555-1234";
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

export function mappingFormatOptionsForField(field: FieldItem | undefined): Array<{ value: MappingFormat; label: string; group: string }> {
  if (!field) return MAPPING_FORMAT_OPTIONS;
  const vt = field.validationType ?? "none";
  const type = field.type;
  const cat = inferFieldCategory(field);
  if (cat === "signature") return MAPPING_FORMAT_OPTIONS.filter((o) => o.group === "Signature" || o.group === "Name" || o.group === "Text");
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

export function clampPercent(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function defaultMappingFormat(field: FieldItem): MappingItem["format"] {
  if (field.id === ESIGN_FIELD_ID_INITIALS || field.type === "initials") return "initials";
  if (field.id === ESIGN_FIELD_ID_SIGNATURE) return "signature";
  if (inferFieldCategory(field) === "signature") return "signature";
  if (field.validationType === "currency") return "currency";
  if (field.validationType === "number") return "digits-only";
  if (field.validationType === "date" || field.type === "date") return "date-mm-dd-yyyy";
  if ((field.type === "radio" || field.type === "checkbox") && field.options && field.options.length > 0) return `checkbox-option:${field.options[0]}`;
  if (field.type === "checkbox") return "checkbox-yes";
  return "as-entered";
}
