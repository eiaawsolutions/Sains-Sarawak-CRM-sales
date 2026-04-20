using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Services;

/// <summary>
/// Thin layer that owns the <c>crm.users</c> table. First-login provisioning is defensive —
/// default role is <see cref="RoleCode.Viewer"/> until an Administrator promotes the user.
/// </summary>
public sealed class UserDirectory : IUserDirectory
{
    private readonly CrmDbContext _db;
    private readonly IClock _clock;

    public UserDirectory(CrmDbContext db, IClock clock) { _db = db; _clock = clock; }

    public async Task<AgentNumberingInfo?> GetForNumberingAsync(Guid userId, CancellationToken ct)
        => await _db.Database.SqlQueryRaw<AgentNumberingInfo>(
            @"SELECT u.id AS UserId,
                     ISNULL(u.staff_prefix, 'UNKNOWN') AS StaffPrefix,
                     ISNULL(d.code, '0-00') AS DepartmentCode,
                     ISNULL(s.code, '000') AS SectionCode
              FROM crm.users u
              LEFT JOIN crm.departments d ON d.id = u.department_id
              LEFT JOIN crm.sections    s ON s.id = u.section_id
              WHERE u.id = @uid",
            new SqlParameter("@uid", userId))
        .AsNoTracking()
        .FirstOrDefaultAsync(ct);

    public async Task<UserContext?> EnsureUserFromFimAsync(string sub, string fullName, string email, string? mobile, CancellationToken ct)
    {
        var existing = await _db.Database.SqlQueryRaw<UserRow>(
            @"SELECT TOP 1 id AS Id, role_id AS RoleId, department_id AS DepartmentId, section_id AS SectionId,
                     staff_prefix AS StaffPrefix, full_name AS FullName
              FROM crm.users WHERE fim_sub = @s",
            new SqlParameter("@s", sub))
        .AsNoTracking()
        .FirstOrDefaultAsync(ct);

        if (existing is not null)
            return new UserContext(existing.Id, sub, existing.FullName ?? fullName,
                (RoleCode)existing.RoleId, existing.DepartmentId, existing.SectionId, existing.StaffPrefix);

        // First-login provisioning — default to Viewer per ADR-0004.
        var newId = Guid.NewGuid();
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO crm.users
                (id, fim_sub, full_name, email, mobile, role_id, is_active, created_at, updated_at)
            VALUES
                ({newId}, {sub}, {fullName}, {email}, {mobile},
                 {(int)RoleCode.Viewer}, 1, {_clock.UtcNow}, {_clock.UtcNow});", ct);

        return new UserContext(newId, sub, fullName, RoleCode.Viewer, null, null, null);
    }

    public Task RecordLoginAsync(Guid userId, CancellationToken ct)
        => _db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE crm.users SET last_login_at = {_clock.UtcNow} WHERE id = {userId};", ct);

    private sealed class UserRow
    {
        public Guid Id { get; set; }
        public int RoleId { get; set; }
        public Guid? DepartmentId { get; set; }
        public Guid? SectionId { get; set; }
        public string? StaffPrefix { get; set; }
        public string? FullName { get; set; }
    }
}
