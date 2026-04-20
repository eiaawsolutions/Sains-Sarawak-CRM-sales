using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sains.Crm.Domain.Uat;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Uat.Executors;

/// <summary>
/// Executes a parameter-less SQL that returns a single scalar and asserts against it.
/// Config:
///   { "sql": "SELECT COUNT(*) FROM crm.feature_flags", "expectValue": 5 }   (exact)
///   { "sql": "...",                                   "expectMinValue": 5 } (>=)
/// The SQL is whitelisted to start with SELECT — anything else is rejected.
/// </summary>
public sealed class SqlAssertionExecutor
{
    private readonly CrmDbContext _db;
    public SqlAssertionExecutor(CrmDbContext db) { _db = db; }

    public async Task<UatTestResult> ExecuteAsync(UatTestCase c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.ExecutorConfigJson))
            return Skip(c, "missing executor_config");

        AssertionConfig? cfg;
        try { cfg = JsonSerializer.Deserialize<AssertionConfig>(c.ExecutorConfigJson, JsonOpts); }
        catch (Exception ex) { return Error(c, $"bad config: {ex.Message}"); }
        if (cfg is null || string.IsNullOrWhiteSpace(cfg.Sql))
            return Skip(c, "config missing sql");

        var trimmed = cfg.Sql.TrimStart();
        if (!trimmed.StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            return Error(c, "SQL must start with SELECT");

        var sw = Stopwatch.StartNew();
        try
        {
            var raw = await _db.Database.SqlQueryRaw<long?>(cfg.Sql).FirstOrDefaultAsync(ct);
            sw.Stop();
            var value = raw ?? 0;
            var evidence = $"scalar={value}";

            if (cfg.ExpectValue.HasValue)
            {
                return value == cfg.ExpectValue.Value
                    ? Pass(c, sw, evidence)
                    : Fail(c, sw, evidence, $"expected {cfg.ExpectValue}, got {value}");
            }
            if (cfg.ExpectMinValue.HasValue)
            {
                return value >= cfg.ExpectMinValue.Value
                    ? Pass(c, sw, evidence)
                    : Fail(c, sw, evidence, $"expected >= {cfg.ExpectMinValue}, got {value}");
            }
            return Error(c, "neither expectValue nor expectMinValue set");
        }
        catch (Exception ex)
        {
            sw.Stop();
            return Error(c, ex.Message);
        }
    }

    private static UatTestResult Pass(UatTestCase c, Stopwatch sw, string ev)  => new(c.TestId, UatOutcome.Pass, (int)sw.ElapsedMilliseconds, ev, null);
    private static UatTestResult Fail(UatTestCase c, Stopwatch sw, string ev, string why) => new(c.TestId, UatOutcome.Fail, (int)sw.ElapsedMilliseconds, ev, why);
    private static UatTestResult Skip(UatTestCase c, string why) => new(c.TestId, UatOutcome.Skip, null, null, why);
    private static UatTestResult Error(UatTestCase c, string why) => new(c.TestId, UatOutcome.Error, null, null, why);

    private sealed class AssertionConfig
    {
        [JsonPropertyName("sql")]            public string? Sql { get; set; }
        [JsonPropertyName("expectValue")]    public long? ExpectValue { get; set; }
        [JsonPropertyName("expectMinValue")] public long? ExpectMinValue { get; set; }
        [JsonPropertyName("note")]           public string? Note { get; set; }
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };
}
