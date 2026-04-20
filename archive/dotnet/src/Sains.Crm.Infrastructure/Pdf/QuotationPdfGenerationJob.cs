using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Pdf;

/// <summary>
/// Hangfire-executed side-effect of <c>QuotationAutoApproved</c> and <c>QuotationVetApproved</c>
/// domain events (FSD §3.2.6 / §3.2.9 #3). Renders the quotation PDF and persists the bytes
/// to the configured object store (local disk in v1.0; S3/R2 in future).
/// </summary>
public interface IQuotationPdfGenerationJob
{
    Task<string> RenderAndStoreAsync(Guid quotationId, CancellationToken ct);
}

public sealed class QuotationPdfGenerationJob : IQuotationPdfGenerationJob
{
    private readonly CrmDbContext _db;
    private readonly IQuotationPdfService _pdf;
    private readonly IClock _clock;
    private readonly ILogger<QuotationPdfGenerationJob> _log;
    private readonly string _storageRoot;

    public QuotationPdfGenerationJob(
        CrmDbContext db,
        IQuotationPdfService pdf,
        IClock clock,
        ILogger<QuotationPdfGenerationJob> log,
        IConfigurationStorageRoot storageRoot)
    {
        _db = db; _pdf = pdf; _clock = clock; _log = log;
        _storageRoot = storageRoot.Root;
    }

    public async Task<string> RenderAndStoreAsync(Guid quotationId, CancellationToken ct)
    {
        var q = await _db.Quotations
            .Include(x => x.Lines)
            .AsNoTracking()
            .FirstAsync(x => x.Id == quotationId, ct);

        var account = q.AccountId.HasValue
            ? await _db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == q.AccountId.Value, ct)
            : null;

        var owner = await _db.Database
            .SqlQueryRaw<OwnerRow>(
                @"SELECT u.full_name AS FullName, ISNULL(u.staff_prefix, '') AS StaffPrefix
                  FROM crm.users u WHERE u.id = @uid",
                new Microsoft.Data.SqlClient.SqlParameter("@uid", q.OwnerUserId))
            .AsNoTracking()
            .FirstAsync(ct);

        var stateName = q.Account is not null ? string.Empty : string.Empty; // simplified

        var model = new QuotationPdfModel(
            QuotationNo: q.QuotationNoRaw,
            RevisionLetter: q.RevisionLetter,
            ApprovedAt: q.ApprovedAt ?? _clock.UtcNow,
            Subject: q.Subject,
            OrganizationName: account?.OrganizationName ?? "(unknown)",
            AddressLine1: account?.Address.Line1,
            AddressLine2: account?.Address.Line2,
            AddressLine3: account?.Address.Line3,
            City: account?.Address.City,
            Postcode: account?.Address.Postcode,
            StateName: account?.Address.StateCode,
            Phone: account?.OfficePhone,
            Lines: q.Lines.OrderBy(l => l.LineOrder).Select(l => new QuotationPdfLine(
                LineOrder: l.LineOrder,
                Description: l.Description,
                Quantity: l.Quantity,
                UnitPrice: l.UnitPrice,
                DiscountAmount: l.DiscountAmount,
                TaxPct: l.TaxPct,
                LineTotal: l.LineTotal,
                IsOptional: l.IsOptional)).ToList(),
            Subtotal: q.Subtotal,
            Discount: q.Discount,
            Tax: q.Tax,
            Total: q.Total,
            Currency: q.Currency,
            TermsConditions: q.TermsConditions,
            Note: q.Note,
            PreparedByName: owner.FullName ?? "(unknown)",
            PreparedByStaffId: owner.StaffPrefix ?? "");

        var pdfBytes = _pdf.Render(model);

        var safeNo = q.QuotationNoRaw
            .Replace(" ", "_").Replace("/", "-").Replace("(", "").Replace(")", "");
        var dir = Path.Combine(_storageRoot, _clock.UtcNow.ToString("yyyy-MM"));
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, $"{safeNo}.pdf");
        await File.WriteAllBytesAsync(path, pdfBytes, ct);

        _log.LogInformation("Quotation {QuotationNo} PDF rendered at {Path}", q.QuotationNoRaw, path);
        return path;
    }

    private sealed class OwnerRow
    {
        public string? FullName { get; set; }
        public string? StaffPrefix { get; set; }
    }
}

public interface IConfigurationStorageRoot { string Root { get; } }

public sealed class ConfigurationStorageRoot : IConfigurationStorageRoot
{
    public string Root { get; }
    public ConfigurationStorageRoot(Microsoft.Extensions.Configuration.IConfiguration cfg)
    {
        Root = cfg["Storage:QuotationPdfRoot"]
            ?? Path.Combine(Path.GetTempPath(), "sains-crm", "quotations");
    }
}
