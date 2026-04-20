using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Infrastructure.Persistence.Configurations;

internal sealed class QuotationLineConfig : IEntityTypeConfiguration<QuotationLine>
{
    public void Configure(EntityTypeBuilder<QuotationLine> e)
    {
        e.ToTable("quotation_lines", "crm");
        e.HasKey(x => x.Id);
        e.Property(x => x.QuotationId).HasColumnName("quotation_id");
        e.Property(x => x.ProductId).HasColumnName("product_id");
        e.Property(x => x.ParentLineId).HasColumnName("parent_line_id");
        e.Property(x => x.LineOrder).HasColumnName("line_order");
        e.Property(x => x.CategoryId).HasColumnName("category_id");
        e.Property(x => x.SubCategoryId).HasColumnName("sub_category_id");
        e.Property(x => x.Description).HasColumnName("description").IsRequired();
        e.Property(x => x.Quantity).HasColumnName("quantity").HasPrecision(18, 4);
        e.Property(x => x.UnitPrice).HasColumnName("unit_price_myr").HasPrecision(18, 2);
        e.Property(x => x.DiscountAmount).HasColumnName("discount_amount_myr").HasPrecision(18, 2);
        e.Property(x => x.TaxPct).HasColumnName("tax_pct").HasPrecision(5, 2);
        e.Property(x => x.IsOptional).HasColumnName("is_optional");

        // computed columns — database-generated, never written by app
        e.Ignore(x => x.LineSubtotal);
        e.Ignore(x => x.LineTax);
        e.Ignore(x => x.LineTotal);
        e.Ignore(x => x.DomainEvents);
    }
}
