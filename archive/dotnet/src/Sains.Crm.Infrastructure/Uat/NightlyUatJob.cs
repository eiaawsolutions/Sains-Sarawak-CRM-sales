using Hangfire;
using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Uat;

namespace Sains.Crm.Infrastructure.Uat;

/// <summary>
/// Hangfire recurring job — runs the full UAT harness once per day at 03:00 MYT. Registered at
/// startup via <c>RecurringJob.AddOrUpdate</c>.
/// </summary>
public sealed class NightlyUatJob
{
    private readonly IUatRunner _runner;
    private readonly ILogger<NightlyUatJob> _log;

    public const string JobId = "uat.nightly";
    public const string CronMyt = "0 19 * * *";   // 03:00 MYT = 19:00 UTC

    public NightlyUatJob(IUatRunner runner, ILogger<NightlyUatJob> log)
    {
        _runner = runner; _log = log;
    }

    [AutomaticRetry(Attempts = 0)]
    public async Task RunAsync()
    {
        try
        {
            var id = await _runner.RunAsync("nightly_cron", null, null, CancellationToken.None);
            _log.LogInformation("Nightly UAT run {RunId} complete.", id);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Nightly UAT run failed.");
            throw;
        }
    }
}
