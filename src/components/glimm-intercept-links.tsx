import { useMountEffect } from "@/hooks/use-mount-effect";
import { useNavigate } from "@tanstack/react-router";
import { useGlimm } from "glimm/react";
import type { SweepOptions } from "glimm/react";

// TanStack-native port of glimm's `InterceptLinks` (glimm/next is unusable here:
// it top-level-imports next/link + next/navigation). Same default skip rules,
// but routes through TanStack Router's navigate({ href }) instead of next router.

type InterceptLinksProps = {
  /** Sweep overrides applied to every intercepted nav. */
  sweep?: SweepOptions;
};

// Mirrors glimm's defaultShouldIntercept: bail on modifier/non-primary clicks,
// data-glimm-skip, new-tab/download anchors, cross-origin, and same-page hashes.
const shouldIntercept = (e: MouseEvent, a: HTMLAnchorElement) => {
  if (e.defaultPrevented) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (e.button !== 0) return false;
  if (a.dataset.glimmSkip !== undefined) return false;
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  if (!a.href) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.hash) return false;
  return true;
};

/**
 * Drop once at the root (inside GlimmProvider). Delegates a document click
 * listener that plays a glimm sweep around every internal link nav. Opt a
 * link out with `data-glimm-skip`.
 */
export const InterceptLinks = ({ sweep: sweepOpts }: InterceptLinksProps): null => {
  const { sweep } = useGlimm();
  const navigate = useNavigate();

  useMountEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor || !shouldIntercept(e, anchor)) return;
      const url = new URL(anchor.href, window.location.href);
      e.preventDefault();
      // sweep awaits navigate at its midpoint, then plays the outro.
      sweep(() => navigate({ href: url.pathname + url.search + url.hash }), sweepOpts);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  });

  return null;
};
