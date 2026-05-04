"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SHORT_HEX_RE = /^[0-9a-fA-F]$/;

const cssColorToHex = (color: string): string => {
  if (!color) return "#000000";
  if (color.startsWith("#")) return color.slice(0, 7);
  if (typeof document === "undefined") return "#000000";
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = color;
    return ctx.fillStyle;
  } catch {
    return "#000000";
  }
};

const hexToRgb = (hex: string): [number, number, number] => {
  const stripped = hex.replace("#", "");
  const full =
    stripped.length === 3
      ? stripped
          .split("")
          .map((c) => c + c)
          .join("")
      : stripped;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((n) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness * 100];
  const d = max - min;
  const saturation = lightness > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === rn) hue = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / d + 2;
  else hue = (rn - gn) / d + 4;
  hue *= 60;
  return [hue, saturation * 100, lightness * 100];
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
};

const hexToHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsl(r, g, b);
};

const hslToHex = (h: number, s: number, l: number): string => {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
};

interface SaturationPanelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (saturation: number, lightness: number) => void;
}

const SaturationPanel = ({ hue, saturation, lightness, onChange }: SaturationPanelProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [positionX, setPositionX] = React.useState(saturation / 100);
  const [positionY, setPositionY] = React.useState(0);
  const lastDraggedRef = React.useRef(false);

  React.useEffect(() => {
    if (lastDraggedRef.current && !isDragging) {
      lastDraggedRef.current = false;
      return;
    }
    if (isDragging) return;

    const newPositionX = saturation / 100;
    let newPositionY = 0;
    if (saturation < 1) {
      newPositionY = 1 - lightness / 100;
    } else {
      const topLightness = 50 + 50 * (1 - newPositionX);
      newPositionY = topLightness === 0 ? 0 : 1 - lightness / topLightness;
    }
    setPositionX(Math.max(0, Math.min(1, newPositionX)));
    setPositionY(Math.max(0, Math.min(1, newPositionY)));
  }, [saturation, lightness, isDragging]);

  React.useEffect(() => {
    if (isDragging) lastDraggedRef.current = true;
  }, [isDragging]);

  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handlePointerMove = React.useCallback((event: PointerEvent | React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setPositionX(x);
    setPositionY(y);
    const nextSaturation = x * 100;
    const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
    const nextLightness = topLightness * (1 - y);
    onChangeRef.current(nextSaturation, nextLightness);
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = () => setIsDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, handlePointerMove]);

  return (
    <div
      ref={containerRef}
      className="relative h-32 w-full cursor-crosshair rounded-md"
      style={{
        background: `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)), linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)), hsl(${hue}, 100%, 50%)`,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
        handlePointerMove(e.nativeEvent);
      }}
    >
      <div
        className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left: `${positionX * 100}%`,
          top: `${positionY * 100}%`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
};

interface ColorPickerPanelProps {
  value: string;
  onChange: (hex: string) => void;
}

const ColorPickerPanel = ({ value, onChange }: ColorPickerPanelProps) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only seed
  const initialHsl = React.useMemo(() => hexToHsl(value), []);
  const [hue, setHueState] = React.useState(initialHsl[0]);
  const [saturation, setSaturation] = React.useState(initialHsl[1]);
  const [lightness, setLightness] = React.useState(initialHsl[2]);
  const draggingRef = React.useRef(false);
  const lastEmittedRef = React.useRef(value.toLowerCase());
  const hexInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (draggingRef.current) return;
    const incoming = value.toLowerCase();
    if (incoming === lastEmittedRef.current) return;
    const [h, s, l] = hexToHsl(incoming);
    // Preserve hue when saturation rounds to 0 (achromatic) so the palette
    // doesn't snap back to red while the user adjusts S/L.
    setHueState((prev) => (s < 0.5 ? prev : h));
    setSaturation(s);
    setLightness(l);
    lastEmittedRef.current = incoming;
  }, [value]);

  const emit = React.useCallback(
    (h: number, s: number, l: number) => {
      const hex = hslToHex(h, s, l);
      lastEmittedRef.current = hex.toLowerCase();
      if (hexInputRef.current && hexInputRef.current !== document.activeElement) {
        hexInputRef.current.value = hex.toUpperCase();
      }
      onChange(hex);
    },
    [onChange],
  );

  const handleSLChange = React.useCallback(
    (s: number, l: number) => {
      draggingRef.current = true;
      setSaturation(s);
      setLightness(l);
      emit(hue, s, l);
      // release dragging on next tick so the value-sync effect doesn't fight us
      queueMicrotask(() => {
        draggingRef.current = false;
      });
    },
    [emit, hue],
  );

  const handleHueChange = React.useCallback(
    (next: number | readonly number[]) => {
      const value = Array.isArray(next) ? next[0] : (next as number);
      draggingRef.current = true;
      setHueState(value);
      emit(value, saturation, lightness);
      queueMicrotask(() => {
        draggingRef.current = false;
      });
    },
    [emit, saturation, lightness],
  );

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim();
    if (!val.startsWith("#")) val = `#${val}`;
    if (HEX_RE.test(val)) {
      const [h, s, l] = hexToHsl(val);
      setHueState(s < 0.5 ? hue : h);
      setSaturation(s);
      setLightness(l);
      lastEmittedRef.current = val.toLowerCase();
      onChange(val);
    }
  };

  const currentHex = hslToHex(hue, saturation, lightness);

  return (
    <div className="flex flex-col gap-2.5">
      <SaturationPanel
        hue={hue}
        saturation={saturation}
        lightness={lightness}
        onChange={handleSLChange}
      />
      <SliderPrimitive.Root
        value={[hue]}
        max={360}
        step={1}
        onValueChange={handleHueChange}
        thumbAlignment="edge"
      >
        <SliderPrimitive.Control className="relative flex h-4 w-full touch-none items-center select-none">
          <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
            <SliderPrimitive.Thumb className="relative block size-3 rounded-full border border-border/60 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" />
          </SliderPrimitive.Track>
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
      <div className="flex items-center gap-2">
        <div
          className="size-6 shrink-0 rounded-md border border-border/60"
          style={{ backgroundColor: currentHex }}
        />
        <input
          ref={hexInputRef}
          type="text"
          defaultValue={currentHex.toUpperCase()}
          onChange={handleHexInput}
          aria-label="Hex value"
          className="h-7 w-full rounded-md border border-border/60 bg-secondary px-2 font-mono text-[11px] text-foreground uppercase tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring"
          maxLength={7}
        />
      </div>
    </div>
  );
};

