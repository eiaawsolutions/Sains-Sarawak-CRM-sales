import { db } from "@/db";
import { sql } from "drizzle-orm";

export default async function ReportsPage() {
  const statusRows = (await db.execute(sql`
    SELECT qs.name AS status_name, COUNT(q.id)::int AS quotation_count,
           COALESCE(SUM(q.total_myr), 0)::numeric AS total_value_myr
    FROM crm.quotation_statuses qs
    LEFT JOIN crm.quotations q ON q.status_id = qs.id
    GROUP BY qs.id, qs.name ORDER BY qs.id
  `)) as unknown as Array<{ status_name: string; quotation_count: number; total_value_myr: string }>;

  const rejectionRows = (await db.execute(sql`
    SELECT rr.name AS reason, COUNT(q.id)::int AS count
    FROM crm.rejection_reasons rr
    LEFT JOIN crm.quotations q ON q.rejection_reason_id = rr.id AND q.status_id = 6
    GROUP BY rr.id, rr.name ORDER BY rr.id
  `)) as unknown as Array<{ reason: string; count: number }>;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Quotation Performance Report</h1>
          <p className="mt-1 text-sm text-charcoal-soft">FSD §3.6.1 — the single consolidated report. Excel + PDF exports below.</p>
        </div>
        <div className="flex gap-3">
          <a href="/api/reports/quotation-performance/xlsx" className="rounded-pill border border-hairline px-5 py-2.5 font-medium hover:border-crimson hover:text-crimson">
            Download XLSX
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
          <h2 className="px-4 pt-4 text-lg font-semibold">Status Summary</h2>
          <table className="data-table">
            <thead><tr><th>Status</th><th className="text-right">Count</th><th className="text-right">Total (MYR)</th></tr></thead>
            <tbody>
              {statusRows.map(r => (
                <tr key={r.status_name}>
                  <td>{r.status_name}</td>
                  <td className="text-right font-semibold">{r.quotation_count}</td>
                  <td className="text-right">{Number(r.total_value_myr).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
          <h2 className="px-4 pt-4 text-lg font-semibold">Rejected Quotations Breakdown</h2>
          <table className="data-table">
            <thead><tr><th>Reason</th><th className="text-right">Count</th></tr></thead>
            <tbody>
              {rejectionRows.map(r => (
                <tr key={r.reason}>
                  <td>{r.reason}</td>
                  <td className="text-right font-semibold">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
