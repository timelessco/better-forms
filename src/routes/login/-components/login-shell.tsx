import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

// Shared centered login scaffold (logo header + content main) for the login routes.
export const LoginShell = ({ children }: { children: ReactNode }) => (
  <div className="mx-auto flex min-h-dvh max-w-[300px] flex-col justify-center">
    <header className="mb-[54px] flex items-center justify-center">
      <Logo className="h-10 w-6 text-foreground/90" />
    </header>
    <main className="flex flex-col items-center justify-center gap-4">{children}</main>
  </div>
);
