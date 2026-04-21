import { db, schema } from "@/db";
import { desc, asc, inArray, eq, and } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Alert, Badge, Button, ButtonLink, Card, EmptyState, Field, PageHeader, Select,
} from "@/components/ui";

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
      <PageHeader
        title="Leads"
        description="Business opportunities flowing through the Lead → Proposal → Quotation → Customer pipeline."
        actions={canCreate ? (
          <ButtonLink href="/leads/new" tone="primary" size="md">
            + New lead
          </ButtonLink>
        ) : null}
      />

      {sp.reassigned === "1" && (
        <div className="mb-4">
          <Alert tone="success">
            {sp.count ?? "1"} lead(s) re-assigned successfully.
          </Alert>
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
            canCreate={canCreate}
          />
        </form>
      ) : (
        <LeadsTable
          leads={leads}
          statusName={statusName}
          ownerName={ownerName}
          canReassign={false}
          canCreate={canCreate}
        />
      )}
    </div>
  );
}

function BulkActionBar({ assignees }: { assignees: { id: string; fullName: string }[] }) {
  return (
    <Card className="mb-4" padded>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1 max-w-sm">
          <Field label="Re-assign selected leads" htmlFor="newOwnerUserId">
            <Select id="newOwnerUserId" name="newOwnerUserId" required>
              <option value="">— Select Account Manager —</option>
              {assignees.map(a => <option key={a.id} value={a.id}>{a.fullName}</option>)}
            </Select>
          </Field>
        </div>
        <Button type="submit" tone="primary" size="md">
          Re-assign
        </Button>
        <p className="text-[11px] text-ink-faint">
          Tick leads below, pick a user, then re-assign.
        </p>
      </div>
    </Card>
  );
}

function LeadsTable({
  leads, statusName, ownerName, canReassign, canCreate,
}: {
  leads: Array<{ id: string; organizationName: string; primaryContactName: string | null; statusId: number; source: string | null; createdAt: Date | null; ownerUserId: string }>;
  statusName: Map<number, string>;
  ownerName: Map<string, string>;
  canReassign: boolean;
  canCreate: boolean;
}) {
  if (leads.length === 0) {
    return (
      <EmptyState
        title="No leads yet"
        description="Leads will appear here as account managers capture opportunities or as CMD forwards them to the pipeline."
        action={canCreate ? <ButtonLink href="/leads/new" tone="primary" size="md">+ New lead</ButtonLink> : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-hairline bg-white">
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
          {leads.map(l => (
            <tr key={l.id}>
              {canReassign && (
                <td>
                  <input
                    type="checkbox"
                    name="leadId"
                    value={l.id}
                    className="h-4 w-4 rounded border-hairline2 accent-accent"
                  />
                </td>
              )}
              <td className="font-medium text-ink">{l.organizationName}</td>
              <td className="text-ink-soft">{l.primaryContactName ?? "—"}</td>
              <td className="text-ink-soft">{ownerName.get(l.ownerUserId) ?? "—"}</td>
              <td className="text-ink-soft">{l.source ?? "—"}</td>
              <td><StatusBadge status={statusName.get(l.statusId) ?? "—"} /></td>
              <td className="text-ink-soft tabular-nums">{l.createdAt?.toLocaleDateString()}</td>
              <td>
                <Link href={`/leads/${l.id}`} className="text-sm font-medium text-accent hover:text-accent-deep transition-colors duration-sains ease-sains">
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s.includes("won") || s.includes("customer"))        return <Badge tone="teal" dot>{status}</Badge>;
  if (s.includes("lost") || s.includes("reject") || s.includes("close")) return <Badge tone="rose" dot>{status}</Badge>;
  if (s.includes("propos") || s.includes("quot"))         return <Badge tone="accent" dot>{status}</Badge>;
  if (s.includes("qual") || s.includes("review") || s.includes("hold")) return <Badge tone="gold" dot>{status}</Badge>;
  return <Badge tone="neutral" dot>{status}</Badge>;
}
