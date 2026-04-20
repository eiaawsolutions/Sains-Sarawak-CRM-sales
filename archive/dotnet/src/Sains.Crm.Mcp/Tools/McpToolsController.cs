using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Mcp.Tools;

[ApiController]
[Authorize]
[Route("mcp")]
public sealed class McpToolsController : ControllerBase
{
    private readonly CrmDbContext _db;
    private readonly ICurrentUserAccessor _user;

    public McpToolsController(CrmDbContext db, ICurrentUserAccessor user) { _db = db; _user = user; }

    [HttpGet("tools")]
    [AllowAnonymous]
    public IActionResult List() => Ok(McpManifest.All);

    [HttpPost("tools/{name}/invoke")]
    public async Task<IActionResult> Invoke(string name, [FromBody] System.Text.Json.JsonElement input, CancellationToken ct)
    {
        if (!McpManifest.All.Any(t => t.Name == name))
            return NotFound(new { error = "tool_not_found" });

        // All tools run under the invoker's auth context — the SessionContextInterceptor
        // has already set SESSION_CONTEXT so any EF query respects RLS.
        return name switch
        {
            "search_leads"              => await SearchLeads(input, ct),
            "get_lead"                  => await GetLead(input, ct),
            "get_account_360"           => await GetAccount360(input, ct),
            "query_pipeline"            => await QueryPipeline(input, ct),
            "query_audit_log"           => await QueryAuditLog(input, ct),
            _                           => Ok(new { todo = "v1.1 — wire remaining handlers when agents ship" })
        };
    }

    private async Task<IActionResult> SearchLeads(System.Text.Json.JsonElement input, CancellationToken ct)
    {
        var query = input.TryGetProperty("query", out var q) ? q.GetString() ?? "" : "";
        var limit = input.TryGetProperty("limit", out var l) ? l.GetInt32() : 20;

        var rows = await _db.Leads
            .Where(x => string.IsNullOrEmpty(query) || x.OrganizationName.Contains(query))
            .OrderByDescending(x => x.Id)
            .Take(Math.Min(limit, 50))
            .Select(x => new { x.Id, x.OrganizationName, x.Status, x.PrimaryContactName })
            .ToListAsync(ct);
        return Ok(rows);
    }

    private async Task<IActionResult> GetLead(System.Text.Json.JsonElement input, CancellationToken ct)
    {
        if (!Guid.TryParse(input.GetProperty("id").GetString(), out var id))
            return BadRequest();
        var row = await _db.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    private async Task<IActionResult> GetAccount360(System.Text.Json.JsonElement input, CancellationToken ct)
    {
        if (!Guid.TryParse(input.GetProperty("id").GetString(), out var id))
            return BadRequest();
        var row = await _db.Database
            .SqlQueryRaw<Account360Row>(
                "SELECT * FROM crm.v_customer_360 WHERE account_id = @id",
                new Microsoft.Data.SqlClient.SqlParameter("@id", id))
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
        return row is null ? NotFound() : Ok(row);
    }

    private async Task<IActionResult> QueryPipeline(System.Text.Json.JsonElement input, CancellationToken ct)
    {
        var rows = await _db.Quotations
            .OrderByDescending(x => x.Id)
            .Take(100)
            .Select(x => new { x.Id, x.QuotationNoRaw, x.Status, x.Total, x.OwnerUserId })
            .ToListAsync(ct);
        return Ok(rows);
    }

    private async Task<IActionResult> QueryAuditLog(System.Text.Json.JsonElement input, CancellationToken ct)
    {
        var user = _user.Current;
        if (user is null || user.Role is not (RoleCode.Administrator or RoleCode.Director))
            return Forbid();

        var limit = input.TryGetProperty("limit", out var l) ? l.GetInt32() : 100;
        var rows = await _db.Database
            .SqlQueryRaw<AuditRow>(
                "SELECT TOP (@top) id, event_time, event_type, actor_user_id, target_entity, target_id, outcome FROM crm.audit_log ORDER BY event_time DESC",
                new Microsoft.Data.SqlClient.SqlParameter("@top", Math.Min(limit, 500)))
            .AsNoTracking()
            .ToListAsync(ct);
        return Ok(rows);
    }

    private sealed class Account360Row
    {
        public Guid account_id { get; set; }
        public string? organization_name { get; set; }
        public int? active_contact_count { get; set; }
        public int? open_quotation_count { get; set; }
        public int? won_quotation_count { get; set; }
        public decimal? won_total_myr { get; set; }
    }

    private sealed class AuditRow
    {
        public long id { get; set; }
        public DateTime event_time { get; set; }
        public string event_type { get; set; } = "";
        public Guid? actor_user_id { get; set; }
        public string? target_entity { get; set; }
        public Guid? target_id { get; set; }
        public string outcome { get; set; } = "";
    }
}
