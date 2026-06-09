import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { BrushCleaning, Save } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Vendored from @shadix-ui/signature-pad (https://shadix-ui.vercel.app). Robust 3-point
// rolling-quadratic stroke smoothing — no dropped points / dashed gaps. Adaptations: `bare`
// variant + `fill` size so it can slot into a themed form box; penColor falls back to the
// canvas' computed CSS color (so strokes follow --foreground); ResizeObserver for box reflows.

const signaturePadVariants = cva("touch-none", {
  variants: {
    variant: {
      default: "border border-input bg-input/30",
      ghost: "border-none bg-muted/50",
      outline: "border-2 border-primary bg-background",
      bare: "border-none bg-transparent", // host box supplies bg/border/radius
    },
    size: {
      default: "h-[200px] w-full",
      sm: "h-[150px] w-full",
      md: "h-[250px] w-full",
      lg: "h-[300px] w-full",
      fill: "size-full", // fill the host box
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface SignaturePadProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof signaturePadVariants> {
  /** Pen color; defaults to the canvas' computed CSS `color` (theme --foreground). */
  penColor?: string;
  lineWidth?: number;
  showButtons?: boolean;
  saveButtonIcon?: React.ReactNode;
  clearButtonIcon?: React.ReactNode;
  onSave?: (signature: string) => void;
  onChange?: (signature: string | null) => void;
}

export interface SignaturePadRef {
  clear: () => void;
  save: () => void;
  toDataURL: () => string | null;
  isEmpty: () => boolean;
  getCanvas: () => HTMLCanvasElement | null;
}

type Point = { x: number; y: number };

export const SignaturePad = React.forwardRef<SignaturePadRef, SignaturePadProps>(
  (
    {
      penColor,
      lineWidth = 4,
      showButtons = true,
      saveButtonIcon,
      clearButtonIcon,
      variant,
      size,
      className,
      onSave,
      onChange,
      ...props
    },
    ref,
  ) => {
    const [isDrawing, setIsDrawing] = React.useState(false);
    const [isEmpty, setIsEmpty] = React.useState(true);

    const pointsRef = React.useRef<Point[]>([]);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const ctxRef = React.useRef<CanvasRenderingContext2D | null>(null);

    const handleClear = React.useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      onChange?.(null);
    }, [onChange]);

    const handleSave = React.useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || isEmpty) return;
      onSave?.(canvas.toDataURL("image/png"));
    }, [isEmpty, onSave]);

    React.useImperativeHandle(ref, () => ({
      clear: handleClear,
      save: handleSave,
      toDataURL: () => canvasRef.current?.toDataURL("image/png") ?? null,
      isEmpty: () => isEmpty,
      getCanvas: () => canvasRef.current,
    }));

    // Size the backing store to the box × DPR; setting width/height resets the 2D context, so
    // re-apply stroke styles after every resize.
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const updateCanvasSize = () => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(ratio, ratio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = penColor ?? (getComputedStyle(canvas).color || "#000");
        ctx.lineWidth = lineWidth;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctxRef.current = ctx;
      };
      updateCanvasSize();
      const ro = new ResizeObserver(updateCanvasSize);
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [penColor, lineWidth]);

    const getPointerPosition = (e: React.MouseEvent | React.TouchEvent): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e)
        return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const p = getPointerPosition(e);
      if (!p) return;
      setIsDrawing(true);
      pointsRef.current = [p];
      setIsEmpty(false);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const ctx = ctxRef.current ?? canvasRef.current?.getContext("2d") ?? null;
      const next = getPointerPosition(e);
      if (!ctx || !next) return;
      const updated = [...pointsRef.current, next];
      if (updated.length < 2) {
        pointsRef.current = updated;
        return;
      }
      if (updated.length === 2) {
        ctx.beginPath();
        ctx.moveTo(updated[0].x, updated[0].y);
        ctx.lineTo(updated[1].x, updated[1].y);
        ctx.stroke();
        pointsRef.current = updated;
        return;
      }
      // Quadratic through the midpoints of the last three points — continuous, no gaps.
      const [prev, cur, nxt] = updated.slice(-3);
      const cp1 = { x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2 };
      const cp2 = { x: (cur.x + nxt.x) / 2, y: (cur.y + nxt.y) / 2 };
      ctx.beginPath();
      ctx.moveTo(cp1.x, cp1.y);
      ctx.quadraticCurveTo(cur.x, cur.y, cp2.x, cp2.y);
      ctx.stroke();
      pointsRef.current = updated.slice(-3);
    };

    const stopDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      pointsRef.current = [];
      onChange?.(canvasRef.current?.toDataURL("image/png") ?? null);
    };

    return (
      <div className={cn("relative w-full", className)} {...props}>
        <canvas
          ref={canvasRef}
          className={cn("rounded-lg", signaturePadVariants({ variant, size }))}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {showButtons && (
          <div className="absolute right-2 bottom-2 flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={handleClear} className="rounded-full">
              {clearButtonIcon ?? <BrushCleaning />}
            </Button>
            <Button variant="outline" size="icon-sm" onClick={handleSave} className="rounded-full">
              {saveButtonIcon ?? <Save />}
            </Button>
          </div>
        )}
      </div>
    );
  },
);
SignaturePad.displayName = "SignaturePad";
