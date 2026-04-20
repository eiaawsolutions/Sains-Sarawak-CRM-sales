using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Services;

/// <summary>
/// Backs the global kill-switch surface defined in ADR-0006 guardrail #7. Values live in
/// <c>crm.feature_flags</c>. Cached for 15s to keep the hot path cheap; admin flip propagates
/// within that window.
/// </summary>
public sealed class SqlFeatureFlags : IFeatureFlags
{
    private readonly CrmDbContext _db;
    private readonly IMemoryCache _cache;
    private readonly IClock _clock;

    public SqlFeatureFlags(CrmDbContext db, IMemoryCache cache, IClock clock)
    {
        _db = db; _cache = cache; _clock = clock;
    }

    public async Task<bool> IsOnAsync(string key, CancellationToken ct)
        => await _cache.GetOrCreateAsync($"flag:{key}", async e =>
        {
            e.AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(15);
            return await _db.Database
                .SqlQueryRaw<bool>(
                    "SELECT is_enabled FROM crm.feature_flags WHERE [key] = @k",
                    new Microsoft.Data.SqlClient.SqlParameter("@k", key))
                .FirstOrDefaultAsync(ct);
        });

    public async Task<decimal?> GetNumericAsync(string key, CancellationToken ct)
    {
        // Values that are stored as numeric-in-is_enabled (see seed for vetting threshold).
        var raw = await _db.Database
            .SqlQueryRaw<int?>("SELECT is_enabled FROM crm.feature_flags WHERE [key] = @k",
                new Microsoft.Data.SqlClient.SqlParameter("@k", key))
            .FirstOrDefaultAsync(ct);
        return raw.HasValue ? (decimal)raw.Value : null;
    }

    public async Task SetAsync(string key, bool isEnabled, Guid? by, CancellationToken ct)
    {
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE crm.feature_flags
            SET is_enabled = {isEnabled}, updated_at = {_clock.UtcNow}, updated_by_user_id = {by}
            WHERE [key] = {key};", ct);
        _cache.Remove($"flag:{key}");
    }
}
