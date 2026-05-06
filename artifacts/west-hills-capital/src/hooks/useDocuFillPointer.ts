import { useCallback, useRef, type RefObject, type PointerEvent as ReactPointerEvent } from "react";
import { type MappingItem } from "@/lib/docufill-types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export interface UseDocuFillPointerOptions {
  pageFrameRef: RefObject<HTMLElement | null>;
  snapGrid: boolean;
  nativePageW: number;
  nativePageH: number;
  pageMappings: MappingItem[];
  onUpdateMapping: (id: string, patcher: (item: MappingItem) => MappingItem) => void;
  setResizeDim: (dim: { w: number; h: number } | null) => void;
  setDragGuides: (guides: { xs: number[]; ys: number[] } | null) => void;
  setSelectedMappingId: (id: string | null) => void;
  setSelectedFieldId: (id: string | null) => void;
}

export function useDocuFillPointer(options: UseDocuFillPointerOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const beginMappingPointer = useCallback(
    (
      e: ReactPointerEvent<HTMLElement>,
      mapping: MappingItem,
      mode: "move" | "resize",
      frameEl?: HTMLElement | null,
    ) => {
      const {
        pageFrameRef,
        snapGrid,
        nativePageW,
        nativePageH,
        pageMappings,
        onUpdateMapping,
        setResizeDim,
        setDragGuides,
        setSelectedMappingId,
        setSelectedFieldId,
      } = optionsRef.current;

      const frame = frameEl ?? pageFrameRef.current;
      if (!frame) return;
      e.preventDefault();
      e.stopPropagation();
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }

      setSelectedMappingId(mapping.id);
      setSelectedFieldId(mapping.fieldId);

      const rect = frame.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const original = { ...mapping };
      const GRID_PTS = 4;

      const snapPctX = (pct: number) => {
        if (!snapGrid) return pct;
        const pts = (pct / 100) * nativePageW;
        return (Math.round(pts / GRID_PTS) * GRID_PTS / nativePageW) * 100;
      };
      const snapPctY = (pct: number) => {
        if (!snapGrid) return pct;
        const pts = (pct / 100) * nativePageH;
        return (Math.round(pts / GRID_PTS) * GRID_PTS / nativePageH) * 100;
      };

      const otherMappings = pageMappings.filter((item) => item.id !== mapping.id);
      const GUIDE_THRESH = 0.6;

      const onMove = (event: PointerEvent) => {
        const dx = ((event.clientX - startX) / rect.width) * 100;
        const dy = ((event.clientY - startY) / rect.height) * 100;

        if (mode === "resize") {
          const newW = snapPctX(clamp((original.w ?? 26) + dx, 3, 100));
          const newH = snapPctY(clamp((original.h ?? 6) + dy, 2, 100));
          setResizeDim({
            w: Math.round((newW / 100) * nativePageW),
            h: Math.round((newH / 100) * nativePageH),
          });
          onUpdateMapping(original.id, (item) => ({ ...item, w: newW, h: newH }));
          return;
        }

        const width = original.w ?? 26;
        const height = original.h ?? 6;
        const newX = snapPctX(clamp((original.x ?? 0) + dx, 0, 100 - width));
        const newY = snapPctY(clamp((original.y ?? 0) + dy, 0, 100 - height));

        const L = newX, R = newX + width, CX = newX + width / 2;
        const T = newY, B = newY + height, CY = newY + height / 2;
        const guideXs: number[] = [], guideYs: number[] = [];
        for (const other of otherMappings) {
          const oL = other.x ?? 0, oW = other.w ?? 26;
          const oR = oL + oW, oCX = oL + oW / 2;
          const oT = other.y ?? 0, oH = other.h ?? 6;
          const oB = oT + oH, oCY = oT + oH / 2;
          for (const [a, b] of [[L,oL],[L,oR],[L,oCX],[R,oL],[R,oR],[R,oCX],[CX,oL],[CX,oR],[CX,oCX]] as [number,number][])
            if (Math.abs(a - b) < GUIDE_THRESH) guideXs.push(b);
          for (const [a, b] of [[T,oT],[T,oB],[T,oCY],[B,oT],[B,oB],[B,oCY],[CY,oT],[CY,oB],[CY,oCY]] as [number,number][])
            if (Math.abs(a - b) < GUIDE_THRESH) guideYs.push(b);
        }
        setDragGuides(
          guideXs.length > 0 || guideYs.length > 0
            ? { xs: [...new Set(guideXs)], ys: [...new Set(guideYs)] }
            : null,
        );
        onUpdateMapping(original.id, (item) => ({ ...item, x: newX, y: newY }));
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setResizeDim(null);
        setDragGuides(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [],
  );

  return { beginMappingPointer };
}
