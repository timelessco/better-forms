import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { revalidateLogic, useAppForm } from "@/components/ui/tanstack-form";
import { Textarea } from "@/components/ui/textarea";
import { getFormListings } from "@/collections";
import { localFormCollection } from "@/collections/local/form";
import { useForm, useLocalForm } from "@/hooks/use-live-hooks";
import { APP_NAME } from "@/lib/config/app-config";
import {
  getFormInAppNotificationPreferenceQueryOptions,
  setFormInAppNotificationPreference,
} from "@/lib/server-fn/notifications";
import { defaultFormSettings } from "@/types/form-settings";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { FeatureGate } from "@/components/ui/feature-gate";
import {
  ConfigCard,
  ConfigRow,
  selectTriggerCls,
} from "@/components/form-builder/embed-config-panel";

const settingsDefaults = defaultFormSettings;

const selectRedirectOnCompletion = (state: { values: { redirectOnCompletion: unknown } }) =>
  state.values.redirectOnCompletion;
const selectDataRetention = (state: { values: { dataRetention: unknown } }) =>
  state.values.dataRetention;
const selectSelfEmailNotifications = (state: { values: { selfEmailNotifications: unknown } }) =>
  state.values.selfEmailNotifications;
const selectRespondentEmailNotifications = (state: {
  values: { respondentEmailNotifications: unknown };
}) => state.values.respondentEmailNotifications;
const selectPasswordProtect = (state: { values: { passwordProtect: unknown } }) =>
  state.values.passwordProtect;
const selectCloseForm = (state: { values: { closeForm: unknown } }) => state.values.closeForm;
const selectCloseOnDate = (state: { values: { closeOnDate: unknown } }) => state.values.closeOnDate;
const selectLimitSubmissions = (state: { values: { limitSubmissions: unknown } }) =>
  state.values.limitSubmissions;

type BrowserNotificationPermission = NotificationPermission | "unsupported";

const getBrowserNotificationPermission = (): BrowserNotificationPermission => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
};

const getBrowserPermissionLabel = (permission: BrowserNotificationPermission) => {
  switch (permission) {
    case "granted":
      return "Allowed";
    case "denied":
      return "Blocked in browser";
    case "unsupported":
      return "Unsupported in this browser";
    case "default":
    default:
      return "Not enabled in browser";
  }
};

