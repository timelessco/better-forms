import type { AnyFieldApi } from "@tanstack/react-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  CodeXmlIcon,
  InfoIcon,
  LinkIcon,
  PlusIcon,
  RocketIcon,
  XIcon,
} from "@/components/ui/icons";
import { memo, useCallback, useMemo, useState } from "react";
// eslint-disable-next-line react-doctor/no-flush-sync -- flushSync is required so the synchronous router navigation captures the field state update inside the same View Transition snapshot
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateInsightsQueries } from "@/lib/analytics/insights-query-keys";
import { assignFormDomain, setFormAnalytics } from "@/lib/server-fn/forms";
import { CopyButton } from "@/components/ui/copy-button";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { SidebarSection } from "@/components/ui/sidebar-section";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { FeatureGate } from "@/components/ui/feature-gate";
import { settingsDialogStore } from "@/hooks/use-settings-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useForm } from "@/hooks/use-live-hooks";
import { useEditorSidebar } from "@/hooks/use-editor-sidebar";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { publishForm } from "@/hooks/use-form-versions";
import { getFormListings } from "@/collections";
import { useSession } from "@/lib/auth/auth-client";
import { orgDomainsQueryOptions } from "@/lib/server-fn/custom-domains";
import { Switch } from "@/components/ui/switch";
import {
  formFieldsToEmbedOptions,
  selectTriggerFigmaCls,
  triggerLabels,
} from "./embed-config-panel";
import { IconPickerContent, IconPickerPreview } from "@/components/icon-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isValidUrl } from "@/lib/utils";
import { startScopedViewTransition } from "@/lib/view-transition";
import { EmbedCodeDialog, searchToFormValues, formValuesToSearch, tabs } from "./embed-section";
import { EmbedPreviewMockup } from "./embed-preview-mockup";
import type { FormSettings as FormSettingsType, PresentationMode } from "@/types/form-settings";

// Memo'd at module scope so parent re-renders don't tear down subtrees. EmbedPreviewMockup takes only
// primitives, so shallow-equal props skip render (dragging Popup Width changes nothing it consumes).
const MemoEmbedPreviewMockup = memo(EmbedPreviewMockup);

// Sprite names are >4 chars; emoji glyphs are short. resolveIconDisplay (popup preview) keys off the
// same heuristic, so the icon picker writes a sprite name and it renders downstream as an icon.
const isSpriteName = (value: string) => value.trim().length > 4 && !isValidUrl(value);

