import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
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

export const apikey = pgTable("apikey", {
  id: text().primaryKey(),
  name: text(),
  start: text(),
  prefix: text(),
  key: text().notNull(),
  userId: text().notNull(),
  referenceId: text(),
  refillInterval: integer(),
  refillAmount: integer(),
  lastRefillAt: timestamp({ withTimezone: true }),
  enabled: boolean().default(true),
  rateLimitEnabled: boolean().default(true),
  rateLimitTimeWindow: integer().default(86400000),
  rateLimitMax: integer().default(10),
  requestCount: integer().default(0),
  remaining: integer(),
  lastRequest: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
  permissions: text(),
  metadata: text(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: text().primaryKey(),
    organizationId: text().notNull(),
    createdByUserId: text().notNull(),
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
    createdByUserId: text().notNull(),
    workspaceId: text().notNull(),
    title: text().notNull().default("Untitled"),
    formName: text().notNull().default("draft"),
    schemaName: text().notNull().default("draftFormSchema"),
    content: jsonb().notNull().default([]),
    icon: text(),
    cover: text(),
    status: text().notNull().default("draft"), // 'draft' | 'published' | 'archived'
    // Version history fields
    lastPublishedVersionId: text(), // FK to formVersions.id
    publishedContentHash: text(), // Hash for fast change detection
    // Behavioral settings (single typed group). See `FormSettings` type.
    settings: jsonb().$type<FormSettings>().notNull().default(defaultFormSettings),
    customization: jsonb().default({}),
    slug: text(),
    customDomainId: text(),
    sortIndex: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_forms_workspace_id").on(t.workspaceId),
    index("idx_forms_workspace_id_status").on(t.workspaceId, t.status),
    index("idx_forms_id_created_by").on(t.id, t.createdByUserId),
    index("idx_forms_slug_custom_domain").on(t.slug, t.customDomainId),
    index("idx_forms_workspace_id_sort_index").on(t.workspaceId, t.sortIndex),
  ],
);

export const customDomains = pgTable(
  "custom_domains",
  {
    id: text().primaryKey(),
    organizationId: text().notNull(),
    domain: text().notNull().unique(),
    status: text().notNull().default("pending"),
    // Captures `status` when an org is downgraded so re-upgrade can restore
    // without re-verifying through Vercel.
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
  ],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: text().primaryKey(),
    formId: text().notNull(),
    version: integer().notNull(), // v1, v2, v3...
    content: jsonb().notNull(), // Plate.js JSON snapshot
    // Snapshot of versioned (Group 2) form-behavior settings; the live (Group 4)
    // keys (`branding`, `analytics`) are excluded by `pickVersionedSettings`.
    settings: jsonb().$type<VersionedSettingsSnapshot>().notNull(),
    customization: jsonb().default({}), // Theme customization snapshot
    title: text().notNull(),
    icon: text(), // Visual asset snapshot
    cover: text(), // Visual asset snapshot
    publishedByUserId: text().notNull(),
    publishedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_form_versions_form_id").on(t.formId),
    index("idx_form_versions_form_id_version").on(t.formId, t.version),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text().primaryKey(),
    formId: text().notNull(),
    formVersionId: text(), // Links to the form version this submission was created against
    data: jsonb().notNull().default({}),
    isCompleted: boolean().notNull().default(true),
    // Client-generated UUID (localStorage) that links debounced draft saves to a
    // single submission row. Null for legacy rows pre-autosave.
    draftId: text(),
    // Highest step index the respondent reached (0-based). Null until the form
    // is multi-step and a draft save records it.
    lastStepReached: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_submissions_form_id").on(t.formId),
    index("idx_submissions_form_id_created_at_id").on(t.formId, t.createdAt, t.id),
    uniqueIndex("uniq_submissions_form_id_draft_id")
      .on(t.formId, t.draftId)
      .where(sql`${t.draftId} IS NOT NULL`),
  ],
);

