import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PackageItem } from "@/lib/docuplete-local-types";

export function TagChipInput({ tags, onChange, placeholder }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commit = useCallback((raw: string) => {
    const tag = raw.replace(/,/g, "").trim();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setInput("");
  }, [tags, onChange]);
  return (
    <div
      className="flex flex-wrap gap-1.5 content-start w-full cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 bg-[#E2E8F0] text-[#5C4A1E] border border-[#E2E8F0] shrink-0">
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(tags.filter((t) => t !== tag)); }}
            className="ml-0.5 text-[#8A7A5A] hover:text-red-500 transition-colors leading-none"
            aria-label={`Remove tag ${tag}`}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(input); }
          else if (e.key === "Backspace" && !input && tags.length > 0) onChange(tags.slice(0, -1));
        }}
        onBlur={() => commit(input)}
        placeholder={tags.length ? "Add another tag…" : (placeholder ?? "e.g. billing, onboarding, support")}
        className="flex-1 min-w-[8rem] border-0 bg-transparent text-xs outline-none placeholder:text-[#94A3B8] py-0.5"
      />
    </div>
  );
}

export function PackagePickerWithTags({
  packages,
  value,
  onChange,
  placeholder = "Select a package…",
  transactionLabel,
}: {
  packages: PackageItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  transactionLabel?: (scope: string | null | undefined) => string;
}) {
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    packages.forEach((pkg) => pkg.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [packages]);

  const visiblePackages = tagFilter.length === 0
    ? packages
    : packages.filter((pkg) => String(pkg.id) === value || tagFilter.some((t) => pkg.tags?.includes(t)));

  const selectedPkg = packages.find((p) => String(p.id) === value);

  return (
    <div className="space-y-2">
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-[#8A9BB8] shrink-0">Filter:</span>
          <button
            type="button"
            onClick={() => setTagFilter([])}
            className={`text-[11px] rounded-full px-2 py-0.5 border transition-colors ${tagFilter.length === 0 ? "bg-[#0F1C3F] border-[#0F1C3F] text-white font-medium" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#6B7A99] hover:border-[#1B4FD8]/60 hover:text-[#4A5568]"}`}
          >All</button>
          {allTags.map((tag) => {
            const active = tagFilter.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter((prev) => active ? prev.filter((t) => t !== tag) : [...prev, tag])}
                className={`text-[11px] rounded-full px-2 py-0.5 border transition-colors ${active ? "bg-[#1B4FD8] border-[#1B4FD8] text-white font-medium" : "bg-[#F8FAFC] border-[#E2E8F0] text-[#6B7A99] hover:border-[#1B4FD8]/60 hover:text-[#4A5568]"}`}
              >{tag}</button>
            );
          })}
        </div>
      )}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={packages.length === 0}
          className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white text-[#0F1C3F] text-left flex items-center justify-between gap-2 disabled:opacity-60"
        >
          <span className="truncate">
            {selectedPkg
              ? `${selectedPkg.name}${selectedPkg.transaction_scope && transactionLabel ? ` · ${transactionLabel(selectedPkg.transaction_scope)}` : ""}`
              : placeholder}
          </span>
          <svg className={`w-3.5 h-3.5 shrink-0 text-[#8A9BB8] transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-0 w-full min-w-[260px] bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-50 overflow-y-auto max-h-72">
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-xs text-[#8A9BB8] hover:bg-[#F8FAFC]"
              onClick={() => { onChange(""); setOpen(false); }}
            >{placeholder}</button>
            {visiblePackages.length === 0 && (
              <div className="px-3 py-3 text-xs text-[#8A9BB8] border-t border-[#F0EBE0] italic">No packages match the active tag filter.</div>
            )}
            {visiblePackages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                className={`w-full text-left px-3 py-2 border-t border-[#F0EBE0] transition-colors hover:bg-[#F8FAFC] ${String(pkg.id) === value ? "bg-[#EFF6FF]" : ""}`}
                onClick={() => { onChange(String(pkg.id)); setOpen(false); }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[#0F1C3F] truncate">
                    {pkg.name}{pkg.transaction_scope && transactionLabel ? ` · ${transactionLabel(pkg.transaction_scope)}` : ""}
                  </span>
                  {pkg.status !== "active" && <span className="text-[10px] text-[#8A9BB8] shrink-0">inactive</span>}
                </div>
                {pkg.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pkg.tags.map((tag) => (
                      <span key={tag} className="text-[10px] rounded-full px-1.5 py-px bg-[#E2E8F0] text-[#5C4A1E] border border-[#E2E8F0]">{tag}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const ScrollPageCanvas = memo(function ScrollPageCanvas({
  pageNum,
  pdfDoc,
  nativeW,
  nativeH,
}: {
  pageNum: number;
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  nativeW: number;
  nativeH: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const viewport = page.getViewport({ scale: 1.0 });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch { /* rendering failure is non-fatal in scroll mode */ }
    })();
    return () => { cancelled = true; };
  }, [pageNum, pdfDoc]);
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: nativeW, height: nativeH }}
    />
  );
});

export function EmbedSnippetPanel({ embedKey, apiBase }: { embedKey: string | null; apiBase: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const effectiveApi = apiBase || origin;

  if (!embedKey) {
    return (
      <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-[#6B7A99]">
        Save the package to generate your embed key.
      </div>
    );
  }

  const snippet =
    `<div id="docuplete-form"></div>\n` +
    `<script\n` +
    `  src="${origin}/embed/v1.js"\n` +
    `  data-key="${embedKey}"\n` +
    `  data-api="${effectiveApi}"\n` +
    `  data-target="docuplete-form">\n` +
    `</script>`;

  function copy() {
    void navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#6B7A99] font-medium uppercase tracking-wide">Your embed snippet</span>
        <button
          type="button"
          onClick={copy}
          className="text-[11px] text-[#0F1C3F] hover:text-[#182B5F] font-medium px-2 py-0.5 rounded border border-[#0F1C3F]/20 bg-[#EAF0FB] hover:bg-[#D8E6F9] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="rounded-lg bg-[#0F1C3F] text-[#A8C0E8] text-[11px] p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all select-all font-mono">
        {snippet}
      </pre>
      <p className="text-[11px] text-[#8A9BB8]">
        Paste this where you want the form to appear on your website. The form auto-resizes to fit its content.
      </p>
    </div>
  );
}
