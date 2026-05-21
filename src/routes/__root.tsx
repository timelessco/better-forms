import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import Loader from "@/components/ui/loader";
import { NotFound } from "@/components/ui/not-found";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from "@/lib/auth/auth";
import { seo } from "@/lib/seo";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
// `?inline` returns the bundled, hashed CSS as a string at build time.
// We inject it ourselves via a single <style> in RootDocument so we have
// full control over the head — specifically, NO `<link rel="stylesheet">`
// gets emitted via HeadContent's manifest path. Side-effect imports
// + `server.build.inlineCss: true` produced BOTH an inline style and
// a render-blocking link for the same content (Lighthouse flagged 70ms
// savings); this path emits inline only.
import styles from "../styles/styles.css?inline";

// Lazy: sonner is ~14 kB gz and the public form never fires a toast.
// Static `import { toast } from "sonner"` calls still pull sonner into
// their own route chunks (auth/login/builder) — lazying the Toaster
// MOUNT just keeps the library out of the root entry chunk, which
// loads on every page.
const Toaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

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

const APP_STYLE_PROP = { __html: styles } as const;

const RootDocument = ({ children }: { children: React.ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <head>
      {/* App CSS — bundled CSS string from `styles.css?inline` (build-time,
          not user input). Single source of truth so HeadContent doesn't
          also emit a render-blocking <link> for the same content. */}
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
      <HotkeysProvider defaultOptions={{ hotkey: { preventDefault: true } }}>
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
      // App CSS is inlined into RootDocument (see `styles.css?inline` above);
      // no <link rel="stylesheet"> needed here.
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
