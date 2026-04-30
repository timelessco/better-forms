import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import type { SlateElementProps } from "platejs/static";
import { SlateElement } from "platejs/static";
import type * as React from "react";

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

export const HeadingElementStatic = ({
  variant = "h1",
  ...props
}: SlateElementProps & VariantProps<typeof headingVariants>) => (
  <SlateElement as={variant ?? "h1"} className={headingVariants({ variant })} {...props}>
    {props.children}
  </SlateElement>
);

export const H1ElementStatic = (props: SlateElementProps) => (
  <HeadingElementStatic variant="h1" {...props} />
);

export const H2ElementStatic = (props: React.ComponentProps<typeof HeadingElementStatic>) => (
  <HeadingElementStatic variant="h2" {...props} />
);

export const H3ElementStatic = (props: React.ComponentProps<typeof HeadingElementStatic>) => (
  <HeadingElementStatic variant="h3" {...props} />
);

export const H4ElementStatic = (props: React.ComponentProps<typeof HeadingElementStatic>) => (
  <HeadingElementStatic variant="h4" {...props} />
);

export const H5ElementStatic = (props: React.ComponentProps<typeof HeadingElementStatic>) => (
  <HeadingElementStatic variant="h5" {...props} />
);

export const H6ElementStatic = (props: React.ComponentProps<typeof HeadingElementStatic>) => (
  <HeadingElementStatic variant="h6" {...props} />
);
