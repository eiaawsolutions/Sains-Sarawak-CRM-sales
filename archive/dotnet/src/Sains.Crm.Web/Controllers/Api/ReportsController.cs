using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sains.Crm.Application.Reporting;
using Sains.Crm.Infrastructure.Reporting;

namespace Sains.Crm.Web.Controllers.Api;

[ApiController]
[Authorize]
[Route("api/reports")]
public sealed class ReportsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IReportExporter _exporter;

    public ReportsController(IMediator mediator, IReportExporter exporter)
    {
        _mediator = mediator; _exporter = exporter;
    }

    /// <summary>FSD §3.6.1 Quotation Performance Report — JSON for the web UI.</summary>
    [HttpGet("quotation-performance")]
    public async Task<ActionResult<QuotationPerformanceReport>> GetJson(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? sectionId, [FromQuery] Guid? ownerUserId,
        CancellationToken ct)
    {
        var report = await _mediator.Send(new QuotationPerformanceReportQuery(from, to, sectionId, ownerUserId), ct);
        return Ok(report);
    }

    /// <summary>FSD §3.6.1 — Excel export.</summary>
    [HttpGet("quotation-performance/xlsx")]
    public async Task<IActionResult> GetExcel(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? sectionId, [FromQuery] Guid? ownerUserId,
        CancellationToken ct)
    {
        var report = await _mediator.Send(new QuotationPerformanceReportQuery(from, to, sectionId, ownerUserId), ct);
        var bytes = _exporter.ToExcel(report);
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"quotation-performance-{DateTime.UtcNow:yyyyMMdd-HHmm}.xlsx");
    }

    /// <summary>FSD §3.6.1 — PDF export.</summary>
    [HttpGet("quotation-performance/pdf")]
    public async Task<IActionResult> GetPdf(
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] Guid? sectionId, [FromQuery] Guid? ownerUserId,
        CancellationToken ct)
    {
        var report = await _mediator.Send(new QuotationPerformanceReportQuery(from, to, sectionId, ownerUserId), ct);
        var bytes = _exporter.ToPdf(report);
        return File(bytes, "application/pdf",
            $"quotation-performance-{DateTime.UtcNow:yyyyMMdd-HHmm}.pdf");
    }
}
