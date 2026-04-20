import { db, schema } from "@/db";
import { desc, asc, inArray, eq, and } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Leads list (FSD §3.3). For Supervisor / Section Head / UnitHead / Administrator, each row
 * carries a checkbox so multiple leads can be re-assigned in a single action (LEAD-023..027).
 * Account Managers see the list read-only minus the bulk column.
 */
export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<{ reassigned?: string; count?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = session.user.roleCode;
  const sp = await searchParams;

  const leads = await db
    .select({
      id: schema.leads.id,
      organizationName: schema.leads.organizationName,
      primaryContactName: schema.leads.primaryContactName,
      statusId: schema.leads.statusId,
      source: schema.leads.source,
      createdAt: schema.leads.createdAt,
      ownerUserId: schema.leads.ownerUserId,
    })
    .from(schema.leads)
    .orderBy(desc(schema.leads.createdAt))
    .limit(100);

  const statuses = await db.select().from(schema.leadStatuses);
  const statusName = new Map(statuses.map(s => [s.id, s.name]));

  const owners = await db
    .select({ id: schema.users.id, fullName: schema.users.fullName })
    .from(schema.users);
  const ownerName = new Map(owners.map(o => [o.id, o.fullName]));

  const canCreate = ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);
  const canReassign = ["UnitHead", "SectionHead", "Administrator"].includes(role);

  const assignees = canReassign
    ? await db
        .select({ id: schema.users.id, fullName: schema.users.fullName })
        .from(schema.users)
        .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
        .where(and(eq(schema.users.isActive, true), inArray(schema.roles.code, ["AccountManager", "UnitHead"])))
        .orderBy(asc(schema.users.fullName))
    : [];

  async function bulkReassign(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");
    if (!["UnitHead", "SectionHead", "Administrator"].includes(s.user.roleCode)) throw new Error("forbidden");

    const ids = formData.getAll("leadId").map(String).filter(Boolean);
    const newOwnerId = String(formData.get("newOwnerUserId") ?? "").trim();
    if (!newOwnerId || ids.length === 0) redirect("/leads?reassigned=0");

    const newOwner = await db.query.users.findFirst({ where: eq(schema.users.id, newOwnerId) });
    if (!newOwner) throw new Error("invalid_owner");

    await db.update(schema.leads)
      .set({
        ownerUserId: newOwner.id,
        ownerDepartmentId: newOwner.departmentId ?? null,
        ownerSectionId: newOwner.sectionId ?? null,
        updatedAt: new Date(),
      })
      .where(inArray(schema.leads.id, ids));

    redirect(`/leads?reassigned=1&count=${ids.length}`);
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Business opportunities. Lead → Proposal → Quotation → Customer.</p>
        </div>
        {canCreate && (
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow"
          >
            + New lead
          </Link>
        )}
      </header>

      {sp.reassigned === "1" && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {sp.count ?? "1"} lead(s) re-assigned successfully.
        </div>
      )}

      {canReassign ? (
        <form action={bulkReassign}>
          <BulkActionBar assignees={assignees} />
          <LeadsTable
            leads={leads}
            statusName={statusName}
            ownerName={ownerName}
            canReassign={canReassign}
          />
        </form>
      ) : (
        <LeadsTable
          leads={leads}
          statusName={statusName}
          ownerName={ownerName}
          canReassign={false}
        />
      )}
    </div>
  );
}

function BulkActionBar({ assignees }: { assignees: { id: string; fullName: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-hairline bg-white p-4 shadow-claritas-1">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Re-Assignment — select user</label>
        <select
          name="newOwnerUserId"
          required
          className="rounded-md border border-hairline bg-white px-3 py-2 text-sm min-w-[240px]"
        >
          <option value="">— Select Account Manager —</option>
          {assignees.map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-pill bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-white shadow-accent-glow"
      >
        Action · Re-Assignment
      </button>
      <p className="text-xs text-charcoal-faint">Tick leads below, pick a user, click Action.</p>
    </div>
  );
}

function LeadsTable({
  leads, statusName, ownerName, canReassign,
}: {
  leads: Array<{ id: string; organizationName: string; primaryContactName: string | null; statusId: number; source: string | null; createdAt: Date | null; ownerUserId: string }>;
  statusName: Map<number, string>;
  ownerName: Map<string, string>;
  canReassign: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
      <table className="data-table">
        <thead>
          <tr>
            {canReassign && <th style={{ width: "40px" }}></th>}
            <th>Organization</th>
            <th>Primary contact</th>
            <th>Owner</th>
            <th>Source</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={canReassign ? 8 : 7} className="py-12 text-center text-charcoal-faint">No leads yet.</td></tr>
          )}
          {leads.map(l => (
            <tr key={l.id}>
              {canReassign && (
                <td><input type="checkbox" name="leadId" value={l.id} className="h-4 w-4 rounded border-hairline accent-crimson" /></td>
              )}
              <td className="font-medium">{l.organizationName}</td>
              <td>{l.primaryContactName ?? "—"}</td>
              <td className="text-charcoal-soft">{ownerName.get(l.ownerUserId) ?? "—"}</td>
              <td>{l.source ?? "—"}</td>
              <td><Pill>{statusName.get(l.statusId) ?? "?"}</Pill></td>
              <td className="text-charcoal-soft">{l.createdAt?.toLocaleDateString()}</td>
              <td><Link href={`/leads/${l.id}`} className="text-crimson hover:underline">Open →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-pill border border-hairline bg-white px-2.5 py-0.5 text-xs font-semibold">{children}</span>;
}
