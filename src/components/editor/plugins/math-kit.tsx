import { KEYS } from "platejs";
import { createPlatePlugin } from "platejs/react";
import * as React from "react";

const LazyEquationElement = React.lazy(() =>
  import("@/components/ui/equation-node").then((mod) => ({
    default: mod.EquationElement,
  })),
);
const LazyInlineEquationElement = React.lazy(() =>
  import("@/components/ui/equation-node").then((mod) => ({
    default: mod.InlineEquationElement,
  })),
);

// eslint-disable-next-line typescript-eslint/no-explicit-any
const EquationElementLazy = (props: any) => (
  <React.Suspense fallback={<div className="my-1 animate-pulse rounded-sm bg-muted p-3" />}>
    <LazyEquationElement {...props} />
  </React.Suspense>
);
// eslint-disable-next-line typescript-eslint/no-explicit-any
const InlineEquationElementLazy = (props: any) => (
  <React.Suspense
    fallback={<span className="mx-1 inline-block h-5 w-16 animate-pulse rounded-sm bg-muted" />}
  >
    <LazyInlineEquationElement {...props} />
  </React.Suspense>
);

const LightEquationPlugin = createPlatePlugin({
  key: KEYS.equation,
  node: { isElement: true, isVoid: true },
}).withComponent(EquationElementLazy);

const LightInlineEquationPlugin = createPlatePlugin({
  key: KEYS.inlineEquation,
  node: { isElement: true, isInline: true, isVoid: true },
}).withComponent(InlineEquationElementLazy);

export const MathKit = [LightInlineEquationPlugin, LightEquationPlugin];
