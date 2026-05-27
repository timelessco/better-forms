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

/** Canonical (title, description, icon, theme) feeding the URL hash + OG card.
 * HTML head and OG route MUST call this identically or the URL hash won't match
 * the route's recompute. Tries version snapshot then draft. */
export const resolveOgInputs = (
  versionSnapshot: FormSnapshotLike | undefined | null,
  draftSnapshot: FormSnapshotLike,
): ResolvedOgInputs => {
  const v = versionSnapshot ?? null;
  // `||` so ""/null/undefined all collapse identically.
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
