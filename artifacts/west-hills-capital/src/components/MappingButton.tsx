import { memo, type PointerEvent as ReactPointerEvent, type MouseEvent } from "react";
import { type FieldItem, type RecipientItem } from "@/lib/docuplete-types";
import { useDocupleteStore } from "@/stores/useDocupleteStore";

export interface MappingButtonProps {
  mappingId: string;
  fieldName: string;
  sampleValue: string;
  formatLabel: string;
  fieldColor: string;
  fieldType?: FieldItem["type"];
  recipient: RecipientItem | undefined;
  /**
   * Controls border/background style in non-text mode.
   * - undefined (scroll mode): solid when selected, dashed when not.
   * - true  (single-page, fully defined): always solid.
   * - false (single-page, not yet defined): dashed with reduced opacity.
   */
  isFullyDefined?: boolean;
  onMoveStart: (e: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (e: ReactPointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLButtonElement>) => void;
}

export const MappingButton = memo(function MappingButton({
  mappingId,
  fieldName,
  sampleValue,
  formatLabel,
  fieldColor,
  fieldType,
  recipient,
  isFullyDefined,
  onMoveStart,
  onResizeStart,
  onClick,
  onContextMenu,
}: MappingButtonProps) {
  const m = useDocupleteStore((s) => s.mappings.find((item) => item.id === mappingId));
  const isSelected = useDocupleteStore((s) => s.selectedMappingId === mappingId);
  const mapperTextMode = useDocupleteStore((s) => s.mapperTextMode);

  if (!m) return null;

  const isOptionMapping = String(m.format ?? "").startsWith("checkbox-option:");
  const optionLabel = isOptionMapping ? String(m.format).slice("checkbox-option:".length).trim() : null;
  const effectiveColor = (isOptionMapping && m.optionColor) ? m.optionColor : fieldColor;

  const isCheckboxMark =
    m.format === "checkbox-yes" || isOptionMapping;
  const flexJustify = isOptionMapping ? "justify-center" : isCheckboxMark ? "justify-center" : "justify-end";

  const borderStyle = mapperTextMode
    ? `1px ${isSelected ? "solid" : "dashed"} ${effectiveColor}${isSelected ? "" : "80"}`
    : isOptionMapping
      ? `2px dashed ${effectiveColor}`
      : isFullyDefined === undefined
        ? `2px ${isSelected ? "solid" : "dashed"} ${effectiveColor}`
        : isFullyDefined
          ? `2px solid ${effectiveColor}`
          : `2px dashed ${effectiveColor}88`;

  const bgColor = mapperTextMode
    ? isSelected ? effectiveColor + "18" : "transparent"
    : isOptionMapping
      ? `${effectiveColor}10`
      : isFullyDefined === false
        ? "rgba(255,255,255,0.55)"
        : "rgba(255,255,255,0.93)";

  return (
    <button
      key={m.id}
      type="button"
      onPointerDown={(e) => onMoveStart(e)}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`absolute rounded cursor-move flex flex-col ${flexJustify} ${
        mapperTextMode
          ? isSelected ? "ring-2 shadow" : "hover:ring-1"
          : "shadow"
      } ${isSelected ? "ring-[#1B4FD8]/70" : "ring-[#1B4FD8]/30"}`}
      style={{
        left: `${m.x}%`,
        top: `${m.y}%`,
        width: `${m.w}%`,
        height: `${m.h}%`,
        minHeight: isOptionMapping ? "12px" : "20px",
        minWidth: isOptionMapping ? "12px" : undefined,
        border: borderStyle,
        backgroundColor: bgColor,
        fontSize: `${(m.fontSize && m.fontSize > 0) ? m.fontSize : 11}px`,
        textAlign: m.align ?? "left",
        paddingBottom: !isCheckboxMark ? "2px" : undefined,
        paddingLeft: isOptionMapping ? undefined : "2px",
        paddingRight: isOptionMapping ? undefined : "2px",
        zIndex: 2,
        transform: m.rotation ? `rotate(${m.rotation}deg)` : undefined,
      }}
    >
      {mapperTextMode ? (
        <>
          <span
            className="block leading-none select-none pointer-events-none truncate"
            style={{ color: "#111", fontFamily: "Helvetica, Arial, sans-serif" }}
          >
            {sampleValue || "\u00A0"}
          </span>
          <div style={{ borderBottom: `0.5px solid ${effectiveColor}80`, marginTop: "1px" }} />
        </>
      ) : isOptionMapping ? (
        <div
          className="pointer-events-none w-full h-full flex items-center justify-center"
          title={`${fieldName}: ${optionLabel}`}
        >
          <span
            className={`${fieldType === "radio" ? "rounded-full" : "rounded-sm"} border-2 flex items-center justify-center font-bold leading-none select-none`}
            style={{
              borderColor: effectiveColor,
              color: effectiveColor,
              width: "72%",
              height: "72%",
              minWidth: "8px",
              minHeight: "8px",
              fontSize: "55%",
            }}
          >
            {m.mark ?? (fieldType === "radio" ? "●" : "X")}
          </span>
        </div>
      ) : (
        <div className="pointer-events-none w-full overflow-hidden">
          <span className="block leading-tight">{fieldName}</span>
          {recipient && (
            <span
              className="block text-[9px] leading-none truncate font-medium"
              style={{ color: recipient.color }}
            >
              {recipient.email ?? recipient.label}
            </span>
          )}
          <span className="block text-[9px] uppercase tracking-wide text-[#6B7A99]">
            {formatLabel}
          </span>
          <span
            className="block leading-tight italic truncate"
            style={{ color: "#9AAAC0", opacity: 0.85 }}
          >
            {sampleValue}
          </span>
          <div style={{ borderBottom: "0.4px solid #c8c8c8", marginTop: "1px" }} />
        </div>
      )}
      {isSelected && (
        <span
          onPointerDown={(e) => onResizeStart(e)}
          className="absolute bottom-0 right-0 h-3 w-3 translate-x-1 translate-y-1 rounded-sm border border-[#0F1C3F] bg-[#1B4FD8] cursor-nwse-resize"
        />
      )}
    </button>
  );
});
