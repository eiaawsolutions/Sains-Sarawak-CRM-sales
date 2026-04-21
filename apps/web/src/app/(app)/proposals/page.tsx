import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";

export default async function ProposalsPage() {
  const session = await auth();
  const role = session?.user.roleCode ?? "Viewer";

  const rows = await db
    .select({
      id: schema.proposals.id,
      proposalNo: schema.proposals.proposalNo,
      subject: schema.proposals.subject,
      statusId: schema.proposals.statusId,
      leadId: schema.proposals.leadId,
      convertedQuotationId: schema.proposals.convertedQuotationId,
      createdAt: schema.proposals.createdAt,
      leadOrg: schema.leads.organizationName,
    })
    .from(schema.proposals)
    .leftJoin(schema.leads, eq(schema.leads.id, schema.proposals.leadId))
    .orderBy(desc(schema.proposals.createdAt))
    .limit(100);

  const statuses = await db.select().from(schema.proposalStatuses);
  const statusName = new Map(statuses.map(s => [s.id, s.name]));

  const canCreate = ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);

  return (
    <div>
      <PageHeader
        title="Proposals"
        description="Pre-quotation discussions. Open → Converted into Quotation (FSD §3.4)."
        actions={canCreate ? (
          <ButtonLink href="/proposals/new" tone="primary" size="md">+ New proposal</ButtonLink>
        ) : null}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No proposals yet"
          description="Proposals are the bridge between an interested lead and a priced quotation."
          action={canCreate ? <ButtonLink href="/proposals/new" tone="primary" size="md">+ New proposal</ButtonLink> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>Proposal No</th>
                <th>Subject</th>
                <th>Lead</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-ink">{p.proposalNo}</td>
                  <td className="font-medium text-ink">{p.subject}</td>
                  <td className="text-ink-soft">{p.leadOrg ?? "—"}</td>
                  <td>
                    {p.statusId === 2
                      ? <Badge tone="teal" dot>{statusName.get(p.statusId) ?? "Converted"}</Badge>
                      : <Badge tone="neutral" dot>{statusName.get(p.statusId) ?? "Open"}</Badge>}
                  </td>
                  <td className="text-ink-soft tabular-nums">{p.createdAt?.toLocaleDateString()}</td>
                  <td>
                    <Link href={`/proposals/${p.id}`} className="text-sm font-medium text-accent hover:text-accent-deep transition-colors duration-sains ease-sains">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
