import "@tanstack/react-start/server-only";
import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { VersionedSettingsSnapshot } from "@/lib/content-hash";
import type { FormSettings } from "@/types/form-settings";
import { defaultFormSettings } from "@/types/form-settings";

// Organization Tables (Better Auth Organization Plugin)
export const organization = pgTable("organization", {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  // Cached from Polar via webhooks (src/lib/auth/polar-handlers.ts).
  plan: text().notNull().default("free"),
});

export const member = pgTable(
  "member",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    organizationId: text().notNull(),
    role: text().notNull().default("member"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_member_user_id_org_id").on(t.userId, t.organizationId)],
);

export const invitation = pgTable("invitation", {
  id: text().primaryKey(),
  email: text().notNull(),
  inviterId: text().notNull(),
  organizationId: text().notNull(),
  role: text().notNull().default("member"),
  status: text().notNull().default("pending"), // pending, accepted, rejected, canceled
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const todos = pgTable("todos", {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).defaultNow(),
});

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  username: text().unique(),
  displayUsername: text(),
  twoFactorEnabled: boolean().default(false),
});

export const session = pgTable("session", {
  id: text().primaryKey(),
  userId: text().notNull(),
  token: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ipAddress: text(),
  userAgent: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  activeOrganizationId: text(),
});

