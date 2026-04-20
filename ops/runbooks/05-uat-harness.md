# Runbook — UAT test harness

**What:** auto-runs the 179 SAINS UAT cases from the signed test-script workbook on every push + nightly at 03:00 MYT. Scores pass/fail and reconciles against the SAINS baseline so we see regressions and newly-fixed items instantly.

**Source of truth:** `db/testdata/uat_cases.json` — re-exported whenever SAINS publishes a new workbook revision. The seeder upserts on app start (idempotent). Every test_id is stable.

## How it works

1. `UatSeeder` (IHostedService) reads `uat_cases.json` on startup → upserts into `crm.uat_test_cases`.
2. Each case is classified:
   - **Module** — from the sheet name.
   - **Severity** — derived from SAINS baseline + remark keywords (`Critical` if remark mentions "can't proceed", "server error", etc.).
   - **Executor type** — `Manual` (most), `HttpProbe` (LOGIN-001..008, CUST-*, UAT-QPR-*), or `SqlAssertion` (AUD-*, RUN-001, SYS-001).
3. `UatRunner` iterates cases, dispatches to the matching executor, writes one row per case into `crm.uat_test_results`, updates the run's aggregate counts + score_pct.
4. Blazor page `/admin/uat` shows:
   - Pass/Fail/Skip/Score live
   - Per-case row with **SAINS baseline vs harness outcome** and **Reconciliation**:
     - `Agree-Pass`: both green
     - `Agree-Fail`: both red (known issue)
     - `Regression-Fixed`: we pass where SAINS failed → PM to notify SAINS for re-test
     - `Regression-Broken`: we fail where SAINS passed → P0 regression, halt release
5. Hangfire recurring job `uat.nightly` re-runs at 03:00 MYT with `trigger_source='nightly_cron'`.

## Executor catalogue

| Executor | What it does | Cases today |
|---|---|---|
| `HttpProbe` | Sends an HTTP request, asserts `ExpectStatus` and optional `Location` header substring match | 6 (Auth + Customer + Reporting smoke) |
| `SqlAssertion` | Runs a `SELECT`-only scalar SQL and asserts equality or minimum | 5 (audit triggers, feature flags, sequences) |
| `Manual` | Skipped — flagged for human UAT execution | 168 (most — UI-driven scenarios) |
| `DomainRule` | Reserved for v1.1 — runs in-process assertions on the domain model | 0 |

As we implement more features, move cases from `Manual` to a real executor by updating `UatSeeder.DeriveExecutor()` and re-running the seed.

## Score semantics

```
score_pct = pass / (pass + fail + error)   (skip excluded)
```

`error` means the harness itself failed (infra down, bad config) — counts against the score so we notice instead of silently hiding a broken probe.

## How to run manually

- **UI:** `/admin/uat` → "Run all modules" or pick a module → "Run selected module". Results land within seconds (HTTP probes are fast; SQL queries return immediately).
- **API:** `POST /api/admin/uat/runs[?module=Quotation]` — returns the run id.
- **CLI:** `dotnet run --project src/Sains.Crm.Web -- uat:run` (wire a startup CLI switch if needed).

## How to refresh the case catalogue

1. SAINS sends a new revision of `(Revise) SAINS CRM – Full System Test Scripts X.X.xlsx`.
2. Re-run the extractor (Python snippet in `docs/uat-extractor.md`) → new `uat_cases.json`.
3. Commit the JSON into `db/testdata/uat_cases.json`.
4. Restart the app — seeder upserts. Deleted cases are NOT removed automatically (defensive — if SAINS accidentally drops a row it stays visible).
   - To remove a case: `DELETE FROM crm.uat_test_cases WHERE test_id = 'XXX';` after verifying with SAINS.

## Reconciliation outcomes — what to do

| Reconciliation | Meaning | Action |
|---|---|---|
| `Agree-Pass` | Harness + SAINS both pass | None. Feature safe. |
| `Agree-Fail` | Both fail → known open defect | Ensure it's ticketed. |
| `Regression-Fixed` | Harness passes where SAINS failed | PM notifies SAINS; request re-test on their side. Update baseline after their retest. |
| `Regression-Broken` | Harness fails where SAINS passed | **P0.** Block release. Investigate; likely a deployment regression. |
| `NotRun` | Case exists, never executed | Normal for a fresh run that filtered by module. |
| `Mismatch` | Any other combo | Investigate — usually a Skip/Pending interaction. |

## KPI targets

- **Harness run duration**: < 90s for all 179 cases (current: ~11 executable + 168 Skip = dominated by Skip loop, trivially fast)
- **Nightly run failure rate**: 0 across 30 days
- **Regression detection**: every `Regression-Broken` must page on-call within 15 minutes (wire SIEM forwarding)

## Known limits

- 168 cases are currently `Manual` — they depend on UI flows humans have to walk through. As we extend coverage, these move to HTTP probes (for simple CRUD pages) or dedicated end-to-end tests (for Combine/Primary-Quotation flows).
- `HttpProbe` doesn't log in — it asserts 401/302 redirects. We can extend it with an FIM test-harness token once SAINS provisions one for the UAT environment.
- `SqlAssertion` only supports scalar `SELECT` — by design; never write SQL that mutates.
