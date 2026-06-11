/**
 * Run an *isolated* view transition: only elements that carry their own `viewTransitionName`
 * cross-fade; the rest of the page (app sidebar, header, side panels) is held static by cancelling
 * the global root transition for the duration (see `.vt-isolate-root` in styles.css).
 *
 * Without this, every `document.startViewTransition` also animates the `root` snapshot — the whole
 * viewport minus named elements — so unrelated chrome visibly cross-fades. Use this for localized
 * swaps (editor version switch, share preview tabs). The theme toggle deliberately does NOT use it
 * because it WANTS the full-page root cross-fade.
 *
 * Falls back to a synchronous update when the API is unavailable or the user prefers reduced motion.
 */
export const startScopedViewTransition = (update: () => void): void => {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (typeof document === "undefined" || !document.startViewTransition || reduceMotion) {
    update();
    return;
  }
  const root = document.documentElement;
  root.classList.add("vt-isolate-root");
  const transition = document.startViewTransition(update);
  void transition.finished.finally(() => root.classList.remove("vt-isolate-root"));
};
