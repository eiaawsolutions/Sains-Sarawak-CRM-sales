import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function QuotationsPage() {
  const session = await auth();
  const role = session?.user.roleCode ?? "Viewer";

  const rows = await db
    .select({
      id: schema.quotations.id,
      no: schema.quotations.quotationNo,
      statusId: schema.quotations.statusId,
      total: schema.quotations.totalMyr,
      revisionLetter: schema.quotations.revisionLetter,
      createdAt: schema.quotations.createdAt,
    })
    .from(schema.quotations)
    .orderBy(desc(schema.quotations.createdAt))
    .limit(100);

  const statuses = await db.select().from(schema.quotationStatuses);
  const name = new Map(statuses.map(s => [s.id, s.name]));

  const canCreate = ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Quotations</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Draft → Under Vetting → Approved → Quotation Sent → Closed / Rejected. 6-state canonical (FSD §3.2.9).
          </p>
        </div>
        {canCreate && (
          <Link href="/quotations/new" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
            + New quotation
          </Link>
        )}
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quotation No</th>
              <th>Revision</th>
              <th>Status</th>
              <th className="text-right">Total (MYR)</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-charcoal-faint">No quotations yet.</td></tr>
            )}
            {rows.map(q => (
              <tr key={q.id}>
                <td className="font-mono text-xs">{q.no}</td>
                <td>{q.revisionLetter}</td>
                <td><StatusPill statusId={q.statusId} name={name.get(q.statusId) ?? "?"} /></td>
                <td className="text-right font-semibold">{Number(q.total).toLocaleString()}</td>
                <td className="text-charcoal-soft">{q.createdAt?.toLocaleDateString()}</td>
                <td><Link href={`/quotations/${q.id}`} className="text-crimson hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ statusId, name }: { statusId: number; name: string }) {
  const bg =
    statusId === 1 ? "bg-gray-100 text-charcoal" :
    statusId === 2 ? "bg-orange-50 text-orange-900 border-orange-200" :
    statusId === 3 ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
    statusId === 4 ? "bg-crimson-faint text-crimson border-crimson/20" :
    statusId === 5 ? "bg-gradient-accent text-white" :
    "bg-charcoal text-white";
  return <span className={`inline-flex items-center rounded-pill border border-hairline px-2.5 py-0.5 text-xs font-semibold ${bg}`}>{name}</span>;
}
