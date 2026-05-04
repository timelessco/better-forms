import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { formFavorites } from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { getActiveOrgId } from "./auth-helpers";
import { authForm } from "./auth-helpers.server";

export const getFavorites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id;

    const favs = await db.select().from(formFavorites).where(eq(formFavorites.userId, userId));

    return favs.map((f) => ({
      id: f.id,
      userId: f.userId,
      formId: f.formId,
      sortIndex: f.sortIndex,
      createdAt: f.createdAt.toISOString(),
    }));
  });

export const addFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
      sortIndex: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    // Per-form authorization — without this, any authenticated user could
    // write favorite rows referencing arbitrary form ids in other orgs.
    await authForm(data.formId, userId, getActiveOrgId(context.session));
    const id = `${userId}:${data.formId}`;

    await db
      .insert(formFavorites)
      .values({
        id,
        userId,
        formId: data.formId,
        sortIndex: data.sortIndex ?? null,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  });

export const removeFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ formId: z.uuid() }))
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    await authForm(data.formId, userId, getActiveOrgId(context.session));

    await db
      .delete(formFavorites)
      .where(and(eq(formFavorites.userId, userId), eq(formFavorites.formId, data.formId)));
  });

export const reorderFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      formId: z.uuid(),
      sortIndex: z.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    await authForm(data.formId, userId, getActiveOrgId(context.session));

    await db
      .update(formFavorites)
      .set({ sortIndex: data.sortIndex })
      .where(and(eq(formFavorites.userId, userId), eq(formFavorites.formId, data.formId)));
  });
