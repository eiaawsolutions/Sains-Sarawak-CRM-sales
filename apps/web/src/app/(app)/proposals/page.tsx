import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";

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
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Proposals</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Pre-quotation discussions. Open → Converted into Quotation (FSD §3.4).
          </p>
        </div>
        {canCreate && (
          <Link
            href="/proposals/new"
            className="inline-flex items-center gap-2 rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow"
          >
            + New proposal
          </Link>
        )}
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
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
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-charcoal-faint">No proposals yet.</td></tr>
            )}
            {rows.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.proposalNo}</td>
                <td className="font-medium">{p.subject}</td>
                <td>{p.leadOrg ?? "—"}</td>
                <td>
                  <Pill converted={p.statusId === 2}>
                    {statusName.get(p.statusId) ?? "?"}
                  </Pill>
                </td>
                <td className="text-charcoal-soft">{p.createdAt?.toLocaleDateString()}</td>
                <td><Link href={`/proposals/${p.id}`} className="text-crimson hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ children, converted }: { children: React.ReactNode; converted?: boolean }) {
  const bg = converted ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-gray-100 text-charcoal";
  return <span className={`inline-flex items-center rounded-pill border border-hairline px-2.5 py-0.5 text-xs font-semibold ${bg}`}>{children}</span>;
}
