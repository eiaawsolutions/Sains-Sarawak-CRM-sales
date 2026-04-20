using System.Security.Cryptography;
using System.Text;
using Hangfire;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Integration;

/// <summary>
/// Accepts a CMD webhook payload after authentication has been verified at the endpoint.
/// Writes the raw payload + ledger row synchronously (so the HTTP response can return 200 &lt;300ms)
/// and enqueues a Hangfire job for async processing per ADR-0005.
/// </summary>
public sealed class CmdWebhookSink : ICmdWebhookSink
{
    private readonly CrmDbContext _db;
    private readonly IClock _clock;
    private readonly IBackgroundJobClient _jobs;
    private readonly IFeatureFlags _flags;
    private readonly ILogger<CmdWebhookSink> _log;

    public CmdWebhookSink(CrmDbContext db, IClock clock, IBackgroundJobClient jobs, IFeatureFlags flags, ILogger<CmdWebhookSink> log)
    {
        _db = db; _clock = clock; _jobs = jobs; _flags = flags; _log = log;
    }

    public async Task<string> AcceptAsync(CmdInboundPayload payload, CancellationToken ct)
    {
        if (!await _flags.IsOnAsync("cmd_webhook_enabled", ct))
            throw new InvalidOperationException("CMD webhook kill-switch is OFF.");

        // idempotency_key = SHA256(body)
        var key = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload.BodyJson))).ToLowerInvariant();

        // dedup check — if we've already processed this exact payload, return the original id
        var existing = await _db.Database
            .SqlQueryRaw<Guid?>(
                "SELECT resolved_id FROM crm.cmd_webhook_ledger WHERE idempotency_key = @k",
                new SqlParameter("@k", key))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        if (existing is { } prior && prior != Guid.Empty)
            return prior.ToString();

        // persist raw payload + ledger entry
        var payloadId = Guid.NewGuid();
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            INSERT INTO crm.cmd_webhook_payloads
                (id, received_at, body_json, body_bytes, client_id_header, unix_time_header, signature_header, source_ip)
            VALUES
                ({payloadId}, {_clock.UtcNow}, {payload.BodyJson}, {payload.BodyJson.Length},
                 {payload.ClientIdHeader}, {payload.UnixTimeHeader}, {payload.SignatureHeader}, {payload.SourceIp});

            INSERT INTO crm.cmd_webhook_ledger
                (idempotency_key, received_at, status, module, sp_key, payload_ref, correlation_id)
            VALUES
                ({key}, {_clock.UtcNow}, {(byte)WebhookStatus.Pending}, NULL, NULL, {payloadId}, {Guid.NewGuid()});",
            ct);

        // enqueue async processor
        _jobs.Enqueue<ICmdPayloadProcessor>(p => p.ProcessAsync(key, CancellationToken.None));

        // pre-allocate a resolved_id — we return it now so SAINS has something to log; the
        // processor will set the *actual* account id once it runs
        var futureId = Guid.NewGuid();
        return futureId.ToString();
    }
}

public enum WebhookStatus : byte
{
    Pending = 1, Processed = 2, Failed = 3, DeadLetter = 4
}

/// <summary>Hangfire-executed — keep constructor small and deterministic.</summary>
public interface ICmdPayloadProcessor
{
    Task ProcessAsync(string idempotencyKey, CancellationToken ct);
}
