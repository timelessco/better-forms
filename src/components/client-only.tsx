import { type ReactNode, useSyncExternalStore } from "react";

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return mounted ? children : fallback;
}
