import { extractOgDescription } from "@/lib/og/extract-description";

export type FormSnapshotLike = {
  title?: string | null;
  content?: unknown;
  icon?: string | null;
  customization?: unknown;
};

export type ResolvedOgInputs = {
  title: string;
  description: string;
  icon: string | null;
  themeColorName: string | null;
};

/**
 * Canonical resolution for the (title, description, icon, theme) pair that
 * feeds both the URL hash and the rendered OG card. The HTML head and the
 * OG route MUST call this with the same effective snapshot — otherwise the
 * hash baked into the URL won't match the hash the route recomputes.
 *
 * Pass the version-snapshot snapshot if available; otherwise the draft
 * snapshot. Both are tried in order so callers don't have to repeat the
 * fallback at every site.
 */
export const resolveOgInputs = (
  versionSnapshot: FormSnapshotLike | undefined | null,
  draftSnapshot: FormSnapshotLike,
): ResolvedOgInputs => {
  const v = versionSnapshot ?? null;
  // Use `||` so empty-string/null/undefined all collapse identically.
  const title = (v?.title || draftSnapshot.title || "Untitled") as string;
  const content = v?.content ?? draftSnapshot.content;
  const description = extractOgDescription(content);
  const icon = (v?.icon || draftSnapshot.icon || null) as string | null;
  const customization = (v?.customization ?? draftSnapshot.customization) as
    | Record<string, string>
    | null
    | undefined;
  const themeColorName = customization?.themeColor ?? null;
  return { title, description, icon, themeColorName };
};
