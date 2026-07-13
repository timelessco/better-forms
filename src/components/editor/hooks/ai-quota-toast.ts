import { toast } from "sonner";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";

// 429 AI-limit codes, normalized. Short-window burst ("rate-limited" → slow down) vs daily
// quota ("daily-limit" → Upgrade CTA).
export type AiQuotaCode = "rate-limited" | "daily-limit";

const AI_RATE_LIMIT_MESSAGE = "Too many AI requests. Please wait a moment before generating again.";
const AI_DAILY_LIMIT_MESSAGE = "Daily AI limit reached. Upgrade to Pro for unlimited generations.";

// Map a structured server error code to the normalized quota kind, or null if it isn't one.
export const parseAiQuotaCode = (code: string | undefined): AiQuotaCode | null => {
  if (code === "quota/ai-rate-limited") return "rate-limited";
  if (code === "quota/ai-daily-limit") return "daily-limit";
  return null;
};

// Single source of the AI-limit toast UX (incl. the daily-limit Upgrade-to-Pro action).
// `message` overrides the default copy (the theme path forwards the server body message).
export const showAiQuotaToast = (code: AiQuotaCode, message?: string): void => {
  if (code === "rate-limited") {
    toast.error(message || AI_RATE_LIMIT_MESSAGE);
    return;
  }
  toast.error(message || AI_DAILY_LIMIT_MESSAGE, {
    action: {
      label: "Upgrade to Pro",
      onClick: () => settingsDialogStore.open("billing"),
    },
  });
};