export const formFavorites = pgTable(
  "form_favorites",
  {
    id: text().primaryKey(), // Format: ${userId}:${formId}
    userId: text().notNull(),
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
    userId: text().notNull(),
    workspaceId: text().notNull(),
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
    userId: text().notNull(),
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
    userId: text().notNull(),
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
    formId: text().notNull(),

    // Anonymous tracking
    visitorHash: text().notNull(),
    sessionId: text().notNull(),

    // Source attribution
    referrer: text(),
    utmSource: text(),
    utmMedium: text(),
    utmCampaign: text(),

    // Device metadata
    deviceType: text(), // 'desktop' | 'tablet' | 'mobile'
    browser: text(),
    browserVersion: text(),
    os: text(),
    osVersion: text(),

    // Geolocation (country-level, privacy-friendly)
    country: text(),
    countryName: text(),
    city: text(),
    region: text(),

    // Timing
    visitStartedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    visitEndedAt: timestamp({ withTimezone: true }),
    durationMs: integer(),

    // Interaction tracking
    didStartForm: boolean().notNull().default(false),
    didSubmit: boolean().notNull().default(false),
    submissionId: text(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_form_visits_form_id").on(t.formId)],
);

export const formQuestionProgress = pgTable("form_question_progress", {
  id: text().primaryKey(),
  formId: text().notNull(),
  visitId: text().notNull(),
  visitorHash: text().notNull(),

  questionId: text().notNull(),
  questionType: text(),
  questionIndex: integer().notNull(),

  viewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp({ withTimezone: true }),
  completedAt: timestamp({ withTimezone: true }),
  wasLastQuestion: boolean().notNull().default(false),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const formAnalyticsDaily = pgTable(
  "form_analytics_daily",
  {
    id: text().primaryKey(),
    formId: text().notNull(),
    date: text().notNull(), // 'YYYY-MM-DD'

    // Core metrics
    totalVisits: integer().notNull().default(0),
    uniqueVisitors: integer().notNull().default(0),
    totalSubmissions: integer().notNull().default(0),
    uniqueSubmitters: integer().notNull().default(0),
    avgDurationMs: integer(),
    medianDurationMs: integer(),

    // Device breakdown
    deviceDesktop: integer().default(0),
    deviceMobile: integer().default(0),
    deviceTablet: integer().default(0),

    // Browser breakdown
    browserChrome: integer().default(0),
    browserFirefox: integer().default(0),
    browserSafari: integer().default(0),
    browserEdge: integer().default(0),
    browserOther: integer().default(0),

    // OS breakdown
    osWindows: integer().default(0),
    osMacos: integer().default(0),
    osIos: integer().default(0),
    osAndroid: integer().default(0),
    osLinux: integer().default(0),
    osOther: integer().default(0),

    // Flexible breakdowns (JSONB for many values)
    countryBreakdown: jsonb().notNull().default({}),
    cityBreakdown: jsonb().notNull().default({}),
    sourceBreakdown: jsonb().notNull().default({}),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_form_analytics_daily_form_id_date").on(t.formId, t.date)],
);

export const formDropoffDaily = pgTable(
  "form_dropoff_daily",
  {
    id: text().primaryKey(),
    formId: text().notNull(),
    date: text().notNull(), // 'YYYY-MM-DD'
    questionId: text().notNull(),
    questionIndex: integer().notNull(),

    viewCount: integer().notNull().default(0),
    startCount: integer().notNull().default(0),
    completeCount: integer().notNull().default(0),
    dropoffCount: integer().notNull().default(0),
    dropoffRate: integer(), // Percentage * 100
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
    apikey,
    organization,
    member,
    invitation,
    forms,
    formVersions,
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
      apikeys: r.many.apikey({
        from: r.user.id,
        to: r.apikey.userId,
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
    apikey: {
      user: r.one.user({
        from: r.apikey.userId,
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

export const WorkspaceZod = createSelectSchema(workspaces);

export const uploadRateLimits = pgTable("upload_rate_limits", {
  ip: text("ip").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

export const FormZod = createSelectSchema(forms);
export const FormVersionZod = createSelectSchema(formVersions);
export const SubmissionZod = createSelectSchema(submissions);
export const FormVisitsZod = createSelectSchema(formVisits);
export const FormQuestionProgressZod = createSelectSchema(formQuestionProgress);
export const FormAnalyticsDailyZod = createSelectSchema(formAnalyticsDaily);
export const FormDropoffDailyZod = createSelectSchema(formDropoffDaily);

export const OrganizationZod = createSelectSchema(organization);
export const MemberZod = createSelectSchema(member);
export const InvitationZod = createSelectSchema(invitation);

export const FormFavoriteZod = createSelectSchema(formFavorites);
export const CustomDomainZod = createSelectSchema(customDomains);
export const FormNotificationPreferenceZod = createSelectSchema(formNotificationPreferences);
export const FormSubmissionNotificationZod = createSelectSchema(formSubmissionNotifications);
