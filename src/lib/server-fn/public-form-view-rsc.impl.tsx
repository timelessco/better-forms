import { createCompositeComponent } from "@tanstack/react-start/rsc";
import { createSlateEditor } from "platejs";
import type { Value } from "platejs";

import { BaseEditorKit } from "@/components/editor/editor-base-kit";
import { ServerFormIcon } from "@/components/form-components/server-form-icon";
import { EditorStatic } from "@/components/ui/editor-static";
import { DEFAULT_ICON } from "@/lib/config/app-config";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { cn, DEFAULT_ICON_NAME, isValidUrl } from "@/lib/utils";
import { getFieldLabelProps } from "@/components/form-components/fields/shared";
import { transformPlateForPreview } from "@/lib/editor/transform-plate-for-preview";
import type {
  FieldSegment,
  PreviewSegment,
  PreviewStepResult,
} from "@/lib/editor/transform-plate-for-preview";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { applyFormCacheHeaders } from "@/lib/server-fn/cdn-cache";
import { getFieldChunkUrls } from "@/lib/server-fn/field-chunk-manifest.server";
import { getPublishedFormById } from "@/lib/server-fn/public-form-view";
import type {
  ButtonGroupSlotProps,
  FieldSlotProps,
} from "@/lib/server-fn/public-form-view-rsc.types";

// Hook-free (unlike StaticContentBlock) so it's usable inside an RSC render.
const ServerPlateBlock = ({ nodes }: { nodes: Value }) => {
  const editor = createSlateEditor({ plugins: BaseEditorKit, value: nodes });
  return (
    <EditorStatic
      editor={editor}
      variant="none"
      className="!mx-0 !my-0 !p-0 text-base [&_.slate-p]:m-0 [&_.slate-p]:px-0 [&_.slate-p]:py-1"
    />
  );
};

// Server-rendered label + required badge. No hooks, no Tooltip (that's
// client-only Radix) — renders a plain styled label with a `title` tooltip
// so the required marker still has an accessible hint without shipping JS.
const RequiredBadge = () => (
  <span
    aria-label="Required field"
    title="Required"
    className={cn(
      "flex size-4 shrink-0 items-center justify-center rounded-[8px] bg-destructive/15 text-destructive",
      "mr-1 ml-auto",
    )}
  >
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Required</title>
      <path
        d="M12.3892 5.68944L12.793 6.92754L9.02484 8.21946L11.4741 11.53L10.4244 12.3375L7.94824 8.91925L5.57971 12.3106L4.53002 11.5031L6.89855 8.21946L3.15735 6.95445L3.58799 5.68944L7.27536 7.00828V3.02484H8.64803V6.98137L12.3892 5.68944Z"
        fill="currentColor"
      />
    </svg>
  </span>
);

const HEADING_VARIANTS = {
  h1: { Tag: "h1", className: "flex-1 font-bold font-heading text-4xl" },
  h2: { Tag: "h2", className: "flex-1 font-heading font-semibold text-2xl" },
  h3: { Tag: "h3", className: "flex-1 font-heading font-semibold text-xl" },
  blockquote: { Tag: "blockquote", className: "flex-1 border-l-2 pl-6 italic" },
} as const;

type HeadingVariant = keyof typeof HEADING_VARIANTS;

const ServerFieldLabel = ({
  text,
  labelType,
  htmlFor,
  required,
}: {
  text: string;
  labelType?: string;
  htmlFor: string;
  required?: boolean;
}) => {
  if (!text) return null;
  const badge = required ? <RequiredBadge /> : null;

  if (labelType && labelType in HEADING_VARIANTS) {
    const { Tag, className } = HEADING_VARIANTS[labelType as HeadingVariant];
    return (
      <div className="flex w-full items-center py-2.5">
        <Tag className={className}>{text}</Tag>
        {badge}
      </div>
    );
  }

  return (
    <label
      htmlFor={htmlFor}
      data-slot="label"
      className="flex w-full items-center gap-2 py-2.5 text-sm select-none"
    >
      <span className="flex-1">{text}</span>
      {badge}
    </label>
  );
};

// Buttons grouped at end of each step (Previous + Next/Submit on same row).
type ButtonField = {
  id: string;
  name: string;
  fieldType: "Button";
  buttonText?: string;
  buttonRole: "next" | "previous" | "submit";
};

type GroupedSegment = PreviewSegment | { type: "buttonGroup"; buttons: ButtonField[] };

