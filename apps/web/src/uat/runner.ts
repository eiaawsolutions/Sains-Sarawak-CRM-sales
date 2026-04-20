/**
 * UAT harness runner — TS port of the .NET UatRunner. Same 179-case matrix, same scoring,
 * same Reconciliation logic. Three executors: httpProbe, sqlAssertion, manual (skip).
 */
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export type Outcome = "Pass" | "Fail" | "Skip" | "Error" | "NotRun";

export interface RunnerOptions {
  trigger: "manual_ui" | "nightly_cron" | "ci";
  moduleFilter?: string;
  triggeredByUserId?: string;
}

interface CaseRow {
  testId: string;
  module: string;
  script: string | null;
  scenario: string;
  sainsActual: string;
  severity: string;
  executorType: string;
  executorConfig: unknown;
}

export async function runHarness(opts: RunnerOptions): Promise<string> {
  const cases = await loadCases(opts.moduleFilter);

  const [run] = await db.insert(schema.uatTestRuns).values({
    triggerSource: opts.trigger,
    triggeredByUserId: opts.triggeredByUserId,
    moduleFilter: opts.moduleFilter,
    totalCases: cases.length,
    status: "running",
  }).returning({ id: schema.uatTestRuns.id });

  const runId = run!.id;
  let pass = 0, fail = 0, skip = 0, error = 0;

  for (const c of cases) {
    const started = Date.now();
    let outcome: Outcome = "Skip";
    let evidence: string | null = null;
    let failureReason: string | null = null;

    try {
      switch (c.executorType) {
        case "http_probe":     ({ outcome, evidence, failureReason } = await runHttpProbe(c));   break;
        case "sql_assertion":  ({ outcome, evidence, failureReason } = await runSqlAssertion(c)); break;
        case "manual":
        default:               outcome = "Skip"; failureReason = "manual test — requires human tester"; break;
      }
    } catch (e) {
      outcome = "Error";
      failureReason = (e as Error).message ?? String(e);
    }

    const latencyMs = Date.now() - started;
    const matchesSains =
      (outcome === "Pass" && c.sainsActual === "Pass") ||
      (outcome === "Fail" && c.sainsActual === "Fail");

    await db.insert(schema.uatTestResults).values({
      runId,
      testId: c.testId,
      outcome,
      latencyMs,
      evidence,
      failureReason,
      matchesSains,
    });

    if (outcome === "Pass") pass++;
    else if (outcome === "Fail") fail++;
    else if (outcome === "Skip") skip++;
    else if (outcome === "Error") error++;
  }

  const executed = pass + fail + error;
  const scorePct = executed === 0 ? null : Number(((pass / executed) * 100).toFixed(2));

  await db.update(schema.uatTestRuns)
    .set({
      completedAt: new Date(),
      passCount: pass, failCount: fail, skipCount: skip, errorCount: error,
      scorePct: scorePct?.toString() ?? null,
      status: "completed",
    })
    .where(eq(schema.uatTestRuns.id, runId));

  return runId;
}

async function loadCases(moduleFilter?: string): Promise<CaseRow[]> {
  if (moduleFilter) {
    return await db.select({
      testId: schema.uatTestCases.testId, module: schema.uatTestCases.module,
      script: schema.uatTestCases.script, scenario: schema.uatTestCases.scenario,
      sainsActual: schema.uatTestCases.sainsActual, severity: schema.uatTestCases.severity,
      executorType: schema.uatTestCases.executorType, executorConfig: schema.uatTestCases.executorConfig,
    }).from(schema.uatTestCases).where(eq(schema.uatTestCases.module, moduleFilter));
  }
  return await db.select({
    testId: schema.uatTestCases.testId, module: schema.uatTestCases.module,
    script: schema.uatTestCases.script, scenario: schema.uatTestCases.scenario,
    sainsActual: schema.uatTestCases.sainsActual, severity: schema.uatTestCases.severity,
    executorType: schema.uatTestCases.executorType, executorConfig: schema.uatTestCases.executorConfig,
  }).from(schema.uatTestCases);
}

// ---------- Executors ----------

async function runHttpProbe(c: CaseRow): Promise<{ outcome: Outcome; evidence: string | null; failureReason: string | null }> {
  const cfg = c.executorConfig as { method?: string; path?: string; expectStatus?: number[]; expectHeaderLocationContains?: string } | null;
  if (!cfg?.path) return skipFor(c, "missing config.path");

  const base = process.env.SELF_BASE_URL ?? "http://localhost:3000";
  const url = `${base}${cfg.path}`;
  const res = await fetch(url, { method: cfg.method ?? "GET", redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  const evidence = `status=${res.status} location='${location}'`;

  const statusOk = !cfg.expectStatus || cfg.expectStatus.includes(res.status);
  const locationOk = !cfg.expectHeaderLocationContains || location.toLowerCase().includes(cfg.expectHeaderLocationContains.toLowerCase());

  if (statusOk && locationOk) return { outcome: "Pass", evidence, failureReason: null };
  if (!statusOk) return { outcome: "Fail", evidence, failureReason: `expected status ${cfg.expectStatus?.join("|")}, got ${res.status}` };
  return { outcome: "Fail", evidence, failureReason: `expected Location to contain '${cfg.expectHeaderLocationContains}', got '${location}'` };
}

async function runSqlAssertion(c: CaseRow): Promise<{ outcome: Outcome; evidence: string | null; failureReason: string | null }> {
  const cfg = c.executorConfig as { sql?: string; expectValue?: number; expectMinValue?: number; note?: string } | null;
  if (!cfg?.sql) return skipFor(c, "missing config.sql");

  const trimmed = cfg.sql.trimStart().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    return { outcome: "Error", evidence: null, failureReason: "SQL must start with SELECT" };
  }

  // Parameter-less scalar query
  const rows = await db.execute(sql.raw(cfg.sql));
  const firstRow = (rows as unknown as Array<Record<string, unknown>>)[0] ?? {};
  const value = Number(Object.values(firstRow)[0] ?? 0);
  const evidence = `scalar=${value}`;

  if (cfg.expectValue !== undefined) {
    return value === cfg.expectValue
      ? { outcome: "Pass", evidence, failureReason: null }
      : { outcome: "Fail", evidence, failureReason: `expected ${cfg.expectValue}, got ${value}` };
  }
  if (cfg.expectMinValue !== undefined) {
    return value >= cfg.expectMinValue
      ? { outcome: "Pass", evidence, failureReason: null }
      : { outcome: "Fail", evidence, failureReason: `expected >= ${cfg.expectMinValue}, got ${value}` };
  }
  return { outcome: "Error", evidence, failureReason: "neither expectValue nor expectMinValue set" };
}

function skipFor(_c: CaseRow, reason: string) {
  return { outcome: "Skip" as const, evidence: null, failureReason: reason };
}
