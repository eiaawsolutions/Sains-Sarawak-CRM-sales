import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) notFound();

  const lines = await db
    .select()
    .from(schema.quotationLines)
    .where(eq(schema.quotationLines.quotationId, id))
    .orderBy(asc(schema.quotationLines.lineOrder));

  const status = await db.query.quotationStatuses.findFirst({ where: eq(schema.quotationStatuses.id, q.statusId) });
  const type = await db.query.quotationTypes.findFirst({ where: eq(schema.quotationTypes.id, q.typeId) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, q.ownerUserId) });

  return (
    <div className="max-w-5xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/quotations" className="hover:text-crimson">Quotations</Link>
        <span className="mx-2">/</span>
        <span className="font-mono">{q.quotationNo}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{q.subject ?? "(no subject)"}</h1>
          <p className="mt-1 font-mono text-sm text-charcoal-soft">
            {q.quotationNo}  ·  Rev {q.revisionLetter}  ·  {type?.name}  ·  Owner {owner?.fullName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-pill border border-hairline bg-white px-3 py-1 text-xs font-semibold">
            {status?.name ?? "?"}
          </span>
          <a
            href={`/api/quotations/${q.id}/pdf`}
            className="rounded-pill bg-gradient-accent px-5 py-2.5 font-semibold text-white shadow-accent-glow"
          >
            Download PDF
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Billed to</h2>
          <address className="not-italic text-sm">
            <div className="font-medium">{q.snapOrganizationName ?? "—"}</div>
            {q.snapLine1 && <div>{q.snapLine1}</div>}
            {q.snapLine2 && <div>{q.snapLine2}</div>}
            {q.snapLine3 && <div>{q.snapLine3}</div>}
            <div>{[q.snapCity, q.snapPostcode].filter(Boolean).join(" ")}</div>
            <div>{[q.snapStateCode, q.snapCountryCode].filter(Boolean).join(", ")}</div>
            {q.snapPhone && <div className="text-xs text-charcoal-soft">Phone: {q.snapPhone}</div>}
          </address>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Workflow</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Submitted" v={q.submittedAt?.toLocaleString()} />
            <Row k="Approved" v={q.approvedAt?.toLocaleString()} />
            <Row k="Sent" v={q.sentAt?.toLocaleString()} />
            <Row k="Closed" v={q.closedAt?.toLocaleString()} />
            <Row k="Returned" v={q.returnedAt?.toLocaleString()} />
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
        <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Line items</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit (MYR)</th>
              <th className="text-right">Tax %</th>
              <th className="text-right">Amount (MYR)</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-charcoal-faint">No line items</td></tr>
            )}
            {lines.map((l, i) => {
              const qty = Number(l.quantity);
              const price = Number(l.unitPriceMyr);
              const disc = Number(l.discountAmountMyr);
              const amt = qty * price - disc;
              return (
                <tr key={l.id}>
                  <td className="text-charcoal-soft">{i + 1}</td>
                  <td>{l.description}{l.isOptional ? <span className="ml-2 text-xs text-charcoal-faint">(optional)</span> : ""}</td>
                  <td className="text-right">{qty}</td>
                  <td className="text-right">{price.toLocaleString()}</td>
                  <td className="text-right">{Number(l.taxPct).toFixed(2)}</td>
                  <td className="text-right font-semibold">{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} className="text-right text-charcoal-soft">Subtotal</td><td className="text-right font-semibold">{Number(q.subtotalMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colSpan={5} className="text-right text-charcoal-soft">Discount</td><td className="text-right font-semibold">{Number(q.discountMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colSpan={5} className="text-right text-charcoal-soft">Tax</td><td className="text-right font-semibold">{Number(q.taxMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colSpan={5} className="text-right font-semibold text-crimson">Total (MYR)</td><td className="text-right font-bold text-crimson">{Number(q.totalMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
          </tfoot>
        </table>
      </section>

      {q.note && (
        <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{q.note}</p>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-charcoal-soft">{k}</dt>
      <dd className="flex-1 text-charcoal">{v ?? "—"}</dd>
    </div>
  );
}