export const SettingsContent = ({ formId, isLocal }: { formId: string; isLocal?: boolean }) => {
  const cloudForm = useForm(isLocal ? undefined : formId);
  const localFormResult = useLocalForm(isLocal ? formId : undefined);
  const formResult = isLocal ? localFormResult : cloudForm;
  const formDoc = formResult.data?.[0] ?? null;
  const hasEmailField = useMemo(() => {
    const content = formDoc?.content;
    if (!Array.isArray(content)) return false;
    return content.some((node) => (node as { type?: string }).type === "formEmail");
  }, [formDoc]);
  const collection = (isLocal ? localFormCollection : getFormListings()) as ReturnType<
    typeof getFormListings
  >;
  const queryClient = useQueryClient();
  const [browserPermission, setBrowserPermission] = useState<BrowserNotificationPermission>(
    getBrowserNotificationPermission,
  );

  const inAppNotificationPreference = useQuery({
    ...getFormInAppNotificationPreferenceQueryOptions(formId),
    enabled: !isLocal,
  });

  const setInAppNotificationPreferenceMutation = useMutation({
    mutationFn: async (enabled: boolean) =>
      setFormInAppNotificationPreference({
        data: { formId, enabled },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["form-in-app-notification-preference", formId], result);
      queryClient.invalidateQueries({ queryKey: ["submission-notifications"] });
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Failed to update in-app notifications";
      toast.error(message);
    },
  });

  const handleInAppNotificationsChange = async (checked: boolean) => {
    await setInAppNotificationPreferenceMutation.mutateAsync(checked);

    if (!checked) {
      setBrowserPermission(getBrowserNotificationPermission());
      return;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      return;
    }

    setBrowserPermission(Notification.permission);
  };

  const form = useAppForm({
    defaultValues: { ...settingsDefaults, ...(formDoc?.settings ?? {}) },
    validationLogic: revalidateLogic(),
    listeners: {
      onChange: ({ formApi }) => {
        if (!formDoc?.id) return;
        collection.update(formDoc.id, (draft) => {
          draft.settings = { ...(draft.settings ?? settingsDefaults), ...formApi.state.values };
          draft.updatedAt = new Date().toISOString();
        });
      },
      onChangeDebounceMs: 500,
    },
  });

  const CONFIG_INPUT_CLS = "rounded-lg !border-none";

  return (
    <div className="space-y-3 pb-8">
      <form.AppForm>
        <form.Form className="gap-3 p-0">
          <SidebarSection label="General" className="pb-2.75" action={<></>}>
            <ConfigCard>
              <ConfigRow label="Language" description="Language for default buttons, errors, etc.">
                <form.AppField name="language">
                  {(field) => (
                    <Select
                      value={field.state.value || "English"}
                      onValueChange={(value) => field.handleChange(value ?? "English")}
                    >
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </form.AppField>
              </ConfigRow>

              <ConfigRow
                label="Redirect on completion"
                description="Redirect to a custom URL when the form is submitted."
                variant="switch"
              >
                <form.AppField name="redirectOnCompletion">
                  {(field) => (
                    <Switch
                      aria-label="Redirect on completion"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>

              <form.Subscribe selector={selectRedirectOnCompletion}>
                {(redirectOnCompletion) =>
                  redirectOnCompletion ? (
                    <>
                      <ConfigRow label="Redirect URL">
                        <form.AppField name="redirectUrl">
                          {(field) => (
                            <Input
                              type="url"
                              placeholder="https://example.com"
                              value={(field.state.value as string) || ""}
                              onChange={(e) => field.handleChange(e.target.value || null)}
                              className={`w-[160px] text-sm ${CONFIG_INPUT_CLS}`}
                              aria-label="Redirect URL"
                              variant="primary"
                            />
                          )}
                        </form.AppField>
                      </ConfigRow>
                      <ConfigRow label="Redirect delay">
                        <form.AppField name="redirectDelay">
                          {(field) => (
                            <Input
                              type="number"
                              min={0}
                              max={60}
                              placeholder="0"
                              value={field.state.value || 0}
                              onChange={(e) => field.handleChange(Number(e.target.value) || 0)}
                              className={`w-[70px] text-sm ${CONFIG_INPUT_CLS}`}
                              aria-label="Redirect delay"
                              variant="primary"
                            />
                          )}
                        </form.AppField>
                      </ConfigRow>
                    </>
                  ) : null
                }
              </form.Subscribe>

              <ConfigRow
                label={`${APP_NAME} branding`}
                description={`Show "Made with ${APP_NAME}" on your form.`}
                variant="switch"
              >
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="h-4 border-none bg-teal-100 px-1.5 text-[9px] text-teal-600"
                  >
                    Pro
                  </Badge>
                  <FeatureGate requiredPlan="pro">
                    <form.AppField name="branding">
                      {(field) => (
                        <Switch
                          aria-label="Branding"
                          checked={!!field.state.value}
                          onCheckedChange={field.handleChange}
                          size="default"
                        />
                      )}
                    </form.AppField>
                  </FeatureGate>
                </div>
              </ConfigRow>

              <ConfigRow
                label="Data retention"
                description="Auto-delete submissions after a set period."
                variant="switch"
              >
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="h-4 border-none bg-teal-100 px-1.5 text-[9px] text-teal-600"
                  >
                    Pro
                  </Badge>
                  <FeatureGate requiredPlan="pro">
                    <form.AppField name="dataRetention">
                      {(field) => (
                        <Switch
                          aria-label="Data retention"
                          checked={!!field.state.value}
                          onCheckedChange={field.handleChange}
                          size="default"
                        />
                      )}
                    </form.AppField>
                  </FeatureGate>
                </div>
              </ConfigRow>

              <form.Subscribe selector={selectDataRetention}>
                {(dataRetention) =>
                  dataRetention ? (
                    <ConfigRow label="Retention days">
                      <form.AppField name="dataRetentionDays">
                        {(field) => (
                          <Input
                            type="number"
                            min={1}
                            placeholder="30"
                            value={(field.state.value as number) || ""}
                            onChange={(e) =>
                              field.handleChange(e.target.value ? Number(e.target.value) : null)
                            }
                            className={`w-[70px] text-sm ${CONFIG_INPUT_CLS}`}
                            aria-label="Retention days"
                            variant="primary"
                          />
                        )}
                      </form.AppField>
                    </ConfigRow>
                  ) : null
                }
              </form.Subscribe>
            </ConfigCard>
          </SidebarSection>

          <SidebarSection label="Notifications" className="pb-2.75" action={<></>}>
            <ConfigCard>
              <ConfigRow
                label="Email notifications"
                description="Get an email for new form submissions."
                variant="switch"
              >
                <form.AppField name="selfEmailNotifications">
                  {(field) => (
                    <Switch
                      aria-label="Email notifications"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>

              <form.Subscribe selector={selectSelfEmailNotifications}>
                {(selfEmailNotifications) =>
                  selfEmailNotifications ? (
                    <ConfigRow label="Email">
                      <form.AppField name="notificationEmail">
                        {(field) => (
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            value={(field.state.value as string) || ""}
                            onChange={(e) => field.handleChange(e.target.value || null)}
                            className={`w-[160px] text-sm ${CONFIG_INPUT_CLS}`}
                            aria-label="Notification email"
                            variant="primary"
                          />
                        )}
                      </form.AppField>
                    </ConfigRow>
                  ) : null
                }
              </form.Subscribe>

              {!isLocal && inAppNotificationPreference.data?.canManageInAppNotifications ? (
                <>
                  <ConfigRow
                    label="In-app notifications"
                    description="Show new submission alerts in your inbox and browser."
                    variant="switch"
                  >
                    <Switch
                      aria-label="In-app notifications"
                      checked={!!inAppNotificationPreference.data.inAppNotifications}
                      onCheckedChange={handleInAppNotificationsChange}
                      disabled={setInAppNotificationPreferenceMutation.isPending}
                      size="default"
                    />
                  </ConfigRow>

                  {inAppNotificationPreference.data.inAppNotifications ? (
                    <ConfigRow
                      label="Browser status"
                      description="Native browser popups require browser permission."
                    >
                      <span className="text-sm text-foreground">
                        {getBrowserPermissionLabel(browserPermission)}
                      </span>
                    </ConfigRow>
                  ) : null}
                </>
              ) : null}

              <ConfigRow
                label="Respondent emails"
                description={
                  hasEmailField
                    ? "Send a confirmation email to respondents."
                    : "Add an email field to your form to enable this."
                }
                variant="switch"
              >
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className="h-4 border-none bg-teal-100 px-1.5 text-[9px] text-teal-600"
                  >
                    Pro
                  </Badge>
                  <FeatureGate requiredPlan="pro">
                    <form.AppField name="respondentEmailNotifications">
                      {(field) => (
                        <Switch
                          aria-label="Respondent email notifications"
                          checked={!!field.state.value && hasEmailField}
                          onCheckedChange={field.handleChange}
                          disabled={!hasEmailField}
                          size="default"
                        />
                      )}
                    </form.AppField>
                  </FeatureGate>
                </div>
              </ConfigRow>

              <form.Subscribe selector={selectRespondentEmailNotifications}>
                {(respondentEmailNotifications) =>
                  respondentEmailNotifications && hasEmailField ? (
                    <>
                      <ConfigRow label="Subject">
                        <form.AppField name="respondentEmailSubject">
                          {(field) => (
                            <Input
                              type="text"
                              placeholder="Thank you for your submission"
                              value={(field.state.value as string) || ""}
                              onChange={(e) => field.handleChange(e.target.value || null)}
                              className={`w-[160px] text-sm ${CONFIG_INPUT_CLS}`}
                              aria-label="Email subject"
                              variant="primary"
                            />
                          )}
                        </form.AppField>
                      </ConfigRow>
                      <div className="bg-secondary px-[10px] py-[7px]">
                        <span className="mb-1.5 block text-sm">Body</span>
                        <form.AppField name="respondentEmailBody">
                          {(field) => (
                            <Textarea
                              placeholder="Thank you for filling out our form."
                              value={(field.state.value as string) || ""}
                              onChange={(e) => field.handleChange(e.target.value || null)}
                              className="min-h-[60px] w-full !rounded-md border-border/60 !bg-background text-sm"
                              aria-label="Email body"
                            />
                          )}
                        </form.AppField>
                      </div>
                    </>
                  ) : null
                }
              </form.Subscribe>
            </ConfigCard>
          </SidebarSection>

          <SidebarSection label="Access" className="pb-2.75" action={<></>}>
            <ConfigCard>
              <ConfigRow
                label="Password protect"
                description="Require a password before respondents can access the form."
                variant="switch"
              >
                <form.AppField name="passwordProtect">
                  {(field) => (
                    <Switch
                      aria-label="Password protect"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>

              <form.Subscribe selector={selectPasswordProtect}>
                {(passwordProtect) =>
                  passwordProtect ? (
                    <ConfigRow label="Password">
                      <form.AppField name="password">
                        {(field) => (
                          <PasswordInput
                            value={(field.state.value as string) || ""}
                            onChange={(val) => field.handleChange(val || null)}
                          />
                        )}
                      </form.AppField>
                    </ConfigRow>
                  ) : null
                }
              </form.Subscribe>

              <ConfigRow
                label="Close form"
                description="People won't be able to respond to this form anymore."
                variant="switch"
              >
                <form.AppField name="closeForm">
                  {(field) => (
                    <Switch
                      aria-label="Close form"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>

              <form.Subscribe selector={selectCloseForm}>
                {(closeForm) =>
                  closeForm ? (
                    <div className="bg-secondary px-[10px] py-[7px]">
                      <span className="mb-1.5 block text-sm">Closed message</span>
                      <form.AppField name="closedFormMessage">
                        {(field) => (
                          <Textarea
                            placeholder="This form is now closed."
                            value={(field.state.value as string) || ""}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className="min-h-[50px] w-full !rounded-md border-border/60 !bg-background text-sm"
                            aria-label="Closed message"
                          />
                        )}
                      </form.AppField>
                    </div>
                  ) : null
                }
              </form.Subscribe>

              <ConfigRow
                label="Close on date"
                description="Schedule a date to close the form for new submissions."
                variant="switch"
              >
                <form.AppField name="closeOnDate">
                  {(field) => (
                    <Switch
                      aria-label="Close on date"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>

              <form.Subscribe selector={selectCloseOnDate}>
                {(closeOnDate) =>
                  closeOnDate ? (
                    <ConfigRow label="Close date">
                      <form.AppField name="closeDate">
                        {(field) => (
                          <DatePicker
                            value={(field.state.value as string) || ""}
                            onChange={(val: string | null) => field.handleChange(val)}
                          />
                        )}
                      </form.AppField>
                    </ConfigRow>
                  ) : null
                }
              </form.Subscribe>

              <ConfigRow
                label="Limit submissions"
                description="Set the maximum number of submissions to receive."
                variant="switch"
              >
                <form.AppField name="limitSubmissions">
                  {(field) => (
                    <Switch
                      aria-label="Limit submissions"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>

              <form.Subscribe selector={selectLimitSubmissions}>
                {(limitSubmissions) =>
                  limitSubmissions ? (
                    <ConfigRow label="Max submissions">
                      <form.AppField name="maxSubmissions">
                        {(field) => (
                          <Input
                            type="number"
                            min={1}
                            placeholder="100"
                            value={(field.state.value as number) || ""}
                            onChange={(e) =>
                              field.handleChange(e.target.value ? Number(e.target.value) : null)
                            }
                            className={`w-[70px] text-sm ${CONFIG_INPUT_CLS}`}
                            aria-label="Max submissions"
                            variant="primary"
                          />
                        )}
                      </form.AppField>
                    </ConfigRow>
                  ) : null
                }
              </form.Subscribe>

              <ConfigRow
                label="Prevent duplicates"
                description="Ensure each respondent can only submit the form once."
                variant="switch"
              >
                <form.AppField name="preventDuplicateSubmissions">
                  {(field) => (
                    <Switch
                      aria-label="Prevent duplicates"
                      checked={!!field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>
            </ConfigCard>
          </SidebarSection>

          <SidebarSection label="Behavior" className="pb-2.75" action={<></>}>
            <ConfigCard>
              <ConfigRow
                label="Save for later"
                description="Save answers so respondents can continue where they left off."
                variant="switch"
              >
                <form.AppField name="saveAnswersForLater">
                  {(field) => (
                    <Switch
                      aria-label="Save for later"
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                      size="default"
                    />
                  )}
                </form.AppField>
              </ConfigRow>
            </ConfigCard>
          </SidebarSection>
        </form.Form>
      </form.AppForm>
    </div>
  );
};

const PasswordInput = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative w-[160px]">
      <Input
        type={show ? "text" : "password"}
        placeholder="Enter password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg !border-none pr-8 text-sm"
        aria-label="Form password"
        variant="primary"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Toggle password visibility"
      >
        {show ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};
