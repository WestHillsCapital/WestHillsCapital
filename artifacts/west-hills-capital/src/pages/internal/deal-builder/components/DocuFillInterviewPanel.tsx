import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionToCsv, downloadCsv } from "@/lib/docufill-csv";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface InterviewField {
  id: string;
  name: string;
  type: "text" | "date" | "radio" | "checkbox" | "dropdown";
  options?: string[];
  sensitive?: boolean;
  required?: boolean;
  interviewMode?: "optional" | "required" | "readonly" | "omitted";
  defaultValue?: string;
  color?: string;
  source?: string;
  validationType?: string;
  validationPattern?: string;
  validationMessage?: string;
}

interface InterviewSession {
  token: string;
  package_id?: number | string;
  package_name: string;
  package_version: number;
  custodian_name: string | null;
  depository_name: string | null;
  transaction_scope: string;
  status: "pending" | "complete";
  test_mode: boolean;
  prefill: Record<string, string>;
  answers: Record<string, string>;
  fields: InterviewField[];
}

interface Props {
  token: string;
  getAuthHeaders: () => HeadersInit;
}

function fieldCurrentValue(
  field: InterviewField,
  answers: Record<string, string>,
  prefill: Record<string, string>,
): string {
  if (answers[field.id] !== undefined) return answers[field.id]!;
  if (field.source && prefill[field.source] !== undefined) return String(prefill[field.source]!);
  return field.defaultValue ?? "";
}

function fieldIsVisible(field: InterviewField): boolean {
  const mode = field.interviewMode ?? (field.required ? "required" : "optional");
  return mode !== "omitted";
}

function fieldIsReadonly(field: InterviewField): boolean {
  return field.interviewMode === "readonly";
}

