import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

interface ClientOnlyProps {
  children: ReactElement | ReactNode | (() => ReactElement | ReactNode);
  fallback?: ReactNode;
}

export const ClientOnly = ({ children, fallback = null }: ClientOnlyProps) => {
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value gates the early-return fallback render below
  const [mounted, setMounted] = useState(false);

  useMountEffect(() => {
    setMounted(true);
  });

  if (!mounted) {
    return <>{fallback}</>;
  }

  if (typeof children === "function") {
    return <>{children()}</>;
  }

  return <>{children}</>;
};
