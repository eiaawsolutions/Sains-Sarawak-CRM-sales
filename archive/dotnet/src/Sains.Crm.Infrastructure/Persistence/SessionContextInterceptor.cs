using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;

namespace Sains.Crm.Infrastructure.Persistence;

/// <summary>
/// EF Core connection interceptor — propagates the current <see cref="UserContext"/> into
/// SQL Server <c>SESSION_CONTEXT</c> on every connection open. This is the foundation of
/// RLS (see V0008_schema_rls_policies.sql). Without this, every policy denies access.
/// </summary>
public sealed class SessionContextInterceptor : DbConnectionInterceptor
{
    private readonly ICurrentUserAccessor _currentUser;

    public SessionContextInterceptor(ICurrentUserAccessor currentUser)
    {
        _currentUser = currentUser;
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        var ctx = _currentUser.Current;
        if (ctx is null)
        {
            // No user context: treat as unauthenticated. All RLS-scoped tables will return zero rows.
            return;
        }

        if (connection is not SqlConnection)
            return;

        await SetContextAsync(connection, "user_id", ctx.UserId.ToString(), cancellationToken);
        await SetContextAsync(connection, "role_code", ctx.Role.ToString(), cancellationToken);
        await SetContextAsync(connection, "section_id", ctx.SectionId?.ToString() ?? string.Empty, cancellationToken);
        await SetContextAsync(connection, "department_id", ctx.DepartmentId?.ToString() ?? string.Empty, cancellationToken);
        await SetContextAsync(connection, "bypass_rls", "0", cancellationToken);
    }

    private static async Task SetContextAsync(DbConnection conn, string key, string value, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "EXEC sp_set_session_context @key = @k, @value = @v, @read_only = 1;";
        var pk = cmd.CreateParameter(); pk.ParameterName = "@k"; pk.Value = key; cmd.Parameters.Add(pk);
        var pv = cmd.CreateParameter(); pv.ParameterName = "@v"; pv.Value = value;  cmd.Parameters.Add(pv);
        await cmd.ExecuteNonQueryAsync(ct);
    }
}
