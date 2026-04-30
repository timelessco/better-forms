import { useForm as useTanstackForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { RocketIcon, XIcon } from "@/components/ui/icons";
import { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "@/hooks/use-live-hooks";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import { publishForm } from "@/hooks/use-form-versions";
import { getFormListings } from "@/collections";
import { useSession } from "@/lib/auth/auth-client";
import { orgDomainsQueryOptions } from "@/lib/server-fn/custom-domains";
import { Switch } from "@/components/ui/switch";
import {
  ConfigCard,
  ConfigRow,
  formFieldsToEmbedOptions,
  EmbedConfigPanel,
} from "./embed-config-panel";
import { EmbedCodeDialog, searchToFormValues, formValuesToSearch, tabs } from "./embed-section";
import { EmbedPreviewMockup } from "./embed-preview-mockup";
import type { PresentationMode } from "@/types/form-settings";

const selectValues = (state: { values: ReturnType<typeof searchToFormValues> }) => state.values;

interface ShareSummarySidebarProps {
  formId: string;
}

export const ShareSummarySidebar = ({ formId }: ShareSummarySidebarProps) => {
  const { closeSidebar } = useEditorSidebar();
  const { data: savedDocs } = useForm(formId);
  const doc = savedDocs?.[0];
  const { data: session } = useSession();
  const orgId = session?.session?.activeOrganizationId ?? undefined;

  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const handleOpenCodeDialog = useCallback(() => setCodeDialogOpen(true), []);

  const docSettings = doc?.settings;

  const form = useTanstackForm({
    defaultValues: searchToFormValues(search, doc?.icon, Boolean(docSettings?.branding ?? true)),
    listeners: {
      onChange: ({ formApi }) => {
        const v = formApi.state.values;
        navigate({
          search: ((prev: Record<string, unknown>) => ({
            ...prev,
            ...formValuesToSearch(v),
            // eslint-disable-next-line typescript-eslint/no-explicit-any
          })) as any,
          replace: true,
        });
      },
      onChangeDebounceMs: 150,
    },
  });

  // Persist toggles into the single `settings` JSONB so every embed reflects
  // the change immediately via form settings.
  const docPresentationMode: PresentationMode = docSettings?.presentationMode ?? "card";
  const docProgressBar = Boolean(docSettings?.progressBar);
  const docBranding = Boolean(docSettings?.branding ?? true);
  const docAnalytics = Boolean(docSettings?.analytics);

  const updateSettings = useCallback(
    (patch: Record<string, unknown>) => {
      if (!doc?.id) return;
      const collection = getFormListings();
      collection.update(
        doc.id,
        (draft: { settings?: Record<string, unknown>; updatedAt?: string }) => {
          draft.settings = { ...(draft.settings ?? {}), ...patch };
          draft.updatedAt = new Date().toISOString();
        },
      );
    },
    [doc?.id],
  );

  const handlePresentationModeChange = useCallback(
    (value: PresentationMode) => {
      if (docPresentationMode === value) return;
      updateSettings({ presentationMode: value });
    },
    [docPresentationMode, updateSettings],
  );

  const handleProgressBarChange = useCallback(
    (value: boolean) => {
      if (docProgressBar === value) return;
      updateSettings({ progressBar: value });
    },
    [docProgressBar, updateSettings],
  );

  const handleBrandingChange = useCallback(
    (value: boolean) => {
      if (docBranding === value) return;
      updateSettings({ branding: value });
      form.setFieldValue("branding", value);
    },
    [docBranding, updateSettings, form],
  );

  const handleAnalyticsChange = useCallback(
    (value: boolean) => {
      if (docAnalytics === value) return;
      updateSettings({ analytics: value });
    },
    [docAnalytics, updateSettings],
  );

  const docCustomDomainId = doc?.customDomainId;
  const docSlug = doc?.slug;

  const [domainState, setDomainState] = useState<{
    domainId: string | null;
    slug: string | null;
  }>({ domainId: docCustomDomainId ?? null, slug: docSlug ?? null });

  const activeDomainId = docCustomDomainId ?? domainState.domainId;
  const activeSlug = docSlug ?? domainState.slug;

  const { data: domains } = useQuery({
    ...orgDomainsQueryOptions(orgId ?? ""),
    enabled: !!orgId,
  });

  const selectedDomainName = useMemo(
    () => (domains ?? []).find((d) => d.id === activeDomainId)?.domain,
    [domains, activeDomainId],
  );

  const handleDomainAssigned = useCallback((domainId: string | null, slug: string | null) => {
    setDomainState({ domainId, slug });
  }, []);

  const handlePublish = useCallback(async () => {
    try {
      const tx = publishForm(formId);
      await tx.isPersisted.promise;
      toast.success("Form published successfully!");
    } catch (error) {
      toast.error("Failed to publish form");
      console.error(error);
    }
  }, [formId]);

  if (!doc) return null;

  const isDraft = doc.status === "draft";
  const shareUrl =
    selectedDomainName && activeSlug
      ? `https://${selectedDomainName}/${activeSlug}`
      : `${window.location.origin}/forms/${doc.id}`;

  return (
    <Sidebar
      side="right"
      collapsible="none"
      className="h-full w-full animate-in border-none duration-200 ease-out slide-in-from-right-[40%]"
    >
      <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
        <div className="flex items-center justify-between">
          <h2 className="pl-2.5 text-base text-foreground">Share</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={closeSidebar}
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {!isDraft && (
          <form.Field name="embedType">
            {(field) => (
              <Tabs
                value={field.state.value}
                defaultValue={"fullpage"}
                onValueChange={(v) => {
                  const update = () => {
                    flushSync(() => {
                      field.handleChange(v as typeof field.state.value);
                      navigate({
                        search: ((prev: Record<string, unknown>) => ({
                          ...prev,
                          embedType: v,
                          // eslint-disable-next-line typescript-eslint/no-explicit-any
                        })) as any,
                        replace: true,
                      });
                    });
                  };
                  if (document.startViewTransition) {
                    document.startViewTransition(update);
                  } else {
                    update();
                  }
                }}
                className="pl-1"
              >
                <TabsList className="w-full">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={"text-base font-medium tracking-[0.21px]"}
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                  <TabsIndicator />
                </TabsList>
              </Tabs>
            )}
          </form.Field>
        )}
      </SidebarHeader>

      <SidebarContent>
        <div className="space-y-3 px-3">
          <SidebarSection label="Presentation" className="pb-2.75" action={<></>}>
            <ConfigCard>
              <ConfigRow
                label="Mode"
                description="Choose how questions are presented to respondents."
              >
                <Tabs
                  value={docPresentationMode}
                  onValueChange={(v) => handlePresentationModeChange(v as PresentationMode)}
                >
                  <TabsList className="h-7">
                    <TabsTrigger value="card" className="px-2 text-xs">
                      Card
                    </TabsTrigger>
                    <TabsTrigger value="field-by-field" className="px-2 text-xs">
                      Field by field
                    </TabsTrigger>
                    <TabsIndicator />
                  </TabsList>
                </Tabs>
              </ConfigRow>

              <ConfigRow
                label="Progress bar"
                description="Show respondents how much of the form they have completed."
                variant="switch"
              >
                <Switch
                  aria-label="Progress bar"
                  checked={docProgressBar}
                  onCheckedChange={handleProgressBarChange}
                  size="default"
                />
              </ConfigRow>
            </ConfigCard>
          </SidebarSection>

          {isDraft ? (
            <div className="flex flex-col items-center justify-center space-y-6 rounded-2xl border-2 border-dashed bg-muted/20 px-4 py-10 text-center">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <RocketIcon className="animate-bounce-subtle h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold">Ready to go live?</h3>
                <p className="text-xs text-muted-foreground">
                  Your form is currently in draft. Publish it to start collecting responses.
                </p>
              </div>
              <Button size="sm" onClick={handlePublish} className="w-full gap-2 font-semibold">
                Publish Now
              </Button>
            </div>
          ) : (
            <form.Subscribe selector={selectValues}>
              {(values) => {
                const embedType = values.embedType;
                const options = formFieldsToEmbedOptions(values);
                return (
                  <div className="space-y-3">
                    <EmbedPreviewMockup
                      key={embedType}
                      embedType={embedType}
                      popupPosition={options.popup.position}
                      darkOverlay={options.popup.overlay === "dark"}
                      emoji={options.popup.emoji}
                      emojiIcon={options.popup.emojiIcon}
                      alignLeft={options.display.alignment === "left"}
                    />

                    <SidebarSection label="Customise" className="pb-2.75" action={<></>}>
                      <EmbedConfigPanel form={form} embedType={embedType} section="customize" />
                    </SidebarSection>

                    <SidebarSection label="Pro Features" action={<></>}>
                      <EmbedConfigPanel
                        form={form}
                        embedType={embedType}
                        section="pro"
                        docBranding={docBranding}
                        onBrandingChange={handleBrandingChange}
                        docAnalytics={docAnalytics}
                        onAnalyticsChange={handleAnalyticsChange}
                        orgId={orgId}
                        formId={formId}
                        customDomainId={activeDomainId}
                        formSlug={activeSlug}
                        formTitle={doc.title}
                        onDomainAssigned={handleDomainAssigned}
                      />
                    </SidebarSection>

                    <Button
                      onClick={handleOpenCodeDialog}
                      variant="default"
                      className="w-full text-base"
                    >
                      Get Code
                    </Button>

                    <EmbedCodeDialog
                      open={codeDialogOpen}
                      onOpenChange={setCodeDialogOpen}
                      embedType={embedType}
                      options={options}
                      formId={formId}
                      docTitle={doc.title || undefined}
                      customDomain={selectedDomainName}
                      formSlug={activeSlug ?? undefined}
                    />
                  </div>
                );
              }}
            </form.Subscribe>
          )}
        </div>
      </SidebarContent>

      {!isDraft && (
        <SidebarFooter className="px-2 py-2">
          <div className="flex h-[30px] items-center gap-[6px] rounded-lg bg-gray-100 py-[3px] pr-[3px] pl-[10px]">
            <span className="min-w-0 flex-1 truncate font-case text-sm font-normal text-(--color-gray-alpha-600)">
              {shareUrl}
            </span>
            <CopyButton
              text={shareUrl}
              variant="ghost"
              size="sm"
              className="h-6 shrink-0 gap-1 rounded-[5px] border-none bg-(--color-gray-0) px-2 text-sm text-gray-600 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-(--color-gray-0) [&_svg]:size-[13px]"
            >
              Copy
            </CopyButton>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
};
