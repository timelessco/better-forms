import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { Toaster } from "@/components/ui/sonner";
import type { Session } from "@/lib/auth/auth";
import { seo } from "@/lib/seo";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import appCss from "../styles/styles.css?url";

const LazyDevtools = lazy(() =>
  import("./-components/devtools").then((m) => ({ default: m.Devtools })),
);

interface MyRouterContext {
  queryClient: QueryClient;
  session: Session | null;
}

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("vite-ui-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}})()`;

// iOS Safari zooms into inputs with font-size < 16px on focus. Forcing
// maximum-scale=1.0 on iOS only suppresses that zoom while preserving
// pinch-to-zoom everywhere else. A MutationObserver re-applies the
// attribute if TanStack rewrites the viewport meta during navigation.
const IOS_AUTOZOOM_FIX_SCRIPT = `(function(){if(window.__iosAutozoomFixApplied)return;var isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(!isIOS)return;window.__iosAutozoomFixApplied=true;var applying=false;var apply=function(){var m=document.querySelector('meta[name=viewport]');if(!m)return;var c=m.getAttribute('content')||'';if(c.indexOf('maximum-scale=1.0')!==-1)return;applying=true;if(/maximum-scale=[\\d.]+/.test(c)){m.setAttribute('content',c.replace(/maximum-scale=[\\d.]+/,'maximum-scale=1.0'))}else{m.setAttribute('content',c+', maximum-scale=1.0')}applying=false};apply();new MutationObserver(function(ms){if(applying)return;for(var i=0;i<ms.length;i++){var x=ms[i];if((x.type==='attributes'&&x.target.nodeName==='META')||x.type==='childList'){apply();return}}}).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']})})()`;

const RootDocument = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <head>
      {/* Theme init script - static trusted content, not user input */}
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for theme initialization */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <HeadContent />
    </head>
    <body
      suppressHydrationWarning
      className="min-h-screen bg-background font-sans text-foreground antialiased"
    >
      <HotkeysProvider defaultOptions={{ hotkey: { preventDefault: true } }}>
        <ThemeProvider defaultTheme="system">
          {children}
          <Toaster richColors />
          {process.env.NODE_ENV === "development" && (
            <Suspense>
              <LazyDevtools />
            </Suspense>
          )}
        </ThemeProvider>
      </HotkeysProvider>
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      ...seo(),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/metadata/favicon.svg" },
      { rel: "icon", href: "/metadata/favicon.ico" },
      { rel: "apple-touch-icon", href: "/metadata/apple-touch-icon.png" },
      { rel: "manifest", href: "/metadata/site.webmanifest" },
    ],
    scripts: [{ children: IOS_AUTOZOOM_FIX_SCRIPT }],
  }),
  shellComponent: RootDocument,
  pendingComponent: Loader,
  errorComponent: ErrorBoundary,
  notFoundComponent: NotFound,
});
