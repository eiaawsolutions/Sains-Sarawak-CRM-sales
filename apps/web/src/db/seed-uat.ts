/**
 * UAT seeder — upserts all 179 cases from src/uat/data/uat_cases.json. Idempotent.
 * Classifies each case (module / severity / executor) using the rules in src/uat/classify.ts.
 */
import { db, schema } from "./index";
import { sql } from "drizzle-orm";
import { normaliseActual, deriveSeverity, mapModule, deriveExecutor } from "@/uat/classify";
import cases from "@/uat/data/uat_cases.json" with { type: "json" };

interface RawCase {
  sheet: string;
  script: string | null;
  no: string;
  test_id: string;
  scenario: string | null;
  steps: string | null;
  expected: string | null;
  actual: string | null;
  remark_sains: string | null;
  remark_claritas: string | null;
}

async function main() {
  console.log(`🌱 Seeding ${(cases as RawCase[]).length} UAT cases ...`);

  for (const r of cases as RawCase[]) {
    const module = mapModule(r.sheet);
    const baseline = normaliseActual(r.actual);
    const severity = deriveSeverity(baseline, r.remark_sains);
    const { executorType, executorConfig } = deriveExecutor(r.test_id, module);

    await db
      .insert(schema.uatTestCases)
      .values({
        testId: r.test_id,
        sheet: r.sheet,
        module,
        script: r.script ?? null,
        ordinal: r.no,
        scenario: r.scenario ?? "",
        steps: r.steps ?? "",
        expected: r.expected ?? "",
        sainsActual: baseline,
        sainsRemark: r.remark_sains ?? null,
        claritasRemark: r.remark_claritas ?? null,
        severity,
        executorType,
        executorConfig,
      })
      .onConflictDoUpdate({
        target: schema.uatTestCases.testId,
        set: {
          sheet: r.sheet,
          module,
          script: r.script ?? null,
          ordinal: r.no,
          scenario: r.scenario ?? "",
          steps: r.steps ?? "",
          expected: r.expected ?? "",
          sainsActual: baseline,
          sainsRemark: r.remark_sains ?? null,
          claritasRemark: r.remark_claritas ?? null,
          severity,
          executorType,
          executorConfig,
          updatedAt: sql`NOW()`,
        },
      });
  }

  const [{ total }] = await db
    .execute(sql`SELECT COUNT(*)::int AS total FROM crm.uat_test_cases`) as unknown as Array<{ total: number }>;
  console.log(`✅ UAT seed complete. Total rows: ${total}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
