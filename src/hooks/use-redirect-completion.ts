import { useEffect, useState } from "react";

import type { PublicFormSettings } from "@/types/form-settings";

// Submit-then-redirect countdown. Once submitted, if the form has redirect-on-completion configured,
// either jumps immediately (delay 0) or ticks down N seconds then navigates. Returns the live
// countdown (null = inactive) so the caller can render the "Redirecting in Ns" line.
export const useRedirectCompletion = (isSubmitted: boolean, settings?: PublicFormSettings) => {
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // eslint-disable-next-line react-doctor/no-cascading-set-state -- single state (redirectCountdown) updated via initial set + interval functional updater; not cascading independent state
  useEffect(() => {
    if (!isSubmitted) return;
    if (!settings?.redirectOnCompletion || !settings?.redirectUrl) return;

    const delay = settings.redirectDelay ?? 0;

    if (delay === 0) {
      window.location.href = settings.redirectUrl;
      return;
    }

    setRedirectCountdown(delay);

    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          if (settings.redirectUrl) {
            window.location.href = settings.redirectUrl;
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, settings?.redirectOnCompletion, settings?.redirectUrl, settings?.redirectDelay]);

  return redirectCountdown;
};
