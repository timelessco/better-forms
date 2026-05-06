/**
 * Seed local dev DB with realistic data across every table.
 *
 * Use this after spinning up a fresh DB or running `nuke-db.ts` + `db:push`,
 * to get a working environment without poking around the UI to create test
 * data by hand.
 *
 * Strategy:
 *   - Truncate every table CASCADE (idempotent).
 *   - Pre-generate UUIDs in JS for every PK; wire FK columns explicitly with
 *     `valuesFromArray` (the schema mostly uses informal text-FKs without
 *     `.references()`, and drizzle-seed only understands the legacy RQB-v1
 *     `relations` shape, not this codebase's `defineRelations` v2).
 *   - Seed in dependency order so every FK lookup hits a real row.
 *
 * Usage:
 *   bun scripts/seed-dev.ts
 *   USERS=20 ORGS=5 FORMS=80 bun scripts/seed-dev.ts
 */
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { seed } from "drizzle-seed";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";
import {
  account,
  aiGenerationCounts,
  customDomains,
  forms,
  formAnalyticsDaily,
  formDropoffDaily,
  formFavorites,
  formNotificationPreferences,
  formQuestionProgress,
  formSubmissionNotifications,
  formVersions,
  formVisits,
  invitation,
  member,
  organization,
  session,
  submissions,
  todos,
  twoFactor,
  uploadRateLimits,
  user,
  userWorkspaceOrder,
  verification,
  workspaces,
} from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const N = {
  users: Number(process.env.USERS ?? 10),
  orgs: Number(process.env.ORGS ?? 3),
  workspaces: Number(process.env.WORKSPACES ?? 6),
  forms: Number(process.env.FORMS ?? 30),
  versions: Number(process.env.VERSIONS ?? 60),
  submissions: Number(process.env.SUBMISSIONS ?? 200),
  visits: Number(process.env.VISITS ?? 1000),
  questionProgress: Number(process.env.QUESTION_PROGRESS ?? 400),
  customDomains: Number(process.env.CUSTOM_DOMAINS ?? 3),
  todos: Number(process.env.TODOS ?? 10),
  invitations: Number(process.env.INVITATIONS ?? 5),
  verifications: Number(process.env.VERIFICATIONS ?? 5),
  uploadRateLimits: Number(process.env.UPLOAD_RATE_LIMITS ?? 5),
};

