import { memo, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { DocItem } from "@/lib/docuplete-local-types";

const API_BASE = import.meta.env.DEV
  ? ""
  : ((import.meta.env.VITE_API_URL as string | undefined) ?? "");

interface DocumentPreviewTileProps {
  packageId: number;
  doc: DocItem;
  order: number;
  selected: boolean;
  getAuthHeaders: () => HeadersInit;
  docupleteApiPath: string;
  previewCache: { current: Record<string, string> };
  previewCacheOrder: { current: string[] };
  onSelect: () => void;
  previewHeight?: string;
}

export const DocumentPreviewTile = memo(function DocumentPreviewTile({
  packageId,
  doc,
  order,
  selected,
  getAuthHeaders,
  docupleteApiPath,
  previewCache,
  previewCacheOrder,
  onSelect,
  previewHeight = "h-28",
}: DocumentPreviewTileProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getAuthHeadersRef = useRef(getAuthHeaders);
  getAuthHeadersRef.current = getAuthHeaders;

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    setFailed(false);
    if (!doc.pdfStored) return;
    const cacheKey = `${packageId}:${doc.id}`;
    const cachedUrl = previewCache.current[cacheKey];
    if (cachedUrl) {
      setPreviewUrl(cachedUrl);
      return;
    }
    fetch(`${API_BASE}${docupleteApiPath}/packages/${packageId}/documents/${doc.id}.pdf`, { headers: { ...getAuthHeadersRef.current() } })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load document preview");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        previewCacheOrder.current = previewCacheOrder.current.filter((key) => key !== cacheKey);
        previewCacheOrder.current.push(cacheKey);
        previewCache.current[cacheKey] = objectUrl;
        while (previewCacheOrder.current.length > 24) {
          const oldestKey = previewCacheOrder.current.shift();
          if (!oldestKey) break;
          const oldestUrl = previewCache.current[oldestKey];
          if (oldestUrl) URL.revokeObjectURL(oldestUrl);
          delete previewCache.current[oldestKey];
        }
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageId, doc.id, doc.pdfStored, previewCache, previewCacheOrder]);

  useEffect(() => {
    if (!previewUrl) return;
    let cancelled = false;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
    const loadingTask = pdfjsLib.getDocument(previewUrl);
    (async () => {
      try {
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdfDoc.getPage(1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const containerWidth = container.clientWidth || 160;
        const nativeViewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth / nativeViewport.width;
        const viewport = page.getViewport({ scale });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => {});
      pdfDoc?.destroy().catch(() => {});
    };
  }, [previewUrl]);

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      className={`relative w-full ${previewHeight} overflow-hidden rounded border bg-[#F8F6F0] text-left focus:outline-none focus:ring-2 focus:ring-[#C49A38]/40 ${selected ? "border-[#C49A38]" : "border-[#DDD5C4]"}`}
    >
      {previewUrl && !failed ? (
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full pointer-events-none bg-white"
          style={{ height: "auto" }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center text-xs text-[#6B7A99]">
          <div className="font-semibold text-[#0F1C3F]">{order}</div>
          <div>{doc.pages} page(s)</div>
          <div>{failed ? "Preview unavailable" : doc.pdfStored ? "Loading preview" : "No PDF"}</div>
        </div>
      )}
      <div className="absolute left-1.5 top-1.5 rounded bg-white/90 border border-[#DDD5C4] px-1.5 py-0.5 text-[10px] font-semibold text-[#0F1C3F] shadow-sm">{order}</div>
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 border-t border-[#DDD5C4] px-2 py-1 text-[10px] text-[#6B7A99]">
        {doc.pages} page{doc.pages === 1 ? "" : "s"} · {doc.pdfStored ? "PDF preview" : "No PDF"}
      </div>
    </div>
  );
});