// Buttons are collected and moved to the end of the step (rendered as a single
// button group row) regardless of their original position in the segments.
const groupSegmentsForRendering = (
  segments: PreviewSegment[],
): { grouped: GroupedSegment[]; fields: PlateFormField[] } => {
  const grouped: GroupedSegment[] = [];
  const fields: PlateFormField[] = [];
  const allButtons: ButtonField[] = [];

  for (const seg of segments) {
    if (seg.type === "field" && seg.field.fieldType === "Button") {
      allButtons.push(seg.field as ButtonField);
    } else {
      grouped.push(seg);
      if (seg.type === "field") fields.push(seg.field);
    }
  }

  if (allButtons.length > 1) {
    grouped.push({ type: "buttonGroup", buttons: allButtons });
  } else if (allButtons.length === 1) {
    grouped.push({ type: "field", field: allButtons[0] } as FieldSegment);
  }

  return { grouped, fields };
};

export const renderStepComponent = async (segments: PreviewSegment[]) => {
  const { grouped, fields } = groupSegmentsForRendering(segments);

  const keyedItems = grouped.map((item, idx) => {
    if (item.type === "static") {
      const firstNode = item.nodes[0] as { id?: string; type?: string } | undefined;
      return {
        ...item,
        key: firstNode?.id
          ? `static-${firstNode.id}`
          : `static-${idx}-${firstNode?.type ?? "?"}-${item.nodes.length}`,
      };
    }
    if (item.type === "buttonGroup") {
      return { ...item, key: `buttons-${item.buttons.map((b) => b.id).join("-")}` };
    }
    return { ...item, key: item.field.id };
  });

  const src = await createCompositeComponent(
    ({
      Field,
      ButtonGroup,
    }: {
      Field: React.ComponentType<FieldSlotProps>;
      ButtonGroup: React.ComponentType<ButtonGroupSlotProps>;
    }) => (
      <>
        {keyedItems.map((item) => {
          if (item.type === "static") {
            return <ServerPlateBlock key={item.key} nodes={item.nodes} />;
          }
          if (item.type === "buttonGroup") {
            return <ButtonGroup key={item.key} groupId={item.key} buttons={item.buttons} />;
          }
          if (item.type === "field") {
            const field = item.field;
            if (field.fieldType === "Button") {
              return <Field key={item.key} fieldId={field.id} field={field} />;
            }
            const { label, required, labelType } = getFieldLabelProps(field);
            return (
              <div
                key={item.key}
                data-bf-input="true"
                data-bf-standalone={label ? undefined : "true"}
              >
                <ServerFieldLabel
                  text={label}
                  labelType={labelType}
                  htmlFor={field.name}
                  required={required}
                />
                <Field fieldId={field.id} field={field} />
              </div>
            );
          }
          return null;
        })}
      </>
    ),
  );

  return { src, fields };
};

const VERCEL_BLOB_HOST = ".public.blob.vercel-storage.com";
const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}){1,2}$/;
const PAGE_MAX_WIDTH = `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`;

const vercelImg = (url: string, w: number, q = 75) =>
  url.includes(VERCEL_BLOB_HOST)
    ? `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=${q}`
    : url;

const vercelSrcSet = (url: string, widths: number[], q = 75) =>
  url.includes(VERCEL_BLOB_HOST)
    ? widths.map((w) => `${vercelImg(url, w, q)} ${w}w`).join(", ")
    : undefined;

interface PublicFormHeaderData {
  title?: string | null;
  icon?: string | null;
  cover?: string | null;
  customization?: Record<string, string> | null;
}

const resolveLogoCircleSize = (customization: Record<string, string> | null | undefined) => {
  const raw = customization?.logoWidth;
  if (!raw) return { size: "100", minimal: false };
  const parsed = Number.parseInt(raw);
  return {
    size: String(Math.max(48, parsed)),
    minimal: parsed <= 0,
  };
};

const resolveSpriteIconName = (icon: string) => (icon === DEFAULT_ICON ? DEFAULT_ICON_NAME : icon);