export const account = pgTable("account", {
  id: text().primaryKey(),
  userId: text().notNull(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  accessToken: text(),
  refreshToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  idToken: text(),
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const twoFactor = pgTable("twoFactor", {
  id: text().primaryKey(),
  secret: text().notNull(),
  backupCodes: text().notNull(),
  userId: text().notNull(),
});

// Convention: composite-identity tables (`${userId}:${formId}`, `${orgId}:${YYYY-MM-DD}`) use string-concat PKs in `id` — TanStack DB ergonomics compromise. Used by formFavorites, userWorkspaceOrder, formNotificationPreferences, formSubmissionNotifications, aiGenerationCounts.
// Convention: `createdByUserId`/`publishedByUserId` are audit-trail FKs to user.id with ON DELETE SET NULL — rows owned by org/parent, so user deletion anonymises the field.

// Single source for enum-like status sets — derives both CHECK constraints and TS unions. Keep tuples in sync with consumers (forms.ts, custom-domains.ts).
export const FORM_STATUSES = ["draft", "published", "archived"] as const;
export const CUSTOM_DOMAIN_STATUSES = ["pending", "verified", "failed", "suspended"] as const;
export const DEVICE_TYPES = ["desktop", "mobile", "tablet"] as const;

const sqlInList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

export const workspaces = pgTable(
  "workspaces",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    name: text().notNull().default("Workspace"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_workspaces_organization_id").on(t.organizationId),
    index("idx_workspaces_id_created_by").on(t.id, t.createdByUserId),
  ],
);

export const forms = pgTable(
  "forms",
  {
    id: text().primaryKey(), // UUID generated client-side
    // Public form identifier; never exposes the internal UUID. See ADR-0001.
    shortId: text().notNull().unique(),
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().notNull().default("Untitled"),
    // formName/schemaName: TanStack Form runtime ids (DOM `id`, Zod export names), NOT the user-facing `title`. Use sites in src/components/form-components/.
    formName: text().notNull().default("draft"),
    schemaName: text().notNull().default("draftFormSchema"),
    content: jsonb().notNull().default([]),
    icon: text(),
    cover: text(),
    status: text().notNull().default("draft"),
    // Version history fields
    lastPublishedVersionId: text().references((): AnyPgColumn => formVersions.id, {
      onDelete: "set null",
    }),
    publishedContentHash: text(), // Hash for fast change detection
    // Behavioral settings draft (working buffer); live copy in `formSettings` by formId. Same FormSettings shape; draft-vs-live diff drives the dirty flag.
    draftSettings: jsonb().$type<FormSettings>().notNull().default(defaultFormSettings),
    customization: jsonb().default({}),
    slug: text(),
    customDomainId: text().references((): AnyPgColumn => customDomains.id, {
      onDelete: "set null",
    }),
    sortIndex: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_forms_workspace_id").on(t.workspaceId),
    index("idx_forms_workspace_id_status").on(t.workspaceId, t.status),
    index("idx_forms_id_created_by").on(t.id, t.createdByUserId),
    uniqueIndex("uniq_forms_slug_custom_domain")
      .on(t.slug, t.customDomainId)
      .where(sql`${t.slug} IS NOT NULL`),
    index("idx_forms_workspace_id_sort_index").on(t.workspaceId, t.sortIndex),
    check("forms_status_check", sql`${t.status} IN (${sqlInList(FORM_STATUSES)})`),
  ],
);

export const customDomains = pgTable(
  "custom_domains",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text().notNull().unique(),
    status: text().notNull().default("pending"),
    // Captures `status` on org downgrade so re-upgrade restores without re-verifying via Vercel.
    previousStatus: text(),
    vercelDomainId: text(),
    siteTitle: text(),
    faviconUrl: text(),
    ogImageUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("custom_domains_org_idx").on(t.organizationId),
    index("custom_domains_domain_idx").on(t.domain),
    check(
      "custom_domains_status_check",
      sql`${t.status} IN (${sqlInList(CUSTOM_DOMAIN_STATUSES)})`,
    ),
    check(
      "custom_domains_previous_status_check",
      sql`${t.previousStatus} IS NULL OR ${t.previousStatus} IN (${sqlInList(CUSTOM_DOMAIN_STATUSES)})`,
    ),
  ],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    version: integer().notNull(), // v1, v2, v3...
    content: jsonb().notNull(), // Plate.js JSON snapshot
    // Legacy: pre-split versions snapshot 23 settings keys here; no longer versioned — new rows write null.
    settings: jsonb().$type<VersionedSettingsSnapshot | null>(),
    customization: jsonb().default({}), // Theme customization snapshot
    title: text().notNull(),
    icon: text(), // Visual asset snapshot
    cover: text(), // Visual asset snapshot
    publishedByUserId: text().references(() => user.id, { onDelete: "set null" }),
    // Denormalized publisher snapshot at publish time — survives user deletion/rename/profile drift. Authoritative for "who published this"; the FK only tells "is this still the same active user". Nullable: legacy rows predate it.
    publishedByName: text(),
    publishedByImage: text(),
    publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_versions_form_id").on(t.formId),
    index("idx_form_versions_form_id_version").on(t.formId, t.version),
  ],
);

/** Live published settings the public renderer reads (form row holds the `draftSettings` buffer). Outside `formVersions` — flip toggles, not snapshot-able. See docs/plans/2026-05-04-settings-version-split.md. */
export const formSettings = pgTable("form_settings", {
  formId: text()
    .primaryKey()
    .references(() => forms.id, { onDelete: "cascade" }),
  settings: jsonb().$type<FormSettings>().notNull().default(defaultFormSettings),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    formVersionId: text().references(() => formVersions.id, { onDelete: "set null" }),
    data: jsonb().notNull().default({}),
    isCompleted: boolean().notNull().default(true),
    // Client UUID (localStorage) linking debounced draft saves to one submission row. Null for legacy pre-autosave rows.
    draftId: text(),
    // Highest step index reached (0-based). Null until multi-step + a draft save records it.
    lastStepReached: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_submissions_form_id").on(t.formId),
    index("idx_submissions_form_id_created_at_id").on(t.formId, t.createdAt, t.id),
    index("idx_submissions_form_version_id").on(t.formVersionId),
    uniqueIndex("uniq_submissions_form_id_draft_id")
      .on(t.formId, t.draftId)
      .where(sql`${t.draftId} IS NOT NULL`),
  ],
);

export const formFavorites = pgTable(
  "form_favorites",
  {
    id: text().primaryKey(), // Format: ${userId}:${formId}
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    sortIndex: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_favorites_user_id").on(t.userId),
    index("idx_form_favorites_user_id_form_id").on(t.userId, t.formId),
  ],
);

// Per-user workspace order (ordering is private per viewer)
export const userWorkspaceOrder = pgTable(
  "user_workspace_order",
  {
    id: text().primaryKey(), // Format: ${userId}:${workspaceId}
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sortIndex: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_user_workspace_order_user_id").on(t.userId)],
);

export const formNotificationPreferences = pgTable(
  "form_notification_preferences",
  {
    id: text().primaryKey(), // Format: ${userId}:${formId}
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    inAppNotifications: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_notification_preferences_user_id").on(t.userId),
    index("idx_form_notification_preferences_user_id_form_id").on(t.userId, t.formId),
  ],
);

export const formSubmissionNotifications = pgTable(
  "form_submission_notifications",
  {
    id: text().primaryKey(), // Format: ${userId}:${formId}
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    unreadCount: integer().notNull().default(0),
    isRead: boolean().notNull().default(true),
    firstUnreadAt: timestamp({ withTimezone: true }),
    latestSubmissionAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    latestSubmissionId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_submission_notifications_user_id").on(t.userId),
    index("idx_form_submission_notifications_user_id_form_id").on(t.userId, t.formId),
    index("idx_form_submission_notifications_user_id_is_read").on(t.userId, t.isRead),
  ],
);

export const formVisits = pgTable(
  "form_visits",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),

    // Anonymous tracking
    visitorHash: text().notNull(),
    sessionId: text().notNull(),

    // Source attribution
    referrer: text(),
    utmSource: text(),
    utmMedium: text(),
    utmCampaign: text(),

    // Device metadata
    deviceType: text(),
    browser: text(),
    browserVersion: text(),
    os: text(),
    osVersion: text(),

    // Geolocation: ISO-3166 code + city/region. Display names resolved app-side (i18n) — no countryName column.
    country: text(),
    city: text(),
    region: text(),

    // Timing
    visitStartedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    visitEndedAt: timestamp({ withTimezone: true }),
    durationMs: integer(),

    // Interaction tracking
    didStartForm: boolean().notNull().default(false),
    didSubmit: boolean().notNull().default(false),
    submissionId: text().references(() => submissions.id, { onDelete: "set null" }),

    // Core Web Vitals (RUM, one/session). Nullable: finalized on page-hide, may be absent (e.g. no interaction => no INP).
    lcpMs: integer(),
    inpMs: integer(),
    cls: real(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_visits_form_id").on(t.formId),
    index("idx_form_visits_visitor_hash").on(t.visitorHash),
    index("idx_form_visits_form_id_visit_started_at").on(t.formId, t.visitStartedAt),
    check(
      "form_visits_device_type_check",
      sql`${t.deviceType} IS NULL OR ${t.deviceType} IN (${sqlInList(DEVICE_TYPES)})`,
    ),
  ],
);

export const formQuestionProgress = pgTable(
  "form_question_progress",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    visitId: text()
      .notNull()
      .references(() => formVisits.id, { onDelete: "cascade" }),
    visitorHash: text().notNull(),

    questionId: text().notNull(),
    questionType: text(),
    questionIndex: integer().notNull(),

    stepId: text(),
    stepIndex: integer(),

    viewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    wasLastQuestion: boolean().notNull().default(false),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_question_progress_form_id").on(t.formId),
    index("idx_form_question_progress_visit_id").on(t.visitId),
    uniqueIndex("uq_form_question_progress_visit_question").on(t.visitId, t.questionId),
  ],
);

