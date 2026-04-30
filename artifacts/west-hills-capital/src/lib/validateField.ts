/**
 * Given the raw value typed into a sensitive (password) field and its validationType,
 * returns a masked preview string where every digit is replaced with "•" but separator
 * characters (hyphens, slashes) are preserved at their expected positions.
 *
 * Returns null for unknown types or types whose format carries no structural separators.
 * Note: "date" is deliberately excluded here — it is handled by MaskedDateFormatGuide.
 *
 * Examples:
 *   buildSensitiveMask("123456789",  "ssn")   → "•••-••-••••"
 *   buildSensitiveMask("123456789",  "zip4")  → "•••••-••••"
 *   buildSensitiveMask("1234567890", "phone") → "•••-•••-••••"
 *   buildSensitiveMask("12345",      "zip")   → "•••••"
 */
export function buildSensitiveMask(value: string, validationType: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;

  switch (validationType) {
    case "ssn": {
      // NNN-NN-NNNN
      const d = digits.slice(0, 9);
      let out = "";
      for (let i = 0; i < d.length; i++) {
        if (i === 3 || i === 5) out += "-";
        out += "•";
      }
      return out;
    }
    case "zip": {
      return "•".repeat(Math.min(digits.length, 5));
    }
    case "zip4": {
      // NNNNN-NNNN
      const d = digits.slice(0, 9);
      let out = "";
      for (let i = 0; i < d.length; i++) {
        if (i === 5) out += "-";
        out += "•";
      }
      return out;
    }
    case "phone": {
      // NNN-NNN-NNNN
      const d = digits.slice(0, 10);
      let out = "";
      for (let i = 0; i < d.length; i++) {
        if (i === 3 || i === 6) out += "-";
        out += "•";
      }
      return out;
    }
    default:
      return null;
  }
}

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
    // Strict MM/DD/YYYY check — new Date() is far too permissive (e.g. accepts ".........-")
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      return field.validationMessage || `${label} must be a valid date.`;
    }
    const [m, d, y] = trimmed.split("/").map(Number);
    const dt = new Date(y, m - 1, d);
    return (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d)
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
  if (vt === "state") {
    const US_STATE_CODES = new Set([
      "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
      "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
      "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
      "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
      "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
      "DC","PR","GU","VI","AS","MP",
    ]);
    return US_STATE_CODES.has(trimmed.toUpperCase())
      ? null
      : field.validationMessage || `${label} must be a 2-letter US state code (e.g. KS, TX).`;
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
