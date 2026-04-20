using Sains.Crm.Domain.Common;

namespace Sains.Crm.Application.Abstractions;

public interface IClock { DateTimeOffset UtcNow { get; } }

public interface ICurrentUserAccessor { UserContext? Current { get; } }

public interface IAuditSink
{
    Task AppendAsync(AuditEntry entry, CancellationToken ct);
}

public sealed record AuditEntry(
    DateTimeOffset EventTime,
    string EventType,
    Guid? ActorUserId,
    int? ActorRoleId,
    string? TargetEntity,
    Guid? TargetId,
    string? BeforeValue,
    string? AfterValue,
    string Outcome,
    string? Reason);

public interface IFeatureFlags
{
    Task<bool> IsOnAsync(string key, CancellationToken ct);
    Task<decimal?> GetNumericAsync(string key, CancellationToken ct);
    Task SetAsync(string key, bool isEnabled, Guid? by, CancellationToken ct);
}

public interface IUserDirectory
{
    Task<AgentNumberingInfo?> GetForNumberingAsync(Guid userId, CancellationToken ct);
    Task<UserContext?> EnsureUserFromFimAsync(string sub, string fullName, string email, string? mobile, CancellationToken ct);
    Task RecordLoginAsync(Guid userId, CancellationToken ct);
}

public sealed record AgentNumberingInfo(Guid UserId, string StaffPrefix, string DepartmentCode, string SectionCode);

public interface IFimOidcClient
{
    Task<JwksKeySet> GetJwksAsync(CancellationToken ct);
}

public sealed record JwksKeySet(string RawJson, DateTimeOffset FetchedAt);

public interface ILdapApiClient
{
    Task<LdapUser?> LookupByEmailAsync(string email, CancellationToken ct);
}

public sealed record LdapUser(string Uid, string Name, string Email);

public interface ICmdWebhookSink
{
    Task<string> AcceptAsync(CmdInboundPayload payload, CancellationToken ct);
}

public sealed record CmdInboundPayload(
    string BodyJson,
    string ClientIdHeader,
    string UnixTimeHeader,
    string SignatureHeader,
    string? SourceIp);

public interface IAgentGateway  // v1.1 — null-implemented in v1.0
{
    Task<bool> IsAvailableAsync(CancellationToken ct);
}
