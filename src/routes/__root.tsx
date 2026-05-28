import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from "@/lib/auth/auth";
import { seo } from "@/lib/seo";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
// `?inline` = build-time CSS string, injected via single <style> in RootDocument so HeadContent emits no render-blocking <link>. (Side-effect import + inlineCss emitted both; Lighthouse −70ms.)
import styles from "../styles/styles.css?inline";

// Lazy: sonner ~14kB gz, public form never toasts. Static `toast` imports still chunk it (auth/login/builder); lazy Toaster mount just keeps it out of the always-loaded root chunk.
const Toaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

const LazyDevtools = lazy(() =>
  import("./-components/devtools").then((m) => ({ default: m.Devtools })),
);

interface MyRouterContext {
  queryClient: QueryClient;
  session: Session | null;
}

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("vite-ui-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}})()`;

// iOS Safari zooms inputs <16px on focus; maximum-scale=1.0 (iOS only) suppresses that, keeps pinch-zoom elsewhere. MutationObserver re-applies if TanStack rewrites viewport meta on nav.
const IOS_AUTOZOOM_FIX_SCRIPT = `(function(){if(window.__iosAutozoomFixApplied)return;var isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);if(!isIOS)return;window.__iosAutozoomFixApplied=true;var applying=false;var apply=function(){var m=document.querySelector('meta[name=viewport]');if(!m)return;var c=m.getAttribute('content')||'';if(c.indexOf('maximum-scale=1.0')!==-1)return;applying=true;if(/maximum-scale=[\\d.]+/.test(c)){m.setAttribute('content',c.replace(/maximum-scale=[\\d.]+/,'maximum-scale=1.0'))}else{m.setAttribute('content',c+', maximum-scale=1.0')}applying=false};apply();new MutationObserver(function(ms){if(applying)return;for(var i=0;i<ms.length;i++){var x=ms[i];if((x.type==='attributes'&&x.target.nodeName==='META')||x.type==='childList'){apply();return}}}).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['content']})})()`;

const APP_STYLE_PROP = { __html: styles } as const;

const RootDocument = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <head>
      {/* App CSS from `styles.css?inline` (build-time, no user input). Single source — HeadContent emits no render-blocking <link>. */}
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: build-time CSS string, identical security posture to the theme init script below */}
      {/* eslint-disable-next-line react/no-danger -- build-time CSS bundle, no user input */}
      <style dangerouslySetInnerHTML={APP_STYLE_PROP} />
      {/* Theme init script - static trusted content, not user input */}
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: Needed for theme initialization */}
      {/* eslint-disable-next-line react/no-danger -- static module-literal, no user input; must run synchronously to avoid theme flash */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {import.meta.env.DEV && (
        // eslint-disable-next-line react-doctor/rendering-script-defer-async, react-doctor/no-undeferred-third-party -- dev-only react-scan script; not shipped to production
        <script
          async
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan@0.5.6/dist/auto.global.js"
        />
      )}
      <HeadContent />
    </head>
    <body
      suppressHydrationWarning
      className="min-h-screen bg-background font-sans text-foreground antialiased"
    >
      <ThemeProvider defaultTheme="system">
        <TooltipProvider>
          {children}
          <Suspense fallback={null}>
            <Toaster richColors />
          </Suspense>
          {process.env.NODE_ENV === "development" && (
            <Suspense>
              <LazyDevtools />
            </Suspense>
          )}
        </TooltipProvider>
      </ThemeProvider>
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
      // App CSS inlined in RootDocument (styles.css?inline) — no <link> here.
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
