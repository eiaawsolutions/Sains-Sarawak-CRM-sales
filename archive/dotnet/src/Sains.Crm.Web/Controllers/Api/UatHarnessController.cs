using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Uat;

namespace Sains.Crm.Web.Controllers.Api;

[ApiController]
[Authorize(Policy = "CanAdmin")]
[Route("api/admin/uat")]
public sealed class UatHarnessController : ControllerBase
{
    private readonly IUatRunner _runner;
    private readonly IUatRunStore _runs;
    private readonly IUatCaseStore _cases;
    private readonly ICurrentUserAccessor _user;

    public UatHarnessController(IUatRunner runner, IUatRunStore runs, IUatCaseStore cases, ICurrentUserAccessor user)
    {
        _runner = runner; _runs = runs; _cases = cases; _user = user;
    }

    /// <summary>Kick off a fresh run. Returns the run id immediately — run is synchronous.</summary>
    [HttpPost("runs")]
    public async Task<ActionResult<Guid>> StartRun([FromQuery] UatModule? module, CancellationToken ct)
    {
        var userId = _user.Current?.UserId;
        var runId = await _runner.RunAsync("manual_ui", userId, module, ct);
        return Ok(runId);
    }

    [HttpGet("runs")]
    public async Task<ActionResult<IReadOnlyList<UatRunSummary>>> ListRuns([FromQuery] int take = 25, CancellationToken ct = default)
        => Ok(await _runs.ListRecentAsync(take, ct));

    [HttpGet("runs/latest")]
    public async Task<ActionResult<UatRunSummary?>> Latest(CancellationToken ct)
        => Ok(await _runs.GetLatestAsync(ct));

    [HttpGet("runs/{runId:guid}")]
    public async Task<ActionResult<UatRunDetail>> GetDetail(Guid runId, CancellationToken ct)
    {
        var detail = await _runs.GetDetailAsync(runId, ct);
        return detail is null ? NotFound() : Ok(detail);
    }

    [HttpGet("cases")]
    public async Task<ActionResult<IReadOnlyList<UatTestCase>>> ListCases([FromQuery] UatModule? module, CancellationToken ct)
        => Ok(await _cases.GetAllAsync(module, ct));

    [HttpGet("cases/{testId}")]
    public async Task<ActionResult<UatTestCase>> GetCase(string testId, CancellationToken ct)
    {
        var c = await _cases.GetAsync(testId, ct);
        return c is null ? NotFound() : Ok(c);
    }
}
