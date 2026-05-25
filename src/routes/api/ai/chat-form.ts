import { createFileRoute } from "@tanstack/react-router";
import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";
import { generateText, tool } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { formSettings, forms, formVersions, organization, workspaces } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { planUnlocks } from "@/lib/config/plan-gates";
import { answerableQuestions, buildSystemPrompt, monthKey } from "@/lib/ai/chat-form-helpers";
import { transformPlateStateToFormElements } from "@/lib/editor/transform-plate-to-form";
import type { Value } from "platejs";
import {
  AI_CHAT_CAP_ERROR,
  AI_CHAT_PREVIEW_CAP_ERROR,
  checkChatSessionCap,
  checkPreviewQuota,
  incrementPreviewCount,
  isExistingChatSession,
  markChatSessionStarted,
} from "@/lib/server-fn/ai-chat-quota.server";
import {
  AI_CHAT_RATE_LIMIT_ERROR,
  checkChatRateLimit,
} from "@/lib/server-fn/ai-chat-rate-limit.server";
import { getActiveOrgId } from "@/lib/server-fn/auth-helpers";
import { getOrgPlanWithPolarSync } from "@/lib/server-fn/plan-helpers.server";
import { isServerPlan } from "@/lib/server-fn/plan-helpers";
import type { TransformedElement } from "@/lib/editor/transform-plate-to-form";
import { buildPublicFormSettings, defaultFormSettings } from "@/types/form-settings";
import type { AiChatTone } from "@/types/form-settings";
import { logger } from "@/lib/utils";
import type { AiToolEmission } from "@/components/form-components/ai-chat-form/types";

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
  const { createOpenAI } = await import("@ai-sdk/openai");
  const openai = createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return openai(modelId);
};

const bodySchema = z.object({
  intent: z.enum(["start", "advance", "parse-and-advance", "finish"]),
  formId: z.uuid(),
  submissionId: z.string().min(1),
  currentQuestionId: z.string().optional(),
  userText: z.string().max(4000).optional(),
  // Client-driven prior-answer threading — lets the AI personalize prose
  // (e.g. address the Respondent by name once they've given it).
  // Server is read-only against this map; the submission table owns truth.
  priorAnswers: z.record(z.string(), z.unknown()).optional(),
  // Optional Zod-validation error from the previous parse attempt. When set,
  // the system prompt tells the AI exactly why the prior parse failed so it
  // can produce a more specific re-ask (e.g. "I need a URL with https://").
  validationError: z.string().max(500).optional(),
  isPreview: z.boolean().optional(),
});

type ChatFormBody = z.infer<typeof bodySchema>;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const askQuestionInput = z.object({
  prompt: z.string().min(1),
  ackPrior: z.string().optional(),
});
const confirmParseInput = z.object({
  parsedValue: z.unknown(),
  prompt: z.string().min(1),
  // Set when the Respondent explicitly declines / has no value / asks to skip,
  // so the client can skip an optional Question immediately instead of re-asking.
  declined: z.boolean().optional(),
});
const closingInput = z.object({ message: z.string().min(1) });

type FormLoadResult = {
  formId: string;
  organizationId: string;
  orgPlan: string;
  content: TransformedElement[];
  formTitle: string;
  settings: ReturnType<typeof buildPublicFormSettings>;
};

const loadPublishedFormForChat = async (formId: string): Promise<FormLoadResult | null> => {
  const [row] = await db
    .select({
      id: forms.id,
      organizationId: organization.id,
      orgPlan: organization.plan,
      liveSettings: formSettings.settings,
      versionContent: formVersions.content,
      versionTitle: formVersions.title,
    })
    .from(forms)
    .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
    .innerJoin(organization, eq(organization.id, workspaces.organizationId))
    .innerJoin(formVersions, eq(formVersions.id, forms.lastPublishedVersionId))
    .leftJoin(formSettings, eq(formSettings.formId, forms.id))
    .where(and(eq(forms.id, formId), eq(forms.status, "published")));
  if (!row) return null;

  return {
    formId: row.id,
    organizationId: row.organizationId,
    orgPlan: row.orgPlan,
    // Transform raw Plate value into typed Form Elements; the published
    // snapshot in `formVersions.content` is the raw editor doc, not the
    // typed elements `answerableQuestions` expects.
    content: transformPlateStateToFormElements((row.versionContent ?? []) as Value),
    formTitle: (row.versionTitle ?? "Untitled") as string,
    settings: buildPublicFormSettings(row.liveSettings),
  };
};

