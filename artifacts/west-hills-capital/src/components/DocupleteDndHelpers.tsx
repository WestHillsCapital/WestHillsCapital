import { memo } from "react";
import { PointerSensor } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";

export type SortableItemRenderProps = {
  handleProps: React.HTMLAttributes<HTMLElement>;
  wrapperRef: (el: HTMLElement | null) => void;
  wrapperStyle: React.CSSProperties;
  isDragging: boolean;
};

export function SortableItem({ id, children }: { id: string; children: (props: SortableItemRenderProps) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <>{children({
    handleProps: { ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement>,
    wrapperRef: setNodeRef,
    wrapperStyle: { transform: DndCSS.Transform.toString(transform), transition },
    isDragging,
  })}</>;
}

export function isInteractiveElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (["button", "input", "textarea", "select", "option", "label", "a"].includes(tag)) return true;
  return isInteractiveElement(el.parentElement);
}

export class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        if (!nativeEvent.isPrimary || nativeEvent.button !== 0) return false;
        return !isInteractiveElement(nativeEvent.target as Element);
      },
    },
  ];
}

export const DragGuideLines = memo(function DragGuideLines({
  dragGuides,
}: { dragGuides: { xs: number[]; ys: number[] } | null }) {
  if (!dragGuides) return null;
  return (
    <>
      {dragGuides.xs.map((x: number, i: number) => (
        <div key={`gx-${i}`} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${x}%`, width: 1, background: "#2563eb", opacity: 0.65, zIndex: 15 }} />
      ))}
      {dragGuides.ys.map((y: number, i: number) => (
        <div key={`gy-${i}`} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${y}%`, height: 1, background: "#2563eb", opacity: 0.65, zIndex: 15 }} />
      ))}
    </>
  );
});

export const ResizeDimTooltip = memo(function ResizeDimTooltip({
  x, y, w, h, resizeDim,
}: { x: number; y: number; w: number; h: number; resizeDim: { w: number; h: number } | null }) {
  if (!resizeDim) return null;
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x + w}%`, top: `${y + h}%`, transform: "translate(4px, 4px)", zIndex: 20 }}
    >
      <div className="bg-[#0F1C3F] text-white rounded px-1.5 py-0.5 whitespace-nowrap" style={{ fontSize: 9 }}>
        {resizeDim.w} × {resizeDim.h} pt
      </div>
    </div>
  );
});
