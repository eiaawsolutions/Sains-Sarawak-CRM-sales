using Hangfire;
using MediatR;
using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Application.Quotations;

/// <summary>
/// FSD §3.2.6 / §3.2.9 #3: "Once the quotation reaches Approved status (either via auto-approval
/// or vetting) → The CRM generates the quotation document in PDF format." The generation is
/// offloaded to Hangfire so the command-handler critical path stays fast.
/// </summary>
public sealed class RenderPdfOnQuotationApproved
    : INotificationHandler<QuotationAutoApprovedNotification>,
      INotificationHandler<QuotationVetApprovedNotification>
{
    private readonly IBackgroundJobClient _jobs;
    private readonly ILogger<RenderPdfOnQuotationApproved> _log;

    public RenderPdfOnQuotationApproved(IBackgroundJobClient jobs, ILogger<RenderPdfOnQuotationApproved> log)
    {
        _jobs = jobs; _log = log;
    }

    public Task Handle(QuotationAutoApprovedNotification n, CancellationToken ct)
    {
        _log.LogInformation("Auto-approved quotation {Id}; enqueueing PDF render", n.QuotationId);
        _jobs.Enqueue<Infrastructure.Pdf.IQuotationPdfGenerationJob>(j =>
            j.RenderAndStoreAsync(n.QuotationId, CancellationToken.None));
        return Task.CompletedTask;
    }

    public Task Handle(QuotationVetApprovedNotification n, CancellationToken ct)
    {
        _log.LogInformation("Vet-approved quotation {Id}; enqueueing PDF render", n.QuotationId);
        _jobs.Enqueue<Infrastructure.Pdf.IQuotationPdfGenerationJob>(j =>
            j.RenderAndStoreAsync(n.QuotationId, CancellationToken.None));
        return Task.CompletedTask;
    }
}

// MediatR notification wrappers — the domain events are pure records; Application layer lifts
// them to INotification so MediatR can dispatch without Domain taking a dependency on MediatR.
public sealed record QuotationAutoApprovedNotification(Guid QuotationId, decimal Total) : INotification;
public sealed record QuotationVetApprovedNotification(Guid QuotationId, Guid ApprovedByUserId) : INotification;
public sealed record QuotationClosedNotification(Guid QuotationId, AcceptanceChannel Via, string? WotReference) : INotification;
