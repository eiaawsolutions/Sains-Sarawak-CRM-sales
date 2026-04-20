using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Infrastructure.Integration;

namespace Sains.Crm.Web.Controllers.Api;

/// <summary>
/// SAINS Integration API v1.2 receiver per ADR-0005. This is the *only* inbound integration
/// endpoint for CMD push. Verifies HMAC signature + timestamp window + idempotency, then hands
/// off to <see cref="ICmdWebhookSink"/> for async processing.
/// </summary>
[ApiController]
[Route("api/CommonService.svc/SaveXml/124")]
public sealed class CmdWebhookController : ControllerBase
{
    private readonly ICmdWebhookSink _sink;
    private readonly IOptions<CmdWebhookOptions> _opts;
    private readonly ILogger<CmdWebhookController> _log;

    public CmdWebhookController(ICmdWebhookSink sink, IOptions<CmdWebhookOptions> opts, ILogger<CmdWebhookController> log)
    {
        _sink = sink; _opts = opts; _log = log;
    }

    [HttpPost]
    [Consumes("text/plain", "application/json")]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        var opts = _opts.Value;

        // Defensive size limit
        if (Request.ContentLength is long len && len > opts.MaxBodyBytes)
            return StatusCode(413, new { success = false, data = new { error = "Payload too large" } });

        // Required headers
        var clientId = Request.Headers["client_id"].ToString();
        var t        = Request.Headers["t"].ToString();
        var sign     = Request.Headers["sign"].ToString();
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(t) || string.IsNullOrEmpty(sign))
            return Unauthorized(new { success = false, data = new { error = "Not authorized" } });

        // Timestamp window
        if (!long.TryParse(t, out var unixMs)
            || !HmacVerifier.IsWithinWindow(unixMs, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), opts.TimestampWindowMs))
            return Unauthorized(new { success = false, data = new { error = "Not authorized" } });

        // Client id match
        if (!string.Equals(clientId, opts.ClientId, StringComparison.Ordinal))
            return Unauthorized(new { success = false, data = new { error = "Not authorized" } });

        // Read body
        using var reader = new StreamReader(Request.Body, System.Text.Encoding.UTF8);
        var body = await reader.ReadToEndAsync(ct);

        // Verify Signature 2 = HMAC(secret, client_id + access_token + t)
        var expected = HmacVerifier.ComputeSignature2(opts.SecretKey, opts.ClientId, opts.AccessToken, t);
        if (!HmacVerifier.Verify(expected, sign.ToUpperInvariant()))
        {
            _log.LogWarning("CMD webhook signature mismatch from {Ip}", HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new { success = false, data = new { error = "Not authorized" } });
        }

        try
        {
            var futureId = await _sink.AcceptAsync(new CmdInboundPayload(
                BodyJson: body,
                ClientIdHeader: clientId,
                UnixTimeHeader: t,
                SignatureHeader: sign,
                SourceIp: HttpContext.Connection.RemoteIpAddress?.ToString()), ct);

            return Ok(new { success = true, data = new { id = futureId } });
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("kill-switch", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(503, new { success = false, data = new { error = "Service temporarily unavailable" } });
        }
    }
}
