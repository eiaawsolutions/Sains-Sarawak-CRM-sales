import { db, schema } from "@/db";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Proposal detail — two linkage paths:
 *  1. Convert → creates a NEW Draft quotation tied to this proposal + flips proposal to Converted.
 *  2. Link existing → attaches an existing unlinked quotation (same lead or same account) to this proposal.
 * N:1 is supported via quotations.proposalId FK; the subpanel lists every quotation whose proposalId
 * matches. The convertedQuotationId column is kept in sync with the first/primary linkage.
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

  const linkedQuotations = await db
    .select({
      id: schema.quotations.id,
      quotationNo: schema.quotations.quotationNo,
      statusId: schema.quotations.statusId,
      totalMyr: schema.quotations.totalMyr,
      subject: schema.quotations.subject,
    })
    .from(schema.quotations)
    .where(eq(schema.quotations.proposalId, proposal.id))
    .orderBy(asc(schema.quotations.createdAt));

  const qStatuses = await db.select().from(schema.quotationStatuses);
  const qStatusName = new Map(qStatuses.map(s => [s.id, s.name]));

  const linkable = !converted
    ? await db
        .select({
          id: schema.quotations.id,
          quotationNo: schema.quotations.quotationNo,
          subject: schema.quotations.subject,
          statusId: schema.quotations.statusId,
          totalMyr: schema.quotations.totalMyr,
        })
        .from(schema.quotations)
        .where(
          and(
            isNull(schema.quotations.proposalId),
            or(
              lead?.id ? eq(schema.quotations.leadId, lead.id) : undefined,
              lead?.accountId ? eq(schema.quotations.accountId, lead.accountId) : undefined,
            ),
          ),
        )
        .orderBy(asc(schema.quotations.createdAt))
        .limit(50)
    : [];

  const role = session.user.roleCode;
  const canConvert = !converted && ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);
  const canLink = canConvert;

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

  async function linkExistingQuotation(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");
    if (!["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(s.user.roleCode)) {
      throw new Error("forbidden");
    }

    const quotationId = String(formData.get("quotationId") ?? "").trim();
    if (!quotationId) throw new Error("Quotation is required");

    const prop = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
    if (!prop || prop.statusId === 2) throw new Error("Proposal is read-only");

    const target = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, quotationId) });
    if (!target) throw new Error("Quotation not found");
    if (target.proposalId && target.proposalId !== id) {
      throw new Error("Quotation is already linked to another proposal");
    }

    await db.update(schema.quotations)
      .set({ proposalId: id, updatedAt: new Date() })
      .where(eq(schema.quotations.id, quotationId));

    if (!prop.convertedQuotationId) {
      await db.update(schema.proposals)
        .set({ convertedQuotationId: quotationId, updatedAt: new Date() })
        .where(eq(schema.proposals.id, id));
    }

    redirect(`/proposals/${id}`);
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
            <Row k="Primary Quotation" v={proposal.convertedQuotationId
              ? <Link href={`/quotations/${proposal.convertedQuotationId}`} className="text-crimson hover:underline font-mono text-xs">{linkedQuotations.find(q => q.id === proposal.convertedQuotationId)?.quotationNo ?? proposal.convertedQuotationId.slice(0, 8)}</Link>
              : "—"} />
          </dl>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-charcoal">{proposal.note ?? <span className="text-charcoal-faint">(no notes)</span>}</p>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-hairline bg-white p-5 shadow-claritas-1">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quotations ({linkedQuotations.length})</h2>
          {canLink && linkable.length > 0 && (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-pill border border-hairline px-4 py-2 text-sm font-medium hover:border-crimson">
                + Link existing quotation
              </summary>
              <form
                action={linkExistingQuotation}
                className="absolute right-0 z-10 mt-2 w-96 rounded-lg border border-hairline bg-white p-4 shadow-claritas-2"
              >
                <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">
                  Unlinked quotations for this {lead?.accountId ? "account" : "lead"}
                </label>
                <select name="quotationId" required className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
                  <option value="">— Select quotation —</option>
                  {linkable.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quotationNo} — {qStatusName.get(q.statusId) ?? "?"} — {q.subject ?? "(no subject)"}
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="submit" className="rounded-pill bg-gradient-accent px-5 py-2 text-sm font-semibold text-white shadow-accent-glow">
                    Link
                  </button>
                </div>
              </form>
            </details>
          )}
        </div>

        {linkedQuotations.length === 0 ? (
          <p className="text-sm text-charcoal-faint">No quotations linked yet. Use Convert to create a new one, or Link existing to attach one.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation No</th>
                <th>Subject</th>
                <th>Status</th>
                <th className="text-right">Total (MYR)</th>
                <th>Primary</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {linkedQuotations.map(q => (
                <tr key={q.id}>
                  <td className="font-mono text-xs">{q.quotationNo}</td>
                  <td className="font-medium">{q.subject ?? "—"}</td>
                  <td>{qStatusName.get(q.statusId) ?? "?"}</td>
                  <td className="text-right font-mono">{Number(q.totalMyr ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>{q.id === proposal.convertedQuotationId ? <span className="rounded-pill bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">Primary</span> : ""}</td>
                  <td><Link href={`/quotations/${q.id}`} className="text-crimson hover:underline">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
