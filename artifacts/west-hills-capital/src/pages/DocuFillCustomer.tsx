import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateFieldValue, fieldFormatHint, buildSensitiveMask } from "@/lib/validateField";
import { ESIGN_FIELD_ID_SIGNATURE, ESIGN_FIELD_ID_INITIALS, ESIGN_FIELD_ID_DATE } from "@/lib/docufill-redaction";
import SignaturePad, { type SignaturePadRef } from "@/components/SignaturePad";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SESSION_BASE = `${API_BASE}/api/v1/docufill/public/sessions`;

/** Turn camelCase / snake_case keys into readable labels: "firstName" → "First Name" */
function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type FieldInterviewMode = "required" | "optional" | "readonly" | "omitted";

type FieldCondition = {
  fieldId: string;
  operator: "equals" | "not_equals" | "is_answered" | "is_not_answered";
  value: string;
};

type FieldItem = {
  id: string;
  name: string;
  color: string;
  type: "text" | "date" | "radio" | "checkbox" | "dropdown" | "initials";
  interviewMode: FieldInterviewMode;
  options?: string[];
  sensitive?: boolean;
  defaultValue?: string;
  validationType?: string;
  validationPattern?: string;
  validationMessage?: string;
  condition?: FieldCondition | null;
};

type SessionData = {
  token: string;
  package_name: string;
  custodian_name: string | null;
  depository_name: string | null;
  fields: FieldItem[];
  prefill: Record<string, string>;
  answers: Record<string, string>;
  status: string;
  org_name?: string | null;
  org_logo_url?: string | null;
  org_brand_color?: string | null;
  auth_level?: "none" | "email_otp";
  signed_at?: string | null;
  signer_name?: string | null;
};

type EsignStep = "email" | "code" | "initials" | "consent";

function fieldIsRequired(field: FieldItem): boolean {
  return field.interviewMode === "required";
}

function evaluateCondition(
  condition: FieldCondition | null | undefined,
  answers: Record<string, string>,
): boolean {
  if (!condition || !condition.fieldId) return true;
  const triggerValue = (answers[condition.fieldId] ?? "").trim();
  switch (condition.operator) {
    case "equals":         return triggerValue.toLowerCase() === (condition.value ?? "").toLowerCase();
    case "not_equals":     return triggerValue.toLowerCase() !== (condition.value ?? "").toLowerCase();
    case "is_answered":    return triggerValue !== "";
    case "is_not_answered": return triggerValue === "";
    default:               return true;
  }
}

function currentValue(field: FieldItem, answers: Record<string, string>, prefill: Record<string, string>): string {
  const ans = answers[field.id];
  if (ans !== undefined) return ans;

  // Check prefill for all field modes (not just readonly)
  const fieldNameLower = field.name.toLowerCase();
  const prefillKey = Object.keys(prefill).find((k) => k.toLowerCase() === fieldNameLower);
  if (prefillKey) return String(prefill[prefillKey] ?? "");

  // Name-combination fallback: if the field looks like a full-name field
  // (contains "name" but not "first" or "last"), join firstName + lastName
  if (
    fieldNameLower.includes("name") &&
    !fieldNameLower.includes("first") &&
    !fieldNameLower.includes("last") &&
    (prefill.firstName || prefill.lastName)
  ) {
    return [prefill.firstName, prefill.lastName].filter(Boolean).join(" ");
  }

  if (field.interviewMode === "readonly") {
    return String(field.defaultValue ?? "");
  }

  return "";
}

