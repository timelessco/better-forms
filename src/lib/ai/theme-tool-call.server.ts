import { valibotSchema } from "@ai-sdk/valibot";
import { generateText, tool } from "ai";
import type { LanguageModel, ModelMessage } from "ai";
import * as v from "valibot";
import { freeThemeSchema, RADIUS_OPTIONS, themeTokensSchema } from "@/lib/ai/ops-schema";
import { flattenFreeThemeArgs, flattenProThemeArgs } from "@/lib/ai/theme-route-helpers";
import type { ThemePromptPick } from "@/lib/ai/theme-route-helpers";
import { incrementAiCount } from "@/lib/server-fn/ai-quota.server";
import { logger } from "@/lib/utils";

// Pro tool args — full 30 light:/dark: tokens + font + radius.
const proThemeArgsSchema = v.object({
  tokens: themeTokensSchema,
  font: v.string(),
  radius: v.picklist(RADIUS_OPTIONS),
});

const PRO_TOOL_DESCRIPTION =
  "Apply a complete visual theme to the form (colors, font, radius). Call exactly once with all 30 token values, font, and radius.";
const FREE_TOOL_DESCRIPTION =
  "Apply a basic theme available on the free plan. Call exactly once with themeColor, baseColor, font, radius, and defaultMode — each value must be from the allowed list in the system prompt.";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Single required-tool call that captures the model's one-shot theme args. Generic over the
// arg schema so pro + free share one implementation.
const captureThemeArgs = async <S extends v.GenericSchema>(opts: {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  toolName: string;
  schema: S;
  description: string;
}): Promise<v.InferOutput<S> | null> => {
  const { model, system, messages, toolName, schema, description } = opts;
  let captured: v.InferOutput<S> | null = null;

  await generateText({
    model,
    system,
    messages,
    toolChoice: "required",
    tools: {
      [toolName]: tool({
        description,
        inputSchema: valibotSchema(schema),
        execute: async (args: v.InferOutput<S>) => {
          captured = args;
          return { ok: true };
        },
      }),
    },
  });

  // Re-bind so TS narrows past the null check — assignment happens in the closure, flow analysis can't reach it via the `let`.
  return captured as v.InferOutput<S> | null;
};

/** Theme mode: one-shot, non-streaming tool call. Pro gets the full 30-token tool; free gets
 * the gated tool. Captures args, flattens to a customization dict, increments quota, and
 * returns the JSON Response (or a 502 if the model emitted nothing). */
export const runThemeToolCall = async (opts: {
  themePick: ThemePromptPick;
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  orgId: string | null;
}): Promise<Response> => {
  const { themePick, model, system, messages, orgId } = opts;
  const isPro = themePick.isPro;

  const captured = await captureThemeArgs({
    model,
    system,
    messages,
    toolName: themePick.toolName,
    schema: isPro ? proThemeArgsSchema : freeThemeSchema,
    description: isPro ? PRO_TOOL_DESCRIPTION : FREE_TOOL_DESCRIPTION,
  });

  if (!captured) {
    return jsonResponse({ error: "model_did_not_emit_theme" }, 502);
  }

  const theme = isPro
    ? flattenProThemeArgs(captured as v.InferOutput<typeof proThemeArgsSchema>)
    : flattenFreeThemeArgs(captured as v.InferOutput<typeof freeThemeSchema>);

  if (orgId) void incrementAiCount(orgId).catch((e) => logger("[ai-quota] increment failed", e));

  return jsonResponse({ theme }, 200);
};
