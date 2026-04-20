import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * FSD §3.6.1 — Quotation Performance Report. Four views:
 *   1. Status Summary          — count + MYR by status
 *   2. Rejected Breakdown      — count by rejection reason
 *   3. Submission / Revision   — revision depth per root quotation
 *   4. Closed Overview         — closed quotations with total value
 * Export: Excel + PDF.
 */
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

  const revisionRows = (await db.execute(sql`
    SELECT root_quotation_id AS root,
           MAX(quotation_no) AS latest_no,
           COUNT(*)::int AS revision_count
    FROM crm.quotations
    GROUP BY root_quotation_id
    ORDER BY revision_count DESC
    LIMIT 25
  `)) as unknown as Array<{ root: string; latest_no: string; revision_count: number }>;

  const closedRows = (await db.execute(sql`
    SELECT quotation_no, total_myr, closed_at
    FROM crm.quotations
    WHERE status_id = 5
    ORDER BY closed_at DESC NULLS LAST
    LIMIT 25
  `)) as unknown as Array<{ quotation_no: string; total_myr: string; closed_at: string | null }>;

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Quotation Performance Report</h1>
          <p className="mt-1 text-sm text-charcoal-soft">FSD §3.6.1 — consolidated monitoring. Excel + PDF exports below.</p>
        </div>
        <div className="flex gap-3">
          <a href="/api/reports/quotation-performance/xlsx" className="rounded-pill border border-hairline px-5 py-2.5 font-medium hover:border-crimson hover:text-crimson">
            Download XLSX
          </a>
          <a href="/api/reports/quotation-performance/pdf" className="rounded-pill bg-gradient-accent px-5 py-2.5 font-semibold text-white shadow-accent-glow">
            Download PDF
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

        <section className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
          <h2 className="px-4 pt-4 text-lg font-semibold">Submission / Revision Summary</h2>
          <p className="px-4 pb-2 text-xs text-charcoal-soft">Top 25 quotation chains by revision depth.</p>
          <table className="data-table">
            <thead><tr><th>Latest Quotation No</th><th className="text-right">Revisions</th></tr></thead>
            <tbody>
              {revisionRows.length === 0 && (
                <tr><td colSpan={2} className="py-6 text-center text-charcoal-faint">No quotations yet.</td></tr>
              )}
              {revisionRows.map(r => (
                <tr key={r.root}>
                  <td className="font-mono text-xs">{r.latest_no}</td>
                  <td className="text-right font-semibold">{r.revision_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
          <h2 className="px-4 pt-4 text-lg font-semibold">Closed Quotations Overview</h2>
          <p className="px-4 pb-2 text-xs text-charcoal-soft">Top 25 most recent customer-accepted quotations.</p>
          <table className="data-table">
            <thead><tr><th>Quotation No</th><th className="text-right">Total (MYR)</th><th>Closed</th></tr></thead>
            <tbody>
              {closedRows.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-charcoal-faint">No closed quotations yet.</td></tr>
              )}
              {closedRows.map(r => (
                <tr key={r.quotation_no}>
                  <td className="font-mono text-xs">{r.quotation_no}</td>
                  <td className="text-right font-semibold">{Number(r.total_myr).toLocaleString()}</td>
                  <td className="text-charcoal-soft text-xs">{r.closed_at ? new Date(r.closed_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
