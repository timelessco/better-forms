import type { ServerPlan } from "@/lib/server-fn/plan-helpers";
import { FORM_THEME_FREE_SYSTEM_PROMPT, FORM_THEME_SYSTEM_PROMPT } from "@/lib/ai/system-prompts";
import type { FreeThemeArgs } from "@/lib/ai/ops-schema";

export type ProThemeArgs = {
  tokens: Record<string, string>;
  font: string;
  radius: "none" | "small" | "medium" | "large";
};

export type ThemePromptPick = {
  prompt: string;
  toolName: "setFormTheme" | "setFormThemeFree";
  isPro: boolean;
};

/** Pure plan → (prompt, tool) routing. Pro/Business get the full 30-token tool;
 * everything else (incl. unknown plans) gets the gated free tool. Unknown → free
 * is intentional: gate down, not up, on unexpected plan values. */
export const pickThemePromptForPlan = (plan: ServerPlan): ThemePromptPick => {
  if (plan === "pro" || plan === "business") {
    return {
      prompt: FORM_THEME_SYSTEM_PROMPT,
      toolName: "setFormTheme",
      isPro: true,
    };
  }
  return {
    prompt: FORM_THEME_FREE_SYSTEM_PROMPT,
    toolName: "setFormThemeFree",
    isPro: false,
  };
};

/** Flatten Pro tool args into a customization dict the client can spread. */
export const flattenProThemeArgs = (args: ProThemeArgs): Record<string, string> => ({
  ...args.tokens,
  font: args.font,
  radius: args.radius,
});

/** Flatten Free tool args into a customization dict the client can spread. */
export const flattenFreeThemeArgs = (args: FreeThemeArgs): Record<string, string> => ({
  themeColor: args.themeColor,
  baseColor: args.baseColor,
  font: args.font,
  radius: args.radius,
  defaultMode: args.defaultMode,
});
