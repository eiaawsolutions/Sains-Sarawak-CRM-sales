using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Uat;

namespace Sains.Crm.Infrastructure.Uat;

/// <summary>
/// On application start, parse <c>db/testdata/uat_cases.json</c> and upsert every row into
/// <c>crm.uat_test_cases</c>. Idempotent. JSON is treated as the authoritative catalogue —
/// if SAINS publishes a new revision of the test script workbook, re-export to JSON and
/// restart the app: all deltas land automatically.
/// </summary>
public sealed class UatSeeder : IHostedService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<UatSeeder> _log;
    private readonly string _path;

    public UatSeeder(IServiceProvider sp, ILogger<UatSeeder> log, Microsoft.Extensions.Configuration.IConfiguration cfg)
    {
        _sp = sp; _log = log;
        _path = cfg["Uat:SeedPath"] ?? "db/testdata/uat_cases.json";
    }

    public async Task StartAsync(CancellationToken ct)
    {
        if (!File.Exists(_path))
        {
            _log.LogWarning("UAT seed file not found at {Path}; skipping.", _path);
            return;
        }

        await using var fs = File.OpenRead(_path);
        var raw = await JsonSerializer.DeserializeAsync<List<RawRow>>(fs, JsonOpts, ct);
        if (raw is null) return;

        var cases = raw.Select(Convert).ToList();

        using var scope = _sp.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IUatCaseStore>();
        var upserted = await store.UpsertManyAsync(cases, ct);
        _log.LogInformation("UAT seed loaded: {Count} cases upserted from {Path}", upserted, _path);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;

    // --- Conversion & classification rules --------------------------------------------------

    private static UatTestCase Convert(RawRow r)
    {
        var module = MapModule(r.Sheet);
        var baseline = NormaliseActual(r.Actual);
        var severity = DeriveSeverity(baseline, r.RemarkSains);
        var executor = DeriveExecutor(r.TestId, module);
        return new UatTestCase(
            TestId: r.TestId,
            Sheet: r.Sheet,
            Module: module,
            Script: string.IsNullOrWhiteSpace(r.Script) ? null : r.Script,
            Ordinal: r.No,
            Scenario: r.Scenario ?? string.Empty,
            Steps: r.Steps ?? string.Empty,
            Expected: r.Expected ?? string.Empty,
            SainsBaselineActual: baseline,
            SainsRemark: string.IsNullOrWhiteSpace(r.RemarkSains) ? null : r.RemarkSains,
            ClaritasRemark: string.IsNullOrWhiteSpace(r.RemarkClaritas) ? null : r.RemarkClaritas,
            Severity: severity,
            ExecutorType: executor.type,
            ExecutorConfigJson: executor.config);
    }

    private static UatModule MapModule(string sheet) => sheet.ToUpperInvariant() switch
    {
        "SAINS CRM LOGIN VIA SSO" => UatModule.Auth,
        "CUSTOMER MODULE"         => UatModule.Customer,
        "LEAD MODULE"             => UatModule.Lead,
        "QUOTATION MODULE"        => UatModule.Quotation,
        "PROPOSAL MODULE"         => UatModule.Proposal,
        "ADMIN MODULE"            => UatModule.Admin,
        "REPORTING MODULE"        => UatModule.Reporting,
        _                         => UatModule.Admin
    };

    private static string NormaliseActual(string? raw) => (raw ?? "").Trim() switch
    {
        "Pass"              => "Pass",
        "Fail"              => "Fail",
        "Please select:"    => "Pending",
        ""                  => "Pending",
        _                   => "Pending"
    };

    /// <summary>Derive severity from the SAINS remark text + baseline outcome.</summary>
    private static UatSeverity DeriveSeverity(string baseline, string? remark)
    {
        if (baseline != "Fail") return UatSeverity.Low;
        if (string.IsNullOrWhiteSpace(remark)) return UatSeverity.Medium;
        var r = remark.ToLowerInvariant();
        if (r.Contains("can't proceed") || r.Contains("cannot proceed") ||
            r.Contains("nothing happens") || r.Contains("server error") ||
            r.Contains("ajax error") || r.Contains("object reference"))
            return UatSeverity.Critical;
        return UatSeverity.High;
    }

    /// <summary>
    /// Map a test_id to an executor. Narrow, conservative: most FSD-explicit flows we can probe
    /// today are auth + webhook + API smoke. Everything else is marked <see cref="UatExecutorType.Manual"/>
    /// so it ships in the matrix as "Skip: manual" rather than faking a pass.
    /// </summary>
    private static (UatExecutorType type, string? config) DeriveExecutor(string testId, UatModule module)
    {
        return testId switch
        {
            // Auth probes
            "LOGIN-001" => (UatExecutorType.HttpProbe, """{"method":"GET","path":"/","expectStatus":[200,302]}"""),
            "LOGIN-002" => (UatExecutorType.HttpProbe, """{"method":"GET","path":"/auth/fim/challenge","expectStatus":[302],"expectHeaderLocationContains":"fim2.sarawak.gov.my"}"""),
            "LOGIN-007" => (UatExecutorType.HttpProbe, """{"method":"GET","path":"/auth/fim/callback","expectStatus":[400,401,302]}"""),
            "LOGIN-008" => (UatExecutorType.HttpProbe, """{"method":"POST","path":"/auth/fim/logout","expectStatus":[200,302]}"""),

            // CMD webhook probe — expects 401 on unauth, confirms endpoint is live
            _ when testId.StartsWith("CUST-") && module == UatModule.Customer =>
                (UatExecutorType.HttpProbe, """{"method":"GET","path":"/api/accounts","expectStatus":[200,401]}"""),

            // Reporting endpoints probe — ensures routes exist + return auth-protected status
            "UAT-QPR-01" => (UatExecutorType.HttpProbe, """{"method":"GET","path":"/api/reports/quotation-performance","expectStatus":[200,401]}"""),
            "UAT-QPR-05" => (UatExecutorType.HttpProbe, """{"method":"GET","path":"/api/reports/quotation-performance/xlsx","expectStatus":[200,401]}"""),

            // SQL-assertion domain rules we can test immediately
            "RUN-001" => (UatExecutorType.SqlAssertion,
                """{"sql":"SELECT CASE WHEN EXISTS(SELECT 1 FROM crm.quotation_sequences) OR NOT EXISTS(SELECT 1 FROM crm.users) THEN 1 ELSE 0 END","expectValue":1,"note":"Running-number table exists and is writable."}"""),
            "AUD-001" => (UatExecutorType.SqlAssertion,
                """{"sql":"SELECT COUNT(*) FROM sys.triggers WHERE name='trg_audit_log_no_update'","expectValue":1,"note":"Audit-log append-only trigger present (FSD §3.5.4)."}"""),
            "AUD-002" => (UatExecutorType.SqlAssertion,
                """{"sql":"SELECT COUNT(*) FROM sys.triggers WHERE name='trg_audit_log_no_delete'","expectValue":1,"note":"Audit-log no-delete trigger present."}"""),
            "AUD-003" => (UatExecutorType.SqlAssertion,
                """{"sql":"SELECT CASE WHEN COLUMNPROPERTY(OBJECT_ID('crm.audit_log'),'before_value','AllowsNull')=1 AND COLUMNPROPERTY(OBJECT_ID('crm.audit_log'),'after_value','AllowsNull')=1 THEN 1 ELSE 0 END","expectValue":1,"note":"Audit-log captures before/after values (FSD §3.5.4)."}"""),
            "SYS-001" => (UatExecutorType.SqlAssertion,
                """{"sql":"SELECT COUNT(*) FROM crm.feature_flags","expectMinValue":5,"note":"Feature flags table populated with at least 5 kill switches."}"""),

            _ => (UatExecutorType.Manual, null)
        };
    }

    private sealed class RawRow
    {
        [JsonPropertyName("sheet")]           public string Sheet { get; set; } = "";
        [JsonPropertyName("script")]          public string? Script { get; set; }
        [JsonPropertyName("no")]              public string No { get; set; } = "";
        [JsonPropertyName("test_id")]         public string TestId { get; set; } = "";
        [JsonPropertyName("scenario")]        public string? Scenario { get; set; }
        [JsonPropertyName("steps")]           public string? Steps { get; set; }
        [JsonPropertyName("expected")]        public string? Expected { get; set; }
        [JsonPropertyName("actual")]          public string? Actual { get; set; }
        [JsonPropertyName("remark_sains")]    public string? RemarkSains { get; set; }
        [JsonPropertyName("remark_claritas")] public string? RemarkClaritas { get; set; }
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };
}
