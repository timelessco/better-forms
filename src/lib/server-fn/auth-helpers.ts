import { createError } from "@/lib/errors/create";
import type { ErrorCode } from "@/lib/errors/codes";

export const getActiveOrgId = (session: { session: Record<string, unknown> }): string => {
  const orgId = session.session.activeOrganizationId as string | undefined;
  if (!orgId) {
    throw createError({
      code: "auth/no-org" satisfies ErrorCode,
      // 403 not 401: user IS authenticated, just lacks an active org. 401 would trigger
      // auto-redirect re-login flows and sign them out unnecessarily.
      status: 403,
      message: "No active organization",
      why: "Session has no activeOrganizationId — user isn't attached to an org",
      fix: "Select or create an organization",
    });
  }
  return orgId;
};
