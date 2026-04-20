import { db, schema } from "@/db";
import { eq, desc, and, inArray, asc } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Lead detail — FSD §3.3.2. Shows lead info, related proposals/quotations, and provides
 * the "Prepare Proposal" action (step 6 decision) which hands off to /proposals/new?leadId=…
 * Also supports direct quotation creation from the lead (LEAD-012/013) and owner
 * reassignment by Supervisor/Section Head (LEAD-022..LEAD-027).
 */
export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const lead = await db.query.leads.findFirst({ where: eq(schema.leads.id, id) });
  if (!lead) notFound();

  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, lead.ownerUserId) });
  const status = await db.query.leadStatuses.findFirst({ where: eq(schema.leadStatuses.id, lead.statusId) });
  const account = lead.accountId
    ? await db.query.accounts.findFirst({ where: eq(schema.accounts.id, lead.accountId) })
    : null;

  const leadProposals = await db
    .select({ id: schema.proposals.id, no: schema.proposals.proposalNo, subject: schema.proposals.subject, statusId: schema.proposals.statusId })
    .from(schema.proposals)
    .where(eq(schema.proposals.leadId, id))
    .orderBy(desc(schema.proposals.createdAt));

  const leadQuotes = await db
    .select({ id: schema.quotations.id, no: schema.quotations.quotationNo, statusId: schema.quotations.statusId, total: schema.quotations.totalMyr })
    .from(schema.quotations)
    .where(eq(schema.quotations.leadId, id))
    .orderBy(desc(schema.quotations.createdAt));

  const role = session.user.roleCode;
  const canAct = ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);
  const canReassign = ["UnitHead", "SectionHead", "Administrator"].includes(role);

  // Eligible assignees for the re-assignment widget (Account Managers + Unit Heads)
  const assignees = canReassign
    ? await db
        .select({ id: schema.users.id, fullName: schema.users.fullName, email: schema.users.email })
        .from(schema.users)
        .innerJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
        .where(and(eq(schema.users.isActive, true), inArray(schema.roles.code, ["AccountManager", "UnitHead"])))
        .orderBy(asc(schema.users.fullName))
    : [];

  async function createQuotationFromLead() {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");

    const now = new Date();
    const yr = now.getFullYear();
    const ts = now.getTime().toString().slice(-7);
    const quotationNo = `QTN-${yr}-${ts}`;
    const ld = await db.query.leads.findFirst({ where: eq(schema.leads.id, id) });
    if (!ld) throw new Error("lead_missing");
    const acc = ld.accountId ? await db.query.accounts.findFirst({ where: eq(schema.accounts.id, ld.accountId) }) : null;
    const newId = crypto.randomUUID();
    await db.insert(schema.quotations).values({
      id: newId,
      quotationNo,
      rootQuotationId: newId,
      revisionLetter: "a",
      accountId: acc?.id ?? null,
      leadId: ld.id,
      ownerUserId: s.user.id,
      statusId: 1,
      typeId: 1,
      subject: `${ld.organizationName} — new quotation`,
      snapOrganizationName: acc?.organizationName ?? ld.organizationName,
      snapLine1: acc?.line1 ?? null,
      snapLine2: acc?.line2 ?? null,
      snapLine3: acc?.line3 ?? null,
      snapCity: acc?.city ?? null,
      snapPostcode: acc?.postcode ?? null,
      snapStateCode: acc?.stateCode ?? null,
      snapCountryCode: acc?.countryCode ?? "MY",
      snapPhone: acc?.officePhone ?? null,
      ownerDepartmentId: s.user.departmentId ?? null,
      ownerSectionId: s.user.sectionId ?? null,
    });
    redirect(`/quotations/${newId}`);
  }

  async function reassignLead(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");
    const r = s.user.roleCode;
    if (!["UnitHead", "SectionHead", "Administrator"].includes(r)) throw new Error("forbidden");

    const newOwnerId = String(formData.get("newOwnerUserId") ?? "").trim();
    if (!newOwnerId) throw new Error("missing_owner");

    const newOwner = await db.query.users.findFirst({ where: eq(schema.users.id, newOwnerId) });
    if (!newOwner || !newOwner.isActive) throw new Error("invalid_owner");

    await db.update(schema.leads)
      .set({
        ownerUserId: newOwner.id,
        ownerDepartmentId: newOwner.departmentId ?? null,
        ownerSectionId: newOwner.sectionId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.leads.id, id));

    redirect(`/leads/${id}?reassigned=1`);
  }

  return (
    <div className="max-w-5xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/leads" className="hover:text-crimson">Leads</Link>
        <span className="mx-2">/</span>
        <span>{lead.organizationName}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{lead.organizationName}</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Account Type: <strong className="text-charcoal">Lead</strong> · {status?.name ?? "?"} · Owner: {owner?.fullName ?? "—"}
          </p>
        </div>
        {canAct && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/proposals/new?leadId=${lead.id}`}
              className="rounded-pill bg-gradient-accent px-5 py-2.5 font-semibold text-white shadow-accent-glow"
            >
              + Prepare proposal
            </Link>
            <form action={createQuotationFromLead}>
              <button
                type="submit"
                className="rounded-pill border border-hairline bg-white px-5 py-2.5 font-semibold hover:border-crimson hover:text-crimson"
              >
                + Create quotation
              </button>
            </form>
          </div>
        )}
      </header>

      {canReassign && (
        <section className="mb-6 rounded-lg border border-hairline bg-white p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Re-assignment</h2>
          <form action={reassignLead} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Assign to user</label>
              <select
                name="newOwnerUserId"
                required
                defaultValue={lead.ownerUserId}
                className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
              >
                {assignees.map(a => (
                  <option key={a.id} value={a.id}>{a.fullName} · {a.email}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-pill bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-white shadow-accent-glow"
            >
              Re-assign
            </button>
          </form>
        </section>
      )}

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Primary contact</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Name" v={lead.primaryContactName} />
            <Row k="Phone" v={lead.primaryContactPhone} />
            <Row k="Email" v={lead.primaryContactEmail} />
            <Row k="Source" v={lead.source} />
            <Row k="Needs proposal?" v={lead.needsProposal ? "Yes" : "No"} />
          </dl>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Linked account</h2>
          {account ? (
            <dl className="space-y-2 text-sm">
              <Row k="Organization" v={<Link href={`/accounts/${account.id}`} className="text-crimson hover:underline">{account.organizationName}</Link>} />
              <Row k="City" v={account.city} />
              <Row k="State" v={account.stateCode} />
            </dl>
          ) : <p className="text-sm text-charcoal-faint">No CMD account linked yet.</p>}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Notes</h2>
        <p className="whitespace-pre-wrap text-sm">{lead.notes ?? <span className="text-charcoal-faint">(no notes)</span>}</p>
      </section>

      <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">System information</h2>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <Row k="Created Date" v={lead.createdAt?.toLocaleString()} />
          <Row k="Created By" v={owner?.fullName ?? "—"} />
          <Row k="Last Updated" v={lead.updatedAt?.toLocaleString()} />
        </dl>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Proposals ({leadProposals.length})</h2>
          {leadProposals.length === 0 ? <p className="text-sm text-charcoal-faint">None</p> : (
            <ul className="space-y-1 text-sm">
              {leadProposals.map(p => (
                <li key={p.id}>
                  <Link href={`/proposals/${p.id}`} className="text-crimson hover:underline font-mono text-xs">{p.no}</Link>
                  <span className="text-charcoal-faint"> · {p.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Quotations ({leadQuotes.length})</h2>
          {leadQuotes.length === 0 ? <p className="text-sm text-charcoal-faint">None</p> : (
            <ul className="space-y-1 text-sm">
              {leadQuotes.map(q => (
                <li key={q.id}>
                  <Link href={`/quotations/${q.id}`} className="text-crimson hover:underline font-mono text-xs">{q.no}</Link>
                  <span className="text-charcoal-faint"> · MYR {Number(q.total).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
