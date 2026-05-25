import type { EmbedType } from "@/hooks/use-editor-sidebar";
import type { EmbedFormFields } from "./embed-config-panel";
import { defaultEmbedFormFields } from "./embed-config-panel";

export { EmbedCodeDialog, generateEmbedUrl } from "./embed-code-dialog";

export type EmbedFormValues = EmbedFormFields & { embedType: EmbedType };

export const tabs: { value: EmbedType; label: string }[] = [
  { value: "standard", label: "Embed" },
  { value: "popup", label: "Popup" },
  { value: "fullpage", label: "Full Page" },
];

/** Map URL search params → form field values */
export const searchToFormValues = (
  search: Record<string, unknown>,
  formIcon?: string | null,
  formBranding?: boolean,
): EmbedFormValues => ({
  embedType:
    (search.embedType as EmbedType) ?? ((search.demo as boolean) ? "standard" : "fullpage"),
  height: (search.embedHeight as number) ?? defaultEmbedFormFields.height,
  dynamicHeight: (search.embedDynamicHeight as boolean) ?? defaultEmbedFormFields.dynamicHeight,
  dynamicWidth: (search.embedDynamicWidth as boolean) ?? defaultEmbedFormFields.dynamicWidth,
  hideTitle: (search.embedHideTitle as boolean) ?? defaultEmbedFormFields.hideTitle,
  alignLeft: (search.embedAlignLeft as boolean) ?? defaultEmbedFormFields.alignLeft,
  transparentBackground:
    (search.embedTransparent as boolean) ?? defaultEmbedFormFields.transparentBackground,
  branding: (search.embedBranding as boolean) ?? formBranding ?? defaultEmbedFormFields.branding,
  customDomain: defaultEmbedFormFields.customDomain,
  popupTrigger:
    (search.embedPopupTrigger as EmbedFormFields["popupTrigger"]) ??
    defaultEmbedFormFields.popupTrigger,
  popupPosition:
    (search.embedPopupPosition as EmbedFormFields["popupPosition"]) ??
    defaultEmbedFormFields.popupPosition,
  popupWidth: (search.embedPopupWidth as number) ?? defaultEmbedFormFields.popupWidth,
  darkOverlay: (search.embedDarkOverlay as boolean) ?? defaultEmbedFormFields.darkOverlay,
  emoji: (search.embedEmoji as boolean) ?? defaultEmbedFormFields.emoji,
  emojiIcon: (search.embedEmojiIcon as string) ?? (formIcon || defaultEmbedFormFields.emojiIcon),
  emojiAnimation:
    (search.embedEmojiAnimation as EmbedFormFields["emojiAnimation"]) ??
    defaultEmbedFormFields.emojiAnimation,
  hideOnSubmit: (search.embedHideOnSubmit as boolean) ?? defaultEmbedFormFields.hideOnSubmit,
  hideOnSubmitDelay:
    (search.embedHideOnSubmitDelay as number) ?? defaultEmbedFormFields.hideOnSubmitDelay,
});

/** Map form field values → URL search params */
export const formValuesToSearch = (v: EmbedFormValues) => ({
  embedType: v.embedType,
  embedHeight: v.height,
  embedDynamicHeight: v.dynamicHeight,
  embedDynamicWidth: v.dynamicWidth,
  embedHideTitle: v.hideTitle,
  embedAlignLeft: v.alignLeft,
  embedTransparent: v.transparentBackground,
  embedBranding: v.branding,
  embedPopupTrigger: v.popupTrigger,
  embedPopupPosition: v.popupPosition,
  embedPopupWidth: v.popupWidth,
  embedDarkOverlay: v.darkOverlay,
  embedEmoji: v.emoji,
  embedEmojiIcon: v.emojiIcon,
  embedEmojiAnimation: v.emojiAnimation,
  embedHideOnSubmit: v.hideOnSubmit,
  embedHideOnSubmitDelay: v.hideOnSubmitDelay,
});
