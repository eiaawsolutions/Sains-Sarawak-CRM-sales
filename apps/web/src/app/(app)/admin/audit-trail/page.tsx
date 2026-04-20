import { db, schema } from "@/db";
import { and, desc, gte, lte, ilike, SQL } from "drizzle-orm";

type SP = Promise<{ module?: string; from?: string; to?: string; actor?: string }>;

export default async function AuditTrailPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const module = (sp.module ?? "").trim();
  const from   = (sp.from ?? "").trim();
  const to     = (sp.to ?? "").trim();
  const actor  = (sp.actor ?? "").trim();

  const conds: SQL[] = [];
  if (module) conds.push(ilike(schema.auditLog.eventType, `%${module}%`));
  if (from)   conds.push(gte(schema.auditLog.eventTime, new Date(from)));
  if (to)     conds.push(lte(schema.auditLog.eventTime, new Date(to + "T23:59:59Z")));
  if (actor)  conds.push(ilike(schema.auditLog.actorUserAgent, `%${actor}%`));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(where)
    .orderBy(desc(schema.auditLog.eventTime))
    .limit(500);

  const exportUrl = `/admin/audit-trail/export?${new URLSearchParams({ module, from, to, actor }).toString()}`;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold">Audit Trail</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Admin &gt; Audit Trail. Search and export system activity logs.</p>
        </div>
        <a href={exportUrl} className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-semibold transition hover:border-crimson hover:text-crimson">
          Export CSV
        </a>
      </header>

      <form className="mb-6 grid grid-cols-4 gap-3 rounded-lg border border-hairline bg-gradient-surface p-4 shadow-claritas-1">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Module / Event</label>
          <input name="module" defaultValue={module} placeholder="e.g. quotation, user.update"
                 className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">From</label>
          <input type="date" name="from" defaultValue={from}
                 className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">To</label>
          <input type="date" name="to" defaultValue={to}
                 className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-pill bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-white shadow-accent-glow">
            Search
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event Type</th>
              <th>Target</th>
              <th>Actor</th>
              <th>Outcome</th>
              <th>Latency</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-charcoal-faint">No records found for this search.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td className="text-xs text-charcoal-soft">{r.eventTime.toLocaleString()}</td>
                <td className="font-mono text-xs">{r.eventType}</td>
                <td className="text-xs">{r.targetEntity ?? "—"}{r.targetId ? ` · ${String(r.targetId).slice(0, 8)}` : ""}</td>
                <td className="text-xs">{r.actorUserId ? String(r.actorUserId).slice(0, 8) : "—"}</td>
                <td>
                  <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${r.outcome === "success" ? "bg-emerald-50 text-emerald-800" : "bg-crimson-faint text-crimson"}`}>
                    {r.outcome}
                  </span>
                </td>
                <td className="text-xs text-charcoal-soft">{r.latencyMs != null ? `${r.latencyMs} ms` : "—"}</td>
                <td className="max-w-[320px] truncate text-xs text-charcoal-soft">{r.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-charcoal-soft">Showing up to 500 most recent records matching the filter.</p>
    </div>
  );
}