const loadDraftFormForPreview = async (
  formId: string,
  userId: string,
): Promise<(FormLoadResult & { isOwner: true }) | null> => {
  const [row] = await db
    .select({
      id: forms.id,
      title: forms.title,
      content: forms.content,
      organizationId: organization.id,
      orgPlan: organization.plan,
      draftSettings: forms.draftSettings,
      createdByUserId: forms.createdByUserId,
    })
    .from(forms)
    .innerJoin(workspaces, eq(workspaces.id, forms.workspaceId))
    .innerJoin(organization, eq(organization.id, workspaces.organizationId))
    .where(eq(forms.id, formId));
  if (!row) return null;
  // Owner-only preview: the requesting user must have created the Form.
  // Fuller membership checks are done on the editor routes; this is a
  // lightweight guard for the preview endpoint.
  if (row.createdByUserId !== userId) return null;
  return {
    formId: row.id,
    organizationId: row.organizationId,
    orgPlan: row.orgPlan,
    content: transformPlateStateToFormElements((row.content ?? []) as Value),
    formTitle: row.title,
    settings: buildPublicFormSettings({ ...defaultFormSettings, ...row.draftSettings }),
    isOwner: true,
  };
};

const fallbackProse = (questionLabel: string) => `Let's keep going. ${questionLabel}?`;

const callAiWithRetry = async (
  intent: ChatFormBody["intent"],
  systemPrompt: string,
  userMessage: string,
): Promise<AiToolEmission | { error: "ai_failed" }> => {
  const model = await getModel();

  const tools = {
    askQuestion: tool({
      description:
        "Ask the Respondent the current Question. `prompt` is the natural-language prose to render in a chat bubble. `ackPrior` is an optional brief acknowledgement of the prior Answer.",
      inputSchema: askQuestionInput,
      execute: async (args) => ({ ok: true, args }),
    }),
    confirmParse: tool({
      description:
        "Parse the Respondent's free-text reply into the strict value type for the current Question. `parsedValue` is the structured value; `prompt` is the prose for the next Question. Set `declined: true` (and leave `parsedValue` empty) when the Respondent explicitly declines, says they don't have one, or asks to skip — do NOT set it for a genuine attempt to answer or a question about the form.",
      inputSchema: confirmParseInput,
      execute: async (args) => ({ ok: true, args }),
    }),
    closing: tool({
      description: "Render the closing message after the final Question is answered.",
      inputSchema: closingInput,
      execute: async (args) => ({ ok: true, args }),
    }),
  };

  const toolName: keyof typeof tools =
    intent === "parse-and-advance"
      ? "confirmParse"
      : intent === "finish"
        ? "closing"
        : "askQuestion";

  let captured: AiToolEmission | null = null;

  const attempt = async () => {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      toolChoice: { type: "tool", toolName },
      tools,
    });
    for (const tc of result.toolCalls ?? []) {
      if (tc.toolName === "askQuestion") {
        captured = { tool: "askQuestion", args: askQuestionInput.parse(tc.input) };
      } else if (tc.toolName === "confirmParse") {
        captured = { tool: "confirmParse", args: confirmParseInput.parse(tc.input) };
      } else if (tc.toolName === "closing") {
        captured = { tool: "closing", args: closingInput.parse(tc.input) };
      }
    }
  };

  try {
    await attempt();
  } catch (err) {
    logger("[chat-form] AI attempt failed, retrying", err);
    await new Promise((r) => setTimeout(r, 200));
    try {
      await attempt();
    } catch (err2) {
      logger("[chat-form] AI retry failed", err2);
      return { error: "ai_failed" };
    }
  }

  if (!captured) return { error: "ai_failed" };
  return captured;
};

const getClientIp = (): string => getRequestIP({ xForwardedFor: true }) ?? "unknown";