export const formAnalyticsDaily = pgTable(
  "form_analytics_daily",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    date: text().notNull(), // 'YYYY-MM-DD'

    // Core metrics
    totalVisits: integer().notNull().default(0),
    uniqueVisitors: integer().notNull().default(0),
    totalSubmissions: integer().notNull().default(0),
    uniqueSubmitters: integer().notNull().default(0),
    avgDurationMs: integer(),
    medianDurationMs: integer(),

    // Breakdowns: counts keyed by dimension value, e.g. { desktop: 12, mobile: 4 } / { Chrome: 9, Other: 3 }.
    deviceBreakdown: jsonb("device_breakdown")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    browserBreakdown: jsonb("browser_breakdown")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    osBreakdown: jsonb("os_breakdown").$type<Record<string, number>>().notNull().default({}),
    countryBreakdown: jsonb().$type<Record<string, number>>().notNull().default({}),
    cityBreakdown: jsonb().$type<Record<string, number>>().notNull().default({}),
    sourceBreakdown: jsonb().$type<Record<string, number>>().notNull().default({}),

    // Core Web Vitals distributions: bucket label -> sample count (see lib/analytics/vitals).
    lcpHistogram: jsonb("lcp_histogram").$type<Record<string, number>>().notNull().default({}),
    inpHistogram: jsonb("inp_histogram").$type<Record<string, number>>().notNull().default({}),
    clsHistogram: jsonb("cls_histogram").$type<Record<string, number>>().notNull().default({}),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_form_analytics_daily_form_id_date").on(t.formId, t.date)],
);

