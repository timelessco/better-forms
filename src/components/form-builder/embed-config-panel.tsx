import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StyleNumberInput } from "@/components/ui/style-controls";
import { Switch } from "@/components/ui/switch";
import { FeatureGate } from "@/components/ui/feature-gate";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { cn } from "@udecode/cn";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { orgDomainsQueryOptions } from "@/lib/server-fn/custom-domains";
import { assignFormDomain, updateFormSlug } from "@/lib/server-fn/forms";

/** Common display config shared across all embed types */
export interface EmbedDisplayConfig {
  title: "visible" | "hidden";
  background: "transparent" | "solid";
  alignment: "center" | "left";
  dynamicHeight: boolean;
  dynamicWidth: boolean;
  branding: boolean;
}

/** Popup-specific appearance and behavior config */
export interface EmbedPopupConfig {
  overlay: "dark" | "light";
  hideOnSubmit: boolean;
  hideOnSubmitDelay: number;
  trigger: "button" | "auto" | "scroll";
  position: "bottom-right" | "bottom-left" | "center";
  width: number;
  emoji: boolean;
  emojiIcon: string;
  emojiAnimation: "wave" | "bounce" | "pulse";
}

/** Full embed options using typed config objects */
export interface EmbedOptions {
  height: number;
  display: EmbedDisplayConfig;
  popup: EmbedPopupConfig;
  customDomain: boolean;
}

/** Flat representation used by TanStack Form field bindings and URL search params */
export interface EmbedFormFields {
  height: number;
  dynamicHeight: boolean;
  dynamicWidth: boolean;
  hideTitle: boolean;
  alignLeft: boolean;
  transparentBackground: boolean;
  customDomain: boolean;
  branding: boolean;
  popupTrigger: "button" | "auto" | "scroll";
  popupPosition: "bottom-right" | "bottom-left" | "center";
  popupWidth: number;
  darkOverlay: boolean;
  emoji: boolean;
  emojiIcon: string;
  emojiAnimation: "wave" | "bounce" | "pulse";
  hideOnSubmit: boolean;
  hideOnSubmitDelay: number;
}

export const defaultEmbedFormFields: EmbedFormFields = {
  height: 558,
  dynamicHeight: true,
  dynamicWidth: false,
  hideTitle: false,
  alignLeft: false,
  transparentBackground: false,
  customDomain: false,
  branding: true,
  popupTrigger: "button",
  popupPosition: "bottom-right",
  popupWidth: 376,
  darkOverlay: false,
  emoji: true,
  emojiIcon: "\u{1F44B}",
  emojiAnimation: "wave",
  hideOnSubmit: false,
  hideOnSubmitDelay: 0,
};

/** Convert flat form fields to structured EmbedOptions */
export const formFieldsToEmbedOptions = (fields: EmbedFormFields): EmbedOptions => ({
  height: fields.height,
  display: {
    title: fields.hideTitle ? "hidden" : "visible",
    background: fields.transparentBackground ? "transparent" : "solid",
    alignment: fields.alignLeft ? "left" : "center",
    dynamicHeight: fields.dynamicHeight,
    dynamicWidth: fields.dynamicWidth,
    branding: fields.branding,
  },
  popup: {
    overlay: fields.darkOverlay ? "dark" : "light",
    hideOnSubmit: fields.hideOnSubmit,
    hideOnSubmitDelay: fields.hideOnSubmitDelay,
    trigger: fields.popupTrigger,
    position: fields.popupPosition,
    width: fields.popupWidth,
    emoji: fields.emoji,
    emojiIcon: fields.emojiIcon,
    emojiAnimation: fields.emojiAnimation,
  },
  customDomain: fields.customDomain,
});

/** Minimal field API shape from TanStack Form render callbacks */
interface FieldRenderApi<T = unknown> {
  state: { value: T };
  handleChange: (value: T) => void;
}

