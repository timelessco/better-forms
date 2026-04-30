import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/ui/icons";
import { useCallback, useState, useTransition } from "react";
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

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError(t("pleaseEnterPassword"));
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
        }
      } catch {
        setError(t("somethingWentWrong"));
      }
    });
  }, [formId, password, t]);

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
                <LockIcon className="h-8 w-8 text-muted-foreground" />
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
                    if (e.key === "Enter") handleUnlock();
                  }}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
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
