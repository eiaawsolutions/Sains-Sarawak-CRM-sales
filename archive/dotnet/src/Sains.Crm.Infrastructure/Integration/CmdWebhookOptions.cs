namespace Sains.Crm.Infrastructure.Integration;

public sealed class CmdWebhookOptions
{
    public const string Section = "CmdWebhook";

    /// <summary>
    /// Rotated per ADR-0005 step 7. Initial values printed in Integration API v1.2 doc — treated
    /// as COMPROMISED and MUST be replaced before go-live. Load from env / secret vault, never config file.
    /// </summary>
    public string ClientId { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    /// <summary>Access token issued by SAINS after refresh; stored server-side in feature_flags or cache.</summary>
    public string AccessToken { get; set; } = string.Empty;

    /// <summary>Timestamp tolerance window (ms) for replay protection.</summary>
    public int TimestampWindowMs { get; set; } = 5 * 60 * 1000;

    /// <summary>Maximum body size accepted on the webhook endpoint.</summary>
    public int MaxBodyBytes { get; set; } = 512 * 1024;
}
