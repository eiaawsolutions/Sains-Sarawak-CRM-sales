/**
 * QUO-VA-003/004: Section Head "Approval Quotation" list.
 *
 * Lists every quotation in Under Vetting (statusId=2) and supports search
 * by quotation number. Role-gated to the vetter set.
 */
import { db, schema } from "@/db";
import { and, desc, eq, ilike } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureBootstrapped } from "@/db/bootstrap";
import { QuotationStatus } from "@/server/quotation-state-machine";

const VETTERS = ["SectionHead", "UnitHead", "Director", "Administrator"] as const;

export default async function ApprovalQuotationListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = session.user.roleCode;
  if (!VETTERS.includes(role as (typeof VETTERS)[number])) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold">Approval Quotation</h1>
        <p className="mt-4 rounded-lg border border-hairline bg-rose-50 p-4 text-sm text-rose-900">
          Access denied. This page is restricted to Section Head, Unit Head, Director, and Administrator roles.
        </p>
      </div>
    );
  }

  await ensureBootstrapped();

  const sp = await searchParams;
  const search = (sp.q ?? "").trim();

  const whereClause = search.length > 0
    ? and(eq(schema.quotations.statusId, QuotationStatus.UnderVetting), ilike(schema.quotations.quotationNo, `%${search}%`))
    : eq(schema.quotations.statusId, QuotationStatus.UnderVetting);

  const rows = await db
    .select({
      id: schema.quotations.id,
      no: schema.quotations.quotationNo,
      revisionLetter: schema.quotations.revisionLetter,
      total: schema.quotations.totalMyr,
      submittedAt: schema.quotations.submittedAt,
      createdAt: schema.quotations.createdAt,
      ownerUserId: schema.quotations.ownerUserId,
      snapOrganizationName: schema.quotations.snapOrganizationName,
    })
    .from(schema.quotations)
    .where(whereClause)
    .orderBy(desc(schema.quotations.submittedAt))
    .limit(200);

  const ownerIds = Array.from(new Set(rows.map(r => r.ownerUserId)));
  const owners = ownerIds.length > 0
    ? await db.select({ id: schema.users.id, name: schema.users.fullName }).from(schema.users)
    : [];
  const ownerName = new Map(owners.map(u => [u.id, u.name]));

  return (
    <div>
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/quotations" className="hover:text-crimson">Quotations</Link>
        <span className="mx-2">/</span>
        <span>Approval Quotation</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Approval Quotation</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Quotations awaiting Section Head vetting (≥ RM10,000). Search by Quotation No, open the record, and click Approve.
        </p>
      </header>

      <form method="GET" action="/quotations/approval" className="mb-6 flex items-end gap-3">
        <div className="flex-1 max-w-md">
          <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Search Quotation No</label>
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="e.g. QUO-2026-0001"
            className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono focus:border-crimson"
          />
        </div>
        <button
          type="submit"
          className="rounded-pill bg-gradient-accent px-5 py-2 text-sm font-semibold text-white shadow-accent-glow"
        >
          Search
        </button>
        {search && (
          <Link
            href="/quotations/approval"
            className="rounded-pill border border-hairline bg-white px-5 py-2 text-sm font-semibold hover:border-crimson hover:text-crimson"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Quotation No</th>
              <th>Revision</th>
              <th>Customer</th>
              <th>Owner</th>
              <th className="text-right">Total (MYR)</th>
              <th>Submitted</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-charcoal-faint">
                  {search ? `No quotations under vetting match "${search}".` : "No quotations awaiting vetting."}
                </td>
              </tr>
            )}
            {rows.map(q => (
              <tr key={q.id}>
                <td className="font-mono text-xs">{q.no}</td>
                <td>{q.revisionLetter}</td>
                <td>{q.snapOrganizationName ?? "—"}</td>
                <td className="text-charcoal-soft">{ownerName.get(q.ownerUserId) ?? "—"}</td>
                <td className="text-right font-semibold">{Number(q.total).toLocaleString()}</td>
                <td className="text-charcoal-soft">{q.submittedAt?.toLocaleDateString() ?? "—"}</td>
                <td>
                  <span className="inline-flex items-center rounded-pill border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-900">
                    Under Vetting
                  </span>
                </td>
                <td>
                  <Link href={`/quotations/${q.id}`} className="text-crimson hover:underline">Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-charcoal-faint">
        Showing up to 200 records. Use search to narrow down.
      </p>
    </div>
  );
}
