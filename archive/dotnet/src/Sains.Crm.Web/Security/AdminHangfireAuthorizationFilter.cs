using Hangfire.Dashboard;

namespace Sains.Crm.Web.Security;

public sealed class AdminHangfireAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext ctx)
    {
        var http = ctx.GetHttpContext();
        return http.User.Identity?.IsAuthenticated == true
            && http.User.HasClaim("role", "Administrator");
    }
}
