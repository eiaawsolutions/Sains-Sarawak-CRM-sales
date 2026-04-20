using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Services;

/// <summary>
/// Persists audit entries to the append-only <c>crm.audit_log</c>. The table has INSTEAD OF
/// UPDATE/DELETE triggers (V0007) so even an attacker with DB credentials cannot forge history.
/// </summary>
public sealed class SqlAuditSink : IAuditSink
{
    private readonly CrmDbContext _db;

    public SqlAuditSink(CrmDbContext db) { _db = db; }

    public Task AppendAsync(AuditEntry e, CancellationToken ct)
        => _db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO crm.audit_log
                (event_time, event_type, actor_user_id, actor_role_id, target_entity, target_id,
                 before_value, after_value, outcome, reason)
            VALUES
                ({e.EventTime}, {e.EventType}, {e.ActorUserId}, {e.ActorRoleId},
                 {e.TargetEntity}, {e.TargetId}, {e.BeforeValue}, {e.AfterValue},
                 {e.Outcome}, {e.Reason});", ct);
}
