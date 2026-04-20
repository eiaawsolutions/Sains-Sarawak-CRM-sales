namespace Sains.Crm.Infrastructure.Identity;

/// <summary>
/// Bound from <c>appsettings.json</c> section <c>Fim</c>. Production values live in user secrets
/// or SAINS vault; never commit real <see cref="ClientSecret"/>.
/// </summary>
public sealed class FimOptions
{
    public const string Section = "Fim";

    /// <summary>FIM 2.0 authority root, e.g. <c>https://fim2.sarawak.gov.my</c>.</summary>
    public string Authority { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    /// <summary>CRM callback URL registered with SAINS, e.g. <c>https://crm.sains.my/auth/fim/callback</c>.</summary>
    public string CallbackPath { get; set; } = "/auth/fim/callback";
    public string SignedOutCallbackPath { get; set; } = "/auth/fim/signed-out";
    public string Scopes { get; set; } = "openid email cn mobile";
    public string LogoutRedirectPath { get; set; } = "/goodbye";
    /// <summary>Whether to use PKCE (RFC 7636 S256). Strongly recommended — leave on.</summary>
    public bool UsePkce { get; set; } = true;
    /// <summary>Clock skew tolerance for JWT validation.</summary>
    public TimeSpan ClockSkew { get; set; } = TimeSpan.FromMinutes(2);
}