interface EmbedConfigPanelProps {
  embedType: EmbedType;
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  form: { Field: any; Subscribe: any };
  section: "customize" | "pro";
  /** Current server-side value of forms.branding for this form. When provided,
   * the Reform Branding toggle in the Pro section reads this value directly
   * instead of local form state, and writes back through `onBrandingChange`. */
  docBranding?: boolean;
  onBrandingChange?: (value: boolean) => void;
  /** Current server-side value of forms.analytics. Pro-gated; when off the
   * public form skips visit/progress tracking entirely. */
  docAnalytics?: boolean;
  onAnalyticsChange?: (value: boolean) => void;
  /** Custom domain props for the Pro section */
  orgId?: string;
  formId?: string;
  customDomainId?: string | null;
  formSlug?: string | null;
  formTitle?: string | null;
  onDomainAssigned?: (domainId: string | null, slug: string | null) => void;
}

export const ConfigCard = ({
  children,
  variant = "rounded",
}: {
  children: React.ReactNode;
  variant?: "rounded" | "square";
}) => (
  <div
    className={cn(
      "flex flex-col gap-px overflow-hidden",
      variant === "rounded" ? "rounded-lg" : "rounded-none",
    )}
  >
    {children}
  </div>
);

/**
 * Figma row:
 *   Select / value rows → pl-[10px] pr-[3px] py-[7px] gap-[6px]
 *   Switch rows          → pl-[10px] pr-[6px] py-[7px] gap-[6px]
 */
export const ConfigRow = ({
  label,
  description,
  children,
  variant = "default",
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "switch";
}) => (
  <div
    className={`flex min-h-8.5 items-center gap-3 overflow-clip bg-secondary py-1.75 pl-2.5 ${
      // max-h-9.5
      variant === "switch" ? "pr-[6px]" : "pr-[3px]"
    }`}
  >
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-base font-normal">{label}</span>
      {description && (
        <p className="text-sm font-normal text-wrap text-muted-foreground">{description}</p>
      )}
    </div>
    {children}
  </div>
);

/**
 * Figma button: h-[24px] px-[8px] py-[5.5px] rounded-[5px] gap-[4px]
 * Must override SelectTrigger defaults: data-[size=default]:h-8, py-2, pe-2, ps-2.5, rounded-lg
 * Use data-[size=default]:h-[24px] to match specificity of the default variant class.
 */
export const selectTriggerCls =
  "data-[size=default]:h-[24px] shrink-0 border-none bg-transparent shadow-none rounded-[5px] px-2 py-0 gap-1 w-auto text-[13px] text-foreground font-medium whitespace-nowrap ";

export const EmbedConfigPanel = ({
  embedType,
  form,
  section,
  docBranding,
  onBrandingChange,
  docAnalytics,
  onAnalyticsChange,
  orgId,
  formId,
  customDomainId,
  formSlug,
  formTitle,
  onDomainAssigned,
}: EmbedConfigPanelProps) => {
  if (section === "customize") {
    return <CustomizeSection embedType={embedType} form={form} />;
  }
  return (
    <ProSection
      docBranding={docBranding}
      onBrandingChange={onBrandingChange}
      docAnalytics={docAnalytics}
      onAnalyticsChange={onAnalyticsChange}
      orgId={orgId}
      formId={formId}
      customDomainId={customDomainId}
      formSlug={formSlug}
      formTitle={formTitle}
      onDomainAssigned={onDomainAssigned}
    />
  );
};

const triggerLabels: Record<string, string> = {
  button: "On Button Click",
  auto: "Automatically",
  scroll: "After Scrolling",
};

const positionLabels: Record<string, string> = {
  "bottom-right": "Bottom Right",
  "bottom-left": "Bottom Left",
  center: "Center",
};

const selectDynamicHeight = (s: { values: { dynamicHeight: boolean } }) => s.values.dynamicHeight;