function CheckIcon() {
  return (
    <svg className="w-16 h-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Masked date format guide ─────────────────────────────────────────────────
// Only rendered for fields that are both sensitive AND have validationType="date"
// (e.g. date-of-birth). The input is type="password" so the signer can't see
// what they typed — this guide gives character-level format feedback without
// revealing any actual digits.

const DATE_TEMPLATE = "MM/DD/YYYY";
const DATE_SEPARATOR_POSITIONS = new Set([2, 5]);

function MaskedDateFormatGuide({ value, field }: { value: string; field: { validationType?: string; validationMessage?: string } }) {
  const isComplete = value.length >= 10;
  const isValid = isComplete && validateFieldValue({ ...field, interviewMode: "optional" }, value) === null;

  if (isValid) {
    return (
      <div className="mt-1.5 flex items-center gap-1 text-xs text-green-600" aria-hidden>
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <span className="font-medium">Valid date</span>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex gap-px font-mono text-xs leading-none select-none" aria-hidden>
      {Array.from(DATE_TEMPLATE).map((templateChar, i) => {
        const isSep = DATE_SEPARATOR_POSITIONS.has(i);
        const inputChar = value[i];
        if (!inputChar) {
          return (
            <span key={i} className={isSep ? "text-[#8A9BB8]" : "text-[#B8C4D8]"}>
              {templateChar}
            </span>
          );
        }
        const isCorrect = isSep ? inputChar === "/" : /\d/.test(inputChar);
        return (
          <span key={i} className={isCorrect ? "text-green-600" : "text-red-500"}>
            {isSep ? inputChar : "•"}
          </span>
        );
      })}
    </div>
  );
}

// ─── Sensitive format ghost ────────────────────────────────────────────────────
// Shown below any sensitive password input (except date, which uses
// MaskedDateFormatGuide) when the signer has focus or has typed a value.
// Replaces the static "Format:" hint for ssn / zip / zip4 / phone.

function SensitiveFormatGhost({ value, validationType }: { value: string; validationType: string }) {
  const mask = buildSensitiveMask(value, validationType);
  if (!mask) return null;
  return (
    <div className="mt-1.5 font-mono text-xs text-[#8A9BB8] tracking-wide select-none" aria-hidden>
      {mask}
    </div>
  );
}

function useCountdown(target: Date | null): { secondsLeft: number; isExpired: boolean } {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!target) { setSecondsLeft(0); return; }
    const update = () => setSecondsLeft(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [target]);
  return { secondsLeft, isExpired: target !== null && secondsLeft === 0 };
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Returns a foreground color (dark or white) that stays readable on any brand background hex. */
function getBrandTextColor(hex: string): string {
  try {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.6 ? "#0F1C3F" : "#ffffff";
  } catch { return "#ffffff"; }
}

/** True if the field represents the signer's hand-written/typed signature. */
function isEsignSignatureField(field: FieldItem): boolean {
  if (field.id === ESIGN_FIELD_ID_SIGNATURE) return true;
  const n = field.name.toLowerCase().trim();
  return n === "signature" || n.startsWith("signature ") || n.endsWith(" signature") || n.includes("signatur");
}

/** True if the field represents the date the document was signed. */
function isEsignDateField(field: FieldItem): boolean {
  if (field.id === ESIGN_FIELD_ID_DATE) return true;
  const n = field.name.toLowerCase().trim();
  return (
    n === "signer date" || n === "date signed" || n === "signing date" || n === "signature date" ||
    ((n.includes("signer") || n.includes("signed") || n.includes("signing") || n.includes("signature")) && n.includes("date"))
  );
}

/** Today's date formatted as MM/DD/YYYY (matches the standard Docuplete date format). */
function todayFormatted(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function DocuFillCustomer() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";

  const [session, setSession] = useState<SessionData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "expired" | "submitting" | "generated" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSavedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // E-sign flow state
  const [esignStep, setEsignStep] = useState<EsignStep | null>(null);
  const [signerEmail, setSignerEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [signerName, setSignerName] = useState("");
  const [sigMode, setSigMode] = useState<"type" | "draw">("draw");
  const [sigPadHasContent, setSigPadHasContent] = useState(false);
  const sigPadRef = useRef<SignaturePadRef>(null);
  const [identityToken, setIdentityToken] = useState<string | null>(null);
  // Initials step state
  const [initialsMode, setInitialsMode] = useState<"draw" | "type">("draw");
  const [typedInitials, setTypedInitials] = useState("");
  const [initPadHasContent, setInitPadHasContent] = useState(false);
  const initPadRef = useRef<SignaturePadRef>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<Date | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const { secondsLeft: expirySecondsLeft, isExpired: otpExpired } = useCountdown(otpExpiresAt);
  const { secondsLeft: cooldownSecondsLeft, isExpired: cooldownExpired } = useCountdown(otpCooldownUntil);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!isEmbed) return;
    const el = rootRef.current ?? document.documentElement;
    let lastHeight = 0;
    const send = () => {
      const h = el.scrollHeight;
      if (h !== lastHeight) {
        lastHeight = h;
        window.parent.postMessage({ type: "docuplete:resize", height: h }, "*");
      }
    };
    const ro = new ResizeObserver(send);
    ro.observe(el);
    send();
    return () => ro.disconnect();
  }, [isEmbed, pageStatus]);

  useEffect(() => {
    if (!token) { setPageStatus("expired"); return; }
    fetch(`${SESSION_BASE}/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.session) { setPageStatus("expired"); return; }
        const s: SessionData = data.session;
        if (s.status === "generated") {
          setSession(s);
          setDownloadUrl(`${SESSION_BASE}/${token}/packet.pdf`);
          setPageStatus("generated");
          return;
        }
        setSession(s);
        // Auto-populate signer-date fields with today's date if not already answered
        const initialAnswers: Record<string, string> = { ...(s.answers ?? {}) };
        (s.fields ?? []).forEach((f) => {
          if (isEsignDateField(f) && !initialAnswers[f.id]) {
            initialAnswers[f.id] = todayFormatted();
          }
        });
        setAnswers(initialAnswers);
        setPageStatus("ready");
      })
      .catch(() => setPageStatus("error"));
  }, [token]);

  // For email_otp packages: gate the interview behind identity verification.
  // Runs once when the session finishes loading — before the customer sees the form.
  useEffect(() => {
    if (pageStatus !== "ready" || !session || session.auth_level !== "email_otp" || identityToken) return;
    const prefillEmail = Object.entries(session.prefill ?? {})
      .find(([k]) => k.toLowerCase().includes("email"))?.[1]?.trim() ?? "";
    if (prefillEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefillEmail)) {
      setSignerEmail(prefillEmail);
      setEsignStep("code");
      void handleRequestOtp(prefillEmail);
    } else {
      setEsignStep("email");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageStatus]);

  function scheduleAutoSave(nextAnswers: Record<string, string>) {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      fetch(`${SESSION_BASE}/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: nextAnswers }),
      }).catch(() => {});
      hasSavedRef.current = true;
    }, 1200);
  }

  function updateAnswer(fieldId: string, value: string) {
    setAnswers((prev) => {
      const next = { ...prev, [fieldId]: value };
      scheduleAutoSave(next);
      return next;
    });
    setMissingFields((prev) => prev.filter((n) => n !== fieldId));
  }

  function handleFieldBlur(field: FieldItem, value: string) {
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

  // Initials fields are collected in their own e-sign step, not the interview form
  const initialsFields = (session?.fields ?? []).filter(
    // System __initials__ is always omitted from the interview form but must still trigger
    // the initials capture step. Legacy name-based initials fields are only included when
    // not explicitly omitted (preserving existing behaviour for non-e-sign packages).
    (f) => f.id === ESIGN_FIELD_ID_INITIALS || (f.type === "initials" && f.interviewMode !== "omitted"),
  );
  const hasInitialsStep = initialsFields.length > 0 && session?.auth_level === "email_otp";
  // Consent step only runs when at least one signature field exists in the package
  const hasSignatureStep = session?.auth_level === "email_otp" &&
    (session?.fields ?? []).some((f) => isEsignSignatureField(f));

  // Exclude initials from the interview form only when the dedicated e-sign initials step is active;
  // for non-email_otp sessions, initials are collected as regular text fields in the interview.
  const visibleFields = (session?.fields ?? []).filter(
    (f) =>
      f.interviewMode !== "omitted" &&
      !(hasInitialsStep && (f.type === "initials" || f.id === ESIGN_FIELD_ID_INITIALS)) &&
      // Signature fields are collected in the e-sign consent step — hide from interview
      !(session?.auth_level === "email_otp" && isEsignSignatureField(f)) &&
      evaluateCondition(f.condition, answers),
  );

  function validate(): boolean {
    if (!session) return false;
    const newErrors: Record<string, string> = {};
    const missing: string[] = [];
    for (const f of visibleFields) {
      if (f.interviewMode === "readonly") continue;
      if (isEsignDateField(f)) continue; // auto-filled — skip required check
      const val = currentValue(f, answers, session.prefill);
      const error = validateFieldValue(f, val);
      if (error) {
        newErrors[f.id] = error;
        if (fieldIsRequired(f) && !val.trim()) missing.push(f.id);
      }
    }
    setFieldErrors(newErrors);
    setMissingFields(missing);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRequestOtp(emailOverride?: string) {
    const email = (emailOverride !== undefined ? emailOverride : signerEmail).trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setOtpError("Please enter a valid email address.");
      if (!emailOverride) setEsignStep("email"); // fall back to email entry if auto-send failed
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(`${SESSION_BASE}/${token}/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Could not send verification code. Please try again.");
        setEsignStep("email"); // let them correct the email on failure
        return;
      }
      if (data.expiresAt)    setOtpExpiresAt(new Date(data.expiresAt as string));
      if (data.cooldownUntil) setOtpCooldownUntil(new Date(data.cooldownUntil as string));
      setOtpCode("");
      setEsignStep("code");
    } catch {
      setOtpError("A network error occurred. Please try again.");
      setEsignStep("email");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const code = otpCode.trim();
    if (!code) {
      setOtpError("Please enter the 6-digit code from your email.");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch(`${SESSION_BASE}/${token}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signerEmail.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Invalid or expired code. Please try again.");
        setOtpCode("");
        setTimeout(() => otpInputRef.current?.focus(), 0);
        return;
      }
      setIdentityToken(data.identityToken as string);
      setEsignStep(null); // identity confirmed — show the interview form
    } catch {
      setOtpError("A network error occurred. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  function handleInitialsContinue() {
    const value = initialsMode === "draw"
      ? (initPadRef.current?.getDataUrl() ?? "")
      : typedInitials.trim();
    if (initialsMode === "draw" ? !value : value.length < 2) return;
    const next = { ...answers };
    for (const f of initialsFields) {
      next[f.id] = value;
    }
    setAnswers(next);
    scheduleAutoSave(next);
    if (hasSignatureStep) {
      setEsignStep("consent");
    } else {
      // Initials done, no signature needed — go straight to generate
      void handleSubmit({ skipSigningSteps: true });
    }
  }

  async function handleSubmit(opts?: { skipSigningSteps?: boolean }) {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Identity was verified at page load — move to signing steps only if needed
    if (!opts?.skipSigningSteps && session?.auth_level === "email_otp" && (hasInitialsStep || hasSignatureStep)) {
      setEsignStep(hasInitialsStep ? "initials" : "consent");
      return;
    }
    // email_otp with no signature/initials fields (or called post-initials) falls through to generate
    setPageStatus("submitting");
    setErrorMsg("");
    try {
      // Auto-populate signature and date fields from the e-sign flow before final submit.
      // For signature fields: use signerName (the text representation of what was signed —
      // drawn signatures are overlaid separately by the PDF generator via signatureImage).
      // Fall back to any "full name" field from the interview if signerName wasn't collected.
      const finalAnswers = { ...answers };
      const fullNameFallback = (() => {
        if (signerName.trim()) return signerName.trim();
        const nameField = (session?.fields ?? []).find(
          (f) => f.validationType === "name" ||
                 f.name.toLowerCase() === "full name" ||
                 f.name.toLowerCase() === "name" ||
                 (f.name.toLowerCase().includes("name") && !f.name.toLowerCase().includes("company") && !f.name.toLowerCase().includes("business")),
        );
        return nameField ? (finalAnswers[nameField.id] ?? "").trim() : "";
      })();
      (session?.fields ?? []).forEach((f) => {
        if (isEsignSignatureField(f) && fullNameFallback) {
          finalAnswers[f.id] = fullNameFallback;
        } else if (isEsignDateField(f) && !finalAnswers[f.id]) {
          finalAnswers[f.id] = todayFormatted();
        }
      });
      await fetch(`${SESSION_BASE}/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const genBody: Record<string, unknown> = {};
      if (identityToken) genBody.esignToken = identityToken;
      if (signerName.trim()) genBody.signerName = signerName.trim();
      if (sigMode === "draw") {
        const dataUrl = sigPadRef.current?.getDataUrl();
        if (dataUrl) genBody.signatureImage = dataUrl;
      }
      const genRes = await fetch(`${SESSION_BASE}/${token}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genBody),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setErrorMsg(genData.error ?? "Could not generate your documents.");
        setPageStatus("ready");
        return;
      }
      setDownloadUrl(`${SESSION_BASE}/${token}/packet.pdf`);
      setPageStatus("generated");
    } catch {
      setErrorMsg("A network error occurred. Your answers have been saved — please try again.");
      setPageStatus("ready");
    }
  }

  async function handleDownload() {
    if (!downloadUrl) return;
    setIsDownloading(true);
    try {
      const res = await fetch(downloadUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${session?.package_name ?? "documents"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(downloadUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  }

  const screenCls = isEmbed ? "bg-white flex items-center justify-center px-4 py-10" : "min-h-screen bg-[#F8F6F0] flex items-center justify-center px-4";

  if (pageStatus === "loading") {
    return (
      <div className={screenCls}>
        <div className="text-[#6B7A99] text-sm">Loading your form…</div>
      </div>
    );
  }

  if (pageStatus === "expired" || (!session && pageStatus !== "error")) {
    return (
      <div className={screenCls}>
        <div className="max-w-md w-full bg-white rounded-xl border border-[#DDD5C4] p-8 text-center space-y-3">
          <svg className="w-10 h-10 text-[#8A9BB8] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <h1 className="text-lg font-semibold text-[#0F1C3F]">This link has expired or is no longer valid</h1>
          <p className="text-sm text-[#6B7A99]">Please contact your advisor to receive a new link.</p>
        </div>
      </div>
    );
  }

  if (pageStatus === "error") {
    return (
      <div className={screenCls}>
        <div className="max-w-md w-full bg-white rounded-xl border border-[#DDD5C4] p-8 text-center space-y-3">
          <p className="text-sm text-red-600">Something went wrong loading your form. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (pageStatus === "generated") {
    return (
      <div className={screenCls}>
        <div className="max-w-md w-full bg-white rounded-xl border border-[#DDD5C4] p-8 text-center space-y-5">
          <div className="flex justify-center"><CheckIcon /></div>
          <div>
            <h1 className="text-xl font-semibold text-[#0F1C3F]">You're all set!</h1>
            <p className="text-sm text-[#6B7A99] mt-1">Your paperwork is complete. Your advisor has been notified.</p>
          </div>
          {downloadUrl && (
            <Button onClick={handleDownload} disabled={isDownloading} className="bg-[#0F1C3F] hover:bg-[#182B5F] w-full">
              {isDownloading ? "Preparing download…" : "Download your completed documents"}
            </Button>
          )}
          <p className="text-xs text-[#8A9BB8]">You can close this window.</p>
        </div>
      </div>
    );
  }

  const brandColor = session!.org_brand_color ?? "#C49A38";
  const brandTextColor = getBrandTextColor(brandColor);
  const requiredCount = visibleFields.filter((f) => fieldIsRequired(f) && f.interviewMode !== "readonly").length;
  const answeredCount = visibleFields.filter((f) => fieldIsRequired(f) && f.interviewMode !== "readonly" && currentValue(f, answers, session!.prefill).trim()).length;
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const missingRequiredCount = requiredCount - answeredCount;
  const progressPct = requiredCount > 0 ? Math.round((answeredCount / requiredCount) * 100) : 100;
  const ringStyle = { "--tw-ring-color": `${brandColor}66` } as React.CSSProperties;

  // E-sign step overlay — renders on top of the form while user goes through identity verification
  if (esignStep !== null) {
    return (
      <div ref={rootRef} className={isEmbed ? "bg-white" : "min-h-screen bg-[#F8F6F0]"}>
        {!isEmbed && <header className="bg-white border-b border-[#DDD5C4] px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {(() => {
              const orgName = session!.org_name ?? "West Hills Capital";
              const logoSrc = session!.org_logo_url ? `${API_BASE}${session!.org_logo_url}` : null;
              const bColor = session!.org_brand_color ?? "#C49A38";
              const initial = orgName.charAt(0).toUpperCase();
              return (
                <>
                  <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: logoSrc ? "#ffffff" : bColor }}>
                    {logoSrc ? <img src={logoSrc} alt={orgName} className="w-full h-full object-contain" /> : <span className="text-white text-xs font-bold">{initial}</span>}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0F1C3F]">{orgName}</div>
                    <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
                  </div>
                </>
              );
            })()}
          </div>
        </header>}
        <main className={`max-w-2xl mx-auto px-4 space-y-6 ${isEmbed ? "py-6" : "py-8"}`}>
          {/* Progress stepper */}
          <div className="flex items-center gap-2 text-xs text-[#6B7A99]">
            {(hasInitialsStep && hasSignatureStep
              ? ["email", "code", "initials", "consent"]
              : hasInitialsStep
              ? ["email", "code", "initials"]
              : hasSignatureStep
              ? ["email", "code", "consent"]
              : ["email", "code"] as EsignStep[]
            ).map((s, i, arr) => {
              const labels: Record<EsignStep, string> = { email: "Identity", code: "Verify", initials: "Initials", consent: "Sign" };
              const stepIdx = arr.indexOf(esignStep!);
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className={`h-px w-6 ${done || active ? "bg-[#0F1C3F]" : "bg-[#DDD5C4]"}`} />}
                  <div className={`flex items-center gap-1.5 ${active ? "text-[#0F1C3F] font-semibold" : done ? "text-[#6B7A99]" : "text-[#8A9BB8]"}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${active ? "bg-[#0F1C3F] text-white border-[#0F1C3F]" : done ? "bg-[#EAF0FB] text-[#0F1C3F] border-[#0F1C3F]/20" : "bg-white text-[#8A9BB8] border-[#DDD5C4]"}`}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span>{labels[s as EsignStep]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Email step */}
          {esignStep === "email" && (
            <div className="bg-white rounded-xl border border-[#DDD5C4] p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0F1C3F]">Verify your identity</h2>
                <p className="text-sm text-[#6B7A99] mt-1">
                  We need to confirm who you are before showing you this form. Enter your email address and we'll send you a one-time code.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="esign-email">Email address</label>
                <Input
                  id="esign-email"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => { setSignerEmail(e.target.value); setOtpError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { void handleRequestOtp(); } }}
                  placeholder="you@example.com"
                  autoFocus
                  disabled={otpLoading}
                  className={otpError ? "border-red-400 focus-visible:ring-red-300" : ""}
                />
                {otpError && <p className="text-xs text-red-600">{otpError}</p>}
              </div>
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => { setEsignStep(null); setOtpError(""); }}
                  variant="outline"
                  className="border-[#DDD5C4] text-[#6B7A99] hover:bg-[#F8F6F0]"
                  disabled={otpLoading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => { void handleRequestOtp(); }}
                  disabled={otpLoading || !signerEmail.trim()}
                  className="flex-1 bg-[#0F1C3F] hover:bg-[#182B5F]"
                >
                  {otpLoading ? "Sending code…" : "Send verification code"}
                </Button>
              </div>
            </div>
          )}

          {/* OTP code step */}
          {esignStep === "code" && (
            <div className="bg-white rounded-xl border border-[#DDD5C4] p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0F1C3F]">
                  {otpLoading && !otpExpiresAt ? "Sending code…" : "Enter your code"}
                </h2>
                <p className="text-sm text-[#6B7A99] mt-1">
                  {otpLoading && !otpExpiresAt
                    ? <>Sending a 6-digit code to <strong className="text-[#0F1C3F]">{signerEmail}</strong>…</>
                    : <>We sent a 6-digit code to <strong className="text-[#0F1C3F]">{signerEmail}</strong>.</>
                  }
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="esign-code">Verification code</label>
                <Input
                  id="esign-code"
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { void handleVerifyOtp(); } }}
                  placeholder="000000"
                  autoFocus
                  disabled={otpLoading}
                  className={`font-mono tracking-widest text-center text-xl ${otpError ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                />
                {otpError && <p className="text-xs text-red-600">{otpError}</p>}
                {/* Expiry countdown */}
                {otpExpiresAt && (
                  otpExpired
                    ? <p className="text-xs text-amber-600 font-medium">Code expired — request a new one</p>
                    : <p className="text-xs text-[#6B7A99]">Code expires in {formatCountdown(expirySecondsLeft)}</p>
                )}
              </div>
              {/* Resend with cooldown */}
              {cooldownExpired ? (
                <button
                  type="button"
                  onClick={() => { void handleRequestOtp(); }}
                  disabled={otpLoading}
                  className="text-xs text-[#0F1C3F] hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              ) : (
                <p className="text-xs text-[#8A9BB8]">
                  Resend in {formatCountdown(cooldownSecondsLeft)}
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => { setEsignStep("email"); setOtpError(""); setOtpCode(""); }}
                  variant="outline"
                  className="border-[#DDD5C4] text-[#6B7A99] hover:bg-[#F8F6F0]"
                  disabled={otpLoading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => { void handleVerifyOtp(); }}
                  disabled={otpLoading || otpCode.length < 6 || otpExpired}
                  className="flex-1 bg-[#0F1C3F] hover:bg-[#182B5F]"
                >
                  {otpLoading ? "Verifying…" : "Verify code"}
                </Button>
              </div>
            </div>
          )}

          {/* Initials step */}
          {esignStep === "initials" && (
            <div className="bg-white rounded-xl border border-[#DDD5C4] p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-[#0F1C3F]">Add your initials</h2>
                <p className="text-sm text-[#6B7A99] mt-1">
                  This document requires your initials. Draw or type them below.
                </p>
              </div>
              {/* Draw/type toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setInitialsMode("draw")}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${initialsMode === "draw" ? "bg-white shadow-sm text-[#0F1C3F] font-medium" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => setInitialsMode("type")}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${initialsMode === "type" ? "bg-white shadow-sm text-[#0F1C3F] font-medium" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}
                >
                  Type
                </button>
              </div>
              {/* Draw pad */}
              {initialsMode === "draw" && (
                <div className="space-y-1.5">
                  <SignaturePad
                    ref={initPadRef}
                    width={220}
                    height={80}
                    onChange={setInitPadHasContent}
                    className="w-full max-w-xs"
                  />
                  <div className="flex justify-end max-w-xs">
                    <button
                      type="button"
                      onClick={() => { initPadRef.current?.clear(); }}
                      disabled={!initPadHasContent}
                      className="text-xs text-[#8A9BB8] hover:text-[#0F1C3F] disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
              {/* Type input */}
              {initialsMode === "type" && (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={typedInitials}
                    onChange={(e) => setTypedInitials(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="e.g. JD"
                    maxLength={4}
                    autoFocus
                    className="max-w-xs font-mono text-xl tracking-widest text-center"
                  />
                  {typedInitials.trim() && (
                    <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] p-3 max-w-xs">
                      <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide mb-1">Initials preview</p>
                      <p className="text-xl font-serif italic text-[#0F1C3F]">{typedInitials}</p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => { setEsignStep("code"); setOtpError(""); setOtpCode(""); setIdentityToken(null); }}
                  variant="outline"
                  className="border-[#DDD5C4] text-[#6B7A99] hover:bg-[#F8F6F0]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleInitialsContinue}
                  disabled={initialsMode === "draw" ? !initPadHasContent : typedInitials.trim().length < 2}
                  className="flex-1 bg-[#0F1C3F] hover:bg-[#182B5F]"
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Consent / signature step */}
          {esignStep === "consent" && (
            <div className="bg-white rounded-xl border border-[#DDD5C4] p-6 space-y-4">
              {/* Identity confirmed header */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#0F1C3F]">Identity verified</h2>
                  <p className="text-sm text-[#6B7A99]">{signerEmail}</p>
                </div>
              </div>

              {/* Full legal name (always required) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#0F1C3F]" htmlFor="esign-name">
                  Full legal name
                </label>
                <Input
                  id="esign-name"
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Full legal name"
                  autoFocus
                  disabled={pageStatus === "submitting"}
                />
              </div>

              {/* Draw / type toggle */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 rounded-lg border border-[#DDD5C4] bg-[#F8F6F0] p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => { setSigMode("type"); }}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sigMode === "type" ? "bg-white shadow-sm text-[#0F1C3F] font-medium" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}
                    disabled={pageStatus === "submitting"}
                  >
                    Type
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSigMode("draw"); }}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${sigMode === "draw" ? "bg-white shadow-sm text-[#0F1C3F] font-medium" : "text-[#6B7A99] hover:text-[#0F1C3F]"}`}
                    disabled={pageStatus === "submitting"}
                  >
                    Draw
                  </button>
                </div>

                {sigMode === "type" && signerName.trim() && (
                  <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0] p-3">
                    <p className="text-[10px] text-[#8A9BB8] uppercase tracking-wide mb-1">Signature preview</p>
                    <p className="text-xl font-serif italic text-[#0F1C3F]">{signerName}</p>
                  </div>
                )}

                {sigMode === "draw" && (
                  <div className="space-y-1.5">
                    <SignaturePad
                      ref={sigPadRef}
                      width={440}
                      height={160}
                      disabled={pageStatus === "submitting"}
                      onChange={setSigPadHasContent}
                      className="w-full"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { sigPadRef.current?.clear(); }}
                        disabled={!sigPadHasContent || pageStatus === "submitting"}
                        className="text-xs text-[#8A9BB8] hover:text-[#0F1C3F] disabled:opacity-40"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#DDD5C4] bg-[#FAFAF8] p-3 text-xs text-[#6B7A99] space-y-1">
                <p>By submitting, you confirm:</p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>The information in this form is accurate and complete.</li>
                  <li>
                    {sigMode === "draw"
                      ? "Your drawn signature above is your legal electronic signature."
                      : "Your typed name above is your legal electronic signature."}
                  </li>
                  <li>You consent to the use of electronic records and signatures.</li>
                </ul>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => { setEsignStep(hasInitialsStep ? "initials" : "code"); if (!hasInitialsStep) { setOtpError(""); setOtpCode(""); setIdentityToken(null); } }}
                  variant="outline"
                  className="border-[#DDD5C4] text-[#6B7A99] hover:bg-[#F8F6F0]"
                  disabled={pageStatus === "submitting"}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => { void handleSubmit(); }}
                  disabled={
                    pageStatus === "submitting" ||
                    !signerName.trim() ||
                    (sigMode === "draw" && !sigPadHasContent)
                  }
                  className="flex-1 bg-[#0F1C3F] hover:bg-[#182B5F]"
                >
                  {pageStatus === "submitting" ? "Submitting…" : "Submit and sign"}
                </Button>
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-[#8A9BB8] pb-4">
            Your answers are encrypted in transit and stored securely.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={isEmbed ? "bg-white" : "min-h-screen bg-[#F8F6F0]"}>
      {/* Header — hidden in embed mode */}
      {!isEmbed && <header className="bg-white border-b border-[#DDD5C4] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {(() => {
            const orgName = session!.org_name ?? "West Hills Capital";
            const logoSrc = session!.org_logo_url ? `${API_BASE}${session!.org_logo_url}` : null;
            const brandColor = session!.org_brand_color ?? "#C49A38";
            const initial = orgName.charAt(0).toUpperCase();
            return (
              <>
                <div
                  className="w-8 h-8 rounded shrink-0 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: logoSrc ? "#ffffff" : brandColor }}
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt={orgName} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white text-xs font-bold">{initial}</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F1C3F]">{orgName}</div>
                  <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
                </div>
              </>
            );
          })()}
        </div>
      </header>}

      <main className={`max-w-2xl mx-auto px-4 space-y-6 ${isEmbed ? "py-6" : "py-8"}`}>
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1C3F]">{session!.package_name}</h1>
          <p className="text-sm text-[#6B7A99] mt-1">
            Please complete the form below. Your answers are saved automatically as you type.
            {requiredCount > 0 && ` ${answeredCount} of ${requiredCount} required fields answered.`}
          </p>
        </div>

        {/* Progress bar */}
        {requiredCount > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-[#EFE8D8] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: brandColor }}
              />
            </div>
          </div>
        )}

        {/* Missing fields warning */}
        {missingFields.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="text-sm font-semibold text-amber-900 mb-1">Please complete the required fields</div>
            <div className="flex flex-wrap gap-1.5">
              {missingFields.map((id) => {
                const field = visibleFields.find((f) => f.id === id);
                return field ? (
                  <button
                    key={id}
                    type="button"
                    onClick={() => document.getElementById(`field-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="text-xs bg-white border border-amber-300 text-amber-800 rounded px-2 py-0.5 hover:bg-amber-100 transition-colors"
                  >
                    {field.name}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>
        )}

        {/* Prefill context — show what was pre-filled on this session */}
        {Object.keys(session!.prefill ?? {}).filter((k) => String(session!.prefill[k] ?? "").trim()).length > 0 && (
          <div className="rounded-lg border border-[#DDD5C4] bg-[#FAFAF8] px-4 py-3">
            <div className="text-[11px] font-semibold text-[#8A9BB8] uppercase tracking-wider mb-2">Information on file</div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
              {Object.entries(session!.prefill).filter(([, v]) => String(v ?? "").trim()).map(([key, value]) => (
                <div key={key} className="flex gap-2 min-w-0">
                  <span className="text-[#8A9BB8] shrink-0 w-24 truncate">{humanizeKey(key)}</span>
                  <span className="text-[#0F1C3F] font-medium truncate">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-4">
          {visibleFields.map((field) => {
            const val = currentValue(field, answers, session!.prefill);
            const isReadonly = field.interviewMode === "readonly";
            const isRequired = fieldIsRequired(field);
            const isMissing = missingFields.includes(field.id);
            const fieldError = fieldErrors[field.id];
            const hasFieldError = Boolean(fieldError);

            return (
              <div
                key={field.id}
                id={`field-${field.id}`}
                className={`bg-white rounded-lg border p-4 transition-colors ${
                  hasFieldError ? "border-red-400" : isMissing ? "border-amber-400" : "border-[#DDD5C4]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-[#0F1C3F]" htmlFor={`input-${field.id}`}>
                    {field.name}
                  </label>
                  <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border shrink-0 ${
                    isReadonly ? "bg-blue-50 text-blue-700 border-blue-100"
                    : isRequired ? "bg-red-50 text-red-700 border-red-100"
                    : "bg-[#F8F6F0] text-[#6B7A99] border-[#EFE8D8]"
                  }`}>
                    {isReadonly ? "Pre-filled" : isRequired ? "Required" : "Optional"}
                  </span>
                </div>

                {isReadonly ? (
                  <div className="px-3 py-2 text-sm bg-[#F8F6F0] rounded border border-[#DDD5C4] text-[#334155]">
                    {val || <span className="text-[#8A9BB8] italic">—</span>}
                  </div>
                ) : field.type === "dropdown" ? (
                  <select
                    id={`input-${field.id}`}
                    value={val}
                    onChange={(e) => updateAnswer(field.id, e.target.value)}
                    onBlur={(e) => handleFieldBlur(field, e.target.value)}
                    style={ringStyle}
                    className={`w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 ${
                      hasFieldError ? "border-red-400" : isMissing ? "border-amber-400" : "border-[#D4C9B5]"
                    }`}
                  >
                    <option value="">{isRequired ? "— select —" : "Select…"}</option>
                    {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : field.type === "radio" ? (
                  <div className="space-y-2 pt-1">
                    {(field.options ?? []).map((opt) => (
                      <label key={opt} className="flex items-center gap-2.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={field.id}
                          value={opt}
                          checked={val === opt}
                          onChange={() => { updateAnswer(field.id, opt); handleFieldBlur(field, opt); }}
                          className="w-4 h-4 accent-[#0F1C3F]"
                        />
                        <span className="text-[#0F1C3F]">{opt}</span>
                      </label>
                    ))}
                    {val && (
                      <button type="button" onClick={() => { updateAnswer(field.id, ""); handleFieldBlur(field, ""); }} className="text-[11px] text-[#8A9BB8] hover:text-[#334155] mt-1">
                        Clear selection
                      </button>
                    )}
                  </div>
                ) : field.type === "checkbox" ? (
                  <div className="space-y-2 pt-1">
                    {((field.options ?? []).length ? field.options ?? [] : ["Yes"]).map((opt) => {
                      const selected = val.split(",").map((s) => s.trim()).filter(Boolean);
                      return (
                        <label key={opt} className="flex items-center gap-2.5 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected.includes(opt)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selected.filter((v) => v !== opt), opt]
                                : selected.filter((v) => v !== opt);
                              const joined = next.join(", ");
                              updateAnswer(field.id, joined);
                              handleFieldBlur(field, joined);
                            }}
                            className="w-4 h-4 accent-[#0F1C3F] rounded"
                          />
                          <span className="text-[#0F1C3F]">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <Input
                      id={`input-${field.id}`}
                      type={field.sensitive ? "password" : field.type === "date" ? "date" : "text"}
                      value={val}
                      onChange={(e) => updateAnswer(field.id, e.target.value)}
                      onFocus={() => setFocusedFieldId(field.id)}
                      onBlur={(e) => { handleFieldBlur(field, e.target.value); setFocusedFieldId(null); }}
                      style={hasFieldError || isMissing ? undefined : ringStyle}
                      className={
                        hasFieldError ? "border-red-400 focus-visible:ring-red-300"
                        : isMissing ? "border-amber-400 focus-visible:ring-amber-300"
                        : ""
                      }
                    />
                    {field.sensitive && field.validationType === "date" &&
                      (focusedFieldId === field.id || val !== "") && (
                      <MaskedDateFormatGuide value={val} field={field} />
                    )}
                    {field.sensitive && field.validationType && field.validationType !== "date" &&
                      (focusedFieldId === field.id || val !== "") && (
                      <SensitiveFormatGhost value={val} validationType={field.validationType} />
                    )}
                  </>
                )}

                {fieldError && <p className="mt-1.5 text-xs text-red-600">{fieldError}</p>}
                {(() => {
                  const hint = fieldFormatHint(field.validationType, field.validationMessage ?? undefined);
                  const hasValidValue = val.trim() !== "" && validateFieldValue(field, val) === null;
                  // Suppress the static hint when a specialized visualization replaces it:
                  // - sensitive+date → MaskedDateFormatGuide
                  // - sensitive+ssn/zip/zip4/phone → SensitiveFormatGhost
                  const isMaskedDate = field.sensitive && field.validationType === "date";
                  const hasSensitiveGhost = field.sensitive && !!field.validationType
                    && field.validationType !== "date"
                    && buildSensitiveMask("1", field.validationType) !== null;
                  return hint && !hasFieldError && !hasValidValue && !isMaskedDate && !hasSensitiveGhost ? (
                    <p className="mt-1.5 text-[11px] text-[#8A9BB8]">Format: {hint}</p>
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div className="bg-white rounded-lg border border-[#DDD5C4] p-5 space-y-3">
          <div className="text-sm text-[#6B7A99]">
            {session!.auth_level === "email_otp" && hasSignatureStep
              ? "Your identity has been verified. Complete the form, then you'll provide your legal name and signature to finalize the documents."
              : session!.auth_level === "email_otp"
              ? "Your identity has been verified. Complete the form and submit — your documents will be generated immediately."
              : "By submitting, you confirm the information above is accurate. Your completed documents will be generated immediately and sent to your advisor."}
          </div>
          <Button
            onClick={() => void handleSubmit()}
            disabled={pageStatus === "submitting" || hasErrors || missingRequiredCount > 0}
            style={{ backgroundColor: brandColor, color: brandTextColor }}
            className="w-full disabled:opacity-60 py-3 hover:opacity-90"
          >
            {pageStatus === "submitting"
              ? "Submitting…"
              : session!.auth_level === "email_otp"
              ? "Continue to signing"
              : "Submit and generate documents"}
          </Button>
          {(hasErrors || missingRequiredCount > 0) && pageStatus !== "submitting" && (
            <p className="text-xs text-red-600 text-center">
              {hasErrors
                ? "Please fix the errors above before submitting."
                : `${missingRequiredCount} required field${missingRequiredCount !== 1 ? "s" : ""} still need${missingRequiredCount === 1 ? "s" : ""} to be filled in.`}
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-[#8A9BB8] pb-4">
          Your answers are encrypted in transit and stored securely.
        </p>
      </main>
    </div>
  );
}
