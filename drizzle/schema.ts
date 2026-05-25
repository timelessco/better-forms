import { pgTable, text, serial, jsonb, timestamp, integer, boolean, index, uniqueIndex, unique, check } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from "drizzle-orm";

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
  createdAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const aiChatPreviewCounts = pgTable(
  "ai_chat_preview_counts",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodDay: text("period_day").notNull(),
    count: integer().default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_ai_chat_preview_counts_org_day").using(
      "btree",
      table.organizationId.asc().nullsLast(),
      table.periodDay.asc().nullsLast(),
    ),
  ],
);

export const aiChatRateLimits = pgTable("ai_chat_rate_limits", {
  ip: text().primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  count: integer().default(0).notNull(),
});

export const aiChatSessions = pgTable(
  "ai_chat_sessions",
  {
    submissionId: text("submission_id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodMonth: text("period_month").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_ai_chat_sessions_org_month").using(
      "btree",
      table.organizationId.asc().nullsLast(),
      table.periodMonth.asc().nullsLast(),
    ),
  ],
);

export const aiGenerationCounts = pgTable(
  "ai_generation_counts",
  {
    id: text().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodDay: text("period_day").notNull(),
    count: integer().default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_ai_generation_counts_org_day").using(
      "btree",
      table.organizationId.asc().nullsLast(),
      table.periodDay.asc().nullsLast(),
    ),
  ],
);

export const customDomains = pgTable(
  "custom_domains",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text().notNull(),
    status: text().default("pending").notNull(),
    vercelDomainId: text(),
    siteTitle: text(),
    faviconUrl: text(),
    ogImageUrl: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    previousStatus: text(),
  },
  (table) => [
    index("custom_domains_domain_idx").using("btree", table.domain.asc().nullsLast()),
    index("custom_domains_org_idx").using("btree", table.organizationId.asc().nullsLast()),
    unique("custom_domains_domain_key").on(table.domain),
    check(
      "custom_domains_previous_status_check",
      sql`(("previousStatus" IS NULL) OR ("previousStatus" = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text, 'suspended'::text])))`,
    ),
    check(
      "custom_domains_status_check",
      sql`(status = ANY (ARRAY['pending'::text, 'verified'::text, 'failed'::text, 'suspended'::text]))`,
    ),
  ],
);

export const formAnalyticsDaily = pgTable(
  "form_analytics_daily",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    date: text().notNull(),
    totalVisits: integer().default(0).notNull(),
    uniqueVisitors: integer().default(0).notNull(),
    totalSubmissions: integer().default(0).notNull(),
    uniqueSubmitters: integer().default(0).notNull(),
    avgDurationMs: integer(),
    medianDurationMs: integer(),
    countryBreakdown: jsonb().default({}).notNull(),
    cityBreakdown: jsonb().default({}).notNull(),
    sourceBreakdown: jsonb().default({}).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    browserBreakdown: jsonb("browser_breakdown").default({}).notNull(),
    osBreakdown: jsonb("os_breakdown").default({}).notNull(),
    deviceBreakdown: jsonb("device_breakdown").default({}).notNull(),
  },
  (table) => [
    uniqueIndex("uniq_form_analytics_daily_form_id_date").using(
      "btree",
      table.formId.asc().nullsLast(),
      table.date.asc().nullsLast(),
    ),
  ],
);

export const formDropoffDaily = pgTable(
  "form_dropoff_daily",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    date: text().notNull(),
    questionId: text().notNull(),
    questionIndex: integer().notNull(),
    viewCount: integer().default(0).notNull(),
    startCount: integer().default(0).notNull(),
    completeCount: integer().default(0).notNull(),
    dropoffCount: integer().default(0).notNull(),
    dropoffRate: integer(),
    completionRate: integer(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    stepId: text(),
    stepIndex: integer(),
    terminalDropoffCount: integer().default(0).notNull(),
  },
  (table) => [
    index("idx_form_dropoff_daily_form_id_date").using(
      "btree",
      table.formId.asc().nullsLast(),
      table.date.asc().nullsLast(),
    ),
  ],
);

export const formFavorites = pgTable(
  "form_favorites",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    sortIndex: text(),
  },
  (table) => [
    index("idx_form_favorites_user_id").using("btree", table.userId.asc().nullsLast()),
    index("idx_form_favorites_user_id_form_id").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.formId.asc().nullsLast(),
    ),
  ],
);

