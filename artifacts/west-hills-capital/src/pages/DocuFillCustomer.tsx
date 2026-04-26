import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateFieldValue } from "@/lib/validateField";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SESSION_BASE = `${API_BASE}/api/docufill/public/sessions`;

type FieldInterviewMode = "required" | "optional" | "readonly" | "omitted";

type FieldItem = {
  id: string;
  name: string;
  color: string;
  type: "text" | "date" | "radio" | "checkbox" | "dropdown";
  interviewMode: FieldInterviewMode;
  options?: string[];
  sensitive?: boolean;
  defaultValue?: string;
  validationType?: string;
  validationPattern?: string;
  validationMessage?: string;
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
};

function fieldIsRequired(field: FieldItem): boolean {
  return field.interviewMode === "required";
}

function currentValue(field: FieldItem, answers: Record<string, string>, prefill: Record<string, string>): string {
  const ans = answers[field.id];
  if (ans !== undefined) return ans;
  if (field.interviewMode === "readonly") {
    const prefillKey = Object.keys(prefill).find((k) => k.toLowerCase() === field.name.toLowerCase());
    if (prefillKey) return String(prefill[prefillKey] ?? "");
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

export default function DocuFillCustomer() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

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
        setAnswers(s.answers ?? {});
        setPageStatus("ready");
      })
      .catch(() => setPageStatus("error"));
  }, [token]);

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

  const visibleFields = (session?.fields ?? []).filter(
    (f) => f.interviewMode !== "omitted",
  );

  function validate(): boolean {
    if (!session) return false;
    const newErrors: Record<string, string> = {};
    const missing: string[] = [];
    for (const f of visibleFields) {
      if (f.interviewMode === "readonly") continue;
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

  async function handleSubmit() {
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setPageStatus("submitting");
    setErrorMsg("");
    try {
      await fetch(`${SESSION_BASE}/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const genRes = await fetch(`${SESSION_BASE}/${token}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  if (pageStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center">
        <div className="text-[#6B7A99] text-sm">Loading your form…</div>
      </div>
    );
  }

  if (pageStatus === "expired" || (!session && pageStatus !== "error")) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center px-4">
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
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-[#DDD5C4] p-8 text-center space-y-3">
          <p className="text-sm text-red-600">Something went wrong loading your form. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (pageStatus === "generated") {
    return (
      <div className="min-h-screen bg-[#F8F6F0] flex items-center justify-center px-4">
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

  const requiredCount = visibleFields.filter((f) => fieldIsRequired(f) && f.interviewMode !== "readonly").length;
  const answeredCount = visibleFields.filter((f) => fieldIsRequired(f) && f.interviewMode !== "readonly" && currentValue(f, answers, session!.prefill).trim()).length;
  const hasErrors = Object.keys(fieldErrors).length > 0;
  const missingRequiredCount = requiredCount - answeredCount;

  return (
    <div className="min-h-screen bg-[#F8F6F0]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDD5C4] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#0F1C3F] flex items-center justify-center shrink-0">
            <span className="text-[#C49A38] text-xs font-bold">WHC</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-[#0F1C3F]">West Hills Capital</div>
            <div className="text-[11px] text-[#6B7A99]">Secure document collection</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1C3F]">{session!.package_name}</h1>
          <p className="text-sm text-[#6B7A99] mt-1">
            Please complete the form below. Your answers are saved automatically as you type.
            {requiredCount > 0 && ` ${answeredCount} of ${requiredCount} required fields answered.`}
          </p>
        </div>

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

        {/* Prefill context — show what advisor already provided */}
        {Object.keys(session!.prefill ?? {}).filter((k) => String(session!.prefill[k] ?? "").trim()).length > 0 && (
          <div className="rounded-lg border border-[#DDD5C4] bg-white p-4">
            <div className="text-xs font-semibold text-[#6B7A99] uppercase tracking-wide mb-2">Provided by your advisor</div>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {Object.entries(session!.prefill).filter(([, v]) => String(v ?? "").trim()).map(([key, value]) => (
                <div key={key} className="flex gap-1.5">
                  <span className="text-[#8A9BB8] shrink-0">{key}:</span>
                  <span className="text-[#0F1C3F] font-medium">{String(value)}</span>
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
                    className={`w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 ${
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
                  <Input
                    id={`input-${field.id}`}
                    type={field.sensitive ? "password" : field.type === "date" ? "date" : "text"}
                    value={val}
                    onChange={(e) => updateAnswer(field.id, e.target.value)}
                    onBlur={(e) => handleFieldBlur(field, e.target.value)}
                    className={
                      hasFieldError ? "border-red-400 focus-visible:ring-red-300"
                      : isMissing ? "border-amber-400 focus-visible:ring-amber-300"
                      : ""
                    }
                  />
                )}

                {fieldError && <p className="mt-1.5 text-xs text-red-600">{fieldError}</p>}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        <div className="bg-white rounded-lg border border-[#DDD5C4] p-5 space-y-3">
          <div className="text-sm text-[#6B7A99]">
            By submitting, you confirm the information above is accurate. Your completed documents will be generated immediately and sent to your advisor.
          </div>
          <Button
            onClick={handleSubmit}
            disabled={pageStatus === "submitting" || hasErrors || missingRequiredCount > 0}
            className="w-full bg-[#0F1C3F] hover:bg-[#182B5F] disabled:opacity-60 py-3"
          >
            {pageStatus === "submitting" ? "Submitting…" : "Submit and generate documents"}
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
