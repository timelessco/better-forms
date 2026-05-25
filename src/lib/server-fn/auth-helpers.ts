export const getActiveOrgId = (session: { session: Record<string, unknown> }): string => {
  const orgId = session.session.activeOrganizationId as string | undefined;
  if (!orgId) throw new Error("No active organization");
  return orgId;
};
