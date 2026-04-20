using Sains.Crm.Domain.Uat;

namespace Sains.Crm.Application.Uat;

public interface IUatCaseStore
{
    Task<int> UpsertManyAsync(IReadOnlyList<UatTestCase> cases, CancellationToken ct);
    Task<IReadOnlyList<UatTestCase>> GetAllAsync(UatModule? filter, CancellationToken ct);
    Task<UatTestCase?> GetAsync(string testId, CancellationToken ct);
}

public interface IUatRunStore
{
    Task<Guid> StartRunAsync(string triggerSource, Guid? triggeredByUserId, UatModule? moduleFilter, int totalCases, CancellationToken ct);
    Task RecordResultAsync(Guid runId, UatTestResult result, bool matchesSains, CancellationToken ct);
    Task CompleteRunAsync(Guid runId, int pass, int fail, int skip, int error, CancellationToken ct);
    Task AbortRunAsync(Guid runId, string reason, CancellationToken ct);
    Task<UatRunSummary?> GetLatestAsync(CancellationToken ct);
    Task<IReadOnlyList<UatRunSummary>> ListRecentAsync(int take, CancellationToken ct);
    Task<UatRunDetail?> GetDetailAsync(Guid runId, CancellationToken ct);
}

public interface IUatExecutor
{
    /// <summary>Invoked for every case. Returns a result even on infrastructure errors.</summary>
    Task<UatTestResult> ExecuteAsync(UatTestCase testCase, CancellationToken ct);
}

public interface IUatRunner
{
    /// <summary>Runs every case (or the module subset), writes a single test run, returns run id.</summary>
    Task<Guid> RunAsync(string triggerSource, Guid? triggeredBy, UatModule? filter, CancellationToken ct);
}

public sealed record UatRunSummary(
    Guid RunId,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    string TriggerSource,
    int TotalCases,
    int PassCount,
    int FailCount,
    int SkipCount,
    int ErrorCount,
    decimal? ScorePct,
    string Status);

public sealed record UatRunDetail(
    UatRunSummary Summary,
    IReadOnlyList<UatCaseResultRow> Cases);

public sealed record UatCaseResultRow(
    string TestId,
    UatModule Module,
    string? Script,
    string Scenario,
    string SainsBaseline,        // baseline from SAINS feedback
    UatOutcome HarnessOutcome,   // what the harness saw
    UatSeverity Severity,
    string Reconciliation,       // Agree-Pass | Agree-Fail | Regression-Fixed | Regression-Broken | NotRun | Mismatch
    int? LatencyMs,
    string? FailureReason);
