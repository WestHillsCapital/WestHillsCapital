import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const SETTINGS_BASE = `${API_BASE}/api/v1/product/settings`;

interface OnboardingState {
  dismissed: boolean;
  demo_package_exists: boolean;
  steps: {
    explore_demo: boolean;
    create_package: boolean;
    send_interview: boolean;
  };
}

interface Props {
  getAuthHeaders: () => HeadersInit;
}

const STEPS = [
  {
    key: "explore_demo" as const,
    label: "Explore the demo package",
    description: "Open the pre-loaded demo package and browse your industry-specific field library.",
    href: "/app",
  },
  {
    key: "create_package" as const,
    label: "Create your first package",
    description: "Set up a real document package with your own fields and branding.",
    href: "/app",
  },
  {
    key: "send_interview" as const,
    label: "Send your first interview link",
    description: "Generate a client-facing interview link and share it with a client.",
    href: "/app",
  },
];

/** PATCH the onboarding dismissed flag and swallow errors. */
function patchDismissed(getAuthHeaders: () => HeadersInit) {
  const h = new Headers(getAuthHeaders());
  h.set("Content-Type", "application/json");
  fetch(`${SETTINGS_BASE}/onboarding`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ dismissed: true }),
  }).catch(() => {});
}

export function OnboardingChecklist({ getAuthHeaders }: Props) {
  const [, navigate] = useLocation();
  const [state, setState] = useState<OnboardingState | null>(null);
  /**
   * Three modes:
   *   "hidden"  — do not render
   *   "active"  — show the in-progress checklist
   *   "done"    — show the "all set" success bar (auto-dismisses after 4 s)
   */
  const [mode, setMode] = useState<"hidden" | "active" | "done">("hidden");
  const [collapsed, setCollapsed] = useState(false);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    const headers = getAuthHeaders();
    if (!Object.keys(headers).length) return;
    fetch(`${SETTINGS_BASE}/onboarding`, { headers })
      .then(async (r) => {
        if (!r.ok) return;
        const data = await r.json() as { onboarding: OnboardingState };
        const s = data.onboarding;
        setState(s);
        const allDone = s.steps.explore_demo && s.steps.create_package && s.steps.send_interview;

        if (s.dismissed) {
          // Server says dismissed — always hide, cancel any pending auto-dismiss timer
          if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
          setMode("hidden");
          return;
        }

        if (allDone) {
          // All steps complete but not yet marked dismissed. Transition to "done" mode,
          // persist the dismissed flag server-side, and auto-hide after 4 s.
          setMode("done");
          patchDismissed(getAuthHeaders);
          if (!autoDismissTimer.current) {
            autoDismissTimer.current = setTimeout(() => {
              setMode("hidden");
              autoDismissTimer.current = null;
            }, 4000);
          }
          return;
        }

        // Not done and not dismissed — show the active checklist.
        setMode("active");
      })
      .catch(() => {});
  }, [getAuthHeaders]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      clearInterval(interval);
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
  }, [load]);

  const dismiss = useCallback(() => {
    if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    setMode("hidden");
    patchDismissed(getAuthHeaders);
  }, [getAuthHeaders]);

  if (mode === "hidden" || !state) return null;

  if (mode === "done") {
    return (
      <div className="bg-green-50 border-b border-green-100 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <svg className="w-4 h-4 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">You're all set!</span>
            <span className="text-green-700">You've completed all onboarding steps.</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-green-600 hover:text-green-900 text-sm underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const completedCount = [state.steps.explore_demo, state.steps.create_package, state.steps.send_interview].filter(Boolean).length;

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">
              Getting started
            </span>
            <span className="text-xs text-gray-500 shrink-0">{completedCount}/3 done</span>
            <div className="flex items-center gap-1 shrink-0">
              {[0, 1, 2].map((i) => {
                const done = [state.steps.explore_demo, state.steps.create_package, state.steps.send_interview][i];
                return (
                  <div
                    key={i}
                    className={`h-1.5 w-8 rounded-full transition-colors ${done ? "bg-white" : "bg-gray-700"}`}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="text-xs text-gray-400 hover:text-white transition-colors"
              aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
            >
              {collapsed ? "Show steps" : "Hide steps"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              aria-label="Dismiss onboarding"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1">
            {STEPS.map((step) => {
              const done = state.steps[step.key];
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => navigate(step.href)}
                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    done
                      ? "bg-gray-800 opacity-60 cursor-default"
                      : "bg-gray-800 hover:bg-gray-700 cursor-pointer"
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    done ? "bg-white border-white" : "border-gray-500"
                  }`}>
                    {done && (
                      <svg className="w-2.5 h-2.5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium leading-snug ${done ? "text-gray-400 line-through" : "text-white"}`}>
                      {step.label}
                    </p>
                    {!done && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{step.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
