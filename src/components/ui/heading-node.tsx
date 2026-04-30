import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

const headingVariants = cva("relative", {
  variants: {
    variant: {
      h1: "font-heading text-4xl font-bold",
      h2: "font-heading text-2xl font-semibold",
      h3: "font-heading text-xl font-semibold",
      h4: "font-heading text-lg font-semibold",
      h5: "text-lg font-semibold",
      h6: "text-base font-semibold",
    },
  },
});

export const HeadingElement = ({
  variant = "h1",
  ...props
}: PlateElementProps & VariantProps<typeof headingVariants>) => (
  <PlateElement as={variant ?? "h1"} className={headingVariants({ variant })} {...props}>
    {props.children}
  </PlateElement>
);

export const H1Element = (props: PlateElementProps) => <HeadingElement variant="h1" {...props} />;

export const H2Element = (props: PlateElementProps) => <HeadingElement variant="h2" {...props} />;

export const H3Element = (props: PlateElementProps) => <HeadingElement variant="h3" {...props} />;

export const H4Element = (props: PlateElementProps) => <HeadingElement variant="h4" {...props} />;

export const H5Element = (props: PlateElementProps) => <HeadingElement variant="h5" {...props} />;

export const H6Element = (props: PlateElementProps) => <HeadingElement variant="h6" {...props} />;