export const formNotificationPreferences = pgTable(
  "form_notification_preferences",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    inAppNotifications: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_form_notification_preferences_user_id").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
    index("idx_form_notification_preferences_user_id_form_id").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.formId.asc().nullsLast(),
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
    viewedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    wasLastQuestion: boolean().default(false).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    stepId: text(),
    stepIndex: integer(),
  },
  (table) => [
    index("idx_form_question_progress_form_id").using("btree", table.formId.asc().nullsLast()),
    index("idx_form_question_progress_visit_id").using("btree", table.visitId.asc().nullsLast()),
    uniqueIndex("uq_form_question_progress_visit_question").using(
      "btree",
      table.visitId.asc().nullsLast(),
      table.questionId.asc().nullsLast(),
    ),
  ],
);

export const formSettings = pgTable("form_settings", {
  formId: text()
    .primaryKey()
    .references(() => forms.id, { onDelete: "cascade" }),
  settings: jsonb()
    .default({
      branding: true,
      language: "English",
      password: null,
      analytics: false,
      closeDate: null,
      closeForm: false,
      aiChatTone: "friendly",
      closeOnDate: false,
      progressBar: false,
      redirectUrl: null,
      dataRetention: false,
      redirectDelay: 0,
      aiChatGreeting: null,
      maxSubmissions: null,
      passwordProtect: false,
      limitSubmissions: false,
      presentationMode: "card",
      closedFormMessage: null,
      dataRetentionDays: null,
      notificationEmail: null,
      respondentEmailBody: null,
      saveAnswersForLater: true,
      redirectOnCompletion: false,
      respondentEmailSubject: null,
      selfEmailNotifications: false,
      preventDuplicateSubmissions: false,
      respondentEmailNotifications: false,
    })
    .notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const formSubmissionNotifications = pgTable(
  "form_submission_notifications",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    unreadCount: integer().default(0).notNull(),
    isRead: boolean().default(true).notNull(),
    firstUnreadAt: timestamp({ withTimezone: true }),
    latestSubmissionAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    latestSubmissionId: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_form_submission_notifications_user_id").using(
      "btree",
      table.userId.asc().nullsLast(),
    ),
    index("idx_form_submission_notifications_user_id_form_id").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.formId.asc().nullsLast(),
    ),
    index("idx_form_submission_notifications_user_id_is_read").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.isRead.asc().nullsLast(),
    ),
  ],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references((): AnyPgColumn => forms.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    content: jsonb().notNull(),
    settings: jsonb(),
    customization: jsonb().default({}),
    title: text().notNull(),
    publishedByUserId: text().references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    icon: text(),
    cover: text(),
    publishedByName: text(),
    publishedByImage: text(),
  },
  (table) => [
    index("idx_form_versions_form_id").using("btree", table.formId.asc().nullsLast()),
    index("idx_form_versions_form_id_version").using(
      "btree",
      table.formId.asc().nullsLast(),
      table.version.asc().nullsLast(),
    ),
  ],
);

export const formVisits = pgTable(
  "form_visits",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    visitorHash: text().notNull(),
    sessionId: text().notNull(),
    referrer: text(),
    utmSource: text(),
    utmMedium: text(),
    utmCampaign: text(),
    deviceType: text(),
    browser: text(),
    browserVersion: text(),
    os: text(),
    osVersion: text(),
    country: text(),
    city: text(),
    region: text(),
    visitStartedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    visitEndedAt: timestamp({ withTimezone: true }),
    durationMs: integer(),
    didStartForm: boolean().default(false).notNull(),
    didSubmit: boolean().default(false).notNull(),
    submissionId: text().references(() => submissions.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_form_visits_form_id").using("btree", table.formId.asc().nullsLast()),
    index("idx_form_visits_form_id_visit_started_at").using(
      "btree",
      table.formId.asc().nullsLast(),
      table.visitStartedAt.asc().nullsLast(),
    ),
    index("idx_form_visits_visitor_hash").using("btree", table.visitorHash.asc().nullsLast()),
    check(
      "form_visits_device_type_check",
      sql`(("deviceType" IS NULL) OR ("deviceType" = ANY (ARRAY['desktop'::text, 'mobile'::text, 'tablet'::text])))`,
    ),
  ],
);

