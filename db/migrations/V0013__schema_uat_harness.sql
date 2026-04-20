/* ============================================================
   V0013 — UAT test harness schema
   Backs the /admin/uat page + nightly CI scorer.
   Source: "(Revise) SAINS CRM – Full System Test Scripts 1.0 - feedback by SAINS.xlsx"
   Seed: db/testdata/uat_cases.json  (179 cases)
   ============================================================ */

-- ----------------------------------------------------------------
-- UAT test cases (canonical catalogue — seeded from JSON on startup)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.uat_test_cases', N'U') IS NULL
CREATE TABLE crm.uat_test_cases (
    test_id             varchar(64)      NOT NULL PRIMARY KEY,          -- e.g. 'QUOTE-001', 'PROPCOMB-005'
    sheet               varchar(100)     NOT NULL,                      -- verbatim sheet name
    module              varchar(32)      NOT NULL,                      -- Auth | Customer | Lead | Quotation | Proposal | Admin | Reporting
    script              varchar(200)     NULL,                          -- "Test Script:" banner
    ordinal             varchar(8)       NULL,                          -- '1.0', '2.0' etc. — display order
    scenario            nvarchar(500)    NOT NULL,
    steps               nvarchar(max)    NOT NULL,                      -- newline-delimited raw
    expected            nvarchar(max)    NOT NULL,
    sains_actual        varchar(24)      NOT NULL DEFAULT 'Pending',    -- baseline from SAINS feedback: Pass | Fail | Pending
    sains_remark        nvarchar(max)    NULL,
    claritas_remark     nvarchar(max)    NULL,
    severity            varchar(16)      NOT NULL DEFAULT 'Medium',     -- Critical | High | Medium | Low (derived on seed)
    executor_type       varchar(32)      NOT NULL DEFAULT 'manual',     -- manual | http_probe | domain_rule | sql_assertion
    executor_config     nvarchar(max)    NULL,                          -- JSON blob — per-executor config
    created_at          datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_uat_cases_module ON crm.uat_test_cases(module, script);
GO

-- ----------------------------------------------------------------
-- UAT test runs (one per invocation — manual or scheduled)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.uat_test_runs', N'U') IS NULL
CREATE TABLE crm.uat_test_runs (
    id                  uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    started_at          datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    completed_at        datetime2(7)     NULL,
    triggered_by_user_id uniqueidentifier NULL REFERENCES crm.users(id),
    trigger_source      varchar(32)      NOT NULL,                      -- 'manual_ui' | 'nightly_cron' | 'ci'
    module_filter       varchar(32)      NULL,                          -- NULL = all modules
    total_cases         int              NOT NULL DEFAULT 0,
    pass_count          int              NOT NULL DEFAULT 0,
    fail_count          int              NOT NULL DEFAULT 0,
    skip_count          int              NOT NULL DEFAULT 0,
    error_count         int              NOT NULL DEFAULT 0,
    score_pct           decimal(5,2)     NULL,                          -- pass / (total - skip), 0..100
    status              varchar(16)      NOT NULL DEFAULT 'running',    -- running | completed | aborted | error
    notes               nvarchar(1000)   NULL
);
GO

CREATE INDEX IX_uat_runs_started ON crm.uat_test_runs(started_at DESC);
GO

-- ----------------------------------------------------------------
-- UAT per-case results (one row per case per run)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.uat_test_results', N'U') IS NULL
CREATE TABLE crm.uat_test_results (
    id                  bigint           IDENTITY(1,1) NOT NULL PRIMARY KEY,
    run_id              uniqueidentifier NOT NULL REFERENCES crm.uat_test_runs(id) ON DELETE CASCADE,
    test_id             varchar(64)      NOT NULL REFERENCES crm.uat_test_cases(test_id),
    outcome             varchar(16)      NOT NULL,                      -- Pass | Fail | Skip | Error
    latency_ms          int              NULL,
    evidence            nvarchar(max)    NULL,                          -- captured HTTP status / SQL result / exception message
    failure_reason      nvarchar(max)    NULL,
    matches_sains       bit              NOT NULL DEFAULT 0,            -- 1 iff harness outcome agrees with sains_actual
    executed_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_uat_results_run ON crm.uat_test_results(run_id, outcome);
CREATE INDEX IX_uat_results_test ON crm.uat_test_results(test_id, executed_at DESC);
GO

-- ----------------------------------------------------------------
-- Append-only lock on results (any correction goes into a new run)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.trg_uat_results_no_update', N'TR') IS NULL
EXEC('
CREATE TRIGGER crm.trg_uat_results_no_update
ON crm.uat_test_results
INSTEAD OF UPDATE AS
BEGIN
    RAISERROR (''crm.uat_test_results is append-only; create a new run'', 16, 1);
END');
GO

-- ----------------------------------------------------------------
-- Summary view — latest-run per case with SAINS baseline comparison
-- ----------------------------------------------------------------
CREATE OR ALTER VIEW crm.vw_uat_latest_results AS
WITH latest AS (
    SELECT r.test_id, MAX(r.executed_at) AS latest_at
    FROM crm.uat_test_results r
    GROUP BY r.test_id
)
SELECT
    c.test_id, c.module, c.script, c.scenario, c.severity,
    c.sains_actual                      AS sains_baseline,
    ISNULL(r.outcome, 'NotRun')         AS harness_outcome,
    r.latency_ms, r.failure_reason,
    CASE
        WHEN r.outcome IS NULL THEN 'NotRun'
        WHEN r.outcome = 'Pass' AND c.sains_actual = 'Pass' THEN 'Agree-Pass'
        WHEN r.outcome = 'Fail' AND c.sains_actual = 'Fail' THEN 'Agree-Fail'
        WHEN r.outcome = 'Pass' AND c.sains_actual = 'Fail' THEN 'Regression-Fixed'
        WHEN r.outcome = 'Fail' AND c.sains_actual = 'Pass' THEN 'Regression-Broken'
        ELSE 'Mismatch'
    END AS reconciliation,
    r.executed_at
FROM crm.uat_test_cases c
LEFT JOIN latest l ON l.test_id = c.test_id
LEFT JOIN crm.uat_test_results r ON r.test_id = c.test_id AND r.executed_at = l.latest_at;
GO

PRINT 'V0013 applied: UAT harness schema';
