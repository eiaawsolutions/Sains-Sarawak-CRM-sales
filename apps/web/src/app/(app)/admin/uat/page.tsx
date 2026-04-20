import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { runHarness } from "@/uat/runner";

/**
 * /admin/uat — the test-harness control panel. Admin-only.
 * Shows latest run stats, recent runs, and a per-case matrix with SAINS baseline vs harness
 * outcome + Reconciliation (Agree-Pass / Agree-Fail / Regression-Fixed / Regression-Broken).
 */
export default async function UatPage() {
  const session = await auth();
  if (session?.user.roleCode !== "Administrator") {
    return <p className="text-charcoal-soft">Administrators only.</p>;
  }

  const latest = await db.select().from(schema.uatTestRuns).orderBy(desc(schema.uatTestRuns.startedAt)).limit(1);
  const recent = await db.select().from(schema.uatTestRuns).orderBy(desc(schema.uatTestRuns.startedAt)).limit(25);

  const cases = latest[0]
    ? await db.execute<{
        test_id: string; module: string; script: string | null; scenario: string; severity: string;
        sains_baseline: string; harness_outcome: string; latency_ms: number | null;
        failure_reason: string | null; reconciliation: string;
      }>(sql`
        SELECT c.test_id, c.module, c.script, c.scenario, c.severity,
               c.sains_actual AS sains_baseline,
               COALESCE(r.outcome, 'NotRun') AS harness_outcome,
               r.latency_ms, r.failure_reason,
               CASE
                 WHEN r.outcome IS NULL THEN 'NotRun'
                 WHEN r.outcome = 'Pass' AND c.sains_actual = 'Pass' THEN 'Agree-Pass'
                 WHEN r.outcome = 'Fail' AND c.sains_actual = 'Fail' THEN 'Agree-Fail'
                 WHEN r.outcome = 'Pass' AND c.sains_actual = 'Fail' THEN 'Regression-Fixed'
                 WHEN r.outcome = 'Fail' AND c.sains_actual = 'Pass' THEN 'Regression-Broken'
                 WHEN r.outcome = 'Skip' THEN 'Skipped'
                 ELSE 'Mismatch'
               END AS reconciliation
        FROM crm.uat_test_cases c
        LEFT JOIN crm.uat_test_results r ON r.test_id = c.test_id AND r.run_id = ${latest[0].id}
        ORDER BY c.module, c.script, c.ordinal
      `)
    : [];

  async function runNow() {
    "use server";
    const s = await auth();
    if (s?.user.roleCode !== "Administrator") throw new Error("forbidden");
    await runHarness({ trigger: "manual_ui", triggeredByUserId: s.user.id });
    redirect("/admin/uat");
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold">UAT Test Harness</h1>
          <p className="mt-1 max-w-3xl text-sm text-charcoal-soft">
            Auto-executes the 179 test cases from <em>(Revise) SAINS CRM – Full System Test Scripts 1.0</em>.
            Each run scores pass / fail / skip and reconciles against the SAINS baseline so regressions
            and newly-fixed items surface instantly.
          </p>
        </div>
        <form action={runNow}>
          <button className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
            Run all modules now
          </button>
        </form>
      </header>

      {latest[0] && (
        <div className="mb-6 grid grid-cols-5 gap-4">
          <Stat label="Total"  value={latest[0].totalCases} />
          <Stat label="Pass"   value={latest[0].passCount} color="text-emerald-700" />
          <Stat label="Fail"   value={latest[0].failCount} color="text-crimson" />
          <Stat label="Skip"   value={latest[0].skipCount} color="text-charcoal-soft" />
          <Stat label="Score"  value={latest[0].scorePct ? `${latest[0].scorePct}%` : "—"} color="text-charcoal" />
        </div>
      )}

      <div className="mb-6 rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <h2 className="px-4 pt-4 text-lg font-semibold">Latest run · matrix</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Test ID</th>
              <th>Module</th>
              <th>Scenario</th>
              <th>SAINS baseline</th>
              <th>Harness</th>
              <th>Reconciliation</th>
              <th>Severity</th>
              <th>Latency</th>
              <th>Failure reason</th>
            </tr>
          </thead>
          <tbody>
            {(cases as unknown as Array<any>).map((c) => (
              <tr key={c.test_id}>
                <td className="font-mono text-xs">{c.test_id}</td>
                <td>{c.module}</td>
                <td className="max-w-[260px]">{c.scenario}</td>
                <td><Badge text={c.sains_baseline} /></td>
                <td><Badge text={c.harness_outcome} /></td>
                <td><ReconcileBadge value={c.reconciliation} /></td>
                <td>{c.severity}</td>
                <td className="text-charcoal-soft">{c.latency_ms != null ? `${c.latency_ms} ms` : "—"}</td>
                <td className="max-w-[320px] text-xs text-charcoal-soft">{c.failure_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <h2 className="px-4 pt-4 text-lg font-semibold">Recent runs</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Trigger</th>
              <th>Pass</th>
              <th>Fail</th>
              <th>Skip</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.id}>
                <td>{r.startedAt.toLocaleString()}</td>
                <td>{r.triggerSource}</td>
                <td>{r.passCount}</td>
                <td>{r.failCount}</td>
                <td>{r.skipCount}</td>
                <td>{r.scorePct ? `${r.scorePct}%` : "—"}</td>
                <td><Badge text={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-charcoal" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-gradient-surface px-4 py-5 text-center shadow-claritas-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  const cls =
    text === "Pass" || text === "completed" ? "bg-emerald-50 text-emerald-800" :
    text === "Fail" || text === "aborted"    ? "bg-crimson-faint text-crimson" :
    text === "Skip"                          ? "bg-gray-100 text-charcoal-soft" :
    text === "running"                       ? "bg-orange-50 text-orange-900" :
    "bg-white";
  return <span className={`inline-flex items-center rounded-pill border border-hairline px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

function ReconcileBadge({ value }: { value: string }) {
  const map: Record<string, { text: string; cls: string }> = {
    "Agree-Pass":        { text: "✓ Agree",            cls: "bg-emerald-50 text-emerald-800" },
    "Agree-Fail":        { text: "✗ Agree (both fail)", cls: "bg-crimson-faint text-crimson" },
    "Regression-Fixed":  { text: "↑ Now passing",       cls: "bg-emerald-50 text-emerald-800" },
    "Regression-Broken": { text: "↓ Broke",             cls: "bg-crimson text-white" },
    "Skipped":           { text: "— skipped",           cls: "bg-gray-100 text-charcoal-soft" },
    "NotRun":            { text: "— not run",           cls: "bg-gray-100 text-charcoal-soft" },
  };
  const m = map[value] ?? { text: value, cls: "bg-gray-100 text-charcoal" };
  return <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>{m.text}</span>;
}
