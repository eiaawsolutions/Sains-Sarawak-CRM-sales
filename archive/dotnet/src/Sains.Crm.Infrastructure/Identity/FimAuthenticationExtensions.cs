using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Sains.Crm.Infrastructure.Identity;

public static class FimAuthenticationExtensions
{
    /// <summary>
    /// Wires FIM 2.0 OIDC Authorization Code + PKCE per ADR-0004.
    /// Cookie is server-side, HttpOnly, SameSite=Lax, Secure. JWT validated locally via JWKS.
    /// </summary>
    public static IServiceCollection AddFimAuthentication(this IServiceCollection services)
    {
        services
            .AddAuthentication(options =>
            {
                options.DefaultScheme          = CookieAuthenticationDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
            })
            .AddCookie(options =>
            {
                options.Cookie.Name        = "sains.crm.session";
                options.Cookie.HttpOnly    = true;
                options.Cookie.SameSite    = Microsoft.AspNetCore.Http.SameSiteMode.Lax;
                options.Cookie.SecurePolicy= Microsoft.AspNetCore.Http.CookieSecurePolicy.Always;
                options.ExpireTimeSpan     = TimeSpan.FromHours(12);
                options.SlidingExpiration  = true;
                options.LoginPath          = "/auth/fim/challenge";
                options.LogoutPath         = "/auth/fim/logout";
                options.AccessDeniedPath   = "/auth/403";
            })
            .AddOpenIdConnect(OpenIdConnectDefaults.AuthenticationScheme, options =>
            {
                var fim = services.BuildServiceProvider().GetRequiredService<IOptions<FimOptions>>().Value;

                options.Authority               = fim.Authority;
                options.ClientId                = fim.ClientId;
                options.ClientSecret            = fim.ClientSecret;
                options.CallbackPath            = fim.CallbackPath;
                options.SignedOutCallbackPath   = fim.SignedOutCallbackPath;
                options.ResponseType            = OpenIdConnectResponseType.Code;
                options.UsePkce                 = fim.UsePkce;
                options.SaveTokens              = true;
                options.GetClaimsFromUserInfoEndpoint = true;
                options.MapInboundClaims        = false;

                foreach (var scope in fim.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                    options.Scope.Add(scope);

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    NameClaimType    = "cn",
                    RoleClaimType    = "role",
                    ValidateAudience = true,
                    ValidateIssuer   = true,
                    ValidateLifetime = true,
                    RequireSignedTokens = true,
                    ClockSkew        = fim.ClockSkew
                };

                // Events — hook first-login provisioning
                options.Events = new OpenIdConnectEvents
                {
                    OnTokenValidated = async ctx =>
                    {
                        var directory = ctx.HttpContext.RequestServices.GetRequiredService<Application.Abstractions.IUserDirectory>();
                        var sub   = ctx.Principal?.FindFirst("sub")?.Value ?? string.Empty;
                        var mail  = ctx.Principal?.FindFirst("mail")?.Value ?? string.Empty;
                        var cn    = ctx.Principal?.FindFirst("cn")?.Value ?? mail;
                        var mob   = ctx.Principal?.FindFirst("mobile")?.Value;
                        if (!string.IsNullOrEmpty(sub))
                        {
                            var user = await directory.EnsureUserFromFimAsync(sub, cn, mail, mob, ctx.HttpContext.RequestAborted);
                            if (user is not null)
                                await directory.RecordLoginAsync(user.UserId, ctx.HttpContext.RequestAborted);
                        }
                    },
                    OnRedirectToIdentityProviderForSignOut = ctx =>
                    {
                        // SAINS FIM SLO: GET /login.php?logout=1&redirect=<uri>
                        var uri = $"{fim.Authority.TrimEnd('/')}/login.php?logout=1&redirect={Uri.EscapeDataString(ctx.Properties.RedirectUri ?? fim.LogoutRedirectPath)}";
                        ctx.Response.Redirect(uri);
                        ctx.HandleResponse();
                        return Task.CompletedTask;
                    }
                };
            });

        return services;
    }
}
