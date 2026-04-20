import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function LeadsPage() {
  const session = await auth();
  const role = session?.user.roleCode ?? "Viewer";

  const leads = await db
    .select({
      id: schema.leads.id,
      organizationName: schema.leads.organizationName,
      primaryContactName: schema.leads.primaryContactName,
      statusId: schema.leads.statusId,
      source: schema.leads.source,
      createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .orderBy(desc(schema.leads.createdAt))
    .limit(100);

  const statuses = await db.select().from(schema.leadStatuses);
  const statusName = new Map(statuses.map(s => [s.id, s.name]));

  const canCreate = ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Business opportunities. Lead → Proposal → Quotation → Customer.</p>
        </div>
        {canCreate && (
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow"
          >
            + New lead
          </Link>
        )}
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Primary contact</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-charcoal-faint">No leads yet.</td></tr>
            )}
            {leads.map(l => (
              <tr key={l.id}>
                <td className="font-medium">{l.organizationName}</td>
                <td>{l.primaryContactName ?? "—"}</td>
                <td>{l.source ?? "—"}</td>
                <td><Pill>{statusName.get(l.statusId) ?? "?"}</Pill></td>
                <td className="text-charcoal-soft">{l.createdAt?.toLocaleDateString()}</td>
                <td><Link href={`/leads/${l.id}`} className="text-crimson hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-pill border border-hairline bg-white px-2.5 py-0.5 text-xs font-semibold">{children}</span>;
}