export const formDropoffDaily = pgTable(
  "form_dropoff_daily",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    date: text().notNull(),

    stepId: text(),
    stepIndex: integer(),
    questionId: text().notNull(),
    questionIndex: integer().notNull(),

    viewCount: integer().notNull().default(0),
    startCount: integer().notNull().default(0),
    completeCount: integer().notNull().default(0),
    dropoffCount: integer().notNull().default(0),
    terminalDropoffCount: integer().notNull().default(0),
    dropoffRate: integer(),
    completionRate: integer(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_form_dropoff_daily_form_id_date").on(t.formId, t.date)],
);

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    todos,
    twoFactor,
    organization,
    member,
    invitation,
    forms,
    formVersions,
    formSettings,
    workspaces,
    submissions,
    formVisits,
    formQuestionProgress,
    formAnalyticsDaily,
    formDropoffDaily,
    formFavorites,
    formNotificationPreferences,
    formSubmissionNotifications,
    customDomains,
    userWorkspaceOrder,
  },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
      twoFactors: r.many.twoFactor({
        from: r.user.id,
        to: r.twoFactor.userId,
      }),
      // Workspaces and forms are owned by organization; this just tracks creator.
      createdWorkspaces: r.many.workspaces({
        from: r.user.id,
        to: r.workspaces.createdByUserId,
      }),
      createdForms: r.many.forms({
        from: r.user.id,
        to: r.forms.createdByUserId,
      }),
      publishedVersions: r.many.formVersions({
        from: r.user.id,
        to: r.formVersions.publishedByUserId,
      }),
      members: r.many.member({
        from: r.user.id,
        to: r.member.userId,
      }),
      organizationMemberships: r.many.member({
        from: r.user.id,
        to: r.member.userId,
      }),
      favorites: r.many.formFavorites({
        from: r.user.id,
        to: r.formFavorites.userId,
      }),
      formNotificationPreferences: r.many.formNotificationPreferences({
        from: r.user.id,
        to: r.formNotificationPreferences.userId,
      }),
      formSubmissionNotifications: r.many.formSubmissionNotifications({
        from: r.user.id,
        to: r.formSubmissionNotifications.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
      }),
    },
    twoFactor: {
      user: r.one.user({
        from: r.twoFactor.userId,
        to: r.user.id,
      }),
    },
    organization: {
      members: r.many.member({
        from: r.organization.id,
        to: r.member.organizationId,
      }),
      workspaces: r.many.workspaces({
        from: r.organization.id,
        to: r.workspaces.organizationId,
      }),
      invitations: r.many.invitation({
        from: r.organization.id,
        to: r.invitation.organizationId,
      }),
      customDomains: r.many.customDomains({
        from: r.organization.id,
        to: r.customDomains.organizationId,
      }),
    },
    member: {
      user: r.one.user({
        from: r.member.userId,
        to: r.user.id,
      }),
      organization: r.one.organization({
        from: r.member.organizationId,
        to: r.organization.id,
      }),
    },
    invitation: {
      organization: r.one.organization({
        from: r.invitation.organizationId,
        to: r.organization.id,
      }),
    },
    workspaces: {
      organization: r.one.organization({
        from: r.workspaces.organizationId,
        to: r.organization.id,
      }),
      creator: r.one.user({
        from: r.workspaces.createdByUserId,
        to: r.user.id,
      }),
      forms: r.many.forms({
        from: r.workspaces.id,
        to: r.forms.workspaceId,
      }),
    },
    forms: {
      creator: r.one.user({
        from: r.forms.createdByUserId,
        to: r.user.id,
      }),
      workspace: r.one.workspaces({
        from: r.forms.workspaceId,
        to: r.workspaces.id,
      }),
      submissions: r.many.submissions({
        from: r.forms.id,
        to: r.submissions.formId,
      }),
      visits: r.many.formVisits({
        from: r.forms.id,
        to: r.formVisits.formId,
      }),
      analyticsDaily: r.many.formAnalyticsDaily({
        from: r.forms.id,
        to: r.formAnalyticsDaily.formId,
      }),
      dropoffDaily: r.many.formDropoffDaily({
        from: r.forms.id,
        to: r.formDropoffDaily.formId,
      }),
      versions: r.many.formVersions({
        from: r.forms.id,
        to: r.formVersions.formId,
      }),
      currentPublishedVersion: r.one.formVersions({
        from: r.forms.lastPublishedVersionId,
        to: r.formVersions.id,
      }),
      liveSettings: r.one.formSettings({
        from: r.forms.id,
        to: r.formSettings.formId,
      }),
      favorites: r.many.formFavorites({
        from: r.forms.id,
        to: r.formFavorites.formId,
      }),
      notificationPreferences: r.many.formNotificationPreferences({
        from: r.forms.id,
        to: r.formNotificationPreferences.formId,
      }),
      submissionNotifications: r.many.formSubmissionNotifications({
        from: r.forms.id,
        to: r.formSubmissionNotifications.formId,
      }),
      customDomain: r.one.customDomains({
        from: r.forms.customDomainId,
        to: r.customDomains.id,
      }),
    },
    formVersions: {
      form: r.one.forms({
        from: r.formVersions.formId,
        to: r.forms.id,
      }),
      publishedBy: r.one.user({
        from: r.formVersions.publishedByUserId,
        to: r.user.id,
      }),
    },
    formSettings: {
      form: r.one.forms({
        from: r.formSettings.formId,
        to: r.forms.id,
      }),
    },
    submissions: {
      form: r.one.forms({
        from: r.submissions.formId,
        to: r.forms.id,
      }),
    },
    formVisits: {
      form: r.one.forms({
        from: r.formVisits.formId,
        to: r.forms.id,
      }),
      submission: r.one.submissions({
        from: r.formVisits.submissionId,
        to: r.submissions.id,
      }),
      questionProgress: r.many.formQuestionProgress({
        from: r.formVisits.id,
        to: r.formQuestionProgress.visitId,
      }),
    },
    formQuestionProgress: {
      form: r.one.forms({
        from: r.formQuestionProgress.formId,
        to: r.forms.id,
      }),
      visit: r.one.formVisits({
        from: r.formQuestionProgress.visitId,
        to: r.formVisits.id,
      }),
    },
    formAnalyticsDaily: {
      form: r.one.forms({
        from: r.formAnalyticsDaily.formId,
        to: r.forms.id,
      }),
    },
    formDropoffDaily: {
      form: r.one.forms({
        from: r.formDropoffDaily.formId,
        to: r.forms.id,
      }),
    },
    formFavorites: {
      user: r.one.user({
        from: r.formFavorites.userId,
        to: r.user.id,
      }),
      form: r.one.forms({
        from: r.formFavorites.formId,
        to: r.forms.id,
      }),
    },
    formNotificationPreferences: {
      user: r.one.user({
        from: r.formNotificationPreferences.userId,
        to: r.user.id,
      }),
      form: r.one.forms({
        from: r.formNotificationPreferences.formId,
        to: r.forms.id,
      }),
    },
    formSubmissionNotifications: {
      user: r.one.user({
        from: r.formSubmissionNotifications.userId,
        to: r.user.id,
      }),
      form: r.one.forms({
        from: r.formSubmissionNotifications.formId,
        to: r.forms.id,
      }),
    },
    customDomains: {
      organization: r.one.organization({
        from: r.customDomains.organizationId,
        to: r.organization.id,
      }),
      forms: r.many.forms({
        from: r.customDomains.id,
        to: r.forms.customDomainId,
      }),
    },
  }),
);

