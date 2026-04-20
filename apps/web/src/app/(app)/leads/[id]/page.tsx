import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Lead detail — FSD §3.3.2. Shows lead info, related proposals/quotations, and provides
 * the "Prepare Proposal" action (step 6 decision) which hands off to /proposals/new?leadId=…
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
            {status?.name ?? "?"} · Owner: {owner?.fullName ?? "—"}
          </p>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <Link
              href={`/proposals/new?leadId=${lead.id}`}
              className="rounded-pill bg-gradient-accent px-5 py-2.5 font-semibold text-white shadow-accent-glow"
            >
              + Prepare proposal
            </Link>
          </div>
        )}
      </header>

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
