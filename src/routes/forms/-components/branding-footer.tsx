import { SparklesIcon } from "@/components/ui/icons";
import { APP_NAME, APP_WEBSITE_URL } from "@/lib/config/app-config";

export const BrandingFooter = () => (
  <div className="fixed right-0 bottom-0 left-0 z-50 flex justify-center border-t border-border bg-muted/60 py-3 backdrop-blur">
    <a
      href={APP_WEBSITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <span>Made with</span>
      <SparklesIcon className="h-3 w-3 fill-muted-foreground text-muted-foreground" />
      <span className="text-foreground">{APP_NAME}</span>
    </a>
  </div>
);
