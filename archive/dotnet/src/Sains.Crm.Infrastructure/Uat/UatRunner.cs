using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Uat;
using Sains.Crm.Infrastructure.Uat.Executors;

namespace Sains.Crm.Infrastructure.Uat;

/// <summary>
/// Dispatches every <see cref="UatTestCase"/> to the executor matching its <see cref="UatExecutorType"/>.
/// Writes results into <c>crm.uat_test_results</c> via <see cref="IUatRunStore"/>. A single run
/// is transactional at the row level; a crash mid-run leaves the run in <c>running</c> status
/// for manual cleanup.
/// </summary>
public sealed class UatRunner : IUatRunner
{
    private readonly IUatCaseStore _cases;
    private readonly IUatRunStore _runs;
    private readonly HttpProbeExecutor _http;
    private readonly SqlAssertionExecutor _sql;
    private readonly ILogger<UatRunner> _log;

    public UatRunner(
        IUatCaseStore cases, IUatRunStore runs,
        HttpProbeExecutor http, SqlAssertionExecutor sql,
        ILogger<UatRunner> log)
    {
        _cases = cases; _runs = runs; _http = http; _sql = sql; _log = log;
    }

    public async Task<Guid> RunAsync(string trigger, Guid? userId, UatModule? filter, CancellationToken ct)
    {
        var cases = await _cases.GetAllAsync(filter, ct);
        var runId = await _runs.StartRunAsync(trigger, userId, filter, cases.Count, ct);
        _log.LogInformation("UAT run {RunId} starting ({Total} cases, filter={Filter})",
            runId, cases.Count, filter?.ToString() ?? "all");

        int pass = 0, fail = 0, skip = 0, error = 0;

        foreach (var c in cases)
        {
            UatTestResult result;
            try
            {
                result = c.ExecutorType switch
                {
                    UatExecutorType.HttpProbe    => await _http.ExecuteAsync(c, ct),
                    UatExecutorType.SqlAssertion => await _sql.ExecuteAsync(c, ct),
                    UatExecutorType.Manual       => new UatTestResult(c.TestId, UatOutcome.Skip, null, null, "manual test — requires human tester"),
                    UatExecutorType.DomainRule   => new UatTestResult(c.TestId, UatOutcome.Skip, null, null, "domain-rule executor not yet wired"),
                    _                            => new UatTestResult(c.TestId, UatOutcome.Skip, null, null, "unknown executor type")
                };
            }
            catch (Exception ex)
            {
                result = new UatTestResult(c.TestId, UatOutcome.Error, null, null, ex.Message);
            }

            switch (result.Outcome)
            {
                case UatOutcome.Pass:  pass++;  break;
                case UatOutcome.Fail:  fail++;  break;
                case UatOutcome.Skip:  skip++;  break;
                case UatOutcome.Error: error++; break;
            }

            var matchesSains = (result.Outcome, c.SainsBaselineActual) switch
            {
                (UatOutcome.Pass, "Pass") => true,
                (UatOutcome.Fail, "Fail") => true,
                _                         => false
            };

            await _runs.RecordResultAsync(runId, result, matchesSains, ct);
        }

        await _runs.CompleteRunAsync(runId, pass, fail, skip, error, ct);
        _log.LogInformation("UAT run {RunId} complete: {Pass} pass, {Fail} fail, {Skip} skip, {Error} error", runId, pass, fail, skip, error);
        return runId;
    }
}
