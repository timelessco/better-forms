import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EraserIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { getAriaLabelledBy } from "./shared";
import type { FieldRendererProps } from "./shared";

type Point = { x: number; y: number };

// Script font stack for the "Sign here" placeholder — no bundled font, falls back across OSes to a
// handwriting face, then generic cursive.
const SIGNATURE_FONT = '"Snell Roundhand", "Segoe Script", "Brush Script MT", cursive';

// Self-contained canvas signature pad. Pointer events unify mouse/touch/pen; the backing store is
// sized to the box × DPR so strokes stay crisp and coordinates map 1:1. Emits a PNG data URL on
// pointer-up; "" once cleared. Stroke color follows the form theme via the canvas `color`.
const SignaturePad = ({
  value,
  onChange,
  invalid,
  ariaLabelledBy,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  ariaLabelledBy?: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<Point | null>(null);
  const [hasInk, setHasInk] = useState(Boolean(value));

  // Size the backing store to the element box × DPR; setting width/height resets the context, so
  // re-apply the stroke styles after every resize.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = getComputedStyle(canvas).color || "#000";
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const pointFromEvent = (e: React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pointFromEvent(e);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pointFromEvent(e);
    // Quadratic smoothing through the midpoint keeps fast strokes from looking jagged.
    const midX = (last.current.x + p.x) / 2;
    const midY = (last.current.y + p.y) / 2;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, midX, midY);
    ctx.stroke();
    last.current = p;
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange("");
  };

  return (
    <div
      className={cn(
        "relative h-40 w-full overflow-hidden rounded-[8px] bg-[var(--form-input-bg,var(--color-gray-50))] elevation-sm",
        invalid && "ring-1 ring-destructive",
      )}
    >
      {!hasInk && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl text-muted-foreground/45 italic select-none"
          style={{ fontFamily: SIGNATURE_FONT }}
        >
          Sign here
        </span>
      )}
      <canvas
        ref={canvasRef}
        // touch-none lets pointer drawing work without the page scrolling under the finger.
        className="size-full touch-none text-foreground"
        role="img"
        aria-label="Signature pad"
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
      />
      {hasInk && (
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label="Clear signature"
          className="absolute right-2 bottom-2"
          onClick={clear}
        >
          <EraserIcon />
        </Button>
      )}
    </div>
  );
};

const SignatureField = ({ element, form, name }: FieldRendererProps<"Signature">) => {
  const fieldName = name ?? element.name;
  return (
    <form.AppField name={fieldName}>
      {(f) => {
        const hasErrors = f.state.meta.errors.length > 0 && f.state.meta.isTouched;
        return (
          <>
            <SignaturePad
              value={(f.state.value as string | undefined) ?? ""}
              onChange={(v) => f.handleChange(v)}
              invalid={hasErrors}
              ariaLabelledBy={getAriaLabelledBy(element)}
            />
            <f.FieldError />
          </>
        );
      }}
    </form.AppField>
  );
};

export default SignatureField;