const CustomizeSection = ({
  embedType,
  form,
}: {
  embedType: EmbedType;
  // eslint-disable-next-line typescript-eslint/no-explicit-any
  form: { Field: any; Subscribe: any };
}) => {
  if (embedType === "popup") {
    return (
      <ConfigCard>
        <form.Field name="popupTrigger">
          {(field: FieldRenderApi<string>) => (
            <ConfigRow label="Open popup">
              <Select
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value ?? field.state.value)}
              >
                <SelectTrigger className={selectTriggerCls}>
                  {triggerLabels[field.state.value] ?? field.state.value}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="button">On Button Click</SelectItem>
                  <SelectItem value="auto">Automatically</SelectItem>
                  <SelectItem value="scroll">After Scrolling</SelectItem>
                </SelectContent>
              </Select>
            </ConfigRow>
          )}
        </form.Field>
        <form.Field name="popupPosition">
          {(field: FieldRenderApi<string>) => (
            <ConfigRow label="Popup Position">
              <Select
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value ?? field.state.value)}
              >
                <SelectTrigger className={selectTriggerCls}>
                  {positionLabels[field.state.value] ?? field.state.value}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                </SelectContent>
              </Select>
            </ConfigRow>
          )}
        </form.Field>

        <form.Field name="popupWidth">
          {(field: FieldRenderApi<number>) => (
            <StyleNumberInput
              label="Popup Width"
              value={`${field.state.value}px`}
              onChange={(v) => {
                const num = parseInt(v);
                if (!isNaN(num)) field.handleChange(num);
              }}
              min={200}
              max={600}
              step={1}
              unit="px"
              className="!h-[34px] !rounded-none !border-0 !bg-secondary"
            />
          )}
        </form.Field>
        <form.Field name="hideOnSubmit">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Hide on submit" variant="switch">
              <Switch
                aria-label="Hide on submit"
                checked={field.state.value}
                onCheckedChange={(checked: boolean) => field.handleChange(checked)}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>
        <form.Field name="darkOverlay">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Dark Overlay" variant="switch">
              <Switch
                aria-label="Dark Overlay"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>

        <form.Field name="emoji">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Show Emoji" variant="switch">
              <Switch
                aria-label="Show Emoji"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>
      </ConfigCard>
    );
  }

  if (embedType === "standard") {
    return (
      <ConfigCard>
        <form.Subscribe selector={selectDynamicHeight}>
          {(dynamicHeight: boolean) => (
            <form.Field name="height">
              {(field: FieldRenderApi<number>) => (
                <div className={dynamicHeight ? "pointer-events-none opacity-40" : ""}>
                  <StyleNumberInput
                    label="Height"
                    value={`${field.state.value}px`}
                    onChange={(v) => {
                      const num = parseInt(v);
                      if (!isNaN(num)) field.handleChange(num);
                    }}
                    min={200}
                    max={1000}
                    step={1}
                    unit="px"
                    className="!h-[34px] !rounded-none !border-0 !bg-secondary"
                  />
                </div>
              )}
            </form.Field>
          )}
        </form.Subscribe>

        <form.Field name="dynamicHeight">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Dynamic Height" variant="switch">
              <Switch
                aria-label="Dynamic Height"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>

        <form.Field name="dynamicWidth">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Dynamic Width" variant="switch">
              <Switch
                aria-label="Dynamic Width"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>

        <form.Field name="hideTitle">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Hide Title" variant="switch">
              <Switch
                aria-label="Hide Title"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>

        <form.Field name="alignLeft">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Align Left" variant="switch">
              <Switch
                aria-label="Align Left"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>

        <form.Field name="transparentBackground">
          {(field: FieldRenderApi<boolean>) => (
            <ConfigRow label="Transparency" variant="switch">
              <Switch
                aria-label="Transparency"
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                size="default"
              />
            </ConfigRow>
          )}
        </form.Field>
      </ConfigCard>
    );
  }

  return (
    <ConfigCard>
      <form.Field name="transparentBackground">
        {(field: FieldRenderApi<boolean>) => (
          <ConfigRow label="Transparent BG" variant="switch">
            <Switch
              aria-label="Transparent BG"
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              size="default"
            />
          </ConfigRow>
        )}
      </form.Field>
    </ConfigCard>
  );
};

const generateSlugFromTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "form";

const ProSection = ({
  docBranding,
  onBrandingChange,
  docAnalytics,
  onAnalyticsChange,
  orgId,
  formId,
  customDomainId,
  formSlug,
  formTitle,
  onDomainAssigned,
}: {
  docBranding?: boolean;
  onBrandingChange?: (value: boolean) => void;
  docAnalytics?: boolean;
  onAnalyticsChange?: (value: boolean) => void;
  orgId?: string;
  formId?: string;
  customDomainId?: string | null;
  formSlug?: string | null;
  formTitle?: string | null;
  onDomainAssigned?: (domainId: string | null, slug: string | null) => void;
}) => {
  const queryClient = useQueryClient();

  const { data: domains } = useQuery({
    ...orgDomainsQueryOptions(orgId ?? ""),
    enabled: !!orgId,
  });

  const verifiedDomains = useMemo(
    () => (domains ?? []).filter((d) => d.status === "verified"),
    [domains],
  );

  const defaultSlug = useMemo(
    () => formSlug || (formTitle ? generateSlugFromTitle(formTitle) : "form"),
    [formSlug, formTitle],
  );

  const assignDomainMutation = useMutation({
    mutationFn: (domainId: string | null) => {
      if (!formId) throw new Error("Form ID required");
      return assignFormDomain({ data: { formId, customDomainId: domainId } });
    },
    onSuccess: (result, domainId) => {
      const slug = (result.form as { slug?: string | null }).slug ?? null;
      onDomainAssigned?.(domainId, slug);
      queryClient.invalidateQueries({ queryKey: ["forms", formId] });
    },
  });

  const updateSlugMutation = useMutation({
    mutationFn: (slug: string) => {
      if (!formId) throw new Error("Form ID required");
      return updateFormSlug({ data: { formId, slug } });
    },
    onSuccess: (_result, slug) => {
      onDomainAssigned?.(customDomainId ?? null, slug);
      queryClient.invalidateQueries({ queryKey: ["forms", formId] });
    },
  });

  // Group 4 — live DB fields. Local draft state + explicit Save button so
  // users don't accidentally push domain/slug/branding changes on every click.
  // Silently discarded on unmount (sidebar close / tab switch).
  const [draftBranding, setDraftBranding] = useState<boolean>(docBranding ?? true);
  const [draftAnalytics, setDraftAnalytics] = useState<boolean>(docAnalytics ?? false);
  const [draftDomainId, setDraftDomainId] = useState<string | null>(customDomainId ?? null);
  const [draftSlug, setDraftSlug] = useState<string>(formSlug ?? defaultSlug);

  // Re-sync draft with incoming props when the server-side value changes
  // (e.g. another tab wrote, or the publish flow refetched).
  const [lastDocBranding, setLastDocBranding] = useState(docBranding);
  if (lastDocBranding !== docBranding) {
    setLastDocBranding(docBranding);
    setDraftBranding(docBranding ?? true);
  }
  const [lastDocAnalytics, setLastDocAnalytics] = useState(docAnalytics);
  if (lastDocAnalytics !== docAnalytics) {
    setLastDocAnalytics(docAnalytics);
    setDraftAnalytics(docAnalytics ?? false);
  }
  const [lastCustomDomainId, setLastCustomDomainId] = useState(customDomainId);
  if (lastCustomDomainId !== customDomainId) {
    setLastCustomDomainId(customDomainId);
    setDraftDomainId(customDomainId ?? null);
  }
  const [lastFormSlug, setLastFormSlug] = useState(formSlug);
  const [lastDefaultSlug, setLastDefaultSlug] = useState(defaultSlug);
  if (lastFormSlug !== formSlug || lastDefaultSlug !== defaultSlug) {
    setLastFormSlug(formSlug);
    setLastDefaultSlug(defaultSlug);
    setDraftSlug(formSlug ?? defaultSlug);
  }

  const draftSelectedDomain = useMemo(
    () => verifiedDomains.find((d) => d.id === draftDomainId),
    [verifiedDomains, draftDomainId],
  );

  const isLiveDirty =
    draftBranding !== (docBranding ?? true) ||
    draftAnalytics !== (docAnalytics ?? false) ||
    draftDomainId !== (customDomainId ?? null) ||
    draftSlug.trim() !== (formSlug ?? defaultSlug);

  const saveLiveSettings = useCallback(async () => {
    if (draftBranding !== (docBranding ?? true)) {
      onBrandingChange?.(draftBranding);
    }
    if (draftAnalytics !== (docAnalytics ?? false)) {
      onAnalyticsChange?.(draftAnalytics);
    }
    if (draftDomainId !== (customDomainId ?? null)) {
      await assignDomainMutation.mutateAsync(draftDomainId);
    }
    const trimmed = draftSlug.trim();
    if (draftDomainId && trimmed && trimmed !== (formSlug ?? "")) {
      await updateSlugMutation.mutateAsync(trimmed);
    }
  }, [
    draftBranding,
    draftAnalytics,
    draftDomainId,
    draftSlug,
    docBranding,
    docAnalytics,
    customDomainId,
    formSlug,
    onBrandingChange,
    onAnalyticsChange,
    assignDomainMutation,
    updateSlugMutation,
  ]);

  const isSaving = assignDomainMutation.isPending || updateSlugMutation.isPending;

  return (
    <FeatureGate requiredPlan="pro" variant="block">
      {/* Live Settings — explicit Save gate. These fields write directly to
          the forms row and take effect on the public URL immediately after
          Save, without requiring a republish. */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
            Live Settings
          </span>
          <span className="text-[10px] text-muted-foreground/70">Applies on save</span>
        </div>
        <ConfigCard>
          <ConfigRow label="Analytics" variant="switch">
            <Switch
              aria-label="Analytics"
              checked={draftAnalytics}
              onCheckedChange={setDraftAnalytics}
              size="default"
            />
          </ConfigRow>

          <ConfigRow label="Reform Branding" variant="switch">
            <Switch
              aria-label="Reform Branding"
              checked={draftBranding}
              onCheckedChange={setDraftBranding}
              size="default"
            />
          </ConfigRow>

          <ConfigRow label="Custom Domain">
            <Select
              value={draftDomainId ?? "none"}
              onValueChange={(v) => setDraftDomainId(v && v !== "none" ? v : null)}
              disabled={!orgId || verifiedDomains.length === 0}
            >
              <SelectTrigger
                className={cn(
                  selectTriggerCls,
                  !orgId || verifiedDomains.length === 0 ? "opacity-50" : "",
                )}
              >
                {draftSelectedDomain?.domain ?? "None"}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {verifiedDomains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ConfigRow>

          {draftSelectedDomain && (
            <>
              <ConfigRow label="Slug">
                <Input
                  aria-label="Form slug"
                  value={draftSlug}
                  onChange={(e) => setDraftSlug(e.target.value)}
                  className="h-6 w-32 border-none bg-transparent px-2 py-0 font-mono text-xs shadow-none"
                  placeholder="my-form"
                />
              </ConfigRow>
              <div className="bg-secondary px-2.5 py-1.5">
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {`https://${draftSelectedDomain.domain}/${draftSlug.trim() || defaultSlug}`}
                </p>
              </div>
            </>
          )}
        </ConfigCard>

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            disabled={!isLiveDirty || isSaving}
            onClick={() => {
              saveLiveSettings().catch((err) => console.error("[LiveSettings] Save failed:", err));
            }}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </FeatureGate>
  );
};
