import { useMemo } from "react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

// Brand glyphs aren't in lucide, so inline the (single-path) logos. Each social
// builds its share URL from the form URL + a short blurb.
const SOCIALS = [
  {
    name: "X",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    href: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: "LinkedIn",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    href: (url: string, _text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "WhatsApp",
    path: "M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z",
    href: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
] as const;

type FormShareCardProps = {
  /** Public short id of the form; the link is built as `${origin}/forms/${shortId}`. */
  shortId?: string;
  /** Pre-built share URL (takes precedence over `shortId`). */
  shareUrl?: string;
  /** Blurb prepended to social shares. */
  shareText?: string;
  className?: string;
};

/**
 * Completion-screen call to action: instead of inviting a duplicate submission,
 * nudge the Respondent to share the form so it reaches new people.
 */
export const FormShareCard = ({
  shortId,
  shareUrl: shareUrlProp,
  shareText,
  className,
}: FormShareCardProps) => {
  // A pre-built URL wins; otherwise build it client-side from the short id so it
  // works on the published page, embeds, and preview without server threading.
  const shareUrl = useMemo(() => {
    if (shareUrlProp) return shareUrlProp;
    if (typeof window === "undefined" || !shortId) return "";
    return `${window.location.origin}/forms/${shortId}`;
  }, [shareUrlProp, shortId]);
  const text = shareText ?? "Check out this form";

  if (!shareUrl) return null;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-foreground">
        Know someone who'd be a good fit? Share this form.
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pr-1 pl-3">
        <span className="flex-1 truncate text-left text-xs text-muted-foreground">{shareUrl}</span>
        <CopyButton text={shareUrl} variant="secondary" size="sm" className="shrink-0">
          Copy
        </CopyButton>
      </div>
      <div className="flex items-center justify-center gap-2">
        {SOCIALS.map((social) => (
          <a
            key={social.name}
            href={social.href(shareUrl, text)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${social.name}`}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-muted"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d={social.path} />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
};
