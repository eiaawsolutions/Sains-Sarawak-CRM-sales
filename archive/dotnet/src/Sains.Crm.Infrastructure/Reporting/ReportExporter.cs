using ClosedXML.Excel;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Sains.Crm.Application.Reporting;

namespace Sains.Crm.Infrastructure.Reporting;

public interface IReportExporter
{
    byte[] ToExcel(QuotationPerformanceReport report);
    byte[] ToPdf(QuotationPerformanceReport report);
}

/// <summary>
/// Renders the FSD §3.6.1 Quotation Performance Report to either XLSX or PDF. Both outputs
/// carry the same four views as separate sheets / sections.
/// </summary>
public sealed class ReportExporter : IReportExporter
{
    private static readonly string Charcoal = "#3f3f3f";
    private static readonly string Crimson  = "#721011";

    public byte[] ToExcel(QuotationPerformanceReport r)
    {
        using var wb = new XLWorkbook();

        var s1 = wb.Worksheets.Add("Status Summary");
        s1.Cell(1, 1).Value = "Status ID";
        s1.Cell(1, 2).Value = "Status Code";
        s1.Cell(1, 3).Value = "Status Name";
        s1.Cell(1, 4).Value = "Count";
        s1.Cell(1, 5).Value = "Total Value (MYR)";
        for (var i = 0; i < r.StatusSummary.Count; i++)
        {
            var row = r.StatusSummary[i];
            s1.Cell(i + 2, 1).Value = row.StatusId;
            s1.Cell(i + 2, 2).Value = row.StatusCode;
            s1.Cell(i + 2, 3).Value = row.StatusName;
            s1.Cell(i + 2, 4).Value = row.QuotationCount;
            s1.Cell(i + 2, 5).Value = row.TotalValueMyr ?? 0;
        }
        s1.Columns().AdjustToContents();

        var s2 = wb.Worksheets.Add("Rejections");
        s2.Cell(1, 1).Value = "Reason";
        s2.Cell(1, 2).Value = "Count";
        s2.Cell(1, 3).Value = "Total Value (MYR)";
        for (var i = 0; i < r.RejectionBreakdown.Count; i++)
        {
            var row = r.RejectionBreakdown[i];
            s2.Cell(i + 2, 1).Value = row.ReasonName;
            s2.Cell(i + 2, 2).Value = row.QuotationCount;
            s2.Cell(i + 2, 3).Value = row.TotalValueMyr ?? 0;
        }
        s2.Columns().AdjustToContents();

        var s3 = wb.Worksheets.Add("Revisions");
        s3.Cell(1, 1).Value = "Quotation No";
        s3.Cell(1, 2).Value = "Revision Count";
        s3.Cell(1, 3).Value = "Total (MYR)";
        s3.Cell(1, 4).Value = "Submitted At";
        for (var i = 0; i < r.RevisionSummary.Count; i++)
        {
            var row = r.RevisionSummary[i];
            s3.Cell(i + 2, 1).Value = row.QuotationNo;
            s3.Cell(i + 2, 2).Value = row.RevisionCount;
            s3.Cell(i + 2, 3).Value = row.TotalMyr;
            s3.Cell(i + 2, 4).Value = row.SubmittedAt?.DateTime;
        }
        s3.Columns().AdjustToContents();

        var s4 = wb.Worksheets.Add("Closed");
        s4.Cell(1, 1).Value = "Quotation No";
        s4.Cell(1, 2).Value = "Customer";
        s4.Cell(1, 3).Value = "Total (MYR)";
        s4.Cell(1, 4).Value = "Closed At";
        s4.Cell(1, 5).Value = "Source of Fund";
        for (var i = 0; i < r.ClosedOverview.Count; i++)
        {
            var row = r.ClosedOverview[i];
            s4.Cell(i + 2, 1).Value = row.QuotationNo;
            s4.Cell(i + 2, 2).Value = row.CustomerName ?? "";
            s4.Cell(i + 2, 3).Value = row.TotalMyr;
            s4.Cell(i + 2, 4).Value = row.ClosedAt?.DateTime;
            s4.Cell(i + 2, 5).Value = row.SourceOfFund ?? "";
        }
        s4.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public byte[] ToPdf(QuotationPerformanceReport r)
    {
        QuestPDF.Settings.License = LicenseType.Community;
        var doc = Document.Create(container =>
        {
            container.Page(p =>
            {
                p.Size(PageSizes.A4.Landscape());
                p.Margin(2, Unit.Centimetre);
                p.DefaultTextStyle(x => x.FontFamily("Inter").FontSize(10).FontColor(Charcoal));

                p.Header().Row(row =>
                {
                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text("Quotation Performance Report").FontSize(16).Bold().FontColor(Crimson);
                        c.Item().Text($"Generated {r.GeneratedAt:yyyy-MM-dd HH:mm} by {r.GeneratedByName}").FontSize(9).FontColor("#888");
                    });
                    row.ConstantItem(100).AlignRight().Text("SAINS Sarawak").Bold();
                });

                p.Content().PaddingTop(8).Column(col =>
                {
                    col.Spacing(18);

                    col.Item().Text("1. Status Summary").SemiBold().FontSize(12);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(3); c.ConstantColumn(80); c.ConstantColumn(140); });
                        t.Header(h =>
                        {
                            h.Cell().Background(Charcoal).Padding(4).Text("Status").FontColor(Colors.White).SemiBold();
                            h.Cell().Background(Charcoal).Padding(4).AlignRight().Text("Count").FontColor(Colors.White).SemiBold();
                            h.Cell().Background(Charcoal).Padding(4).AlignRight().Text("Total (MYR)").FontColor(Colors.White).SemiBold();
                        });
                        foreach (var row in r.StatusSummary)
                        {
                            t.Cell().Padding(4).Text(row.StatusName);
                            t.Cell().Padding(4).AlignRight().Text(row.QuotationCount.ToString("N0"));
                            t.Cell().Padding(4).AlignRight().Text((row.TotalValueMyr ?? 0).ToString("N2"));
                        }
                    });

                    col.Item().Text("2. Rejected Quotations Breakdown").SemiBold().FontSize(12);
                    col.Item().Table(t =>
                    {
                        t.ColumnsDefinition(c => { c.RelativeColumn(3); c.ConstantColumn(80); c.ConstantColumn(140); });
                        t.Header(h =>
                        {
                            h.Cell().Background(Charcoal).Padding(4).Text("Reason").FontColor(Colors.White).SemiBold();
                            h.Cell().Background(Charcoal).Padding(4).AlignRight().Text("Count").FontColor(Colors.White).SemiBold();
                            h.Cell().Background(Charcoal).Padding(4).AlignRight().Text("Total (MYR)").FontColor(Colors.White).SemiBold();
                        });
                        foreach (var row in r.RejectionBreakdown)
                        {
                            t.Cell().Padding(4).Text(row.ReasonName);
                            t.Cell().Padding(4).AlignRight().Text(row.QuotationCount.ToString("N0"));
                            t.Cell().Padding(4).AlignRight().Text((row.TotalValueMyr ?? 0).ToString("N2"));
                        }
                    });

                    col.Item().Text($"3. Submission / Revision Summary ({r.RevisionSummary.Count} quotations with revisions)").SemiBold().FontSize(12);
                    col.Item().Text($"4. Closed Quotations Overview ({r.ClosedOverview.Count} closed)").SemiBold().FontSize(12);
                });

                p.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(8).FontColor("#888"));
                    t.Span("Page "); t.CurrentPageNumber(); t.Span(" of "); t.TotalPages();
                });
            });
        });
        return doc.GeneratePdf();
    }
}
