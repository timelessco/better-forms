// Scaffolding shared by the two preview entry points (form-preview-from-plate + form-preview-rsc):
// the empty-state placeholder, the default thank-you card, and the analytics tracking builder.
import { SuccessCheck } from "@/components/transitions/success-check";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import type { PublicFormTracking, TrackingBase } from "@/contexts/step-form-context";
import { useTranslation } from "@/contexts/translation-context";
import type { PresentationMode } from "@/types/form-settings";

const NoContentPlaceholderIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mx-auto mb-4 opacity-50"
  >
    <title>No content placeholder</title>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

// Empty-state shown when the editor has no renderable steps.
export const NoContentPlaceholder = () => (
  <div className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
    <div className="mb-4 text-muted-foreground">{NoContentPlaceholderIcon}</div>
    <h3 className="mb-2 text-lg">No Content Yet</h3>
    <p className="max-w-md text-sm text-muted-foreground">
      Add content to the editor to see the preview.
    </p>
  </div>
);

// "Share with others" row (link + copy) on the thank-you page.
export const ShareWithOthers = ({ shareUrl }: { shareUrl: string }) => (
  <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-2 pt-4">
    <p className="text-sm text-muted-foreground">Share with others</p>
    <div className="flex h-[30px] w-full items-center gap-[6px] rounded-lg bg-muted/60 py-[3px] pr-[3px] pl-[10px]">
      <span className="min-w-0 flex-1 truncate text-sm font-normal text-muted-foreground">
        {shareUrl}
      </span>
      <CopyButton
        text={shareUrl}
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 gap-1 rounded-[5px] border-none bg-background px-2 text-sm text-foreground shadow-[0px_1px_1px_0px_rgba(0,0,0,0.1),0px_0px_0.5px_0px_rgba(0,0,0,0.6)] [&_svg]:size-[13px]"
      >
        Copy
      </CopyButton>
    </div>
  </div>
);

// Default success card when the form has no authored thank-you content. `shareUrl` (from-plate only)
// appends the share row; the RSC caller omits it.
export const DefaultThankYou = ({
  onReset,
  shareUrl,
}: {
  onReset?: () => void;
  shareUrl?: string;
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-green-100">
        <SuccessCheck size={32} className="text-green-600" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold">{t("thankYou")}</h2>
      <p className="mb-6 text-muted-foreground">{t("responseSubmitted")}</p>
      {onReset && (
        <Button type="button" onClick={onReset} variant="outline" size="sm" className="rounded-lg">
          {t("submitAnother")}
        </Button>
      )}
      {shareUrl && <ShareWithOthers shareUrl={shareUrl} />}
    </div>
  );
};

// Build the analytics tracking payload. Per ADR-0002 tracking is always on — card forms still emit
// per-Question view/start/complete. null when there's no visit base or formId (builder previews).
export const buildTracking = (
  trackingBase: TrackingBase | undefined,
  formId: string | undefined,
  presentationMode: PresentationMode,
): PublicFormTracking | null =>
  trackingBase && formId
    ? {
        visitId: trackingBase.visitId,
        visitorHash: trackingBase.visitorHash,
        formId,
        mode: presentationMode === "field-by-field" ? "field-by-field" : "card",
      }
    : null;
