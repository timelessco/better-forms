import { cn } from "@udecode/cn";

/** Display config shared by all embed types. */
export interface EmbedDisplayConfig {
  title: "visible" | "hidden";
  background: "transparent" | "solid";
  alignment: "center" | "left";
  dynamicHeight: boolean;
  dynamicWidth: boolean;
  branding: boolean;
}

/** Popup appearance + behavior. */
export interface EmbedPopupConfig {
  overlay: "dark" | "light";
  hideOnSubmit: boolean;
  hideOnSubmitDelay: number;
  trigger: "button" | "auto" | "scroll" | "delay" | "exit-intent";
  position: "bottom-right" | "bottom-left" | "center";
  width: number;
  emoji: boolean;
  emojiIcon: string;
  emojiAnimation: "wave" | "bounce" | "pulse";
}

/** Embed options as typed config objects. */
export interface EmbedOptions {
  height: number;
  display: EmbedDisplayConfig;
  popup: EmbedPopupConfig;
  customDomain: boolean;
}

/** Flat shape for TanStack Form bindings + URL search params. */
export interface EmbedFormFields {
  height: number;
  dynamicHeight: boolean;
  dynamicWidth: boolean;
  hideTitle: boolean;
  alignLeft: boolean;
  transparentBackground: boolean;
  customDomain: boolean;
  branding: boolean;
  popupTrigger: "button" | "auto" | "scroll" | "delay" | "exit-intent";
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

/** Flat fields → structured EmbedOptions. */
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
 *
 * `surface` "card" = embed-panel look (bg-secondary track); "flat" = customize-sidebar
 * Figma rows on white background (no fill, h-7, muted label, right-aligned value).
 */
export const ConfigRow = ({
  label,
  description,
  children,
  variant = "default",
  surface = "card",
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "switch";
  surface?: "card" | "flat";
}) => {
  if (surface === "flat") {
    return (
      <div className="flex h-7 items-center gap-3 overflow-clip bg-background">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-case text-[14px] leading-[1.15] font-[400] text-muted-foreground">
            {label}
          </span>
          {description && (
            <p className="text-sm font-normal text-wrap text-muted-foreground">{description}</p>
          )}
        </div>
        {/* value slot right-aligned, value text uses foreground */}
        <div className="flex shrink-0 items-center justify-end text-foreground">{children}</div>
      </div>
    );
  }

  return (
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
};

/**
 * Figma button: h-[24px] px-[8px] py-[5.5px] rounded-[5px] gap-[4px]
 * Must override SelectTrigger defaults: data-[size=default]:h-8, py-2, pe-2, ps-2.5, rounded-lg
 * Use data-[size=default]:h-[24px] to match specificity of the default variant class.
 */
export const selectTriggerCls =
  "data-[size=default]:h-[24px] shrink-0 border-none bg-transparent shadow-none rounded-[5px] px-2 py-0 gap-1 w-auto text-[13px] text-foreground font-medium whitespace-nowrap ";

/**
 * Figma customize-sidebar inline value select: borderless, transparent, 24px tall,
 * 14px medium foreground value, gap-1, 10px down-caret (sizes the built-in SelectTrigger icon).
 * Separate from `selectTriggerCls` so the embed panel's trigger stays unchanged.
 */
export const selectTriggerFigmaCls =
  "data-[size=default]:h-[24px] shrink-0 border-none bg-transparent shadow-none rounded-[5px] px-0 py-0 gap-1 w-auto text-[14px] leading-[1.15] text-gray-700 font-[450] font-case whitespace-nowrap [&_svg]:size-[10px] ";

export const triggerLabels: Record<string, string> = {
  button: "On button click",
  auto: "On page load",
  scroll: "After scrolling",
  delay: "After delay",
  "exit-intent": "On exit intent",
};
