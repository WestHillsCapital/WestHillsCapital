export function fieldFormatHint(vt: string | undefined, message?: string): string | null {
  switch (vt) {
    case "phone":    return "555-123-4567";
    case "ssn":      return "XXX-XX-XXXX";
    case "email":    return "user@example.com";
    case "currency": return "1234.56";
    case "number":   return "Numeric value";
    case "date":     return "MM/DD/YYYY";
    case "time":     return "HH:MM";
    case "zip":      return "12345";
    case "zip4":     return "12345-6789";
    case "percent":  return "0–100";
    case "name":     return "Text (name format)";
    case "custom":   return message && message.trim() ? message.trim() : "Custom format";
    default:         return null;
  }
}

export type ValidatableField = {
  id?: string;
  name?: string;
  interviewMode?: string;
  required?: boolean;
  interviewVisible?: boolean;
  validationType?: string;
  validationPattern?: string;
  validationMessage?: string;
};

function isRequired(field: ValidatableField): boolean {
  if (field.interviewMode) return field.interviewMode === "required";
  return field.required === true && field.interviewVisible !== false;
}

export function validateFieldValue(field: ValidatableField, value: string): string | null {
  const trimmed = value.trim();
  const label = field.name ?? field.id ?? "This field";

  if (!trimmed) {
    return isRequired(field) ? `${label} is required.` : null;
  }

  const vt = field.validationType ?? "none";

  if (vt === "none" || vt === "string") return null;

  if (vt === "name") {
    return /^[a-z ,.'-]+$/i.test(trimmed)
      ? null
      : field.validationMessage || `${label} must be a valid name.`;
  }
  if (vt === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ? null
      : field.validationMessage || `${label} must be a valid email address.`;
  }
  if (vt === "phone") {
    return trimmed.replace(/\D+/g, "").length >= 10
      ? null
      : field.validationMessage || `${label} must be a valid phone number.`;
  }
  if (vt === "number") {
    return !Number.isNaN(Number(trimmed.replace(/,/g, "")))
      ? null
      : field.validationMessage || `${label} must be a number.`;
  }
  if (vt === "currency") {
    return !Number.isNaN(Number(trimmed.replace(/[$,]/g, "")))
      ? null
      : field.validationMessage || `${label} must be a currency amount.`;
  }
  if (vt === "percent") {
    const n = Number(trimmed.replace(/%/g, ""));
    return !Number.isNaN(n) && n >= 0 && n <= 100
      ? null
      : field.validationMessage || `${label} must be a percent between 0 and 100.`;
  }
  if (vt === "date") {
    return !Number.isNaN(new Date(trimmed).getTime())
      ? null
      : field.validationMessage || `${label} must be a valid date.`;
  }
  if (vt === "time") {
    return /^([01]?\d|2[0-3]):[0-5]\d(\s?(AM|PM))?$/i.test(trimmed)
      ? null
      : field.validationMessage || `${label} must be a valid time (e.g. 2:30 PM).`;
  }
  if (vt === "zip") {
    return /^\d{5}$/.test(trimmed.replace(/\s/g, ""))
      ? null
      : field.validationMessage || `${label} must be a 5-digit ZIP code.`;
  }
  if (vt === "zip4") {
    return /^\d{5}-\d{4}$/.test(trimmed.replace(/\s/g, ""))
      ? null
      : field.validationMessage || `${label} must be ZIP+4 format (12345-6789).`;
  }
  if (vt === "ssn") {
    return /^\d{3}-?\d{2}-?\d{4}$/.test(trimmed)
      ? null
      : field.validationMessage || `${label} must be a valid SSN format.`;
  }
  if (vt === "custom" && field.validationPattern) {
    try {
      return new RegExp(field.validationPattern).test(trimmed)
        ? null
        : field.validationMessage || `${label} is not in the expected format.`;
    } catch {
      return field.validationMessage || `${label} has an invalid validation pattern.`;
    }
  }

  return null;
}
