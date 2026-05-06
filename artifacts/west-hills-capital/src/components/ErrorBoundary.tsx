import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  inline?: boolean;
  label?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

function InlineFallback({
  label,
  error,
  onReset,
}: {
  label?: string;
  error: Error;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-[#0F1C3F]">
          Something went wrong{label ? ` in ${label}` : ""}.
        </p>
        <p className="text-xs text-[#6B7A99] mt-1">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 text-xs font-medium rounded border border-[#DDD5C4] text-[#4A5B7A] hover:bg-[#F5F0E8] transition-colors"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 text-xs font-medium rounded border border-[#C49A38]/40 text-[#C49A38] hover:bg-[#C49A38]/10 transition-colors"
        >
          Refresh page
        </button>
      </div>
    </div>
  );
}

function FullPageFallback({
  label,
  error,
  onReset,
}: {
  label?: string;
  error: Error;
  onReset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl border border-[#DDD5C4] shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F1C3F] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[#6B7A99] mb-1">
          {label ? `The ${label} encountered an unexpected error.` : "An unexpected error occurred."}
        </p>
        <p className="text-xs text-[#9AAAC0] font-mono bg-[#F5F0E8] rounded px-3 py-2 mb-6 break-all">
          {error.message || "Unknown error"}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[#DDD5C4] text-[#4A5B7A] hover:bg-[#F5F0E8] transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#0F1C3F] text-white hover:bg-[#1A2E5C] transition-colors"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const tag = this.props.label ? ` (${this.props.label})` : "";
    console.error(`[ErrorBoundary${tag}] Uncaught error:`, error, info.componentStack);
    this.props.onError?.(error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.inline ? (
        <InlineFallback label={this.props.label} error={this.state.error} onReset={this.reset} />
      ) : (
        <FullPageFallback label={this.props.label} error={this.state.error} onReset={this.reset} />
      );
    }
    return this.props.children;
  }
}
