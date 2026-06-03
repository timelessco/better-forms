"use client";

import { Slider } from "@base-ui/react/slider";
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// {h: 0-360, s: 0-100, l: 0-100}. No alpha — the Figma picker (and recollect's) is opaque.
type Hsl = { h: number; s: number; l: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

const useUncontrolledSync = (
  ref: React.RefObject<HTMLInputElement | null>,
  value: string | number,
) => {
  React.useEffect(() => {
    const el = ref.current;
    const str = String(value);
    if (el && el !== document.activeElement && el.value !== str) el.value = str;
  }, [ref, value]);
};

const useLatestRef = <T,>(value: T) => {
  const ref = React.useRef(value);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
};

const parseHex = (raw: string): { r: number; g: number; b: number; a: number } | null => {
  const m = raw.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(m)) return null;
  let r: number;
  let g: number;
  let b: number;
  let a = 1;
  if (m.length === 3 || m.length === 4) {
    r = Number.parseInt(m[0] + m[0], 16);
    g = Number.parseInt(m[1] + m[1], 16);
    b = Number.parseInt(m[2] + m[2], 16);
    if (m.length === 4) a = Number.parseInt(m[3] + m[3], 16) / 255;
  } else if (m.length === 6 || m.length === 8) {
    r = Number.parseInt(m.slice(0, 2), 16);
    g = Number.parseInt(m.slice(2, 4), 16);
    b = Number.parseInt(m.slice(4, 6), 16);
    if (m.length === 8) a = Number.parseInt(m.slice(6, 8), 16) / 255;
  } else {
    return null;
  }
  return { r, g, b, a };
};

const cssColorToRgba = (color: string): { r: number; g: number; b: number; a: number } => {
  if (!color) return { r: 0, g: 0, b: 0, a: 1 };
  const direct = parseHex(color);
  if (direct) return direct;
  if (typeof document === "undefined") return { r: 0, g: 0, b: 0, a: 1 };
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return { r: 0, g: 0, b: 0, a: 1 };
    ctx.fillStyle = "#000";
    ctx.fillStyle = color;
    const out = parseHex(ctx.fillStyle);
    return out ?? { r: 0, g: 0, b: 0, a: 1 };
  } catch {
    return { r: 0, g: 0, b: 0, a: 1 };
  }
};

const rgbaToHex = (r: number, g: number, b: number, a: number): string => {
  const hex = [r, g, b].map((n) => clamp(round(n), 0, 255).toString(16).padStart(2, "0")).join("");
  if (a >= 0.999) return `#${hex}`;
  const ah = clamp(round(a * 255), 0, 255)
    .toString(16)
    .padStart(2, "0");
  return `#${hex}${ah}`;
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
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

const cssToHsl = (css: string): Hsl => {
  const { r, g, b } = cssColorToRgba(css);
  const [h, s, l] = rgbToHsl(r, g, b);
  return { h, s, l };
};

const hslToHex = (hsl: Hsl): string => {
  const [r, g, b] = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbaToHex(r, g, b, 1);
};

const CHECKERED_BG =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==")';

const HUE_TRACK =
  "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))";

interface PanelPartProps {
  hsl: Hsl;
  setHsl: (next: Hsl) => void;
}

// Saturation/lightness square — ported from recollect's working Selection. Position is
// derived directly from hsl (no separate drag state), and drags use pointer capture so the
// handle tracks the cursor even outside the box.
const SaturationSelection = ({ hsl, setHsl }: PanelPartProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const x = hsl.s / 100;
  const topLightness = 50 + 50 * (1 - x);
  const y = topLightness === 0 ? 0 : clamp(1 - hsl.l / topLightness, 0, 1);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const newY = clamp((clientY - rect.top) / rect.height, 0, 1);
    const s = newX * 100;
    const l = (50 + 50 * (1 - newX)) * (1 - newY);
    setHsl({ h: hsl.h, s, l });
  };

  const background = `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)), linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)), hsl(${hsl.h}, 100%, 50%)`;

  return (
    <div
      ref={containerRef}
      aria-label="Saturation and lightness"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={round(hsl.s)}
      aria-valuetext={`Saturation ${round(hsl.s)}%, lightness ${round(hsl.l)}%`}
      role="slider"
      tabIndex={0}
      className="relative h-[174px] w-full cursor-crosshair touch-none rounded-lg border-[0.5px] border-border/70 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      style={{ background }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        updateFromPointer(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateFromPointer(event.clientX, event.clientY);
        }
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      />
    </div>
  );
};

