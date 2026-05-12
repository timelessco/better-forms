import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  aiChatPreviewCounts: {
    organization: r.one.organization({
      from: r.aiChatPreviewCounts.organizationId,
      to: r.organization.id,
    }),
  },
  organization: {
    aiChatPreviewCounts: r.many.aiChatPreviewCounts(),
    aiChatSessions: r.many.aiChatSessions(),
    aiGenerationCounts: r.many.aiGenerationCounts(),
    customDomains: r.many.customDomains(),
    users: r.many.user(),
  },
  aiChatSessions: {
    organization: r.one.organization({
      from: r.aiChatSessions.organizationId,
      to: r.organization.id,
    }),
  },
  aiGenerationCounts: {
    organization: r.one.organization({
      from: r.aiGenerationCounts.organizationId,
      to: r.organization.id,
    }),
  },
  customDomains: {
    organization: r.one.organization({
      from: r.customDomains.organizationId,
      to: r.organization.id,
    }),
    forms: r.many.forms(),
  },
  formAnalyticsDaily: {
    form: r.one.forms({
      from: r.formAnalyticsDaily.formId,
      to: r.forms.id,
    }),
  },
  forms: {
    formAnalyticsDailies: r.many.formAnalyticsDaily(),
    formDropoffDailies: r.many.formDropoffDaily(),
    usersViaFormFavorites: r.many.user({
      from: r.forms.id.through(r.formFavorites.formId),
      to: r.user.id.through(r.formFavorites.userId),
      alias: "forms_id_user_id_via_formFavorites",
    }),
    usersViaFormNotificationPreferences: r.many.user({
      from: r.forms.id.through(r.formNotificationPreferences.formId),
      to: r.user.id.through(r.formNotificationPreferences.userId),
      alias: "forms_id_user_id_via_formNotificationPreferences",
    }),
    formVisits: r.many.formVisits({
      from: r.forms.id.through(r.formQuestionProgress.formId),
      to: r.formVisits.id.through(r.formQuestionProgress.visitId),
    }),
    formSettings: r.many.formSettings(),
    usersViaFormSubmissionNotifications: r.many.user({
      from: r.forms.id.through(r.formSubmissionNotifications.formId),
      to: r.user.id.through(r.formSubmissionNotifications.userId),
      alias: "forms_id_user_id_via_formSubmissionNotifications",
    }),
    usersViaFormVersions: r.many.user({
      from: r.forms.id.through(r.formVersions.formId),
      to: r.user.id.through(r.formVersions.publishedByUserId),
      alias: "forms_id_user_id_via_formVersions",
    }),
    submissions: r.many.submissions({
      from: r.forms.id.through(r.formVisits.formId),
      to: r.submissions.id.through(r.formVisits.submissionId),
    }),
    user: r.one.user({
      from: r.forms.createdByUserId,
      to: r.user.id,
      alias: "forms_createdByUserId_user_id",
    }),
    customDomain: r.one.customDomains({
      from: r.forms.customDomainId,
      to: r.customDomains.id,
    }),
    formVersion: r.one.formVersions({
      from: r.forms.lastPublishedVersionId,
      to: r.formVersions.id,
      alias: "forms_lastPublishedVersionId_formVersions_id",
    }),
    workspace: r.one.workspaces({
      from: r.forms.workspaceId,
      to: r.workspaces.id,
    }),
    formVersions: r.many.formVersions({
      from: r.forms.id.through(r.submissions.formId),
      to: r.formVersions.id.through(r.submissions.formVersionId),
      alias: "forms_id_formVersions_id_via_submissions",
    }),
  },
  formDropoffDaily: {
    form: r.one.forms({
      from: r.formDropoffDaily.formId,
      to: r.forms.id,
    }),
  },
  user: {
    formsViaFormFavorites: r.many.forms({
      alias: "forms_id_user_id_via_formFavorites",
    }),
    formsViaFormNotificationPreferences: r.many.forms({
      alias: "forms_id_user_id_via_formNotificationPreferences",
    }),
    formsViaFormSubmissionNotifications: r.many.forms({
      alias: "forms_id_user_id_via_formSubmissionNotifications",
    }),
    formsViaFormVersions: r.many.forms({
      alias: "forms_id_user_id_via_formVersions",
    }),
    formsCreatedByUserId: r.many.forms({
      alias: "forms_createdByUserId_user_id",
    }),
    workspaces: r.many.workspaces({
      from: r.user.id.through(r.userWorkspaceOrder.userId),
      to: r.workspaces.id.through(r.userWorkspaceOrder.workspaceId),
    }),
    organizations: r.many.organization({
      from: r.user.id.through(r.workspaces.createdByUserId),
      to: r.organization.id.through(r.workspaces.organizationId),
    }),
  },
  formVisits: {
    forms: r.many.forms(),
  },
  formSettings: {
    form: r.one.forms({
      from: r.formSettings.formId,
      to: r.forms.id,
    }),
  },
  submissions: {
    forms: r.many.forms(),
  },
  formVersions: {
    formsLastPublishedVersionId: r.many.forms({
      alias: "forms_lastPublishedVersionId_formVersions_id",
    }),
    formsViaSubmissions: r.many.forms({
      alias: "forms_id_formVersions_id_via_submissions",
    }),
  },
  workspaces: {
    forms: r.many.forms(),
    users: r.many.user(),
  },
}));
