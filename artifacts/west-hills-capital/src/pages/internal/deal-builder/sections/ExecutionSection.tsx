import type { ExecutionResult } from "../types";
import { EXECUTION_STEPS } from "../hooks/useDealExecution";

interface Props {
  locked:               boolean;
  // pre-lock
  termsAcknowledged:    boolean;
  setTermsAcknowledged: (b: boolean) => void;
  isSaving:             boolean;
  executionStep:        number;
  saveError:            string | null;
  total:                number;
  onLock:               () => void;
  onPreview:            () => void;
  isGeneratingPreview:  boolean;
  // post-lock
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
      <section className={`rounded-lg p-5 ${executionResult ? "bg-green-900/20 border border-green-800/40" : "bg-gray-900 border border-gray-800"}`}>
        <div className="flex items-start gap-3">
          <div className={`text-xl mt-0.5 ${executionResult ? "text-green-400" : "text-amber-400"}`}>✓</div>
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm ${executionResult ? "text-green-300" : "text-amber-300"}`}>
              Deal #{savedDealId} — {executionResult ? "Executed" : "Locked"}
            </div>
            {lockedAt && (
              <div className="text-gray-500 text-xs mt-1">
                {new Date(lockedAt).toLocaleString()}
              </div>
            )}
            {executionResult && (
              <div className="mt-3 space-y-1.5 text-xs">
                {executionResult.invoiceId && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-24 flex-shrink-0">Invoice #</span>
                    <span className="text-white font-mono">{executionResult.invoiceId}</span>
                  </div>
                )}
                {executionResult.invoiceUrl && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-24 flex-shrink-0">Drive</span>
                    <a href={executionResult.invoiceUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate">
                      View PDF ↗
                    </a>
                  </div>
                )}
                {executionResult.emailSentTo && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-24 flex-shrink-0">Email sent</span>
                    <span className="text-green-400">{executionResult.emailSentTo}</span>
                  </div>
                )}
                {executionResult.warnings && executionResult.warnings.length > 0 && (
                  <div className="mt-2 text-amber-400 bg-amber-900/20 rounded px-2 py-1.5">
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

  // ── Lock & Execute panel ──────────────────────────────────────────────────
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      {saveError && (
        <div className="mb-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded px-3 py-2">
          {saveError}
        </div>
      )}

      {isSaving ? (
        <div className="space-y-2">
          {EXECUTION_STEPS.map((step, i) => {
            const done    = i < executionStep;
            const current = i === executionStep;
            return (
              <div key={step} className={`flex items-center gap-3 text-sm transition-opacity ${i > executionStep ? "opacity-30" : ""}`}>
                <span className="w-5 h-5 flex items-center justify-center rounded-full text-xs flex-shrink-0">
                  {done
                    ? <span className="text-green-400">✓</span>
                    : current
                      ? <span className="inline-block w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      : <span className="text-gray-700">○</span>
                  }
                </span>
                <span className={done ? "text-green-400" : current ? "text-amber-300" : "text-gray-600"}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <label className="flex items-start gap-3 mb-4 cursor-pointer group">
            <input
              type="checkbox"
              checked={termsAcknowledged}
              onChange={(e) => setTermsAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500 flex-shrink-0"
            />
            <span className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
              I confirm this trade was executed verbally on a recorded line and that West Hills Capital's{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
              </a>{" "}
              were provided or referenced in the client's transaction materials.
            </span>
          </label>
          {!termsAcknowledged && (
            <p className="text-xs text-amber-600 mb-3 text-center">
              Terms acknowledgment required before execution
            </p>
          )}
          <button
            onClick={onLock}
            disabled={isSaving || total === 0 || !termsAcknowledged}
            className="w-full py-3 rounded font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Lock &amp; Execute
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Freezes pricing · places DG order · generates PDF invoice · emails client
          </p>
          <div className="border-t border-gray-800 mt-4 pt-4">
            <button
              onClick={onPreview}
              disabled={isGeneratingPreview}
              className="w-full py-2 rounded text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingPreview ? "Generating PDF…" : "Preview Invoice PDF"}
            </button>
            <p className="text-xs text-gray-600 mt-1.5 text-center">
              Downloads the invoice using current form data — no trade executed
            </p>
          </div>
        </>
      )}
    </section>
  );
}
