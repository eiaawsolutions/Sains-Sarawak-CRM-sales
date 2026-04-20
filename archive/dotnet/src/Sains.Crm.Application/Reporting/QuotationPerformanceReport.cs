using MediatR;
using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Application.Reporting;

/// <summary>
/// FSD §3.6.1 — the single consolidated Quotation Performance Report with four views.
/// v1.0 output is the in-memory DTO; Excel + PDF rendering happens in the Web controller.
/// </summary>
public sealed record QuotationPerformanceReportQuery(
    DateOnly? FromDate,
    DateOnly? ToDate,
    Guid? SectionId,
    Guid? OwnerUserId) : IRequest<QuotationPerformanceReport>;

public sealed record QuotationPerformanceReport(
    IReadOnlyList<StatusSummaryRow> StatusSummary,
    IReadOnlyList<RejectionBreakdownRow> RejectionBreakdown,
    IReadOnlyList<RevisionSummaryRow> RevisionSummary,
    IReadOnlyList<ClosedOverviewRow> ClosedOverview,
    DateTimeOffset GeneratedAt,
    string GeneratedByName);

public sealed record StatusSummaryRow(short StatusId, string StatusCode, string StatusName, int QuotationCount, decimal? TotalValueMyr);
public sealed record RejectionBreakdownRow(byte ReasonId, string ReasonCode, string ReasonName, int QuotationCount, decimal? TotalValueMyr);
public sealed record RevisionSummaryRow(Guid QuotationId, string QuotationNo, short RevisionCount, decimal TotalMyr, DateTimeOffset? SubmittedAt);
public sealed record ClosedOverviewRow(Guid Id, string QuotationNo, string? CustomerName, decimal TotalMyr, DateTimeOffset? ClosedAt, string? SourceOfFund);

public sealed class QuotationPerformanceReportHandler : IRequestHandler<QuotationPerformanceReportQuery, QuotationPerformanceReport>
{
    private readonly CrmDbContext _db;
    private readonly IClock _clock;
    private readonly ICurrentUserAccessor _user;

    public QuotationPerformanceReportHandler(CrmDbContext db, IClock clock, ICurrentUserAccessor user)
    {
        _db = db; _clock = clock; _user = user;
    }

    public async Task<QuotationPerformanceReport> Handle(QuotationPerformanceReportQuery q, CancellationToken ct)
    {
        // RLS is already applied by SessionContextInterceptor — these queries honour the caller's scope.
        var status = await _db.Database.SqlQueryRaw<StatusSummaryRow>(
            "SELECT status_id AS StatusId, status_code AS StatusCode, status_name AS StatusName, quotation_count AS QuotationCount, total_value_myr AS TotalValueMyr FROM crm.vw_rpt_status_summary ORDER BY status_id")
            .AsNoTracking().ToListAsync(ct);

        var rejections = await _db.Database.SqlQueryRaw<RejectionBreakdownRow>(
            "SELECT reason_id AS ReasonId, reason_code AS ReasonCode, reason_name AS ReasonName, quotation_count AS QuotationCount, total_value_myr AS TotalValueMyr FROM crm.vw_rpt_rejected_breakdown ORDER BY reason_id")
            .AsNoTracking().ToListAsync(ct);

        var revisions = await _db.Database.SqlQueryRaw<RevisionSummaryRow>(
            "SELECT quotation_id AS QuotationId, quotation_no AS QuotationNo, CAST(revision_count AS smallint) AS RevisionCount, total_myr AS TotalMyr, submitted_at AS SubmittedAt FROM crm.vw_rpt_revision_summary WHERE revision_count > 1 ORDER BY revision_count DESC")
            .AsNoTracking().ToListAsync(ct);

        var closed = await _db.Database.SqlQueryRaw<ClosedOverviewRow>(
            "SELECT id AS Id, quotation_no AS QuotationNo, customer_name AS CustomerName, total_myr AS TotalMyr, closed_at AS ClosedAt, source_of_fund AS SourceOfFund FROM crm.vw_rpt_closed_overview ORDER BY closed_at DESC")
            .AsNoTracking().ToListAsync(ct);

        return new QuotationPerformanceReport(
            StatusSummary: status,
            RejectionBreakdown: rejections,
            RevisionSummary: revisions,
            ClosedOverview: closed,
            GeneratedAt: _clock.UtcNow,
            GeneratedByName: _user.Current?.FullName ?? "(system)");
    }
}