// Emoji/icon picker for the popup bubble. Uses the app's own IconPickerContent (not a generic emoji
// grid) and previews the actual chosen icon in `currentColor` (monochrome) so it tracks light/dark.
const EmojiIconPicker = ({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (icon: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const spriteName = isSpriteName(value) ? value.trim() : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1.5 font-case text-[14px] font-medium text-foreground"
          />
        }
      >
        {isValidUrl(value) ? (
          <img src={value} alt="" className="size-[18px] rounded-full object-cover" />
        ) : spriteName ? (
          <IconPickerPreview
            icon={spriteName}
            iconColor={undefined}
            monochrome
            iconSize="14"
            size="18"
          />
        ) : (
          <span className="text-base leading-none">{value}</span>
        )}
        <span className="text-muted-foreground">Edit</span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-[310px] p-0">
        <IconPickerContent
          hideColors
          iconValue={spriteName}
          iconColor="currentColor"
          onColorChange={() => {}}
          onIconChange={(icon) => {
            onSelect(icon);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

const selectValues = (state: { values: ReturnType<typeof searchToFormValues> }) => state.values;
const selectEmbedType = (state: { values: ReturnType<typeof searchToFormValues> }) =>
  state.values.embedType;
const selectDynamicHeight = (state: { values: ReturnType<typeof searchToFormValues> }) =>
  state.values.dynamicHeight;

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

  // Editing surface: show working draft so toggles reflect pending edits, not last-published state.
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

  // Persist toggles into the single `settings` JSONB so every embed reflects the change immediately.
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

  const queryClient = useQueryClient();
  const handleAnalyticsChange = useCallback(
    (value: boolean) => {
      if (docAnalytics === value) return;
      // Optimistic local update so toggle UI reacts instantly.
      updateSettings({ analytics: value });
      // Server write flips BOTH draftSettings AND live `formSettings` so `isAnalyticsEnabled` updates now, no republish.
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

      {isDraft ? (
        <SidebarContent>
          <div className="space-y-3 px-3 pt-3">
            <SidebarSection label="Preferences" collapsible={false}>
              <PresentationRows
                docPresentationMode={docPresentationMode}
                docProgressBar={docProgressBar}
                onModeChange={handlePresentationModeChange}
                onProgressBarChange={handleProgressBarChange}
              />
            </SidebarSection>
            <DraftPublishCta handlePublish={handlePublish} />
          </div>
        </SidebarContent>
      ) : (
        <>
          <SidebarContent>
            <form.Subscribe selector={selectEmbedType}>
              {(embedType: EmbedType) => {
                if (embedType === "fullpage") {
                  return (
                    <FullPagePreferences
                      form={form}
                      docPresentationMode={docPresentationMode}
                      docProgressBar={docProgressBar}
                      handlePresentationModeChange={handlePresentationModeChange}
                      handleProgressBarChange={handleProgressBarChange}
                      docBranding={docBranding}
                      handleBrandingChange={handleBrandingChange}
                      docAnalytics={docAnalytics}
                      handleAnalyticsChange={handleAnalyticsChange}
                      orgId={orgId}
                      formId={formId}
                      activeDomainId={activeDomainId}
                      activeSlug={activeSlug}
                      handleDomainAssigned={handleDomainAssigned}
                      selectedDomainName={selectedDomainName}
                      customization={doc.customization as Record<string, string> | null}
                    />
                  );
                }
                if (embedType === "popup") {
                  return (
                    <PopupTab
                      form={form}
                      docPresentationMode={docPresentationMode}
                      docProgressBar={docProgressBar}
                      handlePresentationModeChange={handlePresentationModeChange}
                      handleProgressBarChange={handleProgressBarChange}
                      docBranding={docBranding}
                      handleBrandingChange={handleBrandingChange}
                      docAnalytics={docAnalytics}
                      handleAnalyticsChange={handleAnalyticsChange}
                      orgId={orgId}
                      formId={formId}
                      activeDomainId={activeDomainId}
                      activeSlug={activeSlug}
                      handleDomainAssigned={handleDomainAssigned}
                      selectedDomainName={selectedDomainName}
                      customization={doc.customization as Record<string, string> | null}
                    />
                  );
                }
                // Embed (standard iframe) tab.
                return (
                  <EmbedTab
                    form={form}
                    docPresentationMode={docPresentationMode}
                    docProgressBar={docProgressBar}
                    handlePresentationModeChange={handlePresentationModeChange}
                    handleProgressBarChange={handleProgressBarChange}
                    docBranding={docBranding}
                    handleBrandingChange={handleBrandingChange}
                    docAnalytics={docAnalytics}
                    handleAnalyticsChange={handleAnalyticsChange}
                    orgId={orgId}
                    formId={formId}
                    activeDomainId={activeDomainId}
                    activeSlug={activeSlug}
                    handleDomainAssigned={handleDomainAssigned}
                    selectedDomainName={selectedDomainName}
                    customization={doc.customization as Record<string, string> | null}
                  />
                );
              }}
            </form.Subscribe>
          </SidebarContent>

          {/* Copy Link + Get Code: shared footer across all embed tabs. */}
          <ShareSidebarFooter shareUrl={shareUrl} onGetCode={handleOpenCodeDialog} />

          <form.Subscribe selector={selectValues}>
            {(values: ReturnType<typeof searchToFormValues>) => (
              <EmbedCodeDialog
                open={codeDialogOpen}
                onOpenChange={setCodeDialogOpen}
                embedType={values.embedType}
                options={formFieldsToEmbedOptions(values)}
                shortId={doc.shortId}
                docTitle={doc.title || undefined}
                customDomain={selectedDomainName}
                formSlug={activeSlug ?? undefined}
              />
            )}
          </form.Subscribe>
        </>
      )}
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
              // Scoped: only "preview-content" cross-fades; the app sidebar/header stay static.
              startScopedViewTransition(update);
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

// Figma system-flat row: 28px tall, muted 14px label left, value/control right. Mirrors ConfigRow surface="flat".
const PreferenceRow = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="flex h-7 items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="truncate font-case text-[14px] font-normal text-muted-foreground">
        {label}
      </span>
      {hint}
    </div>
    <div className="flex shrink-0 items-center justify-end text-foreground">{children}</div>
  </div>
);

// Inline editable numeric value (e.g. "380px") — borderless, commits on blur/Enter, clamps to range.
const InlineNumberInput = ({
  value,
  onChange,
  min,
  max,
  suffix = "px",
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  suffix?: string;
}) => {
  const [text, setText] = useState(String(value));
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setText(String(value));
  }
  const commit = () => {
    const parsed = parseInt(text, 10);
    if (isNaN(parsed)) {
      setText(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <span className="inline-flex items-center gap-0.5 font-case text-[14px] font-medium">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-9 bg-transparent text-right tabular-nums outline-none"
        aria-label="Width"
      />
      <span className="text-muted-foreground">{suffix}</span>
    </span>
  );
};

const PRESENTATION_LABELS: Record<PresentationMode, string> = {
  card: "All at once",
  "field-by-field": "One at a time",
};

// Shared across all tabs: Question layout (presentation mode) + Show progress bar.
const PresentationRows = ({
  docPresentationMode,
  docProgressBar,
  onModeChange,
  onProgressBarChange,
}: {
  docPresentationMode: PresentationMode;
  docProgressBar: boolean;
  onModeChange: (value: PresentationMode) => void;
  onProgressBarChange: (value: boolean) => void;
}) => (
  <>
    <PreferenceRow label="Question layout">
      <Select
        value={docPresentationMode}
        onValueChange={(v) => {
          if (v) onModeChange(v as PresentationMode);
        }}
      >
        <SelectTrigger className={selectTriggerFigmaCls}>
          {PRESENTATION_LABELS[docPresentationMode]}
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="card">All at once</SelectItem>
          <SelectItem value="field-by-field">One at a time</SelectItem>
        </SelectContent>
      </Select>
    </PreferenceRow>

    <PreferenceRow label="Show progress bar">
      <Switch
        aria-label="Show progress bar"
        checked={docProgressBar}
        onCheckedChange={onProgressBarChange}
        size="default"
      />
    </PreferenceRow>
  </>
);

// Muted info icon with a tooltip — used by the preference rows for inline help.
const HintTooltip = ({ children }: { children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <span className="inline-flex text-muted-foreground">
          <InfoIcon className="size-4" />
        </span>
      }
    />
    <TooltipContent side="top" className="max-w-56">
      {children}
    </TooltipContent>
  </Tooltip>
);

// Shared Pro section rows (gated): Show branding, Track analytics, Custom domain.
const ProRows = ({
  docBranding,
  onBrandingChange,
  docAnalytics,
  onAnalyticsChange,
  orgId,
  formId,
  customDomainId,
  formSlug,
  onDomainAssigned,
  selectedDomainName,
}: {
  docBranding: boolean;
  onBrandingChange: (value: boolean) => void;
  docAnalytics: boolean;
  onAnalyticsChange: (value: boolean) => void;
  orgId: string | undefined;
  formId: string;
  customDomainId: string | null | undefined;
  formSlug: string | null | undefined;
  onDomainAssigned: (domainId: string | null, slug: string | null) => void;
  selectedDomainName: string | undefined;
}) => (
  <>
    <PreferenceRow label="Show branding">
      <FeatureGate requiredPlan="pro">
        <Switch
          aria-label="Show branding"
          checked={docBranding}
          onCheckedChange={onBrandingChange}
          size="default"
        />
      </FeatureGate>
    </PreferenceRow>

    <PreferenceRow
      label="Track analytics"
      hint={
        <HintTooltip>Track form views, submissions, completion rates, and drop-offs.</HintTooltip>
      }
    >
      <FeatureGate requiredPlan="pro">
        <Switch
          aria-label="Track analytics"
          checked={docAnalytics}
          onCheckedChange={onAnalyticsChange}
          size="default"
        />
      </FeatureGate>
    </PreferenceRow>

    <CustomDomainRow
      orgId={orgId}
      formId={formId}
      customDomainId={customDomainId}
      formSlug={formSlug}
      onDomainAssigned={onDomainAssigned}
      selectedDomainName={selectedDomainName}
    />
  </>
);

interface FullPagePreferencesProps {
  form: ShareForm;
  docPresentationMode: PresentationMode;
  docProgressBar: boolean;
  handlePresentationModeChange: (value: PresentationMode) => void;
  handleProgressBarChange: (value: boolean) => void;
  docBranding: boolean;
  handleBrandingChange: (value: boolean) => void;
  docAnalytics: boolean;
  handleAnalyticsChange: (value: boolean) => void;
  orgId: string | undefined;
  formId: string;
  activeDomainId: string | null | undefined;
  activeSlug: string | null | undefined;
  handleDomainAssigned: (domainId: string | null, slug: string | null) => void;
  selectedDomainName: string | undefined;
  customization?: Record<string, string> | null;
}

const FullPagePreferences = ({
  form,
  docPresentationMode,
  docProgressBar,
  handlePresentationModeChange,
  handleProgressBarChange,
  docBranding,
  handleBrandingChange,
  docAnalytics,
  handleAnalyticsChange,
  orgId,
  formId,
  activeDomainId,
  activeSlug,
  handleDomainAssigned,
  selectedDomainName,
  customization,
}: FullPagePreferencesProps) => (
  <div className="flex flex-col gap-4 px-4 pt-3">
    <MemoEmbedPreviewMockup key="fullpage" embedType="fullpage" customization={customization} />

    <SidebarSection label="Preferences" collapsible={false} divider={false}>
      <PresentationRows
        docPresentationMode={docPresentationMode}
        docProgressBar={docProgressBar}
        onModeChange={handlePresentationModeChange}
        onProgressBarChange={handleProgressBarChange}
      />

      <form.Field name="transparentBackground">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Transparent background">
            <Switch
              aria-label="Transparent background"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>

      <ProRows
        docBranding={docBranding}
        onBrandingChange={handleBrandingChange}
        docAnalytics={docAnalytics}
        onAnalyticsChange={handleAnalyticsChange}
        orgId={orgId}
        formId={formId}
        customDomainId={activeDomainId}
        formSlug={activeSlug}
        onDomainAssigned={handleDomainAssigned}
        selectedDomainName={selectedDomainName}
      />
    </SidebarSection>
  </div>
);

type PopupTabProps = FullPagePreferencesProps;

const PopupTab = ({
  form,
  docPresentationMode,
  docProgressBar,
  handlePresentationModeChange,
  handleProgressBarChange,
  docBranding,
  handleBrandingChange,
  docAnalytics,
  handleAnalyticsChange,
  orgId,
  formId,
  activeDomainId,
  activeSlug,
  handleDomainAssigned,
  selectedDomainName,
  customization,
}: PopupTabProps) => (
  <div className="flex flex-col gap-4 px-4 pt-3">
    <form.Subscribe selector={selectValues}>
      {(values: ReturnType<typeof searchToFormValues>) => {
        const options = formFieldsToEmbedOptions(values);
        return (
          <MemoEmbedPreviewMockup
            key="popup"
            embedType="popup"
            popupPosition={options.popup.position}
            darkOverlay={options.popup.overlay === "dark"}
            emojiIcon={options.popup.emojiIcon}
            alignLeft={options.display.alignment === "left"}
            customization={customization}
          />
        );
      }}
    </form.Subscribe>

    <SidebarSection label="Preferences" collapsible={false}>
      <PresentationRows
        docPresentationMode={docPresentationMode}
        docProgressBar={docProgressBar}
        onModeChange={handlePresentationModeChange}
        onProgressBarChange={handleProgressBarChange}
      />
    </SidebarSection>

    <SidebarSection label="Appearance" collapsible={false}>
      <form.Field name="popupWidth">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Width">
            <InlineNumberInput
              value={field.state.value}
              onChange={field.handleChange}
              min={200}
              max={600}
            />
          </PreferenceRow>
        )}
      </form.Field>

      <form.Field name="emojiIcon">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Emoji">
            <EmojiIconPicker value={field.state.value} onSelect={field.handleChange} />
          </PreferenceRow>
        )}
      </form.Field>

      <form.Field name="hideTitle">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Hide title">
            <Switch
              aria-label="Hide title"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>

      <form.Field name="darkOverlay">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Dark overlay">
            <Switch
              aria-label="Dark overlay"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>
    </SidebarSection>

    <SidebarSection label="Behaviour" collapsible={false}>
      <form.Field name="popupTrigger">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Open form">
            <Select
              value={field.state.value}
              onValueChange={(v) => {
                if (v) field.handleChange(v);
              }}
            >
              <SelectTrigger className={selectTriggerFigmaCls}>
                {triggerLabels[field.state.value] ?? field.state.value}
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(triggerLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PreferenceRow>
        )}
      </form.Field>

      <form.Field name="hideOnSubmit">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Hide on submit">
            <Switch
              aria-label="Hide on submit"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>
    </SidebarSection>

    <SidebarSection label="Preferences" collapsible={false} divider={false}>
      <ProRows
        docBranding={docBranding}
        onBrandingChange={handleBrandingChange}
        docAnalytics={docAnalytics}
        onAnalyticsChange={handleAnalyticsChange}
        orgId={orgId}
        formId={formId}
        customDomainId={activeDomainId}
        formSlug={activeSlug}
        onDomainAssigned={handleDomainAssigned}
        selectedDomainName={selectedDomainName}
      />
    </SidebarSection>
  </div>
);

// Embed (standard iframe) tab — inline preview + Appearance + Preferences flat sections.
const EmbedTab = ({
  form,
  docPresentationMode,
  docProgressBar,
  handlePresentationModeChange,
  handleProgressBarChange,
  docBranding,
  handleBrandingChange,
  docAnalytics,
  handleAnalyticsChange,
  orgId,
  formId,
  activeDomainId,
  activeSlug,
  handleDomainAssigned,
  selectedDomainName,
  customization,
}: FullPagePreferencesProps) => (
  <div className="flex flex-col gap-4 px-4 pt-3">
    <form.Subscribe selector={selectValues}>
      {(values: ReturnType<typeof searchToFormValues>) => (
        <MemoEmbedPreviewMockup
          key="standard"
          embedType="standard"
          alignLeft={formFieldsToEmbedOptions(values).display.alignment === "left"}
          customization={customization}
        />
      )}
    </form.Subscribe>

    <SidebarSection label="Preferences" collapsible={false}>
      <PresentationRows
        docPresentationMode={docPresentationMode}
        docProgressBar={docProgressBar}
        onModeChange={handlePresentationModeChange}
        onProgressBarChange={handleProgressBarChange}
      />
    </SidebarSection>

    <SidebarSection label="Appearance" collapsible={false}>
      {/* Manual height collapses while Dynamic height is on, matching the Figma hidden-row state. */}
      <form.Subscribe selector={selectDynamicHeight}>
        {(dynamicHeight: boolean) =>
          dynamicHeight ? null : (
            <form.Field name="height">
              {(field: AnyFieldApi) => (
                <PreferenceRow label="Height">
                  <InlineNumberInput
                    value={field.state.value}
                    onChange={field.handleChange}
                    min={200}
                    max={1000}
                  />
                </PreferenceRow>
              )}
            </form.Field>
          )
        }
      </form.Subscribe>

      <form.Field name="dynamicHeight">
        {(field: AnyFieldApi) => (
          <PreferenceRow
            label="Dynamic height"
            hint={
              <HintTooltip>Resize the embed automatically to fit the form's height.</HintTooltip>
            }
          >
            <Switch
              aria-label="Dynamic height"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>

      <form.Field name="hideTitle">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Hide title">
            <Switch
              aria-label="Hide title"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>

      <form.Field name="transparentBackground">
        {(field: AnyFieldApi) => (
          <PreferenceRow label="Transparent background">
            <Switch
              aria-label="Transparent background"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </PreferenceRow>
        )}
      </form.Field>
    </SidebarSection>

    <SidebarSection label="Preferences" collapsible={false} divider={false}>
      <ProRows
        docBranding={docBranding}
        onBrandingChange={handleBrandingChange}
        docAnalytics={docAnalytics}
        onAnalyticsChange={handleAnalyticsChange}
        orgId={orgId}
        formId={formId}
        customDomainId={activeDomainId}
        formSlug={activeSlug}
        onDomainAssigned={handleDomainAssigned}
        selectedDomainName={selectedDomainName}
      />
    </SidebarSection>
  </div>
);

interface CustomDomainRowProps {
  orgId: string | undefined;
  formId: string;
  customDomainId: string | null | undefined;
  formSlug: string | null | undefined;
  onDomainAssigned: (domainId: string | null, slug: string | null) => void;
  selectedDomainName: string | undefined;
}

// Sentinel value: the first dropdown row opens the workspace domain settings instead of selecting.
const ADD_DOMAIN_VALUE = "__add_domain__";

// Pencil → domain dropdown (apply immediately). Top row jumps to settings → Domains to add a new one.
const CustomDomainRow = ({
  orgId,
  formId,
  customDomainId,
  formSlug,
  onDomainAssigned,
  selectedDomainName,
}: CustomDomainRowProps) => {
  const queryClient = useQueryClient();

  const { data: domains } = useQuery({
    ...orgDomainsQueryOptions(orgId ?? ""),
    enabled: !!orgId,
  });

  const verifiedDomains = useMemo(
    () => (domains ?? []).filter((d) => d.status === "verified"),
    [domains],
  );

  const assignDomainMutation = useMutation({
    mutationFn: (domainId: string | null) =>
      assignFormDomain({ data: { formId, customDomainId: domainId } }),
    onSuccess: (result, domainId) => {
      const slug = (result.form as { slug?: string | null }).slug ?? null;
      onDomainAssigned(domainId, slug);
      void queryClient.invalidateQueries({ queryKey: ["forms", formId] });
    },
  });

  const { mutate: assignDomain } = assignDomainMutation;

  const handleValueChange = useCallback(
    (value: string | null) => {
      if (value === ADD_DOMAIN_VALUE) {
        settingsDialogStore.open("domains");
        return;
      }
      assignDomain(value || null);
    },
    [assignDomain],
  );

  const displayUrl =
    selectedDomainName && formSlug
      ? `https://${selectedDomainName}/${formSlug}`
      : (selectedDomainName ?? null);

  return (
    <div className="flex h-7 items-center gap-3">
      <span className="shrink-0 font-case text-[14px] font-normal text-muted-foreground">
        Custom domain
      </span>
      <div className="flex min-w-0 flex-1 justify-end">
        <FeatureGate requiredPlan="pro">
          <Select value={customDomainId ?? ""} onValueChange={handleValueChange} disabled={!orgId}>
            <SelectTrigger className="h-7 max-w-full gap-1.5 border-none bg-transparent px-0 py-0 text-[14px] font-medium text-foreground shadow-none">
              <span className="truncate">{displayUrl ?? "Add domain"}</span>
            </SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false}>
              <SelectItem value={ADD_DOMAIN_VALUE} className="text-primary">
                <PlusIcon className="size-4" />
                Add domain
              </SelectItem>
              {verifiedDomains.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FeatureGate>
      </div>
    </div>
  );
};

// Shared footer for every published embed tab: Copy Link (left) + Get Code (right).
const ShareSidebarFooter = ({
  shareUrl,
  onGetCode,
}: {
  shareUrl: string;
  onGetCode: () => void;
}) => (
  <SidebarFooter className="flex-row gap-2 px-4 pt-0 pb-3.5">
    <CopyButton
      text={shareUrl}
      variant="ghost"
      size="sm"
      prefix={<LinkIcon className="size-4" />}
      className="w-30 justify-center text-[14px] font-medium text-foreground"
    >
      Copy Link
    </CopyButton>
    <Button
      onClick={onGetCode}
      variant="default"
      size="sm"
      prefix={<CodeXmlIcon className="size-4" />}
      className="flex-1 justify-center text-[14px] font-medium"
    >
      Get Code
    </Button>
  </SidebarFooter>
);
