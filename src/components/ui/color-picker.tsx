"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { PipetteIcon } from "lucide-react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "motion/react";
import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

type Mode = "hex" | "rgba" | "hsl";
type Hsla = { h: number; s: number; l: number; a: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

const useLatestRef = <T,>(value: T) => {
  const ref = React.useRef(value);
  React.useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
};

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

const cssToHsla = (css: string): Hsla => {
  const { r, g, b, a } = cssColorToRgba(css);
  const [h, s, l] = rgbToHsl(r, g, b);
  return { h, s, l, a };
};

const hslaToHex = ({ h, s, l, a }: Hsla): string => {
  const [r, g, b] = hslToRgb(h, s, l);
  return rgbaToHex(r, g, b, a);
};

const CHECKERED_BG =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==")';

interface SaturationPanelProps {
  hue: number;
  saturation: number;
  lightness: number;
  onChange: (saturation: number, lightness: number) => void;
}

const SaturationPanel = ({ hue, saturation, lightness, onChange }: SaturationPanelProps) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value is read in JSX to apply the dragging class
  const [isDragging, setIsDragging] = React.useState(false);
  const [posX, setPosX] = React.useState(saturation / 100);
  const [posY, setPosY] = React.useState(0);
  const onChangeRef = useLatestRef(onChange);

  React.useEffect(() => {
    if (draggingRef.current) return;
    const px = saturation / 100;
    let py = 0;
    if (saturation < 1) {
      py = 1 - lightness / 100;
    } else {
      const top = 50 + 50 * (1 - px);
      py = top === 0 ? 0 : 1 - lightness / top;
    }
    setPosX(clamp(px, 0, 1));
    setPosY(clamp(py, 0, 1));
  }, [saturation, lightness]);

  const move = React.useCallback(
    (event: PointerEvent | React.PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      setPosX(x);
      setPosY(y);
      const top = x < 0.01 ? 100 : 50 + 50 * (1 - x);
      onChangeRef.current(x * 100, top * (1 - y));
    },
    [onChangeRef],
  );

  const onMoveEvent = React.useEffectEvent((e: PointerEvent) => move(e));

  React.useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => onMoveEvent(e);
    const onUp = () => {
      draggingRef.current = false;
      setIsDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="relative h-32 w-full cursor-crosshair rounded-md"
      style={{
        background: `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)), linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)), hsl(${hue}, 100%, 50%)`,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        draggingRef.current = true;
        setIsDragging(true);
        move(e.nativeEvent);
      }}
    >
      <div
        className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left: `${posX * 100}%`,
          top: `${posY * 100}%`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
};

interface SliderRowProps {
  value: number;
  max: number;
  onValueChange: (n: number) => void;
  trackBackground: string;
  ariaLabel: string;
}

const SliderRow = ({ value, max, onValueChange, trackBackground, ariaLabel }: SliderRowProps) => (
  <SliderPrimitive.Root
    value={[value]}
    max={max}
    step={1}
    onValueChange={(v) => onValueChange((v as number[])[0])}
    thumbAlignment="edge"
    aria-label={ariaLabel}
  >
    <SliderPrimitive.Control className="relative flex h-4 w-full touch-none items-center select-none">
      <SliderPrimitive.Track
        className="relative h-2 w-full grow rounded-full"
        style={{ background: trackBackground }}
      >
        <SliderPrimitive.Thumb className="relative block size-3 rounded-full border border-border/60 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" />
      </SliderPrimitive.Track>
    </SliderPrimitive.Control>
  </SliderPrimitive.Root>
);

const HUE_TRACK = "linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)";

interface EyedropperButtonProps {
  onPick: (hex: string) => void;
}

const EyedropperButton = ({ onPick }: EyedropperButtonProps) => {
  if (typeof window === "undefined" || !window.EyeDropper) return null;
  const Picker = window.EyeDropper;
  return (
    <button
      type="button"
      aria-label="Pick color from screen"
      className="grid size-7 shrink-0 place-items-center rounded-md border border-border/60 bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={async () => {
        try {
          const result = await new Picker().open();
          if (result?.sRGBHex) onPick(result.sRGBHex);
        } catch {
          // user dismissed picker
        }
      }}
    >
      <PipetteIcon size={14} />
    </button>
  );
};

const MODES: readonly Mode[] = ["hex", "rgba", "hsl"];

interface FormatToggleProps {
  mode: Mode;
  onChange: (m: Mode) => void;
  className?: string;
}

const FormatToggle = ({ mode, onChange, className }: FormatToggleProps) => (
  <Tabs value={mode} onValueChange={(v) => onChange(v as Mode)} className={cn("!gap-0", className)}>
    <TabsList size="sm">
      {MODES.map((m) => (
        <TabsTrigger key={m} value={m} size="sm" className="font-mono tracking-wide uppercase">
          {m}
        </TabsTrigger>
      ))}
      <TabsIndicator />
    </TabsList>
  </Tabs>
);

