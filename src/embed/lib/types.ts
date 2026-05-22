/**
 * Reform Popup Embed - Type Definitions
 */

export type PopupPosition = "bottom-right" | "bottom-left" | "center";
export type PopupLayout = "default" | "modal";
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
  /** Spinner element shown over the empty iframe; hidden once the form's
   *  SSR'd HTML is parsed (via `Reform.FormLoaded`) or the iframe's own
   *  `load` event fires — whichever comes first. */
  loadingEl?: HTMLElement;
  /** True while pre-mounted on hover but not yet revealed to the user. */
  hidden?: boolean;
  /** Highest content height the iframe has reported this session. Popup
   *  height is monotonically non-decreasing — when the form transitions
   *  from a tall step (e.g. all fields) to a short one (Thank You), the
   *  popup keeps the larger size so the chrome doesn't jump/shrink. */
  maxContentHeight?: number;
}

/** Events sent from iframe to parent */
export type IframeEvent =
  | { event: "Reform.FormLoaded"; formId: string }
  | { event: "Reform.Resize"; height: number }
  | {
      event: "Reform.FormSubmitted";
      formId: string;
      payload: FormSubmitPayload;
    }
  | { event: "Reform.PageView"; formId: string; page: number }
  | { event: "Reform.Close"; formId: string };

/** Global API exposed on window */
interface ReformAPI {
  openPopup: (formId: string, options?: PopupOptions) => void;
  closePopup: (formId: string) => void;
  destroyPopup: (formId: string) => void;
}

declare global {
  interface Window {
    Reform: ReformAPI;
  }
}