// Hue slider — ported from recollect. Value is a plain number (Slider.Root<number>); the thumb
// lives inside the track. This is the structure/binding that actually drives onValueChange.
const Hue = ({ hsl, setHsl }: PanelPartProps) => (
  <Slider.Root<number>
    max={360}
    min={0}
    value={hsl.h}
    onValueChange={(next) => setHsl({ ...hsl, h: next })}
    aria-label="Hue"
  >
    <Slider.Control className="relative flex h-2.5 w-full touch-none items-center">
      <Slider.Track className="h-2.5 w-full rounded-full" style={{ background: HUE_TRACK }}>
        <Slider.Indicator />
        <Slider.Thumb className="size-3 rounded-full border-2 border-white bg-transparent shadow-md outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
);

interface ColorPickerPanelProps {
  value: string;
  onChange: (val: string) => void;
}

const ColorPickerPanel = ({ value, onChange }: ColorPickerPanelProps) => {
  // Seed hsl from value once on mount; panel OWNS it after. Ignoring later value changes is
  // intentional — the parent's optimistic round-trip during a drag would race and feedback-loop.
  const [hsl, setLocalHsl] = React.useState<Hsl>(() => cssToHsl(value));
  const onChangeRef = useLatestRef(onChange);

  const setHsl = React.useCallback(
    (next: Hsl) => {
      // Urgent: local picker state — drives the handle/thumb, commit now so it doesn't lag.
      setLocalHsl(next);
      // Transition: app-wide cascade (collection.update → subscribers → previews/sidebars).
      React.startTransition(() => {
        onChangeRef.current(hslToHex(next));
      });
    },
    [onChangeRef],
  );

  return (
    <div className="flex w-full flex-col gap-2.5">
      <SaturationSelection hsl={hsl} setHsl={setHsl} />
      <Hue hsl={hsl} setHsl={setHsl} />
    </div>
  );
};

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const ColorPicker = ({ label, value, onChange, className }: ColorPickerProps) => {
  const textInputRef = React.useRef<HTMLInputElement>(null);
  const swatchHex = React.useMemo(() => {
    const { r, g, b, a } = cssColorToRgba(value);
    return rgbaToHex(r, g, b, a);
  }, [value]);
  useUncontrolledSync(textInputRef, swatchHex.toUpperCase());

  return (
    <div
      className={cn(
        "relative flex h-7 items-center gap-3 overflow-visible bg-secondary",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-normal text-muted-foreground">{label}</span>
      </div>
      <div className="flex h-full flex-none items-center gap-2">
        <input
          ref={textInputRef}
          type="text"
          defaultValue={swatchHex.toUpperCase()}
          aria-label={`${label} hex value`}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const normalized = raw.startsWith("#") ? raw : `#${raw}`;
            if (HEX_RE.test(normalized)) onChange(normalized);
          }}
          className="w-[72px] bg-transparent text-right font-mono text-[13px] font-medium text-foreground uppercase tabular-nums outline-none"
          maxLength={9}
        />
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`${label} color picker`}
                className="relative size-3.5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border/60 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.4)]"
                style={{ backgroundImage: CHECKERED_BG }}
              >
                <span className="absolute inset-0" style={{ backgroundColor: swatchHex }} />
              </button>
            }
          />
          <PopoverContent side="bottom" align="end" sideOffset={8} keepMounted className="w-64 p-2">
            <ColorPickerPanel value={swatchHex} onChange={onChange} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
