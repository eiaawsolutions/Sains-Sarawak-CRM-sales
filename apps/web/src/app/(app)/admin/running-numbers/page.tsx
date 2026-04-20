import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";

export default async function RunningNumbersPage() {
  const rows = await db
    .select({
      userId:        schema.quotationSequences.agentUserId,
      currentVolume: schema.quotationSequences.currentVolume,
      nextRunning:   schema.quotationSequences.nextRunningNo,
      updatedAt:     schema.quotationSequences.updatedAt,
      agentName:     schema.users.fullName,
      staffPrefix:   schema.users.staffPrefix,
    })
    .from(schema.quotationSequences)
    .leftJoin(schema.users, eq(schema.users.id, schema.quotationSequences.agentUserId))
    .orderBy(asc(schema.users.fullName))
    .limit(500);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Running Number Maintenance</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Admin &gt; Running Number. <strong>Read-only</strong> — editing is not allowed due to impact on system logic.
        </p>
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Staff Prefix</th>
              <th>Current Volume</th>
              <th>Next Running No.</th>
              <th>Last Used</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-charcoal-faint">No sequences yet. First quotation creates them.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.userId}>
                <td className="font-medium">
                  <Link href={`/admin/running-numbers/${r.userId}`} className="text-crimson hover:underline">
                    {r.agentName ?? r.userId}
                  </Link>
                </td>
                <td className="font-mono text-xs">{r.staffPrefix ?? "—"}</td>
                <td className="text-right font-mono">{r.currentVolume}</td>
                <td className="text-right font-mono">{r.nextRunning}</td>
                <td className="text-xs text-charcoal-soft">{r.updatedAt?.toLocaleString() ?? "—"}</td>
                <td><Link href={`/admin/running-numbers/${r.userId}`} className="text-crimson hover:underline">View →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
