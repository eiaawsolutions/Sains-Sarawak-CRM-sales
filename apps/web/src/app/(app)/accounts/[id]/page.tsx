import { db, schema } from "@/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, id) });
  if (!account) notFound();

  const contacts = await db
    .select()
    .from(schema.accountContacts)
    .where(eq(schema.accountContacts.accountId, id))
    .orderBy(desc(schema.accountContacts.updatedAt));

  const orgType = account.organizationTypeId
    ? await db.query.organizationTypes.findFirst({ where: eq(schema.organizationTypes.id, account.organizationTypeId) })
    : null;

  const relatedLeads = await db
    .select({ id: schema.leads.id, name: schema.leads.organizationName, statusId: schema.leads.statusId, createdAt: schema.leads.createdAt })
    .from(schema.leads)
    .where(eq(schema.leads.accountId, id))
    .orderBy(desc(schema.leads.createdAt))
    .limit(20);

  const relatedQuotes = await db
    .select({ id: schema.quotations.id, no: schema.quotations.quotationNo, statusId: schema.quotations.statusId, total: schema.quotations.totalMyr })
    .from(schema.quotations)
    .where(eq(schema.quotations.accountId, id))
    .orderBy(desc(schema.quotations.createdAt))
    .limit(20);

  return (
    <div className="max-w-5xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/accounts" className="hover:text-crimson">Accounts</Link>
        <span className="mx-2">/</span>
        <span>{account.organizationName}</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{account.organizationName}</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          {orgType?.name ?? "—"} · Read-only from CMD · Last synced {account.cmdLastUpdated?.toLocaleString() ?? "never"}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Organization</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Short name" v={account.organizationShortName} />
            <Row k="Office phone" v={account.officePhone} />
            <Row k="Fax" v={account.fax} />
            <Row k="Website" v={account.website} />
            <Row k="Description" v={account.description} />
          </dl>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Address</h2>
          <address className="not-italic text-sm text-charcoal">
            {account.line1 && <div>{account.line1}</div>}
            {account.line2 && <div>{account.line2}</div>}
            {account.line3 && <div>{account.line3}</div>}
            <div>{[account.city, account.postcode].filter(Boolean).join(" ")}</div>
            <div>{[account.stateCode, account.countryCode].filter(Boolean).join(", ")}</div>
          </address>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
        <h2 className="px-5 pt-5 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">
          Contacts ({contacts.length})
        </h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Full name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Business phone</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-charcoal-faint">No contacts synced.</td></tr>
            )}
            {contacts.map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.fullName}</td>
                <td className="text-xs font-mono">{c.email ?? "—"}</td>
                <td className="text-xs font-mono">{c.mobile ?? "—"}</td>
                <td className="text-xs font-mono">{c.businessPhone ?? "—"}</td>
                <td>{c.statusId === 1 ? "Active" : "Inactive"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Related leads</h2>
          {relatedLeads.length === 0 ? <p className="text-sm text-charcoal-faint">None</p> : (
            <ul className="space-y-1 text-sm">
              {relatedLeads.map(l => (
                <li key={l.id}><Link href={`/leads/${l.id}`} className="text-crimson hover:underline">{l.name}</Link> <span className="text-charcoal-faint">· {l.createdAt?.toLocaleDateString()}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Related quotations</h2>
          {relatedQuotes.length === 0 ? <p className="text-sm text-charcoal-faint">None</p> : (
            <ul className="space-y-1 text-sm">
              {relatedQuotes.map(q => (
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
