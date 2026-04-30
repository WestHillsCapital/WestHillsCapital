// E-Sign system field IDs (fixed, permanent — must match API server constants)
export const ESIGN_FIELD_ID_SIGNATURE  = "__signature__" as const;
export const ESIGN_FIELD_ID_INITIALS   = "__initials__" as const;
export const ESIGN_FIELD_ID_DATE       = "__signer_date__" as const;

export const SYSTEM_ESIGN_FIELD_IDS = [
  ESIGN_FIELD_ID_SIGNATURE,
  ESIGN_FIELD_ID_INITIALS,
  ESIGN_FIELD_ID_DATE,
] as const;

export function isSystemEsignFieldId(id: string): boolean {
  return (SYSTEM_ESIGN_FIELD_IDS as readonly string[]).includes(id);
}

export type DocuFillRedactionField = {
  name: string;
  source: string;
  sensitive: boolean;
};

const SENSITIVE_PREFILL_PATTERN = /\b(ssn|social\s*security|dob|date\s*of\s*birth|tax\s*id|tin|ein|account\s*number|routing|bank\s*account|passport|driver.?s?\s*license)\b/i;

export function maskSensitiveValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const visible = text.replace(/\s+/g, "").length > 4 ? text.slice(-4) : "";
  return visible ? `••••${visible}` : "••••";
}

export function isSensitivePrefillKey(key: string, fields: DocuFillRedactionField[]) {
  if (SENSITIVE_PREFILL_PATTERN.test(key)) return true;
  return fields.some((field) => field.sensitive && [field.source, field.name].includes(key));
}

export function getDocuFillPrefillDisplayValue(key: string, value: unknown, fields: DocuFillRedactionField[]) {
  return isSensitivePrefillKey(key, fields) ? maskSensitiveValue(value) : String(value);
}