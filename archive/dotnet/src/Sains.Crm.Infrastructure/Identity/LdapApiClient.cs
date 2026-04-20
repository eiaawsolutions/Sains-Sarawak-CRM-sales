using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sains.Crm.Application.Abstractions;

namespace Sains.Crm.Infrastructure.Identity;

public sealed class SmartXChangeOptions
{
    public const string Section = "SmartXChange";
    public string TokenEndpoint { get; set; } = string.Empty;     // https://api.sains.com.my/token
    public string QueryEndpoint { get; set; } = string.Empty;     // https://api.sains.com.my/ldapquery/v1.0/users/email/query
    public string ConsumerKey { get; set; } = string.Empty;
    public string ConsumerSecret { get; set; } = string.Empty;
    public TimeSpan HttpTimeout { get; set; } = TimeSpan.FromSeconds(10);
}

/// <summary>
/// Thin REST client over SAINS Smart-XChange LDAP Query API v1.0 per ADR-0004. Caches the
/// Bearer token for ~55 minutes (API TTL is 3600s).
/// </summary>
public sealed class LdapApiClient : ILdapApiClient
{
    private const string TokenCacheKey = "smartx:ldap:bearer";

    private readonly HttpClient _http;
    private readonly IMemoryCache _cache;
    private readonly SmartXChangeOptions _opts;
    private readonly ILogger<LdapApiClient> _log;

    public LdapApiClient(HttpClient http, IMemoryCache cache, IOptions<SmartXChangeOptions> opts, ILogger<LdapApiClient> log)
    {
        _http = http; _cache = cache; _opts = opts.Value; _log = log;
        _http.Timeout = _opts.HttpTimeout;
    }

    public async Task<LdapUser?> LookupByEmailAsync(string email, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return null;

        var bearer = await GetBearerAsync(ct);
        using var req = new HttpRequestMessage(HttpMethod.Post, _opts.QueryEndpoint);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        req.Content = JsonContent.Create(new { email });

        using var resp = await _http.SendAsync(req, ct);
        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            return null;
        resp.EnsureSuccessStatusCode();

        var payload = await resp.Content.ReadFromJsonAsync<LdapQueryResponse>(cancellationToken: ct);
        var r = payload?.Result?.FirstOrDefault();
        return r is null ? null : new LdapUser(r.Uid, r.Name, r.Email);
    }

    private async Task<string> GetBearerAsync(CancellationToken ct)
    {
        if (_cache.TryGetValue<string>(TokenCacheKey, out var cached) && !string.IsNullOrEmpty(cached))
            return cached;

        var basic = Convert.ToBase64String(System.Text.Encoding.ASCII.GetBytes($"{_opts.ConsumerKey}:{_opts.ConsumerSecret}"));
        using var req = new HttpRequestMessage(HttpMethod.Post, _opts.TokenEndpoint)
        {
            Content = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("grant_type", "client_credentials") })
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        var tok = await resp.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct)
                  ?? throw new InvalidOperationException("Empty Smart-XChange token response.");

        // TTL is 3600s; cache for 55 minutes to avoid end-of-life miss.
        _cache.Set(TokenCacheKey, tok.AccessToken!, TimeSpan.FromMinutes(55));
        return tok.AccessToken!;
    }

    private sealed class TokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; set; }
        [JsonPropertyName("token_type")]   public string? TokenType  { get; set; }
        // NB: the doc typos the field as expires_in_type; tolerate both.
        [JsonPropertyName("expires_in")]      public int? ExpiresIn { get; set; }
        [JsonPropertyName("expires_in_type")] public int? ExpiresInType { get; set; }
    }

    private sealed class LdapQueryResponse
    {
        [JsonPropertyName("status")]  public string? Status { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("result")]  public List<LdapQueryHit>? Result { get; set; }
    }

    private sealed class LdapQueryHit
    {
        [JsonPropertyName("uid")]   public string Uid { get; set; } = string.Empty;
        [JsonPropertyName("name")]  public string Name { get; set; } = string.Empty;
        [JsonPropertyName("email")] public string Email { get; set; } = string.Empty;
    }
}
