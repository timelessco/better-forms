import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { formFavorites } from "@/db/schema";
import { db } from "@/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireScopedForm } from "./auth-helpers.server";

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
  .validator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      sortIndex: v.nullish(v.string()),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    // Per-form authz: else any authed user could favorite arbitrary form ids in other orgs.
    await requireScopedForm(context.session, data.formId);
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
  .validator(v.object({ formId: v.pipe(v.string(), v.uuid()) }))
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    await requireScopedForm(context.session, data.formId);

    await db
      .delete(formFavorites)
      .where(and(eq(formFavorites.userId, userId), eq(formFavorites.formId, data.formId)));
  });

export const reorderFavorite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    v.object({
      formId: v.pipe(v.string(), v.uuid()),
      sortIndex: v.string(),
    }),
  )
  .handler(async ({ data, context }) => {
    const userId = context.session.user.id;
    await requireScopedForm(context.session, data.formId);

    await db
      .update(formFavorites)
      .set({ sortIndex: data.sortIndex })
      .where(and(eq(formFavorites.userId, userId), eq(formFavorites.formId, data.formId)));
  });
