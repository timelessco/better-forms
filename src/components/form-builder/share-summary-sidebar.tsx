import type { AnyFieldApi } from "@tanstack/react-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { RocketIcon, XIcon } from "@/components/ui/icons";
import { memo, useCallback, useMemo, useState } from "react";
// eslint-disable-next-line react-doctor/no-flush-sync -- flushSync is required so the synchronous router navigation captures the field state update inside the same View Transition snapshot
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateInsightsQueries } from "@/lib/analytics/insights-query-keys";
import { setFormAnalytics } from "@/lib/server-fn/forms";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FeatureGate, useHasPlan } from "@/components/ui/feature-gate";
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
import type {
  AiChatTone,
  FormSettings as FormSettingsType,
  PresentationMode,
} from "@/types/form-settings";

// Memo'd at module scope so parent re-renders don't tear down these subtrees.
// EmbedPreviewMockup only receives primitives, so shallow-equal props skip render
// (e.g. dragging Popup Width doesn't change any prop it consumes).
const MemoEmbedPreviewMockup = memo(EmbedPreviewMockup);
const MemoEmbedConfigPanel = memo(EmbedConfigPanel);

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

  // The Share sidebar is an editing surface — show the working draft so
  // toggles reflect the user's pending edits, not the last-published state.
  const docSettings: Partial<FormSettingsType> | null | undefined =
    doc?.draftSettings ?? doc?.liveSettings;

  const form = useTanstackForm({
    defaultValues: searchToFormValues(search, doc?.icon, Boolean(docSettings?.branding ?? true)),
    listeners: {
      onChange: ({ formApi }) => {
        const v = formApi.state.values;
        void navigate({
          search: ((prev: Record<string, unknown>) => ({
            ...prev,
            ...formValuesToSearch(v),
            // eslint-disable-next-line typescript-eslint/no-explicit-any
          })) as any,
          replace: true,
        });
      },
      onChangeDebounceMs: 300,
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
        (draft: { draftSettings?: Record<string, unknown>; updatedAt?: string }) => {
          draft.draftSettings = { ...draft.draftSettings, ...patch };
          draft.updatedAt = new Date().toISOString();
        },
      );
    },
    [doc?.id],
  );

  const hasPro = useHasPlan("pro");
  const docAiChatTone: AiChatTone = (docSettings?.aiChatTone ?? "friendly") as AiChatTone;
  const docAiChatGreeting: string = docSettings?.aiChatGreeting ?? "";

  const handlePresentationModeChange = useCallback(
    (value: PresentationMode) => {
      if (docPresentationMode === value) return;
      // Block free-plan users at the UI layer too — server rejects on save,
      // this just gives an immediate signal instead of a delayed error.
      if (value === "ai-chat" && !hasPro) return;
      updateSettings({ presentationMode: value });
    },
    [docPresentationMode, updateSettings, hasPro],
  );

  const handleAiChatToneChange = useCallback(
    (value: AiChatTone) => {
      if (docAiChatTone === value) return;
      updateSettings({ aiChatTone: value });
    },
    [docAiChatTone, updateSettings],
  );

  const handleAiChatGreetingChange = useCallback(
    (value: string) => {
      const next = value.trim().length === 0 ? null : value;
      if ((docAiChatGreeting || null) === next) return;
      updateSettings({ aiChatGreeting: next });
    },
    [docAiChatGreeting, updateSettings],
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

  const queryClient = useQueryClient();
  const handleAnalyticsChange = useCallback(
    (value: boolean) => {
      if (docAnalytics === value) return;
      // Optimistic local update so the toggle UI reacts instantly.
      updateSettings({ analytics: value });
      // Server write — flips BOTH draftSettings AND the live `formSettings`
      // row so `isAnalyticsEnabled` (which the recorders/readers read) updates
      // immediately, no republish needed.
      setFormAnalytics({ data: { formId, enabled: value } })
        .then(() => {
          void invalidateInsightsQueries(queryClient, formId);
        })
        .catch((err) => {
          console.error("[ShareSidebar] setFormAnalytics failed:", err);
          toast.error("Failed to update analytics setting");
          // Revert the optimistic flip.
          updateSettings({ analytics: !value });
        });
    },
    [docAnalytics, updateSettings, formId, queryClient],
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
      : `${window.location.origin}/forms/${doc.shortId}`;

  return (
    <Sidebar
      side="right"
      collapsible="none"
      className="size-full animate-in border-none duration-200 ease-out slide-in-from-right-[40%]"
    >
      <ShareSidebarHeader
        isDraft={isDraft}
        form={form}
        navigate={navigate}
        closeSidebar={closeSidebar}
      />

      <SidebarContent>
        <div className="space-y-3 px-3">
          <PresentationSection
            docPresentationMode={docPresentationMode}
            docProgressBar={docProgressBar}
            docAiChatTone={docAiChatTone}
            docAiChatGreeting={docAiChatGreeting}
            handlePresentationModeChange={handlePresentationModeChange}
            handleProgressBarChange={handleProgressBarChange}
            handleAiChatToneChange={handleAiChatToneChange}
            handleAiChatGreetingChange={handleAiChatGreetingChange}
          />

          {docPresentationMode === "ai-chat" && (
            <form.Subscribe selector={(s) => s.values.embedType}>
              {(embedType) =>
                embedType === "standard" ? (
                  <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    AI Chat works best on Full Page or Popup embeds.
                  </div>
                ) : null
              }
            </form.Subscribe>
          )}

          {isDraft ? (
            <DraftPublishCta handlePublish={handlePublish} />
          ) : (
            <PublishedShareBody
              form={form}
              docBranding={docBranding}
              handleBrandingChange={handleBrandingChange}
              docAnalytics={docAnalytics}
              handleAnalyticsChange={handleAnalyticsChange}
              orgId={orgId}
              formId={formId}
              shortId={doc.shortId}
              activeDomainId={activeDomainId}
              activeSlug={activeSlug}
              docTitle={doc.title}
              handleDomainAssigned={handleDomainAssigned}
              handleOpenCodeDialog={handleOpenCodeDialog}
              codeDialogOpen={codeDialogOpen}
              setCodeDialogOpen={setCodeDialogOpen}
              selectedDomainName={selectedDomainName}
              customization={doc.customization as Record<string, string> | null}
            />
          )}
        </div>
      </SidebarContent>

      {!isDraft && <ShareSidebarFooter shareUrl={shareUrl} />}
    </Sidebar>
  );
};

// eslint-disable-next-line typescript-eslint/no-explicit-any -- TanstackForm has deep generic params; subcomponents only need to pass the form through
type ShareForm = any;

interface ShareSidebarHeaderProps {
  isDraft: boolean;
  form: ShareForm;
  navigate: ReturnType<typeof useNavigate>;
  closeSidebar: () => void;
}

const ShareSidebarHeader = ({ isDraft, form, navigate, closeSidebar }: ShareSidebarHeaderProps) => (
  <SidebarHeader className="shrink-0 gap-2.25 space-y-2 pt-2 pb-3 pl-1">
    <div className="flex items-center justify-between">
      <h2 className="pl-2.5 text-base text-foreground">Share</h2>
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-7 text-muted-foreground hover:text-foreground"
        onClick={closeSidebar}
        aria-label="Close"
      >
        <XIcon className="size-4" />
      </Button>
    </div>

    {!isDraft && (
      <form.Field name="embedType">
        {(field: AnyFieldApi) => (
          <Tabs
            value={field.state.value}
            defaultValue={"fullpage"}
            onValueChange={(v) => {
              const update = () => {
                flushSync(() => {
                  field.handleChange(v as typeof field.state.value);
                  void navigate({
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
                // eslint-disable-next-line react-doctor/no-document-start-view-transition -- transition wraps a router navigate + form state flush; React's <ViewTransition> doesn't drive non-component DOM (URL, focus restoration)
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
);

interface PresentationSectionProps {
  docPresentationMode: PresentationMode;
  docProgressBar: boolean;
  docAiChatTone: AiChatTone;
  docAiChatGreeting: string;
  handlePresentationModeChange: (value: PresentationMode) => void;
  handleProgressBarChange: (value: boolean) => void;
  handleAiChatToneChange: (value: AiChatTone) => void;
  handleAiChatGreetingChange: (value: string) => void;
}

const PresentationSection = ({
  docPresentationMode,
  docProgressBar,
  docAiChatTone,
  docAiChatGreeting,
  handlePresentationModeChange,
  handleProgressBarChange,
  handleAiChatToneChange,
  handleAiChatGreetingChange,
}: PresentationSectionProps) => (
  <SidebarSection label="Presentation" className="pb-2.75" action={<></>}>
    <ConfigCard>
      <ConfigRow
        label="Mode"
        description="Choose how questions are presented to respondents."
        variant="stacked"
      >
        <Tabs
          value={docPresentationMode}
          onValueChange={(v) => handlePresentationModeChange(v as PresentationMode)}
          className="w-full"
        >
          <TabsList className="h-7 w-full">
            <TabsTrigger value="card" className="flex-1 px-2 text-xs">
              Card
            </TabsTrigger>
            <TabsTrigger value="field-by-field" className="flex-1 px-2 text-xs">
              Field by field
            </TabsTrigger>
            <FeatureGate requiredPlan="pro" tooltipSide="bottom">
              <TabsTrigger value="ai-chat" className="flex-1 gap-1 px-2 text-xs">
                AI Chat
                <span aria-hidden="true">✨</span>
              </TabsTrigger>
            </FeatureGate>
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

      {docPresentationMode === "ai-chat" && (
        <>
          <ConfigRow label="Tone" description="How the AI should talk to respondents.">
            <Tabs
              value={docAiChatTone}
              onValueChange={(v) => handleAiChatToneChange(v as AiChatTone)}
            >
              <TabsList className="h-7">
                <TabsTrigger value="formal" className="px-2 text-xs">
                  Formal
                </TabsTrigger>
                <TabsTrigger value="friendly" className="px-2 text-xs">
                  Friendly
                </TabsTrigger>
                <TabsTrigger value="playful" className="px-2 text-xs">
                  Playful
                </TabsTrigger>
                <TabsIndicator />
              </TabsList>
            </Tabs>
          </ConfigRow>
          <ConfigRow
            label="Greeting"
            description="Optional. Used verbatim as the very first message."
            variant="stacked"
          >
            <Textarea
              aria-label="AI Chat greeting"
              value={docAiChatGreeting}
              onChange={(e) => handleAiChatGreetingChange(e.target.value)}
              placeholder="Welcome — let's get started."
              className="min-h-12 text-xs"
            />
          </ConfigRow>
        </>
      )}
    </ConfigCard>
  </SidebarSection>
);

const DraftPublishCta = ({ handlePublish }: { handlePublish: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-y-6 rounded-2xl border-2 border-dashed bg-muted/20 px-4 py-10 text-center">
    <div className="rounded-full bg-primary/10 p-3 text-primary">
      {/* eslint-disable-next-line react-doctor/no-inline-bounce-easing -- "animate-bounce-subtle" is a custom easing utility (cubic-bezier ease-out), not the default tacky bounce */}
      <RocketIcon className="animate-bounce-subtle size-8" />
    </div>
    <div className="space-y-2">
      <h3 className="font-semibold">Ready to go live?</h3>
      <p className="text-xs text-muted-foreground">
        Your form is currently in draft. Publish it to start collecting responses.
      </p>
    </div>
    <Button size="sm" onClick={handlePublish} className="w-full gap-2 font-semibold">
      Publish Now
    </Button>
  </div>
);

interface PublishedShareBodyProps {
  form: ShareForm;
  docBranding: boolean;
  handleBrandingChange: (value: boolean) => void;
  docAnalytics: boolean;
  handleAnalyticsChange: (value: boolean) => void;
  orgId: string | undefined;
  formId: string;
  shortId: string;
  activeDomainId: string | null | undefined;
  activeSlug: string | null | undefined;
  docTitle: string | null;
  handleDomainAssigned: (domainId: string | null, slug: string | null) => void;
  handleOpenCodeDialog: () => void;
  codeDialogOpen: boolean;
  setCodeDialogOpen: (open: boolean) => void;
  selectedDomainName: string | undefined;
  customization?: Record<string, string> | null;
}

const PublishedShareBody = ({
  form,
  docBranding,
  handleBrandingChange,
  docAnalytics,
  handleAnalyticsChange,
  orgId,
  formId,
  shortId,
  activeDomainId,
  activeSlug,
  docTitle,
  handleDomainAssigned,
  handleOpenCodeDialog,
  codeDialogOpen,
  setCodeDialogOpen,
  selectedDomainName,
  customization,
}: PublishedShareBodyProps) => (
  <form.Subscribe selector={selectValues}>
    {(values: ReturnType<typeof searchToFormValues>) => {
      const embedType = values.embedType;
      const options = formFieldsToEmbedOptions(values);
      return (
        <div className="space-y-3">
          <MemoEmbedPreviewMockup
            key={embedType}
            embedType={embedType}
            popupPosition={options.popup.position}
            darkOverlay={options.popup.overlay === "dark"}
            emojiIcon={options.popup.emojiIcon}
            alignLeft={options.display.alignment === "left"}
            customization={customization}
          />

          <SidebarSection label="Customise" className="pb-2.75" action={<></>}>
            <MemoEmbedConfigPanel form={form} embedType={embedType} section="customize" />
          </SidebarSection>

          <SidebarSection label="Pro Features" action={<></>}>
            <MemoEmbedConfigPanel
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
              formTitle={docTitle}
              onDomainAssigned={handleDomainAssigned}
            />
          </SidebarSection>

          <Button onClick={handleOpenCodeDialog} variant="default" className="w-full text-base">
            Get Code
          </Button>

          <EmbedCodeDialog
            open={codeDialogOpen}
            onOpenChange={setCodeDialogOpen}
            embedType={embedType}
            options={options}
            shortId={shortId}
            docTitle={docTitle || undefined}
            customDomain={selectedDomainName}
            formSlug={activeSlug ?? undefined}
          />
        </div>
      );
    }}
  </form.Subscribe>
);

const ShareSidebarFooter = ({ shareUrl }: { shareUrl: string }) => (
  <SidebarFooter className="p-2">
    <div className="flex h-[30px] items-center gap-[6px] rounded-lg bg-secondary py-[3px] pr-[3px] pl-[10px]">
      <span className="min-w-0 flex-1 truncate font-case text-sm font-normal text-muted-foreground">
        {shareUrl}
      </span>
      <CopyButton
        text={shareUrl}
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 gap-1 rounded-[5px] border-none bg-(--color-gray-0) px-2 text-sm text-neutral-600 shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] hover:bg-(--color-gray-0) [&_svg]:size-[13px]"
      >
        Copy
      </CopyButton>
    </div>
  </SidebarFooter>
);