export const Route = createFileRoute("/api/ai/chat-form")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const ip = getClientIp();
        const rl = await checkChatRateLimit(ip);
        if (!rl.allowed) {
          return json(429, { error: AI_CHAT_RATE_LIMIT_ERROR });
        }

        let body: ChatFormBody;
        try {
          body = bodySchema.parse(await request.json());
        } catch (err) {
          return json(400, { error: "invalid_body", detail: String(err) });
        }

        // ── Editor preview path (auth required, draft form, preview budget) ──
        if (body.isPreview) {
          const session = await auth.api.getSession({ headers: getRequestHeaders() });
          if (!session) return json(401, { error: "unauthorized" });
          const userId = (session as { user: { id: string } }).user.id;
          const form = await loadDraftFormForPreview(body.formId, userId);
          if (!form) return json(404, { error: "form_not_found" });

          if (!isServerPlan(form.orgPlan) || !planUnlocks(form.orgPlan, "aiChatPresentation")) {
            return json(403, { error: "plan_not_eligible" });
          }
          const orgId = getActiveOrgId(session as never) ?? form.organizationId;
          const userEmail = (session as { user?: { email?: string } }).user?.email ?? null;
          const plan = await getOrgPlanWithPolarSync(orgId, userEmail);
          const preview = await checkPreviewQuota(orgId, plan);
          // The daily preview cap is enforced only in production — locally,
          // builders iterate freely without burning through it.
          if (!preview.allowed && process.env.NODE_ENV === "production") {
            return json(429, {
              error: AI_CHAT_PREVIEW_CAP_ERROR,
              used: preview.used,
              limit: preview.limit,
            });
          }

          const out = await runAiTurn(body, form);
          if ("error" in out) return json(out.status, out.body);
          void incrementPreviewCount(orgId).catch((e) =>
            logger("[chat-form] preview count failed", e),
          );
          return json(200, out.body);
        }

        // ── Respondent path ─────────────────────────────────────────────────
        const form = await loadPublishedFormForChat(body.formId);
        if (!form) return json(404, { error: "form_not_found" });

        if (!isServerPlan(form.orgPlan) || !planUnlocks(form.orgPlan, "aiChatPresentation")) {
          return json(403, { error: "plan_not_eligible" });
        }
        if (form.settings.presentationMode !== "ai-chat") {
          return json(409, { error: "form_mode_not_ai_chat" });
        }

        // Resumes (firstCall=false) skip the cap entirely. For a fresh
        // session, check the cap *before* inserting so a 429 doesn't consume
        // a quota slot.
        const month = monthKey();
        const isResume = await isExistingChatSession(body.submissionId);
        if (!isResume) {
          const cap = await checkChatSessionCap(form.organizationId, form.orgPlan, month);
          if (!cap.allowed) {
            return json(429, {
              error: AI_CHAT_CAP_ERROR,
              used: cap.used,
              limit: cap.limit,
            });
          }
          await markChatSessionStarted(body.submissionId, form.organizationId, month);
        }

        const out = await runAiTurn(body, form);
        if ("error" in out) return json(out.status, out.body);
        return json(200, out.body);
      },
    },
  },
});

const runAiTurn = async (
  body: ChatFormBody,
  form: FormLoadResult,
): Promise<{ body: object } | { error: true; status: number; body: object }> => {
  const questions = answerableQuestions(form.content);
  const questionById = new Map(questions.map((q) => [q.id, q] as const));

  if (body.currentQuestionId && !questionById.has(body.currentQuestionId)) {
    return { error: true, status: 400, body: { error: "unknown_question_id" } };
  }

  // The chat-form endpoint does not write Answers — submission autosave owns
  // persistence. Prior Answers come from the client (which holds the
  // authoritative session state for this turn) so the AI can personalize
  // prose, e.g. address the Respondent by their answered name.
  const priorAnswers = body.priorAnswers ?? {};

  const tone: AiChatTone = form.settings.aiChatTone ?? "friendly";
  const language = form.settings.language ?? "English";
  const greeting = body.intent === "start" ? (form.settings.aiChatGreeting ?? null) : null;

  const systemPrompt = buildSystemPrompt({
    formTitle: form.formTitle,
    tone,
    language,
    content: form.content,
    currentQuestionId: body.currentQuestionId ?? null,
    priorAnswers,
    greeting,
    isStart: body.intent === "start",
    validationError: body.validationError ?? null,
  });

  const userMessage =
    body.intent === "parse-and-advance" && body.userText
      ? body.validationError
        ? `Respondent reply: ${body.userText}\n\nThe previous parse of this same reply failed validation: ${body.validationError}. Re-extract more carefully or, if the reply genuinely cannot be made to satisfy the field, set parsedValue to a sensible empty default and write \`prompt\` as a helpful re-ask explaining the expected format.`
        : `Respondent reply: ${body.userText}`
      : body.intent === "finish"
        ? "Render the closing message."
        : "Generate the next bubble.";

  const result = await callAiWithRetry(body.intent, systemPrompt, userMessage);

  // Deterministic prose fallback when AI fails twice in a row.
  if ("error" in result) {
    const currentQ = body.currentQuestionId ? questionById.get(body.currentQuestionId) : undefined;
    const label =
      currentQ && "label" in currentQ && currentQ.label ? currentQ.label : "your answer";
    if (body.intent === "finish") {
      return {
        body: {
          tool: "closing",
          args: { message: "Thanks — your response has been submitted." },
          fallback: true,
        },
      };
    }
    if (body.intent === "start") {
      return {
        body: {
          tool: "askQuestion",
          args: { prompt: `Welcome to ${form.formTitle}! ${label}?` },
          fallback: true,
        },
      };
    }
    return {
      body: { tool: "askQuestion", args: { prompt: fallbackProse(label) }, fallback: true },
    };
  }

  return { body: { ...result, questionId: body.currentQuestionId ?? null } };
};
