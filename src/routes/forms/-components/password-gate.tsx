import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/ui/icons";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/contexts/translation-context";
import { verifyFormPassword } from "@/lib/server-fn/public-form-view";

interface PasswordGateProps {
  formId: string;
  children: React.ReactNode;
}

const getStorageKey = (formId: string) => `bf-unlocked-${formId}`;

export const PasswordGate = ({ formId, children }: PasswordGateProps) => {
  const { t } = useTranslation();
  // eslint-disable-next-line react-doctor/rerender-state-only-in-handlers -- value gates the children render below
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(getStorageKey(formId)) === "1";
    } catch {
      // sessionStorage unavailable
      return false;
    }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  const triggerShake = useCallback(() => {
    // Defer a frame so class lands after setError re-render flush — else recomputed className strips the shake before it plays. `t-shake` = animation-only helper (transitions.css).
    requestAnimationFrame(() => {
      const input = passwordInputRef.current;
      if (!input) return;
      input.classList.remove("t-shake");
      void input.offsetWidth;
      input.classList.add("t-shake");
      setTimeout(() => input.classList.remove("t-shake"), 320);
    });
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError(t("pleaseEnterPassword"));
      triggerShake();
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const result = await verifyFormPassword({
          data: { formId, password },
        });

        if (result.valid) {
          try {
            sessionStorage.setItem(getStorageKey(formId), "1");
          } catch {
            // sessionStorage unavailable
          }
          setUnlocked(true);
        } else {
          setError(t("incorrectPassword"));
          triggerShake();
        }
      } catch {
        setError(t("somethingWentWrong"));
        triggerShake();
      }
    });
  }, [formId, password, t, triggerShake]);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Blurred form behind — clipped to viewport so it doesn't cause scroll */}
      <div className="pointer-events-none h-screen overflow-hidden select-none" aria-hidden="true">
        <div className="opacity-50 blur-md">{children}</div>
      </div>

      {/* Password overlay — fixed to viewport */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-muted p-3">
                <LockIcon className="size-8 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-semibold">{t("passwordProtected")}</h2>
              <p className="text-sm text-muted-foreground">{t("passwordDescription")}</p>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("enterPassword")}
                  aria-label="Password"
                  autoComplete="off"
                  name="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleUnlock();
                  }}
                  className="pr-10"
                  ref={passwordInputRef}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button onClick={handleUnlock} disabled={isPending} className="w-full">
                {isPending ? t("verifying") : t("unlock")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