const pickN = <T>(pool: T[], n: number): T[] => {
  const out: T[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = pool[i % pool.length] as T;
  return out;
};

const composite = (a: string[], b: string[]): string[] => {
  const out: string[] = [];
  for (const x of a) for (const y of b) out.push(`${x}:${y}`);
  return out;
};

const main = async () => {
  const db = drizzle({ connection: { url: DATABASE_URL, prepare: false } });

  console.log("Truncating every table…");
  await db.execute(sql`
    TRUNCATE TABLE
      ai_generation_counts,
      upload_rate_limits,
      form_dropoff_daily,
      form_analytics_daily,
      form_question_progress,
      form_visits,
      form_submission_notifications,
      form_notification_preferences,
      form_favorites,
      submissions,
      form_versions,
      forms,
      user_workspace_order,
      workspaces,
      custom_domains,
      "twoFactor",
      account,
      session,
      verification,
      invitation,
      member,
      organization,
      "user",
      todos
    RESTART IDENTITY CASCADE
  `);

  // Pre-hash the shared seed password through Better Auth's exact scrypt
  // pipeline so credential-provider rows can actually log in.
  console.log(`Hashing shared seed password ("${SEED_PASSWORD}") via Better Auth scrypt…`);
  const seedPasswordHash = await hashPassword(SEED_PASSWORD);

  // === Pre-generate IDs ===
  const userIds = Array.from({ length: N.users }, () => randomUUID());
  const orgIds = Array.from({ length: N.orgs }, () => randomUUID());
  const wsIds = Array.from({ length: N.workspaces }, () => randomUUID());
  const formIds = Array.from({ length: N.forms }, () => randomUUID());
  const versionIds = Array.from({ length: N.versions }, () => randomUUID());
  const submissionIds = Array.from({ length: N.submissions }, () => randomUUID());
  const visitIds = Array.from({ length: N.visits }, () => randomUUID());
  const customDomainIds = Array.from({ length: N.customDomains }, () => randomUUID());

  // FK round-robin assignments.
  const memberUsers = pickN(userIds, N.users);
  const memberOrgs = pickN(orgIds, N.users);
  const wsOrgs = pickN(orgIds, N.workspaces);
  const wsCreators = pickN(userIds, N.workspaces);
  const formCreators = pickN(userIds, N.forms);
  const formWorkspaces = pickN(wsIds, N.forms);
  const versionForms = pickN(formIds, N.versions);
  const versionPublishers = pickN(userIds, N.versions);
  const submissionForms = pickN(formIds, N.submissions);
  const visitForms = pickN(formIds, N.visits);
  const cdOrgs = pickN(orgIds, N.customDomains);

  // ─── Layer 0: independent tables ────────────────────────────────────────
  console.log(`Seeding users (${N.users}), orgs (${N.orgs}), todos (${N.todos})…`);
  await seed(db, { user, organization, todos, uploadRateLimits, verification }).refine((f) => ({
    user: {
      count: N.users,
      columns: {
        id: f.valuesFromArray({ values: userIds, isUnique: true }),
        name: f.fullName(),
        email: f.email(),
        username: f.valuesFromArray({
          values: userIds.map((_, i) => `user${i}`),
          isUnique: true,
        }),
      },
    },
    organization: {
      count: N.orgs,
      columns: {
        id: f.valuesFromArray({ values: orgIds, isUnique: true }),
        name: f.companyName(),
        slug: f.valuesFromArray({
          values: orgIds.map((_, i) => `org-${i}`),
          isUnique: true,
        }),
        plan: f.valuesFromArray({ values: ["free", "pro"] }),
      },
    },
    todos: {
      count: N.todos,
      columns: {
        title: f.loremIpsum({ sentencesCount: 1 }),
      },
    },
    uploadRateLimits: {
      count: N.uploadRateLimits,
      columns: {
        ip: f.valuesFromArray({
          values: Array.from({ length: N.uploadRateLimits }, (_, i) => `192.168.1.${i + 1}`),
          isUnique: true,
        }),
      },
    },
    verification: {
      count: N.verifications,
      columns: {
        identifier: f.email(),
      },
    },
  }));

  // ─── Layer 1: depends on user/org ───────────────────────────────────────
  console.log(
    "Seeding session/account/twoFactor/member/invitation/customDomains/workspaces/aiCounts…",
  );
  await seed(db, {
    session,
    account,
    twoFactor,
    member,
    invitation,
    customDomains,
    workspaces,
    aiGenerationCounts,
  }).refine((f) => ({
    session: {
      count: N.users,
      columns: {
        userId: f.valuesFromArray({ values: userIds }),
        token: f.valuesFromArray({
          values: Array.from({ length: N.users }, () => randomUUID()),
          isUnique: true,
        }),
        activeOrganizationId: f.valuesFromArray({ values: orgIds }),
      },
    },
    account: {
      count: N.users,
      columns: {
        userId: f.valuesFromArray({ values: userIds }),
        // All seeded accounts use the credential provider so the shared
        // seed-password hash is meaningful for every row.
        providerId: f.valuesFromArray({ values: ["credential"] }),
        accountId: f.valuesFromArray({ values: userIds }),
        password: f.valuesFromArray({ values: [seedPasswordHash] }),
      },
    },
    twoFactor: {
      count: 0,
    },
    member: {
      count: N.users,
      columns: {
        userId: f.valuesFromArray({ values: memberUsers }),
        organizationId: f.valuesFromArray({ values: memberOrgs }),
        role: f.valuesFromArray({ values: ["owner", "admin", "member"] }),
      },
    },
    invitation: {
      count: N.invitations,
      columns: {
        organizationId: f.valuesFromArray({ values: orgIds }),
        inviterId: f.valuesFromArray({ values: userIds }),
        email: f.email(),
        role: f.valuesFromArray({ values: ["member", "admin"] }),
        status: f.valuesFromArray({
          values: ["pending", "accepted", "rejected"],
        }),
      },
    },
    customDomains: {
      count: N.customDomains,
      columns: {
        id: f.valuesFromArray({ values: customDomainIds, isUnique: true }),
        organizationId: f.valuesFromArray({ values: cdOrgs }),
        domain: f.valuesFromArray({
          values: Array.from({ length: N.customDomains }, (_, i) => `forms-${i}.example.com`),
          isUnique: true,
        }),
        status: f.valuesFromArray({ values: ["pending", "verified", "failed"] }),
      },
    },
    workspaces: {
      count: N.workspaces,
      columns: {
        id: f.valuesFromArray({ values: wsIds, isUnique: true }),
        organizationId: f.valuesFromArray({ values: wsOrgs }),
        createdByUserId: f.valuesFromArray({ values: wsCreators }),
      },
    },
    aiGenerationCounts: {
      count: N.orgs,
      columns: {
        id: f.valuesFromArray({
          values: orgIds.map((id) => `${id}:2026-05-01`),
          isUnique: true,
        }),
        organizationId: f.valuesFromArray({ values: orgIds }),
        periodDay: f.valuesFromArray({ values: ["2026-05-01"] }),
      },
    },
  }));

  // ─── Layer 2: forms (depends on workspaces + user) ──────────────────────
  console.log(`Seeding forms (${N.forms})…`);
  await seed(db, { forms }).refine((f) => ({
    forms: {
      count: N.forms,
      columns: {
        id: f.valuesFromArray({ values: formIds, isUnique: true }),
        createdByUserId: f.valuesFromArray({ values: formCreators }),
        workspaceId: f.valuesFromArray({ values: formWorkspaces }),
        title: f.loremIpsum({ sentencesCount: 1 }),
        status: f.valuesFromArray({
          values: ["draft", "published", "archived"],
        }),
      },
    },
  }));

  // ─── Layer 3: form children + per-user mapping rows ─────────────────────
  console.log(
    "Seeding versions/submissions/favorites/notifications/visits/progress/analytics/dropoff…",
  );
  const fanUsers = userIds.slice(0, Math.min(5, N.users));
  const fanForms = formIds.slice(0, Math.min(10, N.forms));
  const fanWorkspaces = wsIds.slice(0, Math.min(3, N.workspaces));
  const favIds = composite(fanUsers, fanForms);
  const notifIds = composite(fanUsers, fanForms);
  const wsOrderIds = composite(fanUsers, fanWorkspaces);
  const dailyIds = formIds.flatMap((fid) =>
    ["2026-04-29", "2026-04-30", "2026-05-01"].map((d) => `${fid}:${d}`),
  );
  const dropoffIds = formIds.flatMap((fid) => ["q1", "q2"].map((q) => `${fid}:2026-05-01:${q}`));

  await seed(db, {
    formVersions,
    submissions,
    formFavorites,
    formNotificationPreferences,
    formSubmissionNotifications,
    formVisits,
    formQuestionProgress,
    formAnalyticsDaily,
    formDropoffDaily,
    userWorkspaceOrder,
  }).refine((f) => ({
    formVersions: {
      count: N.versions,
      columns: {
        id: f.valuesFromArray({ values: versionIds, isUnique: true }),
        formId: f.valuesFromArray({ values: versionForms }),
        publishedByUserId: f.valuesFromArray({ values: versionPublishers }),
        version: f.int({ minValue: 1, maxValue: 5 }),
        title: f.loremIpsum({ sentencesCount: 1 }),
      },
    },
    submissions: {
      count: N.submissions,
      columns: {
        id: f.valuesFromArray({ values: submissionIds, isUnique: true }),
        formId: f.valuesFromArray({ values: submissionForms }),
      },
    },
    formFavorites: {
      count: favIds.length,
      columns: {
        id: f.valuesFromArray({ values: favIds, isUnique: true }),
        userId: f.valuesFromArray({
          values: favIds.map((id) => id.split(":")[0] ?? ""),
        }),
        formId: f.valuesFromArray({
          values: favIds.map((id) => id.split(":")[1] ?? ""),
        }),
      },
    },
    formNotificationPreferences: {
      count: notifIds.length,
      columns: {
        id: f.valuesFromArray({ values: notifIds, isUnique: true }),
        userId: f.valuesFromArray({
          values: notifIds.map((id) => id.split(":")[0] ?? ""),
        }),
        formId: f.valuesFromArray({
          values: notifIds.map((id) => id.split(":")[1] ?? ""),
        }),
      },
    },
    formSubmissionNotifications: {
      count: notifIds.length,
      columns: {
        id: f.valuesFromArray({
          values: notifIds.map((id) => `${id}:notif`),
          isUnique: true,
        }),
        userId: f.valuesFromArray({
          values: notifIds.map((id) => id.split(":")[0] ?? ""),
        }),
        formId: f.valuesFromArray({
          values: notifIds.map((id) => id.split(":")[1] ?? ""),
        }),
      },
    },
    userWorkspaceOrder: {
      count: wsOrderIds.length,
      columns: {
        id: f.valuesFromArray({ values: wsOrderIds, isUnique: true }),
        userId: f.valuesFromArray({
          values: wsOrderIds.map((id) => id.split(":")[0] ?? ""),
        }),
        workspaceId: f.valuesFromArray({
          values: wsOrderIds.map((id) => id.split(":")[1] ?? ""),
        }),
      },
    },
    formVisits: {
      count: N.visits,
      columns: {
        id: f.valuesFromArray({ values: visitIds, isUnique: true }),
        formId: f.valuesFromArray({ values: visitForms }),
        deviceType: f.valuesFromArray({
          values: ["desktop", "tablet", "mobile"],
        }),
        browser: f.valuesFromArray({
          values: ["chrome", "safari", "firefox", "edge"],
        }),
        os: f.valuesFromArray({
          values: ["macos", "windows", "linux", "ios", "android"],
        }),
        country: f.country(),
      },
    },
    formQuestionProgress: {
      count: N.questionProgress,
      columns: {
        formId: f.valuesFromArray({ values: pickN(formIds, N.questionProgress) }),
        visitId: f.valuesFromArray({ values: pickN(visitIds, N.questionProgress) }),
      },
    },
    formAnalyticsDaily: {
      count: dailyIds.length,
      columns: {
        id: f.valuesFromArray({ values: dailyIds, isUnique: true }),
        formId: f.valuesFromArray({
          values: dailyIds.map((id) => id.split(":")[0] ?? ""),
        }),
        date: f.valuesFromArray({
          values: dailyIds.map((id) => id.split(":")[1] ?? ""),
        }),
      },
    },
    formDropoffDaily: {
      count: dropoffIds.length,
      columns: {
        id: f.valuesFromArray({ values: dropoffIds, isUnique: true }),
        formId: f.valuesFromArray({
          values: dropoffIds.map((id) => id.split(":")[0] ?? ""),
        }),
        date: f.valuesFromArray({
          values: dropoffIds.map((id) => id.split(":")[1] ?? ""),
        }),
        questionId: f.valuesFromArray({
          values: dropoffIds.map((id) => id.split(":")[2] ?? ""),
        }),
        questionIndex: f.int({ minValue: 0, maxValue: 10 }),
      },
    },
  }));

  // Final counts.
  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM "user")                         AS users,
      (SELECT count(*) FROM organization)                   AS orgs,
      (SELECT count(*) FROM member)                         AS members,
      (SELECT count(*) FROM invitation)                     AS invitations,
      (SELECT count(*) FROM session)                        AS sessions,
      (SELECT count(*) FROM account)                        AS accounts,
      (SELECT count(*) FROM verification)                   AS verifications,
      (SELECT count(*) FROM workspaces)                     AS workspaces,
      (SELECT count(*) FROM custom_domains)                 AS custom_domains,
      (SELECT count(*) FROM forms)                          AS forms,
      (SELECT count(*) FROM form_versions)                  AS versions,
      (SELECT count(*) FROM submissions)                    AS submissions,
      (SELECT count(*) FROM form_favorites)                 AS favorites,
      (SELECT count(*) FROM form_notification_preferences)  AS notif_prefs,
      (SELECT count(*) FROM form_submission_notifications)  AS notifs,
      (SELECT count(*) FROM user_workspace_order)           AS ws_order,
      (SELECT count(*) FROM form_visits)                    AS visits,
      (SELECT count(*) FROM form_question_progress)         AS question_progress,
      (SELECT count(*) FROM form_analytics_daily)           AS analytics_daily,
      (SELECT count(*) FROM form_dropoff_daily)             AS dropoff_daily,
      (SELECT count(*) FROM ai_generation_counts)           AS ai_counts,
      (SELECT count(*) FROM upload_rate_limits)             AS rate_limits,
      (SELECT count(*) FROM todos)                          AS todos
  `);
  console.log("\nDone. Final counts:");
  console.log(counts[0]);

  await (db.$client as { end: () => Promise<void> }).end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