export function DocuFillInterviewPanel({ token, getAuthHeaders }: Props) {
  const [, navigate] = useLocation();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [packetUrl, setPacketUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPrefill, setShowPrefill] = useState(false);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/sessions/${token}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error("Could not load interview");
      const data: InterviewSession = await res.json();
      setSession(data);
      setAnswers(data.answers ?? {});
      if (data.status === "complete") {
        setPacketUrl(`${API_BASE}/api/internal/docufill/sessions/${token}/packet.pdf`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load interview");
    } finally {
      setIsLoading(false);
    }
  }, [token, getAuthHeaders]);

  useEffect(() => { loadSession(); }, [loadSession]);

  async function saveAnswers() {
    if (!session) return;
    setIsSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/internal/docufill/sessions/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) throw new Error("Could not save answers");
      setSaveMessage("Progress saved.");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save answers");
    } finally {
      setIsSaving(false);
    }
  }

  async function generatePacket() {
    if (!session) return;
    setIsGenerating(true);
    setError(null);
    try {
      const saveRes = await fetch(`${API_BASE}/api/internal/docufill/sessions/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ answers }),
      });
      if (!saveRes.ok) throw new Error("Could not save answers before generating");

      const res = await fetch(`${API_BASE}/api/internal/docufill/sessions/${token}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not generate packet");
      }
      setPacketUrl(`${API_BASE}/api/internal/docufill/sessions/${token}/packet.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate packet");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mt-6 bg-white border border-[#DDD5C4] rounded-lg p-6">
        <div className="flex items-center gap-3 text-sm text-[#6B7A99]">
          <div className="w-4 h-4 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
          Loading IRA paperwork interview…
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!session) return null;

  const visibleFields = session.fields.filter(fieldIsVisible);
  const requiredFields = visibleFields.filter((f) => (f.interviewMode ?? (f.required ? "required" : "optional")) === "required");
  const answeredRequired = requiredFields.filter((f) => {
    const val = fieldCurrentValue(f, answers, session.prefill);
    return val.trim().length > 0;
  });
  const missingRequired = requiredFields.filter((f) => {
    const val = fieldCurrentValue(f, answers, session.prefill);
    return !val.trim();
  });

  const prefillEntries = Object.entries(session.prefill ?? {}).filter(([, v]) => String(v ?? "").trim());

  return (
    <div className="mt-6 bg-white border border-[#C49A38]/40 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#DDD5C4]">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-[#0F1C3F]">IRA Paperwork Interview</h2>
            {session.test_mode && (
              <span className="text-[10px] uppercase tracking-wide rounded bg-amber-50 border border-amber-300 text-amber-700 px-1.5 py-0.5">Test</span>
            )}
            {packetUrl && (
              <span className="text-[10px] uppercase tracking-wide rounded bg-green-50 border border-green-300 text-green-700 px-1.5 py-0.5">Packet Ready</span>
            )}
          </div>
          <p className="text-xs text-[#6B7A99] mt-0.5">
            {session.package_name}
            {session.custodian_name ? ` · ${session.custodian_name}` : ""}
            {session.depository_name ? ` · ${session.depository_name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/internal/docufill?session=${token}`)}
          className="text-xs text-[#6B7A99] border border-[#DDD5C4] rounded px-2.5 py-1.5 hover:text-[#0F1C3F] whitespace-nowrap shrink-0"
        >
          Open full view →
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Progress */}
        {requiredFields.length > 0 && (
          <div className="text-xs text-[#6B7A99]">
            {answeredRequired.length} of {requiredFields.length} required fields answered
            {missingRequired.length > 0 && (
              <span className="ml-2 text-amber-700">· Missing: {missingRequired.map((f) => f.name).join(", ")}</span>
            )}
          </div>
        )}

        {/* Prefilled data (collapsible) */}
        {prefillEntries.length > 0 && (
          <div className="rounded border border-[#DDD5C4] bg-[#F8F6F0]">
            <button
              type="button"
              onClick={() => setShowPrefill((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#0F1C3F]"
            >
              <span>Prefilled from Deal Builder ({prefillEntries.length} values)</span>
              <span className="text-[#8A9BB8]">{showPrefill ? "▲" : "▼"}</span>
            </button>
            {showPrefill && (
              <div className="px-3 pb-3 grid sm:grid-cols-2 gap-1.5 text-xs text-[#6B7A99] border-t border-[#DDD5C4] pt-2">
                {prefillEntries.map(([key, value]) => (
                  <div key={key}><span className="font-medium text-[#0F1C3F]">{key}:</span> {String(value)}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Interview fields */}
        {visibleFields.length === 0 ? (
          <p className="text-xs text-[#8A9BB8]">No interview fields — all values are prefilled from the deal.</p>
        ) : (
          <div className="space-y-3">
            {visibleFields.map((field) => {
              const mode = field.interviewMode ?? (field.required ? "required" : "optional");
              const readonly = fieldIsReadonly(field);
              const currentValue = fieldCurrentValue(field, answers, session.prefill);
              const borderColor = field.color ?? "#DDD5C4";

              return (
                <label
                  key={field.id}
                  className={`block border rounded p-3 ${readonly ? "opacity-70" : ""}`}
                  style={{ borderColor }}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium mb-1.5">
                    <span className="text-[#0F1C3F]">{field.name}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide shrink-0 ${
                      mode === "required" ? "bg-red-50 text-red-700 border border-red-100"
                      : mode === "readonly" ? "bg-blue-50 text-blue-700 border border-blue-100"
                      : "bg-[#F8F6F0] text-[#6B7A99] border border-[#EFE8D8]"
                    }`}>
                      {mode === "required" ? "Required" : mode === "readonly" ? "Read only" : "Optional"}
                    </span>
                  </span>

                  {readonly ? (
                    <div className="px-3 py-2 text-sm bg-[#F8F6F0] rounded border border-[#DDD5C4] text-[#334155]">
                      {currentValue || <span className="text-[#8A9BB8] italic">—</span>}
                    </div>
                  ) : field.type === "dropdown" ? (
                    <select
                      value={currentValue}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      className="w-full border border-[#D4C9B5] rounded px-3 py-2 text-sm"
                    >
                      <option value="">{mode === "required" ? "— select —" : "Select"}</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "radio" ? (
                    <div className="space-y-1 pt-1">
                      {(field.options ?? []).map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer font-normal">
                          <input
                            type="radio"
                            name={field.id}
                            value={opt}
                            checked={currentValue === opt}
                            onChange={() => setAnswers((prev) => ({ ...prev, [field.id]: opt }))}
                          />
                          {opt}
                        </label>
                      ))}
                      {currentValue && (
                        <button
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [field.id]: "" }))}
                          className="text-[11px] text-[#8A9BB8] hover:text-[#334155]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  ) : field.type === "checkbox" ? (
                    <div className="space-y-1 pt-1">
                      {((field.options ?? []).length ? field.options! : ["Yes"]).map((opt) => {
                        const checked = currentValue.split(",").map((s) => s.trim()).filter(Boolean).includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer font-normal">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const existing = currentValue.split(",").map((s) => s.trim()).filter(Boolean);
                                const updated = e.target.checked
                                  ? [...existing.filter((v) => v !== opt), opt]
                                  : existing.filter((v) => v !== opt);
                                setAnswers((prev) => ({ ...prev, [field.id]: updated.join(", ") }));
                              }}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      type={field.sensitive ? "password" : field.type === "date" ? "date" : "text"}
                      value={currentValue}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={mode === "required" ? "Required" : ""}
                    />
                  )}
                </label>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[#EFE8D8]">
          <Button
            type="button"
            variant="outline"
            onClick={saveAnswers}
            disabled={isSaving || isGenerating}
            className="text-[#0F1C3F] border-[#DDD5C4]"
          >
            {isSaving ? "Saving…" : "Save Progress"}
          </Button>

          {!packetUrl ? (
            <Button
              type="button"
              onClick={generatePacket}
              disabled={isGenerating || isSaving}
              className="bg-[#C49A38] hover:bg-[#b58c31] text-black"
            >
              {isGenerating ? "Generating…" : "Generate Packet"}
            </Button>
          ) : (
            <a
              href={packetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-green-700 hover:bg-green-800 text-white text-sm font-medium"
            >
              ↓ Download Packet PDF
            </a>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => {
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
            }}
            className="text-[#6B7A99] border-[#DDD5C4]"
          >
            Download CSV
          </Button>

          {saveMessage && <span className="text-xs text-green-700">{saveMessage}</span>}
        </div>
      </div>
    </div>
  );
}