export const forms = pgTable(
  "forms",
  {
    id: text().primaryKey(),
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().default("Untitled").notNull(),
    formName: text().default("draft").notNull(),
    schemaName: text().default("draftFormSchema").notNull(),
    content: jsonb().default([]).notNull(),
    draftSettings: jsonb()
      .default({
        branding: true,
        language: "English",
        password: null,
        analytics: false,
        closeDate: null,
        closeForm: false,
        aiChatTone: "friendly",
        closeOnDate: false,
        progressBar: false,
        redirectUrl: null,
        dataRetention: false,
        redirectDelay: 0,
        aiChatGreeting: null,
        maxSubmissions: null,
        passwordProtect: false,
        limitSubmissions: false,
        presentationMode: "card",
        closedFormMessage: null,
        dataRetentionDays: null,
        notificationEmail: null,
        respondentEmailBody: null,
        saveAnswersForLater: true,
        redirectOnCompletion: false,
        respondentEmailSubject: null,
        selfEmailNotifications: false,
        preventDuplicateSubmissions: false,
        respondentEmailNotifications: false,
      })
      .notNull(),
    icon: text(),
    cover: text(),
    status: text().default("draft").notNull(),
    lastPublishedVersionId: text().references((): AnyPgColumn => formVersions.id, {
      onDelete: "set null",
    }),
    publishedContentHash: text(),
    customization: jsonb().default({}),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    slug: text(),
    customDomainId: text().references(() => customDomains.id, { onDelete: "set null" }),
    sortIndex: text(),
    shortId: text().notNull(),
  },
  (table) => [
    index("idx_forms_id_created_by").using(
      "btree",
      table.id.asc().nullsLast(),
      table.createdByUserId.asc().nullsLast(),
    ),
    index("idx_forms_workspace_id").using("btree", table.workspaceId.asc().nullsLast()),
    index("idx_forms_workspace_id_sort_index").using(
      "btree",
      table.workspaceId.asc().nullsLast(),
      table.sortIndex.asc().nullsLast(),
    ),
    index("idx_forms_workspace_id_status").using(
      "btree",
      table.workspaceId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    uniqueIndex("uniq_forms_slug_custom_domain")
      .using("btree", table.slug.asc().nullsLast(), table.customDomainId.asc().nullsLast())
      .where(sql`(slug IS NOT NULL)`),
    unique("forms_shortId_key").on(table.shortId),
    check(
      "forms_status_check",
      sql`(status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))`,
    ),
  ],
);

export const invitation = pgTable("invitation", {
  id: text().primaryKey(),
  email: text().notNull(),
  inviterId: text().notNull(),
  organizationId: text().notNull(),
  role: text().default("member").notNull(),
  status: text().default("pending").notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const member = pgTable(
  "member",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    organizationId: text().notNull(),
    role: text().default("member").notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_member_user_id_org_id").using(
      "btree",
      table.userId.asc().nullsLast(),
      table.organizationId.asc().nullsLast(),
    ),
  ],
);

export const organization = pgTable(
  "organization",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    slug: text(),
    logo: text(),
    metadata: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    plan: text().default("free").notNull(),
  },
  (table) => [unique("organization_slug_key").on(table.slug)],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    activeOrganizationId: text(),
  },
  (table) => [unique("session_token_key").on(table.token)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text().primaryKey(),
    formId: text()
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    formVersionId: text().references(() => formVersions.id, { onDelete: "set null" }),
    data: jsonb().default({}).notNull(),
    isCompleted: boolean().default(true).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    draftId: text(),
    lastStepReached: integer(),
  },
  (table) => [
    index("idx_submissions_form_id").using("btree", table.formId.asc().nullsLast()),
    index("idx_submissions_form_id_created_at_id").using(
      "btree",
      table.formId.asc().nullsLast(),
      table.createdAt.asc().nullsLast(),
      table.id.asc().nullsLast(),
    ),
    index("idx_submissions_form_version_id").using("btree", table.formVersionId.asc().nullsLast()),
    uniqueIndex("uniq_submissions_form_id_draft_id")
      .using("btree", table.formId.asc().nullsLast(), table.draftId.asc().nullsLast())
      .where(sql`("draftId" IS NOT NULL)`),
  ],
);

export const todos = pgTable("todos", {
  id: serial().primaryKey(),
  title: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).default(sql`now()`),
});

export const twoFactor = pgTable("twoFactor", {
  id: text().primaryKey(),
  secret: text().notNull(),
  backupCodes: text().notNull(),
  userId: text().notNull(),
});

export const uploadRateLimits = pgTable("upload_rate_limits", {
  ip: text().primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  count: integer().default(0).notNull(),
});

export const user = pgTable(
  "user",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().default(false).notNull(),
    image: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    username: text(),
    displayUsername: text(),
    twoFactorEnabled: boolean().default(false),
  },
  (table) => [
    unique("user_email_key").on(table.email),
    unique("user_username_key").on(table.username),
  ],
);

export const userWorkspaceOrder = pgTable(
  "user_workspace_order",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sortIndex: text().notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_user_workspace_order_user_id").using("btree", table.userId.asc().nullsLast()),
  ],
);

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text().references(() => user.id, { onDelete: "set null" }),
    name: text().default("Workspace").notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_workspaces_id_created_by").using(
      "btree",
      table.id.asc().nullsLast(),
      table.createdByUserId.asc().nullsLast(),
    ),
    index("idx_workspaces_organization_id").using("btree", table.organizationId.asc().nullsLast()),
  ],
);
