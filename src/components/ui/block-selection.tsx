import { useBlockSelected } from "@platejs/selection/react";
import { cva } from "class-variance-authority";
import type { PlateElementProps } from "platejs/react";

// Highlight covers the content box via inset-0. Field labels override to negative top/bottom
// (from --bf-field-gap/--bf-block-margin) so consecutive selections read as Notion pills with
// a uniform gap, regardless of label spacing.
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

// Only the plugin key is read, so accept anything with it — lets void-element callers
// (e.g. FormFileUploadElement) render directly without the full PlateElementProps shape.
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
