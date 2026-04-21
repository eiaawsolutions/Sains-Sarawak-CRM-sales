import { db, schema } from "@/db";
import { desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { runHarness } from "@/uat/runner";
import { Badge, Button, Card, EmptyState, Kpi, PageHeader } from "@/components/ui";

/**
 * /admin/uat — the test-harness control panel. Admin-only.
 * Shows latest run stats, recent runs, and a per-case matrix with SAINS baseline vs harness
 * outcome + Reconciliation (Agree-Pass / Agree-Fail / Regression-Fixed / Regression-Broken).
 */
export default async function UatPage() {
  const session = await auth();
  if (session?.user.roleCode !== "Administrator") {
    return (
      <div>
        <PageHeader title="UAT Test Harness" description="Administrators only." />
        <EmptyState title="Forbidden" description="This surface is restricted to Administrators." />
      </div>
    );
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

  const run = latest[0];

  return (
    <div>
      <PageHeader
        title="UAT Test Harness"
        description="Auto-executes the 179 test cases from (Revise) SAINS CRM – Full System Test Scripts 1.0. Each run scores pass / fail / skip and reconciles against the SAINS baseline so regressions and newly-fixed items surface instantly."
        breadcrumbs={[{ label: "Administration", href: "/admin" }, { label: "UAT Test Harness" }]}
        actions={
          <form action={runNow}>
            <Button tone="primary" size="md" type="submit">
              Run all modules now
            </Button>
          </form>
        }
      />

      {/* KPIs */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Total" value={run ? run.totalCases : 0} />
        <Kpi label="Pass"  value={run ? run.passCount  : 0} tone="teal" />
        <Kpi label="Fail"  value={run ? run.failCount  : 0} tone="rose" />
        <Kpi label="Skip"  value={run ? run.skipCount  : 0} />
        <Kpi label="Score" value={run?.scorePct ? `${run.scorePct}%` : "—"} tone="accent" />
      </section>

      {/* Latest run · matrix */}
      <section className="mb-8">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Latest run · matrix</h2>
              <p className="mt-0.5 text-xs text-ink-soft">
                Per-case reconciliation between SAINS baseline and this harness run.
              </p>
            </div>
            {run && (
              <span className="text-[11px] text-ink-faint tabular-nums">
                Run started {run.startedAt.toLocaleString()} · {run.triggerSource}
              </span>
            )}
          </div>

          {(cases as unknown as Array<Record<string, unknown>>).length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No results yet"
                description="Click 'Run all modules now' to execute the 179 cases and populate the matrix."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wider text-ink-faint">
                    <th className="px-5 py-3 font-semibold">Test ID</th>
                    <th className="px-5 py-3 font-semibold">Module</th>
                    <th className="px-5 py-3 font-semibold">Scenario</th>
                    <th className="px-5 py-3 font-semibold">SAINS baseline</th>
                    <th className="px-5 py-3 font-semibold">Harness</th>
                    <th className="px-5 py-3 font-semibold">Reconciliation</th>
                    <th className="px-5 py-3 font-semibold">Severity</th>
                    <th className="px-5 py-3 font-semibold">Latency</th>
                    <th className="px-5 py-3 font-semibold">Failure reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {(cases as unknown as Array<{
                    test_id: string; module: string; scenario: string; severity: string;
                    sains_baseline: string; harness_outcome: string; latency_ms: number | null;
                    failure_reason: string | null; reconciliation: string;
                  }>).map((c) => (
                    <tr key={c.test_id} className="hover:bg-paper-2">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink">{c.test_id}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{c.module}</td>
                      <td className="max-w-[260px] px-5 py-3 text-ink-soft">{c.scenario}</td>
                      <td className="whitespace-nowrap px-5 py-3"><OutcomeBadge value={c.sains_baseline} /></td>
                      <td className="whitespace-nowrap px-5 py-3"><OutcomeBadge value={c.harness_outcome} /></td>
                      <td className="whitespace-nowrap px-5 py-3"><ReconcileBadge value={c.reconciliation} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{c.severity}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-faint tabular-nums">
                        {c.latency_ms != null ? `${c.latency_ms} ms` : "—"}
                      </td>
                      <td className="max-w-[320px] px-5 py-3 text-xs text-ink-soft">{c.failure_reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Recent runs */}
      <section>
        <Card padded={false}>
          <div className="border-b border-hairline px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Recent runs</h2>
            <p className="mt-0.5 text-xs text-ink-soft">Last 25 runs, newest first.</p>
          </div>

          {recent.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No runs yet" description="The harness has not executed any runs on this deployment." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wider text-ink-faint">
                    <th className="px-5 py-3 font-semibold">Started</th>
                    <th className="px-5 py-3 font-semibold">Trigger</th>
                    <th className="px-5 py-3 font-semibold">Pass</th>
                    <th className="px-5 py-3 font-semibold">Fail</th>
                    <th className="px-5 py-3 font-semibold">Skip</th>
                    <th className="px-5 py-3 font-semibold">Score</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {recent.map(r => (
                    <tr key={r.id} className="hover:bg-paper-2">
                      <td className="whitespace-nowrap px-5 py-3 text-ink tabular-nums">{r.startedAt.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-soft">{r.triggerSource}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink">{r.passCount}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink">{r.failCount}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink">{r.skipCount}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-ink">{r.scorePct ? `${r.scorePct}%` : "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3"><RunStatusBadge value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function OutcomeBadge({ value }: { value: string }) {
  const map: Record<string, "teal" | "rose" | "neutral" | "gold" | "accent"> = {
    Pass:   "teal",
    Fail:   "rose",
    Skip:   "neutral",
    NotRun: "neutral",
    Error:  "gold",
  };
  return <Badge tone={map[value] ?? "neutral"}>{value}</Badge>;
}

function ReconcileBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; tone: "teal" | "rose" | "neutral" | "gold" | "accent" }> = {
    "Agree-Pass":         { label: "Agree",              tone: "teal"    },
    "Agree-Fail":         { label: "Agree (both fail)",  tone: "rose"    },
    "Regression-Fixed":   { label: "Now passing",        tone: "teal"    },
    "Regression-Broken":  { label: "Broke",              tone: "rose"    },
    "Skipped":            { label: "Skipped",            tone: "neutral" },
    "NotRun":             { label: "Not run",            tone: "neutral" },
    "Mismatch":           { label: "Mismatch",           tone: "gold"    },
  };
  const m = map[value] ?? { label: value, tone: "neutral" as const };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

function RunStatusBadge({ value }: { value: string }) {
  const map: Record<string, "teal" | "rose" | "neutral" | "gold" | "accent"> = {
    completed: "teal",
    running:   "gold",
    aborted:   "rose",
    failed:    "rose",
  };
  return <Badge tone={map[value] ?? "neutral"}>{value}</Badge>;
}
