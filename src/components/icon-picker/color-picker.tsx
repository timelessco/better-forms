import { useRef } from "react";

import { cn } from "@/lib/utils";

// prettier-ignore
const DEFAULT_COLORS = [
	"#ffffff", "#000000",
	"#ff2d5f", "#ff339b", "#ea35f7", "#a14fff", "#5a46fa",
	"#0082ff", "#00a9ef", "#00b0ff", "#00bec9", "#00bc7b",
	"#00cb49", "#6ccf00", "#f4b100", "#ff9900", "#ff6800",
	"#ff2a39", "#d2b24d", "#ce8849", "#003468",
];

type ColorPickerProps = {
  onChange: (value: string) => void;
  selectedColor: string;
  colors?: string[];
};

export const ColorPicker = ({ onChange, selectedColor, colors }: ColorPickerProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const isDark = ref.current?.closest(".dark") != null;

  const COLORS = colors || DEFAULT_COLORS;

  // Swap first two colors (white/black) in dark mode for better visibility (only for default palette)
  const displayColors =
    !colors && isDark && COLORS.length >= 2 ? [COLORS[1], COLORS[0], ...COLORS.slice(2)] : COLORS;

  const swapFirstTwo = (color: string) => {
    if (colors || !isDark || COLORS.length < 2) {
      return color;
    }

    if (color === COLORS[0]) {
      return COLORS[1];
    }

    if (color === COLORS[1]) {
      return COLORS[0];
    }

    return color;
  };

  const mappedSelected = swapFirstTwo(selectedColor);
  const baseLightColor = !colors ? COLORS[0] : null;

  return (
    <div ref={ref} className={cn("flex", "cursor-pointer", "items-center", "space-x-1")}>
      {displayColors.map((colorItem) => (
        <div
          className={cn("rounded-md", "p-1", "hover:bg-muted", {
            "bg-muted": colorItem === mappedSelected,
          })}
          key={colorItem}
        >
          <button
            aria-label={`Select ${colorItem} color`}
            aria-pressed={colorItem === mappedSelected}
            className={cn(
              "h-4",
              "w-4",
              "rounded-full",
              "border",
              "p-1",
              {
                "border-foreground": colorItem === baseLightColor,
              },
              {
                "border-transparent": colorItem !== baseLightColor,
              },
            )}
            onClick={() => onChange(swapFirstTwo(colorItem))}
            style={{ backgroundColor: colorItem }}
            type="button"
          />
        </div>
      ))}
    </div>
  );
};
