import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamObject } from "ai";
import type { UIMessage } from "ai";
import { valibotSchema } from "@ai-sdk/valibot";
import type { RequestLogger } from "evlog";
import { createAILogger } from "evlog/ai";
import { useRequest as getNitroRequest } from "nitro/context";
import { apiAuthMiddleware } from "@/lib/auth/middleware";
import { formGenSchema } from "@/lib/ai/ops-schema";
import {
  FORM_APPEND_SYSTEM_PROMPT,
  FORM_EDIT_SYSTEM_PROMPT,
  FORM_GEN_SYSTEM_PROMPT,
} from "@/lib/ai/system-prompts";
import { pickThemePromptForPlan } from "@/lib/ai/theme-route-helpers";
import { checkAiGating, resolvePlanAndSession } from "@/lib/ai/request-gating.server";
import { runThemeToolCall } from "@/lib/ai/theme-tool-call.server";
import { incrementAiCount } from "@/lib/server-fn/ai-quota.server";
import { logger } from "@/lib/utils";

const getModel = async () => {
  const provider = process.env.AI_PROVIDER ?? "openai";
  const apiKey = process.env.AI_API_KEY ?? "";
  const modelId = process.env.AI_MODEL ?? "gpt-4o-mini";
  const baseURL = process.env.AI_BASE_URL;

  if (provider === "google") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelId);
  }

  const openai = createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  return openai(modelId);
};

// Public pricing per 1M tokens (USD). Add models as we adopt them.
const AI_COST_MAP = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
} as const;

export const Route = createFileRoute("/api/ai/form-generate")({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const body = (await request.json()) as {
          messages?: UIMessage[];
          editorContent?: string;
          selectionContext?: string;
          mode?: "create" | "append" | "replace" | "theme";
        };

        const messages = body.messages;
        if (!messages || messages.length === 0) {
          return new Response(JSON.stringify({ error: "messages are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const baseModel = await getModel();

        // Wrap model so every AI SDK call adds token usage, tool calls, streaming metrics, cost to the wide event.
        const req = getNitroRequest() as { context?: { log?: RequestLogger } };
        const log = req.context?.log as RequestLogger;
        const ai = createAILogger(log, { cost: AI_COST_MAP });
        const model = ai.wrap(baseModel);

        const mode = body.mode ?? "create";
        log?.set({ formGen: { mode } });

        // Resolve plan + org up front: theme mode → pickThemePromptForPlan (full vs limited tool); all modes → rate-limit (free=5/day, pro/business=∞).
        const { resolvedPlan, resolvedOrgId } = await resolvePlanAndSession(log, mode);

        // Burst + daily-quota gating (org-scoped). null orgId (anon/lookup-failed) skips gating, still gates as free.
        if (resolvedOrgId) {
          const gate = await checkAiGating(resolvedOrgId, resolvedPlan);
          if (gate) return gate;
        }

        log?.set({ formGen: { plan: resolvedPlan, orgId: resolvedOrgId } });

        const themePick = pickThemePromptForPlan(resolvedPlan);
        logger("[ai-plan] tool pick", {
          mode,
          plan: resolvedPlan,
          toolName: themePick.toolName,
          isPro: themePick.isPro,
        });

        const basePrompt =
          mode === "theme"
            ? themePick.prompt
            : mode === "replace"
              ? FORM_EDIT_SYSTEM_PROMPT
              : mode === "append"
                ? FORM_APPEND_SYSTEM_PROMPT
                : FORM_GEN_SYSTEM_PROMPT;

        const contextParts: string[] = [];
        if (body.editorContent) {
          contextParts.push(`Current form content:\n${body.editorContent}`);
        }
        if (body.selectionContext) {
          if (mode === "replace") {
            contextParts.push(
              `The user selected these blocks and asked for an edit — emit replacement ops for ONLY these:\n"""\n${body.selectionContext}\n"""`,
            );
          } else if (mode === "append") {
            contextParts.push(
              `The user has selected these blocks for context — they want to ADD new content (do NOT remove or regenerate the selection):\n"""\n${body.selectionContext}\n"""`,
            );
          } else {
            contextParts.push(
              `The user has selected the following block as context for their request:\n"""\n${body.selectionContext}\n"""`,
            );
          }
        }
        const systemWithContext = contextParts.length
          ? `${basePrompt}\n\n${contextParts.join("\n\n")}`
          : basePrompt;

        const modelMessages = await convertToModelMessages(messages);

        // ── Theme mode: tool-call (one-shot, non-streaming) ─────────────────
        // Theme atomic — no streaming benefit; tool-call gives clear contract. Pro: full tool (30 light:/dark: tokens). Free: limited tool, output stays in gate-allowed keys.
        if (mode === "theme") {
          return runThemeToolCall({
            themePick,
            model,
            system: systemWithContext,
            messages: modelMessages,
            orgId: resolvedOrgId,
          });
        }

        // ── All other modes: structured-output streaming ────────────────────
        const result = streamObject({
          model,
          schema: valibotSchema(formGenSchema),
          system: systemWithContext,
          messages: modelMessages,
        });

        // Increment once model accepts request; mid-stream error still counts (work performed).
        if (resolvedOrgId)
          void incrementAiCount(resolvedOrgId).catch((e) =>
            logger("[ai-quota] increment failed", e),
          );
        return result.toTextStreamResponse();
      },
    },
  },
});