interface MinimalColorPickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const MinimalColorPicker = ({
  label,
  value,
  onChange,
  className,
}: MinimalColorPickerProps) => {
  const hexColor = cssColorToHex(value);
  const textInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (textInputRef.current && textInputRef.current !== document.activeElement) {
      textInputRef.current.value = hexColor.toUpperCase();
    }
  }, [hexColor]);

  return (
    <div
      className={cn(
        "relative flex min-h-8.5 items-center gap-3 overflow-visible bg-secondary py-1.75 pr-[3px] pl-2.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="text-base font-normal">{label}</span>
      </div>
      <div className="flex h-full flex-none items-center gap-2 px-2">
        <input
          ref={textInputRef}
          type="text"
          defaultValue={hexColor.toUpperCase()}
          aria-label={`${label} hex value`}
          onChange={(e) => {
            let val = e.target.value.trim();
            if (val.length > 0 && SHORT_HEX_RE.test(val[0])) val = `#${val}`;
            if (HEX_RE.test(val)) onChange(val);
          }}
          className="w-[60px] bg-transparent text-right font-mono text-[11px] text-muted-foreground uppercase tabular-nums outline-none"
          maxLength={7}
        />
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`${label} color picker`}
                className="relative h-[18px] w-[18px] shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-border/60"
                style={{ backgroundColor: hexColor }}
              />
            }
          />
          <PopoverContent side="left" align="start" sideOffset={8} className="w-56 p-3">
            <ColorPickerPanel value={hexColor} onChange={onChange} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
