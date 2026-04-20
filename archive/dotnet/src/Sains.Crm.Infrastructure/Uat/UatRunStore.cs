using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Uat;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Uat;

public sealed class UatRunStore : IUatRunStore
{
    private readonly CrmDbContext _db;
    public UatRunStore(CrmDbContext db) { _db = db; }

    public async Task<Guid> StartRunAsync(string trigger, Guid? userId, UatModule? filter, int total, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO crm.uat_test_runs
                (id, started_at, triggered_by_user_id, trigger_source, module_filter, total_cases, status)
            VALUES
                ({id}, SYSUTCDATETIME(), {userId}, {trigger}, {filter.HasValue ? filter.Value.ToString() : null}, {total}, 'running');", ct);
        return id;
    }

    public Task RecordResultAsync(Guid runId, UatTestResult r, bool matchesSains, CancellationToken ct)
        => _db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO crm.uat_test_results
                (run_id, test_id, outcome, latency_ms, evidence, failure_reason, matches_sains, executed_at)
            VALUES
                ({runId}, {r.TestId}, {r.Outcome.ToString()}, {r.LatencyMs}, {r.Evidence}, {r.FailureReason}, {matchesSains}, SYSUTCDATETIME());", ct);

    public async Task CompleteRunAsync(Guid runId, int pass, int fail, int skip, int error, CancellationToken ct)
    {
        var executed = pass + fail + error;
        decimal? score = executed == 0 ? null : Math.Round(100m * pass / executed, 2);
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE crm.uat_test_runs
            SET completed_at = SYSUTCDATETIME(),
                pass_count   = {pass},
                fail_count   = {fail},
                skip_count   = {skip},
                error_count  = {error},
                score_pct    = {score},
                status       = 'completed'
            WHERE id = {runId};", ct);
    }

    public Task AbortRunAsync(Guid runId, string reason, CancellationToken ct)
        => _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE crm.uat_test_runs
            SET completed_at = SYSUTCDATETIME(), status = 'aborted', notes = {reason}
            WHERE id = {runId};", ct);

    public async Task<UatRunSummary?> GetLatestAsync(CancellationToken ct)
    {
        var row = await _db.Database.SqlQueryRaw<RunRow>(
            "SELECT TOP (1) * FROM crm.uat_test_runs ORDER BY started_at DESC")
            .AsNoTracking().FirstOrDefaultAsync(ct);
        return row is null ? null : MapRun(row);
    }

    public async Task<IReadOnlyList<UatRunSummary>> ListRecentAsync(int take, CancellationToken ct)
    {
        var rows = await _db.Database.SqlQueryRaw<RunRow>(
            "SELECT TOP (@n) * FROM crm.uat_test_runs ORDER BY started_at DESC",
            new SqlParameter("@n", Math.Clamp(take, 1, 200)))
            .AsNoTracking().ToListAsync(ct);
        return rows.Select(MapRun).ToList();
    }

    public async Task<UatRunDetail?> GetDetailAsync(Guid runId, CancellationToken ct)
    {
        var run = await _db.Database.SqlQueryRaw<RunRow>(
            "SELECT * FROM crm.uat_test_runs WHERE id = @r", new SqlParameter("@r", runId))
            .AsNoTracking().FirstOrDefaultAsync(ct);
        if (run is null) return null;

        var cases = await _db.Database.SqlQueryRaw<CaseResultRow>(@"
            SELECT c.test_id, c.module, c.script, c.scenario, c.severity,
                   c.sains_actual AS sains_baseline,
                   ISNULL(r.outcome, 'NotRun') AS harness_outcome,
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
            LEFT JOIN crm.uat_test_results r ON r.test_id = c.test_id AND r.run_id = @r
            ORDER BY c.module, c.script, c.ordinal", new SqlParameter("@r", runId))
            .AsNoTracking().ToListAsync(ct);

        return new UatRunDetail(MapRun(run),
            cases.Select(c => new UatCaseResultRow(
                TestId: c.test_id,
                Module: Enum.Parse<UatModule>(c.module, true),
                Script: c.script,
                Scenario: c.scenario,
                SainsBaseline: c.sains_baseline,
                HarnessOutcome: Enum.Parse<UatOutcome>(c.harness_outcome, true),
                Severity: Enum.Parse<UatSeverity>(c.severity, true),
                Reconciliation: c.reconciliation,
                LatencyMs: c.latency_ms,
                FailureReason: c.failure_reason)).ToList());
    }

    private static UatRunSummary MapRun(RunRow r) => new(
        RunId: r.id, StartedAt: r.started_at, CompletedAt: r.completed_at,
        TriggerSource: r.trigger_source, TotalCases: r.total_cases,
        PassCount: r.pass_count, FailCount: r.fail_count, SkipCount: r.skip_count,
        ErrorCount: r.error_count, ScorePct: r.score_pct, Status: r.status);

    private sealed class RunRow
    {
        public Guid id { get; set; }
        public DateTime started_at { get; set; }
        public DateTime? completed_at { get; set; }
        public Guid? triggered_by_user_id { get; set; }
        public string trigger_source { get; set; } = "";
        public string? module_filter { get; set; }
        public int total_cases { get; set; }
        public int pass_count { get; set; }
        public int fail_count { get; set; }
        public int skip_count { get; set; }
        public int error_count { get; set; }
        public decimal? score_pct { get; set; }
        public string status { get; set; } = "";
        public string? notes { get; set; }
    }

    private sealed class CaseResultRow
    {
        public string test_id { get; set; } = "";
        public string module { get; set; } = "";
        public string? script { get; set; }
        public string scenario { get; set; } = "";
        public string severity { get; set; } = "Medium";
        public string sains_baseline { get; set; } = "Pending";
        public string harness_outcome { get; set; } = "NotRun";
        public int? latency_ms { get; set; }
        public string? failure_reason { get; set; }
        public string reconciliation { get; set; } = "NotRun";
    }
}
