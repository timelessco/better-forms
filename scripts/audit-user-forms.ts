/**
 * Audit a user's form-listing surface.
 *
 * Replicates the exact `getFormListings` query and breaks it down by
 * organization, workspace, and status — so you can verify whether the
 * "72 forms in cache vs ~22 in sidebar" gap is from cross-org leak,
 * archived forms, or something else.
 *
 * Usage: bun scripts/audit-user-forms.ts <email>
 *   e.g. bun scripts/audit-user-forms.ts hello@timeless.co
 */
import { and, count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { forms, member, organization, user, workspaces } from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: bun scripts/audit-user-forms.ts <email>");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

const hr = (label: string) => {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
};

// 1. Resolve user
hr(`User lookup: ${email}`);
const [u] = await db.select().from(user).where(eq(user.email, email));
if (!u) {
  console.error(`No user found for ${email}`);
  process.exit(1);
}
console.log({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });

// 2. Org memberships
hr("Organizations this user is a member of");
const memberships = await db
  .select({
    orgId: organization.id,
    orgName: organization.name,
    orgPlan: organization.plan,
    role: member.role,
    joinedAt: member.createdAt,
  })
  .from(member)
  .innerJoin(organization, eq(organization.id, member.organizationId))
  .where(eq(member.userId, u.id))
  .orderBy(member.createdAt);
console.table(memberships);

// 3. Form counts per org and per status
hr("Forms per (org, status)");
const perOrgStatus = await db
  .select({
    orgId: organization.id,
    orgName: organization.name,
    status: forms.status,
    cnt: sql<number>`count(*)`,
  })
  .from(forms)
  .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
  .innerJoin(organization, eq(workspaces.organizationId, organization.id))
  .innerJoin(member, eq(member.organizationId, organization.id))
  .where(eq(member.userId, u.id))
  .groupBy(organization.id, organization.name, forms.status)
  .orderBy(organization.name, forms.status);
console.table(perOrgStatus);

// 4. Replicate the EXACT getFormListings WHERE clause (post-cleanup: excludes archived).
hr("Exact replica of getFormListings(): row count + breakdown");
const listingRows = await db
  .select({
    id: forms.id,
    title: forms.title,
    status: forms.status,
    workspaceId: forms.workspaceId,
    orgId: workspaces.organizationId,
    orgName: organization.name,
  })
  .from(forms)
  .innerJoin(workspaces, eq(forms.workspaceId, workspaces.id))
  .innerJoin(member, eq(workspaces.organizationId, member.organizationId))
  .innerJoin(organization, eq(organization.id, workspaces.organizationId))
  .where(and(eq(member.userId, u.id), sql`${forms.status} <> 'archived'`));

console.log(`\nTotal rows getFormListings would return: ${listingRows.length}`);

const byOrg = new Map<string, { name: string; count: number; statuses: Record<string, number> }>();
for (const row of listingRows) {
  const cur = byOrg.get(row.orgId) ?? { name: row.orgName, count: 0, statuses: {} };
  cur.count += 1;
  cur.statuses[row.status] = (cur.statuses[row.status] ?? 0) + 1;
  byOrg.set(row.orgId, cur);
}
console.log("\nBy organization:");
for (const [orgId, info] of byOrg) {
  console.log(
    `  ${info.name.padEnd(30)} (${orgId.slice(0, 8)}…)  total=${info.count}  ${JSON.stringify(info.statuses)}`,
  );
}

// 5. Active-org sidebar simulation
hr("Sidebar simulation (active org × draft|published only)");
console.log("If activeOrgId is each of the orgs above, this is what would render in the sidebar:");
for (const info of byOrg.values()) {
  const visible = (info.statuses.draft ?? 0) + (info.statuses.published ?? 0);
  const archived = info.statuses.archived ?? 0;
  console.log(
    `  ${info.name.padEnd(30)} sidebar=${visible}  archived(hidden)=${archived}  total=${info.count}`,
  );
}

// 6. Are there duplicate joins inflating counts?
// `getFormListings` uses .innerJoin(member ...) which can multiply rows if a
// user is in member rows for the SAME org more than once. Sanity-check that.
hr("Sanity: duplicate member rows for this user?");
const dupes = await db
  .select({
    orgId: member.organizationId,
    cnt: count(),
  })
  .from(member)
  .where(eq(member.userId, u.id))
  .groupBy(member.organizationId)
  .having(sql`count(*) > 1`);
if (dupes.length === 0) {
  console.log("No duplicate member rows. (good — listing count is not inflated.)");
} else {
  console.log("WARNING: duplicate member rows detected — listing rows may be multiplied:");
  console.table(dupes);
}

console.log("\nDone.");
process.exit(0);
