import { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from "react";

export type SignaturePadRef = {
  getDataUrl: () => string | null;
  isEmpty: () => boolean;
  clear: () => void;
};

type Props = {
  width?: number;
  height?: number;
  disabled?: boolean;
  onChange?: (hasContent: boolean) => void;
  className?: string;
};

/**
 * Canvas-based signature pad with pointer + touch support.
 * Exposes getDataUrl(), isEmpty(), and clear() via a forwarded ref.
 */
const SignaturePad = forwardRef<SignaturePadRef, Props>(function SignaturePad(
  { width = 480, height = 160, disabled = false, onChange, className = "" },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#0F1C3F";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    return ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [width, height]);

  function getPos(e: PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (width  / rect.width),
      y: (e.clientY - rect.top)  * (height / rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pos = getPos(e.nativeEvent);
    lastPos.current = pos;
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const pos = getPos(e.nativeEvent);
    const ctx = getCtx();
    if (!ctx || !lastPos.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    if (!hasStrokes) {
      setHasStrokes(true);
      onChange?.(true);
    }
  }

  function onPointerUp() {
    drawing.current = false;
    lastPos.current = null;
  }

  useImperativeHandle(ref, () => ({
    getDataUrl() {
      const canvas = canvasRef.current;
      if (!canvas || !hasStrokes) return null;
      return canvas.toDataURL("image/png");
    },
    isEmpty() { return !hasStrokes; },
    clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setHasStrokes(false);
      onChange?.(false);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ touchAction: "none", cursor: disabled ? "default" : "crosshair" }}
      className={`block rounded border border-[#DDD5C4] bg-white ${className}`}
    />
  );
});

export default SignaturePad;
