using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Mvc;

namespace Sains.Crm.Web.Controllers.Api;

[Route("auth")]
public sealed class AuthController : Controller
{
    [HttpGet("fim/challenge")]
    public IActionResult Challenge(string? returnUrl = "/")
        => Challenge(new AuthenticationProperties { RedirectUri = returnUrl ?? "/" },
            OpenIdConnectDefaults.AuthenticationScheme);

    [HttpPost("fim/logout")]
    [HttpGet("fim/logout")]
    public IActionResult Logout()
        => SignOut(new AuthenticationProperties { RedirectUri = "/goodbye" },
            CookieAuthenticationDefaults.AuthenticationScheme,
            OpenIdConnectDefaults.AuthenticationScheme);

    [HttpGet("403")]
    public IActionResult Forbidden() => View("~/Pages/Forbidden.cshtml");
}