const NUMERIC_INPUT_CLASS =
  "h-7 min-w-0 rounded-md border border-border/60 bg-secondary px-1.5 text-center font-mono text-[11px] text-foreground tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring";

const HEX_INPUT_CLASS =
  "h-7 w-full rounded-md border border-border/60 bg-secondary px-2 font-mono text-[11px] text-foreground uppercase tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring";

interface FormatInputsProps {
  mode: Mode;
  hsla: Hsla;
  onChangeHsla: (next: Hsla) => void;
}

const FormatInputs = ({ mode, hsla, onChangeHsla }: FormatInputsProps) => {
  if (mode === "hex") {
    return <HexInput hsla={hsla} onChangeHsla={onChangeHsla} />;
  }

  if (mode === "rgba") {
    return <RgbaInputs hsla={hsla} onChangeHsla={onChangeHsla} />;
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-1">
      <NumberField
        ariaLabel="Hue"
        value={round(hsla.h)}
        min={0}
        max={360}
        onChange={(v) => onChangeHsla({ ...hsla, h: v })}
      />
      <PercentField
        ariaLabel="Saturation"
        value={round(hsla.s)}
        onChange={(v) => onChangeHsla({ ...hsla, s: v })}
      />
      <PercentField
        ariaLabel="Lightness"
        value={round(hsla.l)}
        onChange={(v) => onChangeHsla({ ...hsla, l: v })}
      />
      <PercentField
        ariaLabel="Alpha"
        value={round(hsla.a * 100)}
        onChange={(v) => onChangeHsla({ ...hsla, a: v / 100 })}
      />
    </div>
  );
};

interface HexInputProps {
  hsla: Hsla;
  onChangeHsla: (next: Hsla) => void;
}

const HexInput = ({ hsla, onChangeHsla }: HexInputProps) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const currentHex = React.useMemo(() => hslaToHex(hsla).toUpperCase(), [hsla]);
  useUncontrolledSync(inputRef, currentHex);

  return (
    <div className="grid grid-cols-[1fr_56px] gap-1">
      <input
        ref={inputRef}
        type="text"
        defaultValue={currentHex.toUpperCase()}
        aria-label="Hex value"
        maxLength={9}
        className={HEX_INPUT_CLASS}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!HEX_RE.test(raw)) return;
          const parsed = parseHex(raw);
          if (!parsed) return;
          const [h, s, l] = rgbToHsl(parsed.r, parsed.g, parsed.b);
          onChangeHsla({ h, s, l, a: parsed.a });
        }}
      />
      <PercentField
        ariaLabel="Alpha"
        value={round(hsla.a * 100)}
        onChange={(v) => onChangeHsla({ ...hsla, a: v / 100 })}
      />
    </div>
  );
};

const RgbaInputs = ({ hsla, onChangeHsla }: HexInputProps) => {
  const [r, g, b] = React.useMemo(() => hslToRgb(hsla.h, hsla.s, hsla.l), [hsla.h, hsla.s, hsla.l]);
  const update = (next: { r?: number; g?: number; b?: number; a?: number }) => {
    const [h, s, l] = rgbToHsl(next.r ?? r, next.g ?? g, next.b ?? b);
    onChangeHsla({ h, s, l, a: next.a ?? hsla.a });
  };
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-1">
      <NumberField
        ariaLabel="Red"
        value={round(r)}
        min={0}
        max={255}
        onChange={(v) => update({ r: v })}
      />
      <NumberField
        ariaLabel="Green"
        value={round(g)}
        min={0}
        max={255}
        onChange={(v) => update({ g: v })}
      />
      <NumberField
        ariaLabel="Blue"
        value={round(b)}
        min={0}
        max={255}
        onChange={(v) => update({ b: v })}
      />
      <PercentField
        ariaLabel="Alpha"
        value={round(hsla.a * 100)}
        onChange={(v) => update({ a: v / 100 })}
      />
    </div>
  );
};

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onChange: (n: number) => void;
}

const NumberField = ({ value, min, max, ariaLabel, onChange }: NumberFieldProps) => {
  const ref = React.useRef<HTMLInputElement>(null);
  useUncontrolledSync(ref, value);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      defaultValue={value}
      aria-label={ariaLabel}
      className={NUMERIC_INPUT_CLASS}
      onChange={(e) => {
        const n = Number.parseInt(e.target.value, 10);
        if (Number.isNaN(n)) return;
        onChange(clamp(n, min, max));
      }}
    />
  );
};

