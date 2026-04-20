using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sains.Crm.Application.Quotations;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/quotations")]
public sealed class QuotationsController : ControllerBase
{
    private readonly IMediator _mediator;
    public QuotationsController(IMediator mediator) { _mediator = mediator; }

    [HttpPost]
    public async Task<ActionResult<CreateQuotationResult>> Create([FromBody] CreateQuotationCommand c, CancellationToken ct)
    {
        var r = await _mediator.Send(c, ct);
        return CreatedAtAction(nameof(GetById), new { id = r.Id }, r);
    }

    [HttpGet("{id:guid}")]
    public Task<IActionResult> GetById(Guid id) => Task.FromResult<IActionResult>(Ok(new { id }));

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        var r = await _mediator.Send(new SubmitQuotationCommand(id), ct);
        return r.IsSuccess ? NoContent() : BadRequest(r.Error);
    }

    [HttpPost("{id:guid}/vet")]
    [Authorize(Policy = "CanVet")]
    public async Task<ActionResult<VetQuotationResult>> Vet(Guid id, [FromBody] VetQuotationRequest req, CancellationToken ct)
    {
        var r = await _mediator.Send(new VetQuotationCommand(id, req.Decision, req.ReturnNotes), ct);
        return Ok(r);
    }

    [HttpPost("{id:guid}/mark-sent")]
    public async Task<IActionResult> MarkSent(Guid id, CancellationToken ct)
    {
        var r = await _mediator.Send(new MarkQuotationSentCommand(id), ct);
        return r.IsSuccess ? NoContent() : BadRequest(r.Error);
    }

    [HttpPost("{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id, [FromBody] AcceptQuotationRequest req, CancellationToken ct)
    {
        var r = await _mediator.Send(new AcceptQuotationCommand(id, req.Via, req.WotReference), ct);
        return r.IsSuccess ? NoContent() : BadRequest(r.Error);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectQuotationRequest req, CancellationToken ct)
    {
        var r = await _mediator.Send(new RejectQuotationCommand(id, req.Reason, req.OtherText), ct);
        return r.IsSuccess ? NoContent() : BadRequest(r.Error);
    }

    [HttpPost("{id:guid}/lines")]
    public async Task<IActionResult> AddLine(Guid id, [FromBody] AddQuotationLineCommand c, CancellationToken ct)
    {
        var r = await _mediator.Send(c with { QuotationId = id }, ct);
        return r.IsSuccess ? NoContent() : BadRequest(r.Error);
    }

    public sealed record VetQuotationRequest(VettingDecision Decision, string? ReturnNotes);
    public sealed record AcceptQuotationRequest(AcceptanceChannel Via, string? WotReference);
    public sealed record RejectQuotationRequest(RejectionReason Reason, string? OtherText);
}