export const renderHeaderComponent = async ({
  title,
  icon,
  cover,
  customization,
}: PublicFormHeaderData) => {
  const coverIsHex = !!cover && HEX_COLOR_RE.test(cover);
  const coverIsUrl = !!cover && isValidUrl(cover);
  const hasCover = coverIsHex || coverIsUrl;
  const iconIsUrl = !!icon && isValidUrl(icon);
  const iconIsSprite = !!icon && !iconIsUrl;
  const hasTitle = !!title && title.trim().length > 0;

  if (!hasCover && !iconIsUrl && !iconIsSprite && !hasTitle) return null;

  const { size: logoCircleSize, minimal: isLogoMinimal } = resolveLogoCircleSize(customization);
  const hasIcon = iconIsUrl || iconIsSprite;

  const coverClass =
    "relative w-screen left-[50%] right-[50%] -ml-[50vw] -mr-[50vw] h-[120px] sm:h-[200px]";
  const iconWrapClass = cn("relative z-10 mb-1", hasCover ? "-mt-[50px]" : "mt-4 sm:mt-6");
  const tinted = !!cover && cover.includes("tint=true");

  return createCompositeComponent(() => (
    <div className="mb-4 w-full sm:mb-8">
      {coverIsHex && cover && (
        <div className={coverClass} data-bf-cover style={{ backgroundColor: cover }} />
      )}
      {coverIsUrl && cover && (
        <div className={cn(coverClass, "overflow-hidden bg-muted")} data-bf-cover>
          {tinted && (
            <div className="pointer-events-none absolute inset-0 z-1 bg-primary opacity-50 mix-blend-color" />
          )}
          <img
            src={vercelImg(cover, 1200)}
            srcSet={vercelSrcSet(cover, [640, 960, 1200, 1600])}
            sizes="100vw"
            alt="Form cover"
            width={1200}
            height={200}
            decoding="async"
            className={cn(
              "h-full w-full object-cover",
              tinted && "relative z-0 brightness-60 grayscale",
            )}
          />
        </div>
      )}
      <div className="mx-auto px-4" style={{ maxWidth: PAGE_MAX_WIDTH }} data-bf-form-container>
        <div className="flex flex-col">
          {iconIsUrl && icon && (
            <div className={iconWrapClass} data-bf-logo-container={hasCover ? "true" : undefined}>
              <img
                src={vercelImg(icon, 240)}
                srcSet={vercelSrcSet(icon, [120, 240])}
                sizes="(min-width: 640px) 120px, 100px"
                alt="Form icon"
                width={120}
                height={120}
                decoding="async"
                className="h-[100px] w-[100px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
                data-bf-logo
              />
            </div>
          )}
          {iconIsSprite && icon && (
            <div
              className={iconWrapClass}
              data-bf-logo-emoji-container={hasCover ? "true" : undefined}
            >
              <span data-bf-logo-icon={isLogoMinimal ? "minimal" : ""}>
                <ServerFormIcon
                  iconName={resolveSpriteIconName(icon)}
                  iconSize="48"
                  size={logoCircleSize}
                />
              </span>
            </div>
          )}
          {hasTitle && (
            <h1
              data-bf-title
              style={{ textWrap: "pretty" }}
              className={cn(
                "font-serif text-4xl font-light -tracking-[0.03em] text-foreground sm:text-[48px]",
                hasIcon ? "mt-3 sm:mt-4" : "mt-6 sm:mt-8",
              )}
            >
              {title}
            </h1>
          )}
        </div>
      </div>
    </div>
  ));
};

export const renderThankYouComponent = async (nodes: Value | null) => {
  if (!nodes || nodes.length === 0) return null;
  return createCompositeComponent(() => <ServerPlateBlock nodes={nodes} />);
};

export const runPublicFormViewRSC = async (data: { id: string }) => {
  const base = await getPublishedFormById({ data: { id: data.id } });

  applyFormCacheHeaders(data.id, { gated: !(base.form && !base.gated) });

  const { steps, thankYouNodes }: PreviewStepResult = base.form
    ? transformPlateForPreview(base.form.content as Value)
    : { steps: [], thankYouNodes: null };

  const [stepComponents, thankYou, header] = await Promise.all([
    Promise.all(steps.map((segs) => renderStepComponent(segs))),
    renderThankYouComponent(thankYouNodes),
    base.form
      ? renderHeaderComponent({
          title: base.form.title,
          icon: base.form.icon,
          cover: base.form.cover,
          customization: base.form.customization,
        })
      : Promise.resolve(null),
  ]);

  const firstStepFieldTypes = stepComponents[0]
    ? [...new Set(stepComponents[0].fields.map((f) => f.fieldType))]
    : [];
  const preloadModuleUrls = await getFieldChunkUrls(firstStepFieldTypes);

  return {
    ...base,
    steps: stepComponents,
    stepCount: steps.length,
    thankYou,
    header,
    preloadModuleUrls,
  };
};
