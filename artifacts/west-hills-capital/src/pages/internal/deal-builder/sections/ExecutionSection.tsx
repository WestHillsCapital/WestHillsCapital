import type { ExecutionResult } from "../types";
import { EXECUTION_STEPS } from "../hooks/useDealExecution";

interface Props {
  locked:               boolean;
  termsAcknowledged:    boolean;
  setTermsAcknowledged: (b: boolean) => void;
  isSaving:             boolean;
  executionStep:        number;
  saveError:            string | null;
  total:                number;
  onLock:               () => void;
  onPreview:            () => void;
  isGeneratingPreview:  boolean;
  savedDealId:          number | null;
  lockedAt:             string | null;
  executionResult:      ExecutionResult | null;
}

export function ExecutionSection({
  locked,
  termsAcknowledged, setTermsAcknowledged,
  isSaving, executionStep, saveError, total,
  onLock, onPreview, isGeneratingPreview,
  savedDealId, lockedAt, executionResult,
}: Props) {
  // ── Post-lock result card ─────────────────────────────────────────────────
  if (locked) {
    return (
      <section className={`rounded-lg p-4 ${executionResult ? "bg-green-900/20 border border-green-800/40" : "bg-white border border-[#DDD5C4]"}`}>
        <div className="flex items-start gap-3">
          <div className={`text-xl mt-0.5 ${executionResult ? "text-green-400" : "text-[#C49A38]"}`}>✓</div>
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm ${executionResult ? "text-green-300" : "text-[#d4a93e]"}`}>
              Deal #{savedDealId} — {executionResult ? "Executed" : "Locked"}
            </div>
            {lockedAt && (
              <div className="text-[#8A9BB8] text-xs mt-0.5">
                {new Date(lockedAt).toLocaleString()}
              </div>
            )}
            {executionResult && (
              <div className="mt-3 space-y-1.5 text-xs">
                {executionResult.invoiceId && (
                  <div className="flex gap-2">
                    <span className="text-[#8A9BB8] w-24 flex-shrink-0">Invoice #</span>
                    <span className="text-[#0F1C3F] font-mono">{executionResult.invoiceId}</span>
                  </div>
                )}
                {executionResult.invoiceUrl && (
                  <div className="flex gap-2">
                    <span className="text-[#8A9BB8] w-24 flex-shrink-0">Drive</span>
                    <a href={executionResult.invoiceUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">
                      View PDF ↗
                    </a>
                  </div>
                )}
                {executionResult.emailSentTo && (
                  <div className="flex gap-2">
                    <span className="text-[#8A9BB8] w-24 flex-shrink-0">Email sent</span>
                    <span className="text-green-400">{executionResult.emailSentTo}</span>
                  </div>
                )}
                {executionResult.warnings && executionResult.warnings.length > 0 && (
                  <div className="mt-2 text-[#C49A38] bg-[#C49A38]/10 rounded px-2 py-1.5">
                    <div className="font-medium mb-1">Partial completion:</div>
                    {executionResult.warnings.map((w, i) => <div key={i}>· {w}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── Execution panel (pre-lock) ────────────────────────────────────────────
  return (
    <section className="bg-white border border-[#DDD5C4] rounded-lg shadow-sm p-4">

      {/* Progress steps while saving */}
      {isSaving ? (
        <div className="space-y-2.5 py-1">
          {EXECUTION_STEPS.map((step, i) => {
            const done    = i < executionStep;
            const current = i === executionStep;
            return (
              <div key={step} className={`flex items-center gap-3 text-sm transition-opacity ${i > executionStep ? "opacity-30" : ""}`}>
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {done
                    ? <span className="text-green-400 text-base">✓</span>
                    : current
                      ? <span className="inline-block w-3.5 h-3.5 border-2 border-[#C49A38] border-t-transparent rounded-full animate-spin" />
                      : <span className="text-[#B0BDD0] text-base">○</span>
                  }
                </span>
                <span className={done ? "text-green-400" : current ? "text-[#d4a93e]" : "text-[#9AAAC0]"}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {saveError && (
            <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
              {saveError}
            </div>
          )}

          {/* Terms acknowledgment */}
          <label className="flex items-start gap-3 cursor-pointer group mb-3">
            <input
              type="checkbox"
              checked={termsAcknowledged}
              onChange={(e) => setTermsAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-white text-[#C49A38] focus:ring-[#C49A38] flex-shrink-0"
            />
            <span className="text-xs text-[#6B7A99] leading-relaxed group-hover:text-[#374560] transition-colors">
              I confirm this trade was executed verbally on a recorded line and that West Hills Capital's{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-[#C49A38] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>{" "}
              were provided or referenced in the client's transaction materials.
            </span>
          </label>

          {/* Lock & Execute */}
          <button
            onClick={onLock}
            disabled={isSaving || total === 0 || !termsAcknowledged}
            className="w-full py-3.5 rounded-md font-semibold text-sm bg-[#C49A38] hover:bg-[#d4a93e] text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Lock &amp; Execute
          </button>

          {/* Preview invoice — secondary action */}
          <div className="mt-3 pt-3 border-t border-[#DDD5C4]">
            <button
              onClick={onPreview}
              disabled={isGeneratingPreview}
              className="w-full py-2 rounded text-sm font-medium border border-[#DDD5C4] bg-white hover:bg-[#F5F0E8] hover:border-[#C49A38]/50 text-[#4A5B7A] hover:text-[#0F1C3F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingPreview ? "Generating PDF…" : "Preview Invoice PDF"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
