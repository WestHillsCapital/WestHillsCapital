import { type FieldItem } from "@/lib/docufill-types";
import { fieldFormatHint } from "@/lib/validateField";

export function validationTypeHint(vt: FieldItem["validationType"], message?: string): string {
  return fieldFormatHint(vt, message) ?? "Any text";
}

export function validateCellValue(field: FieldItem, value: string): "ok" | "empty-required" | "invalid" {
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

export function tryReformatDate(v: string): string | null {
  if (!v) return null;
  const slashMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = slashMatch[1].padStart(2, "0");
    const d = slashMatch[2].padStart(2, "0");
    return `${m}/${d}/${slashMatch[3]}`;
  }
  const slashShortMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShortMatch) {
    const m = slashShortMatch[1].padStart(2, "0");
    const d = slashShortMatch[2].padStart(2, "0");
    const yr = parseInt(slashShortMatch[3], 10);
    const y = yr <= 30 ? `20${slashShortMatch[3].padStart(2, "0")}` : `19${slashShortMatch[3].padStart(2, "0")}`;
    return `${m}/${d}/${y}`;
  }
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
  const dashMatch = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const m = dashMatch[1].padStart(2, "0");
    const d = dashMatch[2].padStart(2, "0");
    return `${m}/${d}/${dashMatch[3]}`;
  }
  const isoSlashMatch = v.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (isoSlashMatch) return `${isoSlashMatch[2]}/${isoSlashMatch[3]}/${isoSlashMatch[1]}`;
  return null;
}

export function tryAutoFix(field: FieldItem, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (field.type === "date") return tryReformatDate(v);
  const vt = field.validationType;
  if (vt === "date") return tryReformatDate(v);
  if (vt === "phone") {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length === 11 && digits[0] === "1") return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return null;
  }
  if (vt === "ssn") {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 9) return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    return null;
  }
  if (vt === "zip") {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 5) return digits;
    if (digits.length >= 5) return digits.slice(0, 5);
    return null;
  }
  if (vt === "zip4") {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return null;
  }
  if (vt === "currency") {
    const cleaned = v.replace(/[$,\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num.toFixed(2);
    return null;
  }
  if (vt === "number") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return String(num);
    return null;
  }
  if (vt === "percent") {
    const cleaned = v.replace(/[%\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0 && num <= 100) return String(num);
    return null;
  }
  return null;
}

export function autoFixLabel(field: FieldItem): string | null {
  if (field.type === "date") return "→ MM/DD/YYYY";
  const vt = field.validationType;
  if (vt === "date")     return "→ MM/DD/YYYY";
  if (vt === "phone")    return "→ (XXX) XXX-XXXX";
  if (vt === "ssn")      return "→ XXX-XX-XXXX";
  if (vt === "zip")      return "→ 5-digit ZIP";
  if (vt === "zip4")     return "→ XXXXX-XXXX";
  if (vt === "currency") return "→ 0.00";
  if (vt === "number")   return "→ number";
  if (vt === "percent")  return "→ 0–100";
  return null;
}
