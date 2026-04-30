import { APP_NAME } from "@/lib/config/app-config";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EmbedType } from "@/hooks/use-editor-sidebar";
import { cn } from "@/lib/utils";
import type { EmbedOptions } from "./embed-config-panel";
import { all, createLowlight } from "lowlight";
import { toHtml } from "hast-util-to-html";

const lowlight = createLowlight(all);
const hljsClassName =
  "py-1 **:[.hljs-addition]:bg-[#f0fff4] **:[.hljs-addition]:text-[#22863a] dark:**:[.hljs-addition]:bg-[#3c5743] dark:**:[.hljs-addition]:text-[#ceead5] **:[.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable]:text-[#005cc5] dark:**:[.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable]:text-[#6596cf] **:[.hljs-built\\\\_in,.hljs-symbol]:text-[#e36209] dark:**:[.hljs-built\\\\_in,.hljs-symbol]:text-[#c3854e] **:[.hljs-bullet]:text-[#735c0f] **:[.hljs-comment,.hljs-code,.hljs-formula]:text-[#6a737d] dark:**:[.hljs-comment,.hljs-code,.hljs-formula]:text-[#6a737d] **:[.hljs-deletion]:bg-[#ffeef0] **:[.hljs-deletion]:text-[#b31d28] dark:**:[.hljs-deletion]:bg-[#473235] dark:**:[.hljs-deletion]:text-[#e7c7cb] **:[.hljs-emphasis]:italic **:[.hljs-keyword,.hljs-doctag,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language\\\\_]:text-[#d73a49] dark:**:[.hljs-keyword,.hljs-doctag,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language\\\\_]:text-[#ee6960] **:[.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo]:text-[#22863a] dark:**:[.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo]:text-[#36a84f] **:[.hljs-regexp,.hljs-string,.hljs-meta_.hljs-string]:text-[#032f62] dark:**:[.hljs-regexp,.hljs-string,.hljs-meta_.hljs-string]:text-[#3593ff] **:[.hljs-section]:font-bold **:[.hljs-section]:text-[#005cc5] dark:**:[.hljs-section]:text-[#61a5f2] **:[.hljs-strong]:font-bold **:[.hljs-title,.hljs-title.class\\\\_,.hljs-title.class\\\\_.inherited\\\\_\\\\_,.hljs-title.function\\\\_]:text-[#6f42c1] dark:**:[.hljs-title,.hljs-title.class\\\\_,.hljs-title.class\\\\_.inherited\\\\_\\\\_,.hljs-title.function\\\\_]:text-[#a77bfa]";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderHighlighted = (code: string, language?: string) => {
  try {
    const tree = language ? lowlight.highlight(language, code) : lowlight.highlightAuto(code);
    return toHtml(tree);
  } catch {
    try {
      const tree = lowlight.highlightAuto(code);
      return toHtml(tree);
    } catch {
      return escapeHtml(code);
    }
  }
};

interface EmbedCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedType: EmbedType;
  options: EmbedOptions;
  formId: string;
  docTitle?: string;
  customDomain?: string;
  formSlug?: string;
}

export const generateEmbedUrl = (
  formId: string,
  options: EmbedOptions,
  customDomain?: string,
  formSlug?: string,
): string => {
  const baseUrl =
    customDomain && formSlug
      ? `https://${customDomain}/${formSlug}`
      : `${window.location.origin}/forms/${formId}`;
  const params = new URLSearchParams();
  if (options.display.title === "hidden") params.append("hideTitle", "true");
  if (options.display.background === "transparent") params.append("transparent", "true");
  if (options.display.alignment === "left") params.append("align", "left");
  // Note: "Made with Reform" branding is a server-controlled Pro feature. It
  // cannot be toggled via the embed URL or script data-attributes — the source
  // of truth is the form's own `settings.branding` column, managed from the
  // Settings panel.
  if (options.display.dynamicHeight) params.append("dynamicHeight", "true");
  if (options.display.dynamicWidth) params.append("dynamicWidth", "true");
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
};