interface PercentFieldProps {
  value: number;
  ariaLabel: string;
  onChange: (n: number) => void;
}

const PercentField = ({ value, ariaLabel, onChange }: PercentFieldProps) => {
  const ref = React.useRef<HTMLInputElement>(null);
  useUncontrolledSync(ref, value);
  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        defaultValue={value}
        aria-label={ariaLabel}
        className={cn(NUMERIC_INPUT_CLASS, "w-full pr-4")}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isNaN(n)) return;
          onChange(clamp(n, 0, 100));
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[9px] text-muted-foreground">
        %
      </span>
    </div>
  );
};

interface ColorPickerPanelProps {
  value: string;
  onChange: (val: string) => void;
}

const ColorPickerPanel = ({ value, onChange }: ColorPickerPanelProps) => {
  // Seed hsla from value once on mount; panel OWNS it after. Ignoring later value changes is
  // intentional — the parent's optimistic round-trip during a drag would race and feedback-loop.
  const [hsla, setHsla] = React.useState<Hsla>(() => cssToHsla(value));
  const [mode, setMode] = React.useState<Mode>("hex");
  const onChangeRef = useLatestRef(onChange);

  // Mirror hsla in a ref so updateAndEmit computes `next` without setState's updater form:
  // emitting (onChange → collection.update → subscriber setStates) inside an updater triggers
  // React's "update while rendering" warning and can re-run the updater, doubling work per tick.
  const hslaRef = React.useRef(hsla);

  const updateAndEmit = React.useCallback(
    (patch: Partial<Hsla>) => {
      const next = { ...hslaRef.current, ...patch };
      hslaRef.current = next;
      // Urgent: local picker state — drives handle/thumbs, commit now so the cursor doesn't lag.
      setHsla(next);
      // Transition: app-wide cascade (collection.update → subscribers → previews/sidebars).
      // Urgent commits first; pointermoves interrupt this, keeping the handle glued to the cursor.
      React.startTransition(() => {
        onChangeRef.current(hslaToHex(next));
      });
    },
    [onChangeRef],
  );

  const currentHex = React.useMemo(() => hslaToHex(hsla), [hsla]);
  const alphaTrack = React.useMemo(() => {
    const opaque = hslaToHex({ ...hsla, a: 1 });
    return `${CHECKERED_BG} left center, linear-gradient(90deg, transparent, ${opaque})`;
  }, [hsla]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col gap-2.5">
        <SaturationPanel
          hue={hsla.h}
          saturation={hsla.s}
          lightness={hsla.l}
          onChange={(s, l) => updateAndEmit({ s, l })}
        />
        <SliderRow
          value={hsla.h}
          max={360}
          onValueChange={(h) => updateAndEmit({ h })}
          trackBackground={HUE_TRACK}
          ariaLabel="Hue"
        />
        <SliderRow
          value={round(hsla.a * 100)}
          max={100}
          onValueChange={(a) => updateAndEmit({ a: a / 100 })}
          trackBackground={alphaTrack}
          ariaLabel="Alpha"
        />
        <div className="flex items-center gap-2">
          <EyedropperButton
            onPick={(hex) => {
              const parsed = parseHex(hex);
              if (!parsed) return;
              const [h, s, l] = rgbToHsl(parsed.r, parsed.g, parsed.b);
              updateAndEmit({ h, s, l, a: parsed.a });
            }}
          />
          <div
            className="size-7 shrink-0 overflow-hidden rounded-md border border-border/60"
            style={{ backgroundImage: CHECKERED_BG }}
          >
            <div className="size-full" style={{ backgroundColor: currentHex }} />
          </div>
          <FormatToggle mode={mode} onChange={setMode} className="ml-auto" />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={mode}
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(8px)" }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <FormatInputs mode={mode} hsla={hsla} onChangeHsla={(next) => updateAndEmit(next)} />
          </m.div>
        </AnimatePresence>
      </div>
    </LazyMotion>
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
          defaultValue={swatchHex.toUpperCase()}
          aria-label={`${label} hex value`}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const normalized = raw.startsWith("#") ? raw : `#${raw}`;
            if (HEX_RE.test(normalized)) onChange(normalized);
          }}
          className="w-[72px] bg-transparent text-right font-mono text-[11px] text-muted-foreground uppercase tabular-nums outline-none"
          maxLength={9}
        />
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label={`${label} color picker`}
                className="relative size-[18px] shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-border/60"
                style={{ backgroundImage: CHECKERED_BG }}
              >
                <span className="absolute inset-0" style={{ backgroundColor: swatchHex }} />
              </button>
            }
          />
          <PopoverContent side="left" align="start" sideOffset={8} keepMounted className="w-64 p-3">
            <ColorPickerPanel value={swatchHex} onChange={onChange} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
