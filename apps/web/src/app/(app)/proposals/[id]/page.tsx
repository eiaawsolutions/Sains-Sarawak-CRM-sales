import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Proposal detail + "Convert to Quotation" (FSD §3.4.3 Step 3). On convert:
 *  - Proposal status becomes 2 (Converted into Quotation)
 *  - A new Draft quotation is created linked to the proposal + lead
 *  - Proposal becomes read-only
 */
export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
  if (!proposal) notFound();

  const lead = proposal.leadId
    ? await db.query.leads.findFirst({ where: eq(schema.leads.id, proposal.leadId) })
    : null;
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, proposal.ownerUserId) });
  const status = await db.query.proposalStatuses.findFirst({ where: eq(schema.proposalStatuses.id, proposal.statusId) });
  const converted = proposal.statusId === 2;

  const linkedQuotation = proposal.convertedQuotationId
    ? await db.query.quotations.findFirst({ where: eq(schema.quotations.id, proposal.convertedQuotationId) })
    : null;

  const role = session.user.roleCode;
  const canConvert = !converted && ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);

  async function convertToQuotation() {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");

    const prop = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
    if (!prop || prop.statusId === 2) throw new Error("Proposal already converted or missing");

    const ld = prop.leadId ? await db.query.leads.findFirst({ where: eq(schema.leads.id, prop.leadId) }) : null;
    const account = ld?.accountId
      ? await db.query.accounts.findFirst({ where: eq(schema.accounts.id, ld.accountId) })
      : null;

    const now = new Date();
    const yr = now.getFullYear();
    const ts = now.getTime().toString().slice(-7);
    const quotationNo = `QTN-${yr}-${ts}`;

    const newQuoteId = crypto.randomUUID();
    await db.insert(schema.quotations).values({
      id: newQuoteId,
      quotationNo,
      rootQuotationId: newQuoteId,
      parentQuotationId: null,
      revisionLetter: "a",
      accountId: account?.id ?? null,
      leadId: prop.leadId,
      proposalId: prop.id,
      ownerUserId: s.user.id,
      statusId: 1,
      typeId: 1,
      sourceOfFundId: null,
      subject: prop.subject,
      note: prop.note,
      snapOrganizationName: account?.organizationName ?? ld?.organizationName ?? null,
      snapLine1: account?.line1 ?? null,
      snapLine2: account?.line2 ?? null,
      snapLine3: account?.line3 ?? null,
      snapCity: account?.city ?? null,
      snapPostcode: account?.postcode ?? null,
      snapStateCode: account?.stateCode ?? null,
      snapCountryCode: account?.countryCode ?? "MY",
      snapPhone: account?.officePhone ?? null,
      snapFax: account?.fax ?? null,
      ownerDepartmentId: s.user.departmentId ?? null,
      ownerSectionId: s.user.sectionId ?? null,
    });

    await db.update(schema.proposals)
      .set({ statusId: 2, convertedQuotationId: newQuoteId, updatedAt: new Date() })
      .where(eq(schema.proposals.id, id));

    redirect(`/quotations`);
  }

  return (
    <div className="max-w-4xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/proposals" className="hover:text-crimson">Proposals</Link>
        <span className="mx-2">/</span>
        <span>{proposal.proposalNo}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{proposal.subject}</h1>
          <p className="mt-1 font-mono text-sm text-charcoal-soft">{proposal.proposalNo}</p>
        </div>
        <span className={`rounded-pill border px-3 py-1 text-xs font-semibold ${converted ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-gray-100 border-hairline"}`}>
          {status?.name ?? "?"}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Details</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Linked Lead" v={lead ? <Link href={`/leads/${lead.id}`} className="text-crimson hover:underline">{lead.organizationName}</Link> : "—"} />
            <Row k="Owner" v={owner?.fullName ?? "—"} />
            <Row k="Created" v={proposal.createdAt?.toLocaleString()} />
            <Row k="Updated" v={proposal.updatedAt?.toLocaleString()} />
            {linkedQuotation && (
              <Row k="Converted Quotation" v={<Link href={`/quotations/${linkedQuotation.id}`} className="text-crimson hover:underline font-mono text-xs">{linkedQuotation.quotationNo}</Link>} />
            )}
          </dl>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-charcoal">{proposal.note ?? <span className="text-charcoal-faint">(no notes)</span>}</p>
        </section>
      </div>

      {canConvert && (
        <div className="mt-6 rounded-lg border border-hairline bg-white p-5 shadow-claritas-1">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Convert to Quotation</h2>
              <p className="mt-1 text-sm text-charcoal-soft">FSD §3.4.3 step 3 — creates a new Draft quotation and marks this proposal read-only.</p>
            </div>
            <form action={convertToQuotation}>
              <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
                Convert →
              </button>
            </form>
          </div>
        </div>
      )}

      {converted && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          This proposal has been converted and is read-only.
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-charcoal-soft">{k}</dt>
      <dd className="flex-1 text-charcoal">{v ?? "—"}</dd>
    </div>
  );
}
