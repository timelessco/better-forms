// Platform admins (moderation) are env-listed; org member.role is org-scoped and not reused here.
export const isPlatformAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const raw = process.env.PLATFORM_ADMIN_EMAILS;
  if (!raw) return false;
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
};
