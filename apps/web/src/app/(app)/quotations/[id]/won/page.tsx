import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { QuotationStatus } from "@/server/quotation-state-machine";
import { closeWonQuotation } from "@/server/quotation-actions";
import { WonAttachmentForm } from "./won-form";

export default async function QuotationWonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) notFound();

  const ownerOrAdmin = q.ownerUserId === session.user.id || session.user.roleCode === "Administrator";
  if (!ownerOrAdmin) redirect(`/quotations/${id}`);
  if (q.statusId !== QuotationStatus.QuotationSent) redirect(`/quotations/${id}`);

  return (
    <div className="max-w-3xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/quotations" className="hover:text-crimson">Quotations</Link>
        <span className="mx-2">/</span>
        <Link href={`/quotations/${id}`} className="hover:text-crimson font-mono">{q.quotationNo}</Link>
        <span className="mx-2">/</span>
        <span>Close Won</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Quotation WON</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Upload proof-of-acceptance (WOT / AOQ / LOA). At least one file is required, maximum five.
        </p>
      </header>

      <section className="rounded-lg border border-hairline bg-white p-6 shadow-claritas-1">
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-charcoal-soft">Quotation</div>
            <div className="font-mono">{q.quotationNo}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-charcoal-soft">Status</div>
            <select
              disabled
              value="closed_won"
              className="mt-1 w-full rounded-md border border-hairline bg-neutral-50 px-3 py-2 text-sm font-semibold text-emerald-800"
            >
              <option value="closed_won">Closed Won</option>
            </select>
            <p className="mt-1 text-xs text-charcoal-faint">Auto-selected on this page.</p>
          </div>
        </div>

        <WonAttachmentForm quotationId={q.id} action={closeWonQuotation} />
      </section>
    </div>
  );
}
