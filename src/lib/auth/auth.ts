import "@tanstack/react-start/server-only";
import * as schema from "@/db/schema";
import { db } from "@/db";
import {
  sendChangeEmailConfirmationEmail,
  sendMagicLinkEmail,
  sendOrgInvitationEmail,
} from "@/integrations/email";
import { logger } from "@/lib/utils";
import { APP_NAME } from "@/lib/config/app-config";
import { PLAN_PRODUCT_IDS } from "@/lib/config/plan-config";
import {
  handleSubscriptionDowngrade,
  handleSubscriptionUpdated,
  handleSubscriptionUpgrade,
} from "@/lib/auth/polar-handlers.server";
import { checkout, polar, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { magicLink, organization, testUtils } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { eq } from "drizzle-orm";

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
  server: "sandbox", // TODO: Change to production
});

const getServerBaseURL = () => {
  // Prefer VERCEL_BRANCH_URL for stable git-branch URLs (e.g. better-forms-git-dev-timelessco.vercel.app)
  // VERCEL_URL gives random deployment URLs that change per deploy
  const url =
    process.env.BETTER_AUTH_URL ||
    process.env.VERCEL_BRANCH_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3000";
  return url.startsWith("http") ? url : `https://${url}`;
};

export const auth = betterAuth({
  baseURL: getServerBaseURL(),
  appName: APP_NAME,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: false,
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async (data) => {
        logger(`[Auth] Sending change email confirmation to ${data.user.email} → ${data.newEmail}`);
        if (import.meta.env.DEV) {
          logger(`[Auth] Change email URL: ${data.url}`);
        } else {
          void sendChangeEmailConfirmationEmail(data.user.email, data.newEmail, data.url);
        }
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const now = new Date();
            const orgId = crypto.randomUUID();

            const orgName = user.name || user.email.split("@")[0];
            const [org] = await db
              .insert(schema.organization)
              .values({
                id: orgId,
                name: orgName,
                slug: user.id,
                createdAt: now,
              })
              .returning();

            await Promise.all([
              db.insert(schema.member).values({
                id: crypto.randomUUID(),
                userId: user.id,
                organizationId: org.id,
                role: "owner",
                createdAt: now,
              }),
              db.insert(schema.workspaces).values({
                id: crypto.randomUUID(),
                organizationId: org.id,
                createdByUserId: user.id,
                name: "My workspace",
                createdAt: now,
                updatedAt: now,
              }),
            ]);

            logger(
              `[Auth] Created organization "${user.name}" with default workspace for user ${user.email}`,
            );
          } catch (error) {
            logger(`[Auth] Failed to create organization for user ${user.email}:`, error);
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [membership] = await db
            .select()
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .limit(1);

          if (membership) {
            return {
              data: {
                ...session,
                activeOrganizationId: membership.organizationId,
              },
            };
          }
          return { data: session };
        },
      },
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  trustedOrigins: [
    "https://*.vercel.app",
    "https://*.vercel-preview-app",
    "https://localhost:3001",
  ],
  plugins: [
    ...(process.env.NODE_ENV === "test" ? [testUtils()] : []),
    magicLink({
      async sendMagicLink({ email, url }) {
        if (import.meta.env.DEV) {
          logger(`[Auth] Magic link for ${email}: ${url}`);
        } else {
          await sendMagicLinkEmail(email, url);
        }
      },
    }),
    apiKey(),
    organization({
      async sendInvitationEmail(data) {
        logger(
          `[Org] sendInvitationEmail callback START - email: ${data.email}, org: ${data.organization.name}, inviter: ${data.inviter.user.name}, invitationId: ${data.id}`,
        );
        const inviteLink = `${process.env.APP_URL || "http://localhost:3000"}/accept-invite?invitationId=${data.id}`;
        logger(`[Org] Generated invite link: ${inviteLink}`);
        void sendOrgInvitationEmail(
          data.email,
          data.organization.name,
          data.inviter.user.name,
          inviteLink,
        );
        logger(`[Org] sendInvitationEmail callback END`);
      },
    }),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          products: [
            { productId: PLAN_PRODUCT_IDS.free, slug: "free" },
            { productId: PLAN_PRODUCT_IDS.pro, slug: "Pro" },
            { productId: PLAN_PRODUCT_IDS.business, slug: "Business" },
          ],
          successUrl:
            (process.env.APP_URL || "http://localhost:3000") +
            "/dashboard?checkout_id={CHECKOUT_ID}",
          authenticatedUsersOnly: true,
        }),
        portal(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET ?? "",
          onSubscriptionCreated: handleSubscriptionUpgrade,
          onSubscriptionActive: handleSubscriptionUpgrade,
          onSubscriptionUncanceled: handleSubscriptionUpgrade,
          onSubscriptionUpdated: handleSubscriptionUpdated,
          onSubscriptionCanceled: handleSubscriptionDowngrade,
          onSubscriptionRevoked: handleSubscriptionDowngrade,
        }),
      ],
    }),
    tanstackStartCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
