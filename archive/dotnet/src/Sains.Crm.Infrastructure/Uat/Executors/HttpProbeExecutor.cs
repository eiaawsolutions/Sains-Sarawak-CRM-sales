using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Uat;

namespace Sains.Crm.Infrastructure.Uat.Executors;

/// <summary>
/// Runs an HTTP request and asserts the response matches the probe config. Used for route-
/// liveness checks (does the URL exist? does unauth get 401? does auth redirect to FIM?).
/// Never follows redirects automatically — we *want* to see the 302.
/// </summary>
public sealed class HttpProbeExecutor
{
    private readonly HttpClient _http;
    private readonly ILogger<HttpProbeExecutor> _log;

    public HttpProbeExecutor(HttpClient http, ILogger<HttpProbeExecutor> log)
    {
        _http = http; _log = log;
        _http.DefaultRequestHeaders.Add("User-Agent", "SAINS-CRM-UAT-Harness/1.0");
    }

    public async Task<UatTestResult> ExecuteAsync(UatTestCase c, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(c.ExecutorConfigJson))
            return Skip(c, "missing executor_config");

        ProbeConfig? cfg;
        try { cfg = JsonSerializer.Deserialize<ProbeConfig>(c.ExecutorConfigJson, JsonOpts); }
        catch (Exception ex) { return Error(c, $"bad config: {ex.Message}"); }
        if (cfg is null) return Skip(c, "config deserialise returned null");

        var sw = Stopwatch.StartNew();
        try
        {
            using var req = new HttpRequestMessage(new HttpMethod(cfg.Method ?? "GET"), cfg.Path);
            using var resp = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
            sw.Stop();

            var status = (int)resp.StatusCode;
            var location = resp.Headers.Location?.ToString() ?? string.Empty;

            var statusOk = cfg.ExpectStatus is null or { Length: 0 }
                ? true
                : cfg.ExpectStatus.Contains(status);

            var locationOk = string.IsNullOrEmpty(cfg.ExpectHeaderLocationContains)
                || location.Contains(cfg.ExpectHeaderLocationContains, StringComparison.OrdinalIgnoreCase);

            var evidence = $"status={status} location='{location}'";

            if (statusOk && locationOk)
                return Pass(c, sw, evidence);

            var why = !statusOk
                ? $"expected status {string.Join("|", cfg.ExpectStatus ?? [])}, got {status}"
                : $"expected Location to contain '{cfg.ExpectHeaderLocationContains}', got '{location}'";
            return Fail(c, sw, evidence, why);
        }
        catch (TaskCanceledException)
        {
            sw.Stop();
            return Fail(c, sw, null, "request timed out");
        }
        catch (Exception ex)
        {
            sw.Stop();
            return Error(c, ex.Message);
        }
    }

    private static UatTestResult Pass(UatTestCase c, Stopwatch sw, string evidence)
        => new(c.TestId, UatOutcome.Pass, (int)sw.ElapsedMilliseconds, evidence, null);

    private static UatTestResult Fail(UatTestCase c, Stopwatch sw, string? evidence, string why)
        => new(c.TestId, UatOutcome.Fail, (int)sw.ElapsedMilliseconds, evidence, why);

    private static UatTestResult Skip(UatTestCase c, string reason)
        => new(c.TestId, UatOutcome.Skip, null, null, reason);

    private static UatTestResult Error(UatTestCase c, string msg)
        => new(c.TestId, UatOutcome.Error, null, null, msg);

    private sealed class ProbeConfig
    {
        [JsonPropertyName("method")]                      public string? Method { get; set; }
        [JsonPropertyName("path")]                        public string? Path { get; set; }
        [JsonPropertyName("expectStatus")]                public int[]? ExpectStatus { get; set; }
        [JsonPropertyName("expectHeaderLocationContains")]public string? ExpectHeaderLocationContains { get; set; }
    }

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };
}
