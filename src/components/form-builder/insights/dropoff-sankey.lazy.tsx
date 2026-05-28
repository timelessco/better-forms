import { lazy } from "react";

// Recharts is heavy; code-split the Flow funnel so it only loads when the Flow tab renders.
export const DropoffSankey = lazy(() =>
  import("./dropoff-sankey").then((m) => ({ default: m.DropoffSankey })),
);
