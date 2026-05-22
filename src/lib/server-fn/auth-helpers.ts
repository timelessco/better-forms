import { createError } from "@/lib/errors/create";
import type { ErrorCode } from "@/lib/errors/codes";

export const getActiveOrgId = (session: { session: Record<string, unknown> }): string => {
  const orgId = session.session.activeOrganizationId as string | undefined;
  if (!orgId) {
    throw createError({
      code: "auth/no-org" satisfies ErrorCode,
      // 403 (not 401): the user IS authenticated — they just lack an active
      // org. Returning 401 would trigger re-login flows in clients that
      // auto-redirect on Unauthorized, signing the user out unnecessarily.
      status: 403,
      message: "No active organization",
      why: "Session has no activeOrganizationId — user isn't attached to an org",
      fix: "Select or create an organization",
    });
  }
  return orgId;
};
