import * as React from "react";
import { createPortal } from "react-dom";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { useLazyRef } from "@/hooks/use-lazy-ref";
import { cn } from "@/lib/utils";
import { AlignLeftIcon, AlignCenterIcon, AlignRightIcon } from "@/components/ui/icons";
import { motion, AnimatePresence } from "motion/react";
import { ElasticSlider } from "@/components/elastic-slider/elastic-slider";

const VALUE_PARSE_RE = /^(-?\d*\.?\d+)(.*)$/;

interface StyleNumberInputProps {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Force a specific unit (e.g. "px", "%"). Overrides the unit parsed from the value. */
  unit?: string;
  /** User-facing unit label (e.g. "%" when the internal unit is "vw"). If omitted, no unit is shown. */
  displayUnit?: string;
  className?: string;
  valueWidth?: string;
  /** Show the scrubber track, knob, hash marks, and spring/rubber-band effects. Default true. */
  scrubber?: boolean;
  /** Enables a hidden auto state at the far-left edge. */
  allowAuto?: boolean;
  /** Whether the control is currently using the auto/default state. */
  isAuto?: boolean;
  /** Called when the far-left auto state is selected. */
  onAutoChange?: () => void;
}

export const StyleNumberInput = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit: forcedUnit,
  displayUnit,
  className,
  allowAuto = false,
  isAuto = false,
  onAutoChange,
}: StyleNumberInputProps) => {
  const match = value?.toString().match(VALUE_PARSE_RE);
  const numValue = match ? parseFloat(match[1]) : min;
  const unit = forcedUnit ?? (match ? match[2] : "");
  const shownUnit = displayUnit ?? unit;

  const formatValue = React.useCallback(
    (n: number) => (isAuto ? "Auto" : `${n}${shownUnit}`),
    [isAuto, shownUnit],
  );

  const handleValueChange = React.useCallback(
    (n: number) => onChange(`${n}${unit}`),
    [onChange, unit],
  );

  return (
    <ElasticSlider
      label={label}
      value={numValue}
      onValueChange={handleValueChange}
      min={min}
      max={max}
      step={step}
      formatValue={formatValue}
      allowAuto={allowAuto}
      isAuto={isAuto}
      onAutoChange={onAutoChange}
      aria-label={isAuto ? `${label}: Auto` : `${label}: ${numValue}${shownUnit}`}
      className={cn(
        "h-[34px] [--elastic-slider-height:34px]",
        "[--elastic-slider-bg:var(--background)]",
        "[--elastic-slider-fill:var(--secondary)]",
        "[--elastic-slider-fill-active:var(--secondary)]",
        "[&_[data-slot=elastic-slider-label]]:start-2 [&_[data-slot=elastic-slider-label]]:text-base [&_[data-slot=elastic-slider-label]]:font-normal",
        "[&_[data-slot=elastic-slider-value]]:end-[11px] [&_[data-slot=elastic-slider-value]]:text-[13px] [&_[data-slot=elastic-slider-value]]:tabular-nums",
        className,
      )}
      trackClassName={cn("border border-border/60", className)}
    />
  );
};

/** Convert any CSS color (hex, oklch, rgb, etc.) to #rrggbb for <input type="color"> */
const cssColorToHex = (color: string): string => {
  if (color?.startsWith("#")) return color.slice(0, 7);
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = color;
    return ctx.fillStyle;
  } catch {
    return "#000000";
  }
};

