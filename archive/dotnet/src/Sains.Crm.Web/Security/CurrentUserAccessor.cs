using Microsoft.AspNetCore.Http;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;

namespace Sains.Crm.Web.Security;

/// <summary>
/// Adapts the authenticated ASP.NET Core principal into the domain <see cref="UserContext"/>.
/// Claims come from FIM 2.0 OIDC: <c>sub</c>, <c>cn</c>, <c>mail</c>, <c>role</c>, <c>section_id</c>,
/// <c>department_id</c>, <c>staff_prefix</c>. The session cookie carries these after
/// first-login provisioning by <see cref="Infrastructure.Services.UserDirectory"/>.
/// </summary>
public sealed class CurrentUserAccessor : ICurrentUserAccessor
{
    private readonly IHttpContextAccessor _http;
    public CurrentUserAccessor(IHttpContextAccessor http) { _http = http; }

    public UserContext? Current
    {
        get
        {
            var principal = _http.HttpContext?.User;
            if (principal is null || !(principal.Identity?.IsAuthenticated ?? false)) return null;

            var sub = principal.FindFirst("sub")?.Value;
            var userIdClaim = principal.FindFirst("crm_user_id")?.Value;
            if (sub is null || !Guid.TryParse(userIdClaim, out var userId)) return null;

            var roleStr = principal.FindFirst("role")?.Value ?? nameof(RoleCode.Viewer);
            _ = Enum.TryParse<RoleCode>(roleStr, out var role);

            Guid? dept = Guid.TryParse(principal.FindFirst("department_id")?.Value, out var d) ? d : null;
            Guid? sect = Guid.TryParse(principal.FindFirst("section_id")?.Value, out var s) ? s : null;
            var prefix = principal.FindFirst("staff_prefix")?.Value;
            var name = principal.FindFirst("cn")?.Value ?? principal.Identity?.Name ?? "(anonymous)";

            return new UserContext(userId, sub, name, role, dept, sect, prefix);
        }
    }
}
