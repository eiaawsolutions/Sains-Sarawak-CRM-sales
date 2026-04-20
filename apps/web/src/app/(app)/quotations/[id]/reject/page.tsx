import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { QuotationStatus } from "@/server/quotation-state-machine";
import { rejectQuotation } from "@/server/quotation-actions";
import { RejectForm } from "./reject-form";

export default async function QuotationRejectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) notFound();

  const ownerOrAdmin = q.ownerUserId === session.user.id || session.user.roleCode === "Administrator";
  if (!ownerOrAdmin) redirect(`/quotations/${id}`);
  if (q.statusId !== QuotationStatus.QuotationSent) redirect(`/quotations/${id}`);

  const reasons = await db
    .select()
    .from(schema.rejectionReasons)
    .where(eq(schema.rejectionReasons.isActive, true))
    .orderBy(asc(schema.rejectionReasons.sortOrder));

  return (
    <div className="max-w-2xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/quotations" className="hover:text-crimson">Quotations</Link>
        <span className="mx-2">/</span>
        <Link href={`/quotations/${id}`} className="hover:text-crimson font-mono">{q.quotationNo}</Link>
        <span className="mx-2">/</span>
        <span>Reject</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Reject Quotation</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Select a rejection outcome and record a remark. This action is terminal.
        </p>
      </header>

      <section className="rounded-lg border border-hairline bg-white p-6 shadow-claritas-1">
        <RejectForm
          quotationId={q.id}
          reasons={reasons.map(r => ({ id: r.id, name: r.name, requiresText: r.requiresText }))}
          action={rejectQuotation}
        />
      </section>
    </div>
  );
}