export const StyleColorPicker = ({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) => {
  const hexColor = cssColorToHex(value);
  const textInputRef = React.useRef<HTMLInputElement>(null);

  // Sync text input from prop changes (without stealing focus)
  React.useEffect(() => {
    if (textInputRef.current && textInputRef.current !== document.activeElement) {
      textInputRef.current.value = hexColor.toUpperCase();
    }
  }, [hexColor]);

  return (
    <div
      className={cn(
        "flex min-h-8.5 items-center gap-3 overflow-clip bg-secondary py-1.75 pr-[3px] pl-2.5",
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
            const val = e.target.value.trim();
            if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
              onChange(val);
            }
          }}
          className="w-[60px] bg-transparent text-right font-mono text-[11px] text-muted-foreground uppercase tabular-nums outline-none"
          maxLength={7}
        />
        <div
          className="relative h-[18px] w-[18px] shrink-0 cursor-pointer overflow-hidden rounded-[4px] border border-border/60"
          style={{ backgroundColor: hexColor }}
        >
          <input
            type="color"
            value={hexColor}
            aria-label={`${label} color picker`}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
};

export const StyleSelect = ({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: {
    label: string;
    value: string;
    description?: string;
    swatchColor?: string;
  }[];
  className?: string;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [portalTarget] = React.useState<HTMLElement | null>(() =>
    typeof document !== "undefined" ? document.body : null,
  );
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
    width: number;
    above: boolean;
  } | null>(null);
  const selectedOption = options.find((o) => o.value === value);
  const hasDescriptions = options.some((o) => o.description);
  const itemHeight = hasDescriptions ? 60 : 36;

  const updatePos = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dropdownHeight = 8 + options.length * itemHeight;
    const maxHeight = 320;
    const clampedHeight = Math.min(dropdownHeight, maxHeight);
    const spaceBelow = window.innerHeight - rect.bottom - 4;
    const above = spaceBelow < clampedHeight && rect.top > spaceBelow;
    setPos({
      top: above ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      above,
    });
  }, [options.length, itemHeight]);

  React.useEffect(() => {
    if (!isOpen) return;
    updatePos();

    const handleScroll = () => updatePos();
    window.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen, updatePos]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-[34px] w-full items-center justify-between rounded-lg border border-border/60 bg-transparent px-3 text-[13px] transition-colors hover:bg-accent/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          isOpen && "border-border/80 bg-accent/50",
        )}
      >
        <span className="text-muted-foreground">{label}</span>
        <div className="ml-auto flex items-center gap-2">
          {selectedOption?.swatchColor && (
            <div
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-border/60"
              style={{ backgroundColor: selectedOption.swatchColor }}
            />
          )}
          <span className="text-foreground">{selectedOption?.label ?? value}</span>
          <motion.svg
            className="h-3.5 w-3.5 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: "spring", visualDuration: 0.2, bounce: 0.15 }}
          >
            <path d="M6 9.5L12 15.5L18 9.5" />
          </motion.svg>
        </div>
      </button>

      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {isOpen && pos && (
              <motion.div
                ref={dropdownRef}
                className="z-9999 overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-lg backdrop-blur-md"
                initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.95 }}
                transition={{ type: "spring", visualDuration: 0.15, bounce: 0 }}
                style={{
                  position: "fixed",
                  left: pos.left,
                  width: pos.width,
                  maxHeight: 320,
                  ...(pos.above
                    ? {
                        bottom: window.innerHeight - pos.top,
                        transformOrigin: "bottom",
                      }
                    : { top: pos.top, transformOrigin: "top" }),
                }}
              >
                <div className="custom-scrollbar flex max-h-[312px] flex-col overflow-y-auto p-1">
                  {options.map((option) => {
                    const isSelected = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={cn(
                          "group flex w-full shrink-0 items-center justify-between rounded-md text-left transition-colors",
                          hasDescriptions ? "px-3 py-2.5" : "px-2 py-1.5",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {option.swatchColor && (
                            <div
                              className="h-5 w-5 shrink-0 rounded-full border border-border/60"
                              style={{ backgroundColor: option.swatchColor }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-[13px] capitalize">{option.label}</div>
                            {option.description && (
                              <div className="mt-0.5 text-[11px] text-muted-foreground">
                                {option.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <svg
                            className="ml-2 h-3.5 w-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget,
        )}
    </div>
  );
};

export const StyleToggle = ({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = useLazyRef(() => new Map<boolean, HTMLButtonElement>());
  const [pillStyle, setPillStyle] = React.useState<{
    left: number;
    width: number;
  } | null>(null);
  const hasAnimated = React.useRef(false);

  useIsomorphicLayoutEffect(() => {
    const button = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setPillStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, [value]);

  return (
    <div
      className={cn(
        "flex h-[34px] items-center justify-between rounded-lg border border-border/60 bg-transparent pr-1 pl-4",
        className,
      )}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <div
        ref={containerRef}
        className="relative isolation-auto flex h-[26px] items-center rounded-md"
      >
        {pillStyle && (
          <motion.div
            className="absolute top-0.5 bottom-0.5 z-0 rounded bg-white/10"
            style={{ left: pillStyle.left, width: pillStyle.width }}
            animate={{ left: pillStyle.left, width: pillStyle.width }}
            transition={
              hasAnimated.current
                ? { type: "spring", visualDuration: 0.2, bounce: 0.15 }
                : { duration: 0 }
            }
            onAnimationComplete={() => {
              hasAnimated.current = true;
            }}
          />
        )}
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set(false, el);
          }}
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "relative z-10 flex h-full min-w-[34px] cursor-pointer items-center justify-center rounded px-3 text-[11px] font-semibold transition-colors",
            !value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Off
        </button>
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set(true, el);
          }}
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "relative z-10 flex h-full min-w-[34px] cursor-pointer items-center justify-center rounded px-3 text-[11px] font-semibold transition-colors",
            value ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          On
        </button>
      </div>
    </div>
  );
};

export const StyleAlignToggle = ({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = useLazyRef(() => new Map<string, HTMLButtonElement>());
  const [pillStyle, setPillStyle] = React.useState<{
    left: number;
    width: number;
  } | null>(null);
  const hasAnimated = React.useRef(false);

  useIsomorphicLayoutEffect(() => {
    const button = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (button && container) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      setPillStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });
    }
  }, [value]);

  return (
    <div
      className={cn(
        "flex h-[32px] items-center overflow-hidden rounded-lg border border-border/60 bg-transparent text-[13px]",
        className,
      )}
    >
      <div className="flex h-full flex-1 items-center border-r border-border/60 bg-transparent px-3 text-muted-foreground select-none">
        {label}
      </div>
      <div
        ref={containerRef}
        className="relative isolation-auto flex h-full flex-none items-center gap-1 px-1"
      >
        {pillStyle && (
          <motion.div
            className="absolute top-1.5 bottom-1.5 z-0 rounded border border-border/40 bg-background"
            style={{ left: pillStyle.left, width: pillStyle.width }}
            animate={{ left: pillStyle.left, width: pillStyle.width }}
            transition={
              hasAnimated.current
                ? { type: "spring", visualDuration: 0.2, bounce: 0.15 }
                : { duration: 0 }
            }
            onAnimationComplete={() => {
              hasAnimated.current = true;
            }}
          />
        )}
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set("left", el);
          }}
          type="button"
          onClick={() => onChange("left")}
          aria-label="Align left"
          className={cn(
            "relative z-10 flex items-center justify-center rounded border border-transparent p-1.5 transition-colors",
            value === "left" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <AlignLeftIcon className="h-[14px] w-[14px]" />
        </button>
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set("center", el);
          }}
          type="button"
          onClick={() => onChange("center")}
          aria-label="Align center"
          className={cn(
            "relative z-10 flex items-center justify-center rounded border border-transparent p-1.5 transition-colors",
            value === "center" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <AlignCenterIcon className="h-[14px] w-[14px]" />
        </button>
        <button
          ref={(el) => {
            if (el) buttonRefs.current.set("right", el);
          }}
          type="button"
          onClick={() => onChange("right")}
          aria-label="Align right"
          className={cn(
            "relative z-10 flex items-center justify-center rounded border border-transparent p-1.5 transition-colors",
            value === "right" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <AlignRightIcon className="h-[14px] w-[14px]" />
        </button>
      </div>
    </div>
  );
};
