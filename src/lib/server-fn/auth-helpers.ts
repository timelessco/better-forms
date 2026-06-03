import { createError } from "@/lib/errors/create";
import type { ErrorCode } from "@/lib/errors/codes";
import type { Session } from "@/lib/auth/auth";

// `activeOrganizationId` is written by the session.create databaseHook (auth.ts) but isn't
// part of Better Auth's inferred Session type, so spell it out as an intersection rather than
// casting the read. `typeof` narrowing (not a cast) turns the unknown into a string.
type SessionWithActiveOrg = Session & {
  session: { activeOrganizationId?: string | null };
};

export const getActiveOrgId = (session: SessionWithActiveOrg): string => {
  const orgId = session.session.activeOrganizationId;
  if (typeof orgId !== "string" || orgId.length === 0) {
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
