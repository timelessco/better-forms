export type PopupPosition = "bottom-right" | "bottom-left" | "center";
export type PopupLayout = "default" | "modal";
/** How the auto-bubble opens the popup. "button" = click the bubble; others auto-open once. */
export type PopupTrigger = "button" | "auto" | "scroll" | "delay" | "exit-intent";
export type EmojiAnimation = "wave" | "bounce" | "pulse" | "none";

export interface EmojiOptions {
  text: string;
  animation: EmojiAnimation;
}

export interface PopupOptions {
  /** Layout style: 'default' (corner) or 'modal' (centered) */
  layout?: PopupLayout;
  /** Position for default layout */
  position?: PopupPosition;
  /** Popup width in pixels */
  width?: number;
  /** Align form content to the left */
  alignLeft?: boolean;
  /** Hide the form title */
  hideTitle?: boolean;
  /** Show dark overlay behind popup */
  overlay?: boolean;
  /** Emoji bubble with animation */
  emoji?: EmojiOptions;
  /** Auto-close popup after N milliseconds on submit */
  autoClose?: number;
  /** Hidden fields to pre-fill in the form */
  hiddenFields?: Record<string, string>;
  /** Callback when popup opens */
  onOpen?: () => void;
  /** Callback when popup closes */
  onClose?: () => void;
  /** Callback when form is submitted */
  onSubmit?: (payload: FormSubmitPayload) => void;
  /** Callback on page view (multi-step forms) */
  onPageView?: (page: number) => void;
}

export interface FormSubmitPayload {
  formId: string;
  formName?: string;
  submissionId?: string;
  data?: Record<string, unknown>;
}

export interface PopupInstance {
  formId: string;
  options: PopupOptions;
  container: HTMLElement;
  iframe: HTMLIFrameElement;
  overlay?: HTMLElement;
  /** Spinner over empty iframe; hidden on `Reform.FormLoaded` (SSR parsed) or iframe `load`, whichever first. */
  loadingEl?: HTMLElement;
  /** True while pre-mounted on hover but not yet revealed to the user. */
  hidden?: boolean;
  /** Highest reported content height this session. Popup height monotonic non-decreasing — tall→short step (e.g. Thank You) keeps larger size, no chrome jump. */
  maxContentHeight?: number;
}

/** Events sent from iframe to parent */
export type IframeEvent =
  // frameRadius: the form's popup cover radius (--bf-cover-radius) so the host-page frame matches it.
  | { event: "Reform.FormLoaded"; formId: string; frameRadius?: string }
  | { event: "Reform.Resize"; height: number }
  | {
      event: "Reform.FormSubmitted";
      formId: string;
      payload: FormSubmitPayload;
    }
  | { event: "Reform.PageView"; formId: string; page: number }
  | { event: "Reform.Close"; formId: string };

/** Global API exposed on window. Populated by whichever embed script loaded — popup.js sets the popup methods, widgets/embed.js sets loadEmbeds. */
interface ReformAPI {
  openPopup?: (formId: string, options?: PopupOptions) => void;
  closePopup?: (formId: string) => void;
  destroyPopup?: (formId: string) => void;
  /** Standard iframe embed: activate every <iframe data-reform-src> on the page. */
  loadEmbeds?: () => void;
}

declare global {
  interface Window {
    Reform: ReformAPI;
  }
}
