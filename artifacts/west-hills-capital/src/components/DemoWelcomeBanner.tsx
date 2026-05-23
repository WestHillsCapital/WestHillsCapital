type DemoWelcomeBannerProps = {
  demoUiState: "try" | "open" | "dismissed";
  demoSessionLoading: boolean;
  onDismiss: () => void;
  onOpenInterview: () => void;
};

export function DemoWelcomeBanner({ demoUiState, demoSessionLoading, onDismiss, onOpenInterview }: DemoWelcomeBannerProps) {
  return (
    <div className="space-y-4">
      <div className="relative rounded-xl border border-[#1B4FD8]/40 bg-gradient-to-br from-[#0F1C3F] to-[#1C2B4A] p-7 overflow-hidden">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors p-1 rounded"
          title="Skip demo and go to package builder"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {demoUiState === "try" ? (
          <>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-11 h-11 rounded-xl bg-[#1B4FD8]/20 border border-[#1B4FD8]/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-6 h-6 text-[#1B4FD8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Experience Docuplete as your client</h2>
                <p className="text-sm text-white/60 mt-1 leading-relaxed">
                  Open a real client interview in a new tab — fill in details, draw your signature, verify with a one-time code, and get a completed PDF. The whole loop in under 60 seconds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-7">
              {[
                { n: "1", icon: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10", label: "Fill in 8 fields" },
                { n: "2", icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0", label: "Draw & e-sign" },
                { n: "3", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z", label: "Get signed PDF" },
              ].map((step) => (
                <div key={step.n} className="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center text-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#1B4FD8]/20 border border-[#1B4FD8]/40 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-[#1B4FD8]">{step.n}</span>
                  </div>
                  <svg className="w-5 h-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>
                  <span className="text-xs text-white/70 font-medium">{step.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenInterview}
                disabled={demoSessionLoading}
                className="flex items-center gap-2 bg-[#1B4FD8] hover:bg-[#1640B0] disabled:opacity-60 text-white text-sm font-semibold rounded-lg px-6 py-2.5 transition-colors shadow-lg shadow-[#1B4FD8]/20"
              >
                {demoSessionLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    Opening interview…
                  </>
                ) : (
                  <>
                    Open client interview
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Skip, explore the builder →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-5">
              <div className="w-11 h-11 rounded-xl bg-green-400/20 border border-green-400/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">Interview open in a new tab</h2>
                <p className="text-sm text-white/60 mt-1 leading-relaxed">
                  Fill out the form fields, draw your signature, and verify with the one-time code sent to your email. When you submit, come back here and click <strong className="text-white/80">Interviews</strong> in the left sidebar to see your completed packet.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenInterview}
                disabled={demoSessionLoading}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium rounded-lg px-5 py-2 transition-colors"
              >
                {demoSessionLoading ? (
                  <><svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Opening…</>
                ) : (
                  <>Open again<svg className="w-3.5 h-3.5 ml-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></>
                )}
              </button>
              <button type="button" onClick={onDismiss} className="text-sm text-white/40 hover:text-white/70 transition-colors">
                Dismiss and explore the builder →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