export const uploadRateLimits = pgTable("upload_rate_limits", {
  ip: text("ip").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

// AI form-generate calls per org per UTC day; rate-limit check in /api/ai/form-generate. `id` = `${organizationId}:${YYYY-MM-DD}` so one upsert handles the daily bucket, no composite-PK migration.
export const aiGenerationCounts = pgTable(
  "ai_generation_counts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodDay: text("period_day").notNull(), // YYYY-MM-DD (UTC)
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ai_generation_counts_org_day").on(t.organizationId, t.periodDay)],
);

// Tracks AI Chat Sessions for dedup + cap counting. One row per
// (submission_id) ensures resuming an Incomplete Submission does not
// re-count against the Org-Month cap (see CONTEXT.md "Chat Session"). Cap
// check sums COUNT(*) over (organization_id, period_month).
export const aiChatSessions = pgTable(
  "ai_chat_sessions",
  {
    submissionId: text("submission_id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(), // YYYY-MM (UTC)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ai_chat_sessions_org_month").on(t.organizationId, t.periodMonth)],
);

// Per-Org-Day counter for builder-side AI Chat preview calls. Same shape as
// ai_generation_counts — `id` format `${organizationId}:${YYYY-MM-DD}`.
export const aiChatPreviewCounts = pgTable(
  "ai_chat_preview_counts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodDay: text("period_day").notNull(), // YYYY-MM-DD (UTC)
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_ai_chat_preview_counts_org_day").on(t.organizationId, t.periodDay)],
);

// Per-IP token-bucket rate limit for /api/ai/chat-form. Mirrors
// upload_rate_limits but for AI Chat traffic. Refilled lazily on read.
export const aiChatRateLimits = pgTable("ai_chat_rate_limits", {
  ip: text("ip").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

// Row types — import these via `import type` from client-reachable server-fn modules
// so a `typeof <table>.$inferSelect` annotation doesn't pull the table value (and
// thus drizzle-orm) into the client bundle. Server-only marker above keeps values out.
export type FormRow = typeof forms.$inferSelect;
export type FormVersionRow = typeof formVersions.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type CustomDomainRow = typeof customDomains.$inferSelect;
export type FormSubmissionNotificationRow = typeof formSubmissionNotifications.$inferSelect;
