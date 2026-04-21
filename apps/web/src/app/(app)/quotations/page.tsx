import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Badge, ButtonLink, EmptyState, PageHeader } from "@/components/ui";

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
      <PageHeader
        title="Quotations"
        description="Draft → Under Vetting → Approved → Quotation Sent → Closed / Rejected. 6-state canonical (FSD §3.2.9)."
        actions={canCreate ? (
          <ButtonLink href="/quotations/new" tone="primary" size="md">+ New quotation</ButtonLink>
        ) : null}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No quotations yet"
          description="Create a quotation from an approved proposal, or start a new one directly."
          action={canCreate ? <ButtonLink href="/quotations/new" tone="primary" size="md">+ New quotation</ButtonLink> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-white">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation No</th>
                <th>Rev</th>
                <th>Status</th>
                <th className="text-right">Total (MYR)</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.id}>
                  <td className="font-mono text-xs text-ink">{q.no}</td>
                  <td className="text-ink-soft">{q.revisionLetter}</td>
                  <td><QuotationStatusBadge statusId={q.statusId} label={name.get(q.statusId) ?? "—"} /></td>
                  <td className="text-right font-semibold tabular-nums text-ink">
                    {Number(q.total).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="text-ink-soft tabular-nums">{q.createdAt?.toLocaleDateString()}</td>
                  <td>
                    <Link href={`/quotations/${q.id}`} className="text-sm font-medium text-accent hover:text-accent-deep transition-colors duration-sains ease-sains">
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

function QuotationStatusBadge({ statusId, label }: { statusId: number; label: string }) {
  // 1=Draft, 2=Under Vetting, 3=Approved, 4=Sent, 5=Closed-Won, 6=Rejected
  switch (statusId) {
    case 1: return <Badge tone="neutral" dot>{label}</Badge>;
    case 2: return <Badge tone="gold"    dot>{label}</Badge>;
    case 3: return <Badge tone="accent"  dot>{label}</Badge>;
    case 4: return <Badge tone="accent"  dot>{label}</Badge>;
    case 5: return <Badge tone="teal"    dot>{label}</Badge>;
    case 6: return <Badge tone="rose"    dot>{label}</Badge>;
    default: return <Badge tone="neutral" dot>{label}</Badge>;
  }
}
