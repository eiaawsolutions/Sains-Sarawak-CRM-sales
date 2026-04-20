using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Infrastructure.Pdf;

public interface IQuotationPdfService
{
    /// <summary>
    /// Renders the approved quotation to PDF per FSD §3.2.6 / §3.2.9 #3. Returns the bytes —
    /// the caller decides where to persist (filesystem, object storage, streaming download).
    /// </summary>
    byte[] Render(QuotationPdfModel model);
}

public sealed record QuotationPdfModel(
    string QuotationNo,
    string RevisionLetter,
    DateTimeOffset ApprovedAt,
    string? Subject,
    string OrganizationName,
    string? AddressLine1,
    string? AddressLine2,
    string? AddressLine3,
    string? City,
    string? Postcode,
    string? StateName,
    string? Phone,
    IReadOnlyList<QuotationPdfLine> Lines,
    decimal Subtotal,
    decimal Discount,
    decimal Tax,
    decimal Total,
    string Currency,
    string? TermsConditions,
    string? Note,
    string PreparedByName,
    string PreparedByStaffId);

public sealed record QuotationPdfLine(
    short LineOrder,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal TaxPct,
    decimal LineTotal,
    bool IsOptional);

public sealed class QuotationPdfService : IQuotationPdfService
{
    // Claritas brand tokens — mirror claritas-tokens.css
    private static readonly string Charcoal = "#3f3f3f";
    private static readonly string Crimson  = "#721011";
    private static readonly string Hairline = "#e5e5e5";

    public byte[] Render(QuotationPdfModel m)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(2, Unit.Centimetre);
                page.DefaultTextStyle(x => x.FontFamily("Inter").FontSize(10).FontColor(Charcoal));

                page.Header().Element(ComposeHeader);
                page.Content().Element(c => ComposeContent(c, m));
                page.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor("#888"));
                    t.Span("Page ");
                    t.CurrentPageNumber();
                    t.Span(" of ");
                    t.TotalPages();
                    t.Span("  |  SAINS Sarawak · Confidential");
                });
            });
        });

        return doc.GeneratePdf();
    }

    private void ComposeHeader(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text("SAINS Sarawak").FontSize(16).Bold().FontColor(Crimson);
                col.Item().Text("Sarawak Information Systems Sdn. Bhd.").FontSize(9).FontColor(Charcoal);
            });
            row.ConstantItem(160).AlignRight().Column(col =>
            {
                col.Item().Text("QUOTATION").FontSize(18).Bold().FontColor(Charcoal);
            });
        });
    }

    private void ComposeContent(IContainer container, QuotationPdfModel m)
    {
        container.PaddingTop(12).Column(column =>
        {
            column.Spacing(12);

            // Top band — quotation no + approved date + customer
            column.Item().Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("TO").FontSize(8).FontColor("#888");
                    col.Item().Text(m.OrganizationName).Bold();
                    col.Item().Text(m.AddressLine1 ?? "");
                    col.Item().Text(m.AddressLine2 ?? "");
                    col.Item().Text(m.AddressLine3 ?? "");
                    col.Item().Text($"{m.Postcode} {m.City}".Trim());
                    col.Item().Text(m.StateName ?? "");
                    col.Item().Text(m.Phone ?? "");
                });
                row.ConstantItem(180).Column(col =>
                {
                    col.Spacing(4);
                    col.Item().Text(t =>
                    {
                        t.Span("Quotation No: ").SemiBold();
                        t.Span(m.QuotationNo);
                    });
                    col.Item().Text(t =>
                    {
                        t.Span("Approved: ").SemiBold();
                        t.Span(m.ApprovedAt.ToLocalTime().ToString("dd MMM yyyy"));
                    });
                    col.Item().Text(t =>
                    {
                        t.Span("Prepared By: ").SemiBold();
                        t.Span($"{m.PreparedByName} ({m.PreparedByStaffId})");
                    });
                });
            });

            // Subject
            if (!string.IsNullOrWhiteSpace(m.Subject))
                column.Item().Text($"Subject: {m.Subject}").SemiBold();

            // Line-items table
            column.Item().Table(t =>
            {
                t.ColumnsDefinition(c =>
                {
                    c.ConstantColumn(24);
                    c.RelativeColumn(5);
                    c.ConstantColumn(60);
                    c.ConstantColumn(80);
                    c.ConstantColumn(60);
                    c.ConstantColumn(80);
                });

                t.Header(h =>
                {
                    h.Cell().Background(Charcoal).Padding(6).Text("#").FontColor(Colors.White).SemiBold();
                    h.Cell().Background(Charcoal).Padding(6).Text("Description").FontColor(Colors.White).SemiBold();
                    h.Cell().Background(Charcoal).Padding(6).AlignRight().Text("Qty").FontColor(Colors.White).SemiBold();
                    h.Cell().Background(Charcoal).Padding(6).AlignRight().Text("Unit Price").FontColor(Colors.White).SemiBold();
                    h.Cell().Background(Charcoal).Padding(6).AlignRight().Text("Tax %").FontColor(Colors.White).SemiBold();
                    h.Cell().Background(Charcoal).Padding(6).AlignRight().Text("Line Total").FontColor(Colors.White).SemiBold();
                });

                foreach (var line in m.Lines)
                {
                    var rowBg = line.IsOptional ? "#fafafa" : Colors.White;
                    t.Cell().Background(rowBg).BorderBottom(1).BorderColor(Hairline).Padding(6).Text(line.LineOrder.ToString());
                    t.Cell().Background(rowBg).BorderBottom(1).BorderColor(Hairline).Padding(6).Text(text =>
                    {
                        text.Span(line.Description);
                        if (line.IsOptional) text.Span("  [optional]").FontColor("#888").Italic();
                    });
                    t.Cell().Background(rowBg).BorderBottom(1).BorderColor(Hairline).Padding(6).AlignRight().Text($"{line.Quantity:0.##}");
                    t.Cell().Background(rowBg).BorderBottom(1).BorderColor(Hairline).Padding(6).AlignRight().Text($"{line.UnitPrice:N2}");
                    t.Cell().Background(rowBg).BorderBottom(1).BorderColor(Hairline).Padding(6).AlignRight().Text($"{line.TaxPct:N2}%");
                    t.Cell().Background(rowBg).BorderBottom(1).BorderColor(Hairline).Padding(6).AlignRight().Text($"{line.LineTotal:N2}");
                }
            });

            // Totals block
            column.Item().AlignRight().Column(col =>
            {
                col.Item().Text($"Subtotal: {m.Currency} {m.Subtotal:N2}");
                if (m.Discount > 0) col.Item().Text($"Discount: {m.Currency} {m.Discount:N2}");
                col.Item().Text($"Tax: {m.Currency} {m.Tax:N2}");
                col.Item().Text($"Total: {m.Currency} {m.Total:N2}").Bold().FontColor(Crimson).FontSize(12);
            });

            // T&C
            if (!string.IsNullOrWhiteSpace(m.TermsConditions))
            {
                column.Item().PaddingTop(12).Text("Terms & Conditions").SemiBold();
                column.Item().Text(m.TermsConditions);
            }

            if (!string.IsNullOrWhiteSpace(m.Note))
            {
                column.Item().PaddingTop(8).Text("Notes").SemiBold();
                column.Item().Text(m.Note);
            }
        });
    }
}
