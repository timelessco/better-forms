import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  unique,
} from "drizzle-orm/pg-core";
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

export const apikey = pgTable("apikey", {
  id: text().primaryKey(),
  name: text(),
  start: text(),
  prefix: text(),
  key: text().notNull(),
  userId: text().notNull(),
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
  referenceId: text(),
});

export const customDomains = pgTable(
  "custom_domains",
  {
    id: text().primaryKey(),
    organizationId: text().notNull(),
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
  ],
);

export const formAnalyticsDaily = pgTable(
  "form_analytics_daily",
  {
    id: text().primaryKey(),
    formId: text().notNull(),
    date: text().notNull(),
    totalVisits: integer().default(0).notNull(),
    uniqueVisitors: integer().default(0).notNull(),
    totalSubmissions: integer().default(0).notNull(),
    uniqueSubmitters: integer().default(0).notNull(),
    avgDurationMs: integer(),
    medianDurationMs: integer(),
    deviceDesktop: integer().default(0),
    deviceMobile: integer().default(0),
    deviceTablet: integer().default(0),
    browserChrome: integer().default(0),
    browserFirefox: integer().default(0),
    browserSafari: integer().default(0),
    browserEdge: integer().default(0),
    browserOther: integer().default(0),
    osWindows: integer().default(0),
    osMacos: integer().default(0),
    osIos: integer().default(0),
    osAndroid: integer().default(0),
    osLinux: integer().default(0),
    osOther: integer().default(0),
    countryBreakdown: jsonb().default({}).notNull(),
    cityBreakdown: jsonb().default({}).notNull(),
    sourceBreakdown: jsonb().default({}).notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    index("idx_form_analytics_daily_form_id_date").using(
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
    formId: text().notNull(),
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
    userId: text().notNull(),
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
    userId: text().notNull(),
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

export const formQuestionProgress = pgTable("form_question_progress", {
  id: text().primaryKey(),
  formId: text().notNull(),
  visitId: text().notNull(),
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
});

export const formSubmissionNotifications = pgTable(
  "form_submission_notifications",
  {
    id: text().primaryKey(),
    userId: text().notNull(),
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
    formId: text().notNull(),
    version: integer().notNull(),
    content: jsonb().notNull(),
    settings: jsonb().notNull(),
    customization: jsonb().default({}),
    title: text().notNull(),
    publishedByUserId: text().notNull(),
    publishedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    icon: text(),
    cover: text(),
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
    formId: text().notNull(),
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
    countryName: text(),
    city: text(),
    region: text(),
    visitStartedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    visitEndedAt: timestamp({ withTimezone: true }),
    durationMs: integer(),
    didStartForm: boolean().default(false).notNull(),
    didSubmit: boolean().default(false).notNull(),
    submissionId: text(),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [index("idx_form_visits_form_id").using("btree", table.formId.asc().nullsLast())],
);

export const forms = pgTable(
  "forms",
  {
    id: text().primaryKey(),
    createdByUserId: text().notNull(),
    workspaceId: text().notNull(),
    title: text().default("Untitled").notNull(),
    formName: text().default("draft").notNull(),
    schemaName: text().default("draftFormSchema").notNull(),
    content: jsonb().default([]).notNull(),
    settings: jsonb().default({}).notNull(),
    icon: text(),
    cover: text(),
    isMultiStep: boolean().default(false).notNull(),
    status: text().default("draft").notNull(),
    lastPublishedVersionId: text(),
    publishedContentHash: text(),
    language: text().default("English").notNull(),
    redirectOnCompletion: boolean().default(false).notNull(),
    redirectUrl: text(),
    redirectDelay: integer().default(0).notNull(),
    progressBar: boolean().default(false).notNull(),
    branding: boolean().default(true).notNull(),
    saveAnswersForLater: boolean().default(true).notNull(),
    selfEmailNotifications: boolean().default(false).notNull(),
    notificationEmail: text(),
    respondentEmailNotifications: boolean().default(false).notNull(),
    respondentEmailSubject: text(),
    respondentEmailBody: text(),
    passwordProtect: boolean().default(false).notNull(),
    password: text(),
    closeForm: boolean().default(false).notNull(),
    closedFormMessage: text().default("This form is now closed."),
    closeOnDate: boolean().default(false).notNull(),
    closeDate: text(),
    limitSubmissions: boolean().default(false).notNull(),
    maxSubmissions: integer(),
    preventDuplicateSubmissions: boolean().default(false).notNull(),
    dataRetention: boolean().default(false).notNull(),
    dataRetentionDays: integer(),
    customization: jsonb().default({}),
    createdAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    slug: text(),
    customDomainId: text(),
    sortIndex: text(),
    presentationMode: text().default("card").notNull(),
    analytics: boolean().default(false).notNull(),
  },
  (table) => [
    index("idx_forms_id_created_by").using(
      "btree",
      table.id.asc().nullsLast(),
      table.createdByUserId.asc().nullsLast(),
    ),
    index("idx_forms_slug_custom_domain").using(
      "btree",
      table.slug.asc().nullsLast(),
      table.customDomainId.asc().nullsLast(),
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
    formId: text().notNull(),
    formVersionId: text(),
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
    userId: text().notNull(),
    workspaceId: text().notNull(),
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
    organizationId: text().notNull(),
    createdByUserId: text().notNull(),
    name: text().default("Collection").notNull(),
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
