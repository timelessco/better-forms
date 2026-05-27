import { createCompositeComponent } from "@tanstack/react-start/rsc";
import { createSlateEditor } from "platejs";
import type { Value } from "platejs";

import { BaseEditorKit } from "@/components/editor/editor-base-kit";
import { ServerFormIcon } from "@/components/form-components/server-form-icon";
import { EditorStatic } from "@/components/ui/editor-static";
import { DEFAULT_ICON } from "@/lib/config/app-config";
import { CUSTOMIZATION_AUTO_DEFAULTS } from "@/lib/theme/customization-defaults";
import { cn, DEFAULT_ICON_NAME, isHexColor, isValidUrl } from "@/lib/utils";
import { COVER_SRCSET_WIDTHS, vercelImg, vercelSrcSet } from "@/lib/vercel-image";
import {
  fieldLabelId,
  getFieldLabelProps,
  GROUP_FIELD_TYPES,
} from "@/components/form-components/fields/shared";
import {
  chunkSegmentsForFieldByField,
  transformPlateForPreview,
} from "@/lib/editor/transform-plate-for-preview";
import type {
  FieldSegment,
  PreviewSegment,
  PreviewStepResult,
} from "@/lib/editor/transform-plate-for-preview";
import { extractFormHeader } from "@/lib/editor/transform-plate-to-form";
import type { PlateFormField } from "@/lib/editor/transform-plate-to-form";
import { applyFormCacheHeaders } from "@/lib/server-fn/cdn-cache";
import { getFieldChunkUrls } from "@/lib/server-fn/field-chunk-manifest.server";
import { getPublishedFormByShortId } from "@/lib/server-fn/public-form-view";
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
      className="!mx-0 !my-0 overflow-x-visible! !p-0 text-base [&_.slate-p]:m-0 [&_.slate-p]:px-0 [&_.slate-p]:py-1"
    />
  );
};

// Server label + required badge. No hooks/Tooltip (client Radix); uses a title tooltip so
// the required marker keeps an accessible hint without shipping JS.
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
        d="M12.39 5.69L12.79 6.93L9.02 8.22L11.47 11.53L10.42 12.34L7.95 8.92L5.58 12.31L4.53 11.5L6.9 8.22L3.16 6.95L3.59 5.69L7.28 7.01V3.02H8.65V6.98L12.39 5.69Z"
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
  asGroupLabel = false,
}: {
  text: string;
  labelType?: string;
  htmlFor: string;
  required?: boolean;
  /** Group fields render label as span w/ stable id; role=group wrapper handles AT via aria-labelledby. */
  asGroupLabel?: boolean;
}) => {
  if (!text) return null;
  const badge = required ? <RequiredBadge /> : null;
  const labelId = fieldLabelId(htmlFor);

  if (labelType && labelType in HEADING_VARIANTS) {
    const { Tag, className } = HEADING_VARIANTS[labelType as HeadingVariant];
    return (
      <div className="flex w-full items-center py-2.5">
        <Tag id={labelId} className={className}>
          {text}
        </Tag>
        {badge}
      </div>
    );
  }

  if (asGroupLabel) {
    return (
      <span
        id={labelId}
        data-slot="label"
        data-bf-field-label
        className="flex w-full items-center gap-2 py-2.5 text-sm select-none"
      >
        <span className="flex-1">{text}</span>
        {badge}
      </span>
    );
  }

  return (
    <label
      htmlFor={htmlFor}
      id={labelId}
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

// Collect buttons, move to step end as one group row, regardless of original position.
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
            // Group fields lack a single labelable control; role=group + aria-labelledby so AT
            // announces the group label. Mirrors PreviewInputShell.
            const isGroup = GROUP_FIELD_TYPES.has(field.fieldType);
            const groupAriaProps =
              isGroup && label
                ? { role: "group" as const, "aria-labelledby": fieldLabelId(field.name) }
                : {};
            return (
              <div
                key={item.key}
                data-bf-input="true"
                data-bf-standalone={label ? undefined : "true"}
                {...groupAriaProps}
              >
                <ServerFieldLabel
                  text={label}
                  labelType={labelType}
                  htmlFor={field.name}
                  required={required}
                  asGroupLabel={isGroup}
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

const PAGE_MAX_WIDTH = `var(--bf-page-width, ${CUSTOMIZATION_AUTO_DEFAULTS.pageWidth})`;

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
  const coverIsHex = !!cover && isHexColor(cover);
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
            srcSet={vercelSrcSet(cover, [...COVER_SRCSET_WIDTHS])}
            sizes="100vw"
            alt="Form cover"
            width={1200}
            height={200}
            decoding="async"
            fetchPriority="high"
            className={cn(
              "size-full object-cover",
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
                className="size-[100px] rounded-md object-cover sm:h-[120px] sm:w-[120px]"
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

export const runPublicFormViewRSC = async (data: { shortId: string }) => {
  const base = await getPublishedFormByShortId({ data: { shortId: data.shortId } });

  // Cache-Tag must be the UUID so purgeFormCache(formId) can invalidate. When base.form is null
  // (gated/closed/over-limit) the gated:true branch skips Cache-Tag, so empty placeholder is fine.
  applyFormCacheHeaders(base.form?.id ?? "", { gated: !(base.form && !base.gated) });

  const { steps: rawSteps, thankYouNodes }: PreviewStepResult = base.form
    ? transformPlateForPreview(base.form.content as Value)
    : { steps: [], thankYouNodes: null };

  const isFieldByField = base.form?.settings?.presentationMode === "field-by-field";
  const steps = isFieldByField ? chunkSegmentsForFieldByField(rawSteps) : rawSteps;
  // Custom icon color lives in the Plate formHeader node, not the form row; extract so the
  // field-by-field client header matches the builder.
  const formHeaderIconColor =
    isFieldByField && base.form
      ? (extractFormHeader(base.form.content as Value)?.iconColor ?? null)
      : null;

  const [stepComponents, thankYou, header] = await Promise.all([
    Promise.all(steps.map((segs) => renderStepComponent(segs))),
    renderThankYouComponent(thankYouNodes),
    // Field-by-field renders its own client header (icon beside title, no cover band); skip card header.
    base.form && !isFieldByField
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
    formHeaderIconColor,
  };
};
