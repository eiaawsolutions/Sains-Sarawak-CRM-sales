using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;

namespace Sains.Crm.Infrastructure.Persistence;

/// <summary>
/// Writes an append-only <c>audit_log</c> row for every mutating DbContext operation.
/// Before/after snapshots use <see cref="JsonSerializer"/> with the camelCase policy so payloads
/// are greppable and de-serialisable in any downstream tool.
/// </summary>
public sealed class AuditInterceptor : SaveChangesInterceptor
{
    private readonly ICurrentUserAccessor _currentUser;
    private readonly IClock _clock;
    private readonly IAuditSink _sink;

    public AuditInterceptor(ICurrentUserAccessor currentUser, IClock clock, IAuditSink sink)
    {
        _currentUser = currentUser;
        _clock = clock;
        _sink = sink;
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        var ctx = eventData.Context;
        if (ctx is null) return await base.SavedChangesAsync(eventData, result, cancellationToken);

        var user = _currentUser.Current;
        var now = _clock.UtcNow;

        foreach (var entry in ctx.ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            var entityName = entry.Metadata.ClrType.Name;
            var eventType = $"{entityName.ToLowerInvariant()}.{entry.State.ToString().ToLowerInvariant()}";
            var idProp = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "Id");
            var targetId = idProp?.CurrentValue as Guid?;

            await _sink.AppendAsync(new AuditEntry(
                EventTime: now,
                EventType: eventType,
                ActorUserId: user?.UserId,
                ActorRoleId: user is null ? null : (int)user.Role,
                TargetEntity: entityName,
                TargetId: targetId,
                BeforeValue: entry.State is EntityState.Modified or EntityState.Deleted ? Snapshot(entry, pre: true) : null,
                AfterValue: entry.State is EntityState.Added or EntityState.Modified ? Snapshot(entry, pre: false) : null,
                Outcome: "success",
                Reason: null), cancellationToken);
        }

        return await base.SavedChangesAsync(eventData, result, cancellationToken);
    }

    private static string Snapshot(EntityEntry entry, bool pre)
    {
        var dict = entry.Properties.ToDictionary(
            p => p.Metadata.Name,
            p => pre ? p.OriginalValue : p.CurrentValue);
        return JsonSerializer.Serialize(dict, JsonOpts);
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };
}