const generateEmbedCode = (
  embedType: EmbedType,
  options: EmbedOptions,
  formId: string,
  docTitle?: string,
  customDomain?: string,
  formSlug?: string,
): string => {
  const embedUrl = generateEmbedUrl(formId, options, customDomain, formSlug);

  if (embedType === "standard") {
    const baseUrl = `${window.location.origin}/widgets/embed.js`;
    const dynamicHeightScript = options.display.dynamicHeight
      ? `window.addEventListener("message",function(e){try{var d=JSON.parse(e.data);if(d.event==="Reform.Resize"){var f=document.querySelector('iframe[data-reform-src]');if(f&&typeof d.height==="number")f.style.height=d.height+"px"}}catch{}});`
      : "";
    return `<iframe
  data-reform-src="${embedUrl}"
  loading="lazy"
  width="100%"
  height="${options.height}"
  frameborder="0"
  marginheight="0"
  marginwidth="0"
  title="${docTitle || "Form"}"
></iframe>
<script>${dynamicHeightScript}var d=document,w="${baseUrl}",v=function(){"undefined"!=typeof Reform?Reform.loadEmbeds():d.querySelectorAll("iframe[data-reform-src]:not([src])").forEach((function(e){e.src=e.dataset.reformSrc}))};if("undefined"!=typeof Reform)v();else if(d.querySelector('script[src="'+w+'"]')==null){var s=d.createElement("script");s.src=w,s.onload=v,s.onerror=v,d.body.appendChild(s);}</script>`;
  }

  if (embedType === "popup") {
    const isDarkOverlay = options.popup.overlay === "dark";
    return `<!-- ${APP_NAME} Popup Embed -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = "${window.location.origin}/embed/popup.js";
    script.setAttribute('data-form-id', '${formId}');
    script.setAttribute('data-position', '${options.popup.position}');
    script.setAttribute('data-width', '${options.popup.width}');
    script.setAttribute('data-trigger', '${options.popup.trigger}');
    ${isDarkOverlay ? "script.setAttribute('data-dark-overlay', 'true');" : ""}
    ${options.popup.emoji ? `script.setAttribute('data-emoji', '${options.popup.emojiIcon}');` : ""}
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
  }

  return `<!-- Redirect to full page form -->
<meta http-equiv="refresh" content="0; url=${embedUrl}" />

<!-- Or link to it -->
<a href="${embedUrl}">Open Form</a>`;
};

const InlineCopyBar = ({ value }: { value: string }) => (
  <div className="flex items-center gap-2">
    <Input value={value} readOnly aria-label="Embed URL" className="font-mono text-xs" />
    <CopyButton text={value} variant="outline" />
  </div>
);

const CodeBlock = ({
  code,
  language,
  inline,
}: {
  code: string;
  language?: string;
  inline?: boolean;
}) => {
  const highlighted = useMemo(() => renderHighlighted(code, language), [code, language]);
  const isInline = inline ?? !code.includes("\n");

  if (isInline) {
    return <InlineCopyBar value={code} />;
  }

  return (
    <div className="group relative mt-3 w-full max-w-full min-w-0 overflow-hidden">
      <pre
        className={cn(
          "w-full max-w-full min-w-0 rounded-xl border border-border/50 bg-muted/30 p-4 pr-12 font-mono text-[12px] [overflow-wrap:anywhere] [word-break:break-word] whitespace-pre-wrap text-foreground/90 [tab-size:2]",
          hljsClassName,
        )}
      >
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} variant="outline" />
      </div>
    </div>
  );
};

export const EmbedCodeDialog = ({
  open,
  onOpenChange,
  embedType,
  options,
  formId,
  docTitle,
  customDomain,
  formSlug,
}: EmbedCodeDialogProps) => {
  const embedUrl = useMemo(
    () => generateEmbedUrl(formId, options, customDomain, formSlug),
    [formId, options, customDomain, formSlug],
  );
  const embedCode = useMemo(
    () => generateEmbedCode(embedType, options, formId, docTitle, customDomain, formSlug),
    [embedType, options, formId, docTitle, customDomain, formSlug],
  );

  const isAlignLeft = options.display.alignment === "left";
  const isHideTitle = options.display.title === "hidden";
  const isDarkOverlay = options.popup.overlay === "dark";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-background p-0 sm:max-w-2xl [&>button]:text-muted-foreground">
        <div className="min-w-0 space-y-5 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-bold text-foreground">
              Add to your website
            </DialogTitle>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {embedType === "popup"
                ? `Drop a single script on your site. ${APP_NAME} auto-renders a floating bubble at the position you configured; clicking it opens the form.`
                : "Integrate this form seamlessly into your website using the snippet below."}
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {embedType === "standard" ? (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2.5 text-[13px] font-semibold text-foreground">Embed code</h3>
                  <p className="mb-3.5 text-[12px] text-muted-foreground">
                    Paste this HTML code snippet on the page where you want the embed to appear.
                  </p>
                  <CodeBlock code={embedCode} language="html" />
                </div>

                <div>
                  <h3 className="mb-2.5 text-[13px] font-semibold text-foreground">Direct link</h3>
                  <p className="mb-3.5 text-[12px] text-muted-foreground">
                    Alternatively, paste this link in a no-code tool (Notion, Ghost, Canva, etc).
                  </p>
                  <div className="mb-4">
                    <InlineCopyBar value={embedUrl} />
                  </div>
                  <CodeBlock
                    code={`<script async src="${window.location.origin}/widgets/embed.js"></script>`}
                    language="html"
                  />
                </div>
              </div>
            ) : embedType === "popup" ? (
              <div>
                <p className="mb-4 text-[12px] text-muted-foreground">
                  Paste this{" "}
                  <strong className="font-semibold text-foreground">single script tag</strong> into
                  your site's{" "}
                  <code className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{`<head>`}</code>
                  . All popup settings are read from{" "}
                  <code className="rounded border border-border/50 bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    data-*
                  </code>{" "}
                  attributes on the script itself — no separate button required.
                </p>
                <CodeBlock
                  code={`<script
  async
  src="${window.location.origin}/embed/popup.js"
  data-form-id="${formId}"
  data-position="${options.popup.position}"
  data-width="${options.popup.width}"${isAlignLeft ? `\n  data-align-left="1"` : ""}${isHideTitle ? `\n  data-hide-title="1"` : ""}${isDarkOverlay ? `\n  data-dark-overlay="1"` : ""}${options.popup.hideOnSubmit ? `\n  data-auto-close="${options.popup.hideOnSubmitDelay * 1000}"` : ""}
></script>`}
                  language="html"
                />
                <p className="mt-6 mb-2 text-[12px] text-muted-foreground">
                  The script auto-renders a floating bubble at the configured position, preloads the
                  form in the background, and expands into the popup when the bubble is clicked. The
                  bubble uses your form's icon automatically.
                </p>
              </div>
            ) : (
              /* Full page */
              <div>
                <h3 className="mb-2.5 text-[13px] font-semibold text-foreground">
                  Full page redirect
                </h3>
                <p className="mb-3.5 text-[12px] text-muted-foreground">
                  Use a meta redirect or link to send visitors directly to your form.
                </p>
                <CodeBlock code={embedCode} language="html" />
                <div className="mt-5">
                  <InlineCopyBar value={embedUrl} />
                </div>
              </div>
            )}

            <div className="border-t border-border pt-8">
              <Accordion>
                <AccordionItem value="save" className="border-b border-border/50">
                  <AccordionTrigger
                    iconPosition="end"
                    className="group-hover:text-brand px-0 py-5 text-[14px] font-semibold text-foreground transition-colors hover:no-underline"
                  >
                    Save website page and query parameters
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-8 text-[12px] text-muted-foreground">
                    <p>
                      Your page's URL and query parameters are automatically forwarded to the{" "}
                      {embedType === "popup" ? "popup" : "form"} and saved via hidden fields.
                    </p>
                    <div className="rounded-lg border border-border/50 bg-muted p-3.5 font-mono text-[11px] break-all">
                      https://company.com/register?ref=downloads&email=alice@example.com
                    </div>
                    {embedType === "popup" && (
                      <div className="pt-2">
                        <p className="mb-3">
                          Any extra{" "}
                          <code className="rounded bg-muted px-1 font-mono text-foreground">
                            data-*
                          </code>{" "}
                          attribute on the script tag (other than the known config keys) is
                          forwarded to the form as a hidden field.
                        </p>
                        <CodeBlock
                          code={`<script
  async
  src="${window.location.origin}/embed/popup.js"
  data-form-id="${formId}"
  data-ref="downloads"
  data-email="alice@example.com"
></script>`}
                          language="html"
                        />
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="js" className="border-b border-border/50">
                  <AccordionTrigger
                    iconPosition="end"
                    className="group-hover:text-brand px-0 py-5 text-[14px] font-semibold text-foreground transition-colors hover:no-underline"
                  >
                    Use JavaScript
                  </AccordionTrigger>
                  <AccordionContent className="space-y-5 pb-8 text-[12px] text-muted-foreground">
                    <p className="opacity-80">Share these instructions with your developers.</p>

                    {embedType === "standard" ? (
                      <CodeBlock
                        code={`// Include the ${APP_NAME} widget script
<script src="${window.location.origin}/widgets/embed.js"></script>

// Add the embed in your HTML
<iframe data-reform-src="${embedUrl}" loading="lazy" width="100%" height="${options.height}" frameborder="0" title="${docTitle || "Form"}"></iframe>

// Load all embeds
Reform.loadEmbeds();`}
                        language="javascript"
                      />
                    ) : (
                      <div className="space-y-4">
                        <p>
                          The script auto-renders its own bubble trigger and handles opening the
                          popup on click. You can also open or close it programmatically via{" "}
                          <code className="rounded bg-muted px-1 font-mono text-foreground">
                            window.Reform
                          </code>
                          .
                        </p>
                        <CodeBlock
                          code={`// Open the popup
Reform.open();

// Close the popup
Reform.close();`}
                          language="javascript"
                        />
                        <p className="pt-2">
                          All popup configuration (position, width, dark overlay, hidden fields,
                          etc.) is read from{" "}
                          <code className="rounded bg-muted px-1 font-mono text-foreground">
                            data-*
                          </code>{" "}
                          attributes on the script tag when the page loads — there's nothing to pass
                          at the call site.
                        </p>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
