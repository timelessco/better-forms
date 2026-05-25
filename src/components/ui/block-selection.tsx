import { useBlockSelected } from "@platejs/selection/react";
import { cva } from "class-variance-authority";
import type { PlateElementProps } from "platejs/react";

// Highlight covers the inner block's content box via inset-0 by default.
// Field labels override this in styles.css to negative top/bottom (calc'd
// from --bf-field-gap and --bf-block-margin) so consecutive selections
// render as Notion-style pills with a uniform --bf-block-margin visible
// gap, regardless of the larger layout spacing around labels.
export const blockSelectionVariants = cva(
  "pointer-events-none absolute inset-0 z-1 rounded-lg bg-[rgba(32,117,224,0.13)] transition-opacity dark:bg-[rgba(64,119,189,0.2)]",
  {
    defaultVariants: {
      active: true,
    },
    variants: {
      active: {
        false: "opacity-0",
        true: "opacity-100",
      },
    },
  },
);

// Only the plugin key is read here, so accept anything with that field. Lets
// callers (including void-element components like FormFileUploadElement)
// render this directly without satisfying the full PlateElementProps shape
// — they don't have `children` to forward.
type BlockSelectionProps = Pick<PlateElementProps, "plugin">;

export const BlockSelection = (props: BlockSelectionProps) => {
  const isBlockSelected = useBlockSelected();

  if (!isBlockSelected || props.plugin.key === "tr" || props.plugin.key === "table") return null;

  return (
    <div
      className={blockSelectionVariants({
        active: isBlockSelected,
      })}
      data-slot="block-selection"
    />
  );
};
