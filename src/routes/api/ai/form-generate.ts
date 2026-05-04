import { createOpenAI } from "@ai-sdk/openai";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, generateText, streamObject, tool } from "ai";
import type { UIMessage } from "ai";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { apiAuthMiddleware } from "@/lib/auth/middleware";
import {
  formGenSchema,
  freeThemeSchema,
  RADIUS_OPTIONS,
  themeTokensSchema,
} from "@/lib/ai/ops-schema";
import {
  FORM_APPEND_SYSTEM_PROMPT,
  FORM_EDIT_SYSTEM_PROMPT,
  FORM_GEN_SYSTEM_PROMPT,
} from "@/lib/ai/system-prompts";
import {
  flattenFreeThemeArgs,
  flattenProThemeArgs,
  pickThemePromptForPlan,
} from "@/lib/ai/theme-route-helpers";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { getOrgPlanWithPolarSync } from "@/lib/server-fn/plan-helpers.server";
import {
  AI_DAILY_LIMIT_ERROR,
  checkAiQuota,
  incrementAiCount,
} from "@/lib/server-fn/ai-quota.server";
import type { ServerPlan } from "@/lib/server-fn/plan-helpers";
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

        const model = await getModel();

        const mode = body.mode ?? "create";

        // Resolve plan + active org up front for every mode. Used by:
        // 1. Theme mode → pickThemePromptForPlan (full vs limited tool).
        // 2. All modes → AI rate-limit check (free=5/day, pro/business=∞).
        let resolvedPlan: ServerPlan = "free";
        let resolvedOrgId: string | null = null;
        let planLookupError: string | null = null;
        try {
          const { auth } = await import("@/lib/auth/auth");
          const session = await auth.api.getSession({ headers: getRequestHeaders() });
          logger("[ai-plan] session present?", Boolean(session), {
            userId: (session as { user?: { id?: string } } | null)?.user?.id ?? null,
            activeOrganizationId:
              (session as { session?: { activeOrganizationId?: string } } | null)?.session
                ?.activeOrganizationId ?? null,
          });
          if (session) {
            resolvedOrgId = getActiveOrgId(session as never);
            const userEmail =
              (session as { user?: { email?: string } } | null)?.user?.email ?? null;
            // Self-heal: if the DB column is stale (webhook missed), Polar
            // is consulted with the user's email; on drift the column is
            // rewritten to the real plan. Fast path (column already paid)
            // skips the Polar round-trip.
            resolvedPlan = await getOrgPlanWithPolarSync(resolvedOrgId, userEmail);
            logger("[ai-plan] resolved", {
              mode,
              orgId: resolvedOrgId,
              plan: resolvedPlan,
              note: "plan is read from organization.plan DB column (Polar webhook syncs it; route falls back to Polar API on cached='free')",
            });
          } else {
            logger("[ai-plan] no session — defaulting to free, orgId=null");
          }
        } catch (e) {
          planLookupError = e instanceof Error ? e.message : String(e);
          logger("[ai-plan] lookup threw — falling back to free", planLookupError);
          // Fall through with resolvedPlan="free", resolvedOrgId=null;
          // null orgId skips quota tracking but still gates with free path.
        }

        // Rate-limit check. Pro/business get null limit → always allowed.
        if (resolvedOrgId) {
          const quota = await checkAiQuota(resolvedOrgId, resolvedPlan);
          logger("[ai-quota] check", {
            orgId: resolvedOrgId,
            plan: resolvedPlan,
            allowed: quota.allowed,
            used: quota.used,
            limit: quota.limit,
          });
          if (!quota.allowed) {
            return new Response(
              JSON.stringify({
                error: AI_DAILY_LIMIT_ERROR,
                used: quota.used,
                limit: quota.limit,
                plan: quota.plan,
                message: `Daily AI limit reached (${quota.used}/${quota.limit}). Upgrade to Pro for unlimited generations.`,
              }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }
        }

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

        const modelMessages = await Promise.resolve(convertToModelMessages(messages));

        // ── Theme mode: tool-call (one-shot, non-streaming) ─────────────────
        // Theme is atomic — no benefit to streaming, and tool-call gives the
        // model a clear contract. Pro plans get the full-fidelity tool with
        // 30 light:/dark: token overrides; free plans get the limited tool
        // whose output stays inside the gate-allowed customization keys.
        if (mode === "theme") {
          if (themePick.isPro) {
            const setFormThemeArgs = z.object({
              tokens: themeTokensSchema,
              font: z.string(),
              radius: z.enum(RADIUS_OPTIONS),
            });

            let captured: z.infer<typeof setFormThemeArgs> | null = null;

            await generateText({
              model,
              system: systemWithContext,
              messages: modelMessages,
              toolChoice: "required",
              tools: {
                [themePick.toolName]: tool({
                  description:
                    "Apply a complete visual theme to the form (colors, font, radius). Call exactly once with all 30 token values, font, and radius.",
                  inputSchema: setFormThemeArgs,
                  execute: async (args) => {
                    captured = args;
                    return { ok: true };
                  },
                }),
              },
            });

            // Re-bind to a const so TS narrows after the null check (the
            // assignment lives in a closure, so flow analysis can't reach it
            // through the original `let`).
            const captured2 = captured as z.infer<typeof setFormThemeArgs> | null;
            if (!captured2) {
              return new Response(JSON.stringify({ error: "model_did_not_emit_theme" }), {
                status: 502,
                headers: { "Content-Type": "application/json" },
              });
            }

            const theme = flattenProThemeArgs(captured2);
            if (resolvedOrgId)
              void incrementAiCount(resolvedOrgId).catch((e) =>
                logger("[ai-quota] increment failed", e),
              );
            return new Response(JSON.stringify({ theme }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Free plan: limited tool — themeColor + baseColor + font + radius + defaultMode.
          let captured: z.infer<typeof freeThemeSchema> | null = null;

          await generateText({
            model,
            system: systemWithContext,
            messages: modelMessages,
            toolChoice: "required",
            tools: {
              [themePick.toolName]: tool({
                description:
                  "Apply a basic theme available on the free plan. Call exactly once with themeColor, baseColor, font, radius, and defaultMode — each value must be from the allowed list in the system prompt.",
                inputSchema: freeThemeSchema,
                execute: async (args) => {
                  captured = args;
                  return { ok: true };
                },
              }),
            },
          });

          const capturedFree = captured as z.infer<typeof freeThemeSchema> | null;
          if (!capturedFree) {
            return new Response(JSON.stringify({ error: "model_did_not_emit_theme" }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            });
          }

          const theme = flattenFreeThemeArgs(capturedFree);
          if (resolvedOrgId)
            void incrementAiCount(resolvedOrgId).catch((e) =>
              logger("[ai-quota] increment failed", e),
            );
          return new Response(JSON.stringify({ theme }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // ── All other modes: structured-output streaming ────────────────────
        const result = streamObject({
          model,
          schema: formGenSchema,
          system: systemWithContext,
          messages: modelMessages,
        });

        // Streaming hands the response off to the client; we increment once
        // we know the model accepted the request. If the stream errors out
        // mid-way, that still counts as a generation (work was performed).
        if (resolvedOrgId)
          void incrementAiCount(resolvedOrgId).catch((e) =>
            logger("[ai-quota] increment failed", e),
          );
        return result.toTextStreamResponse();
      },
    },
  },
});
