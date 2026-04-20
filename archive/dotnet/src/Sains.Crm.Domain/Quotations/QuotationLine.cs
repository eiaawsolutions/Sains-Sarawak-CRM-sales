using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Quotations;

public sealed class QuotationLine : Entity
{
    public Guid QuotationId { get; private set; }
    public Guid? ProductId { get; private set; }
    public Guid? ParentLineId { get; private set; }
    public short LineOrder { get; private set; }
    public short? CategoryId { get; private set; }
    public short? SubCategoryId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal DiscountAmount { get; private set; }
    public decimal TaxPct { get; private set; }
    public bool IsOptional { get; private set; }

    // Computed (also stored in DB as PERSISTED columns — kept client-side for UI rendering)
    public decimal LineSubtotal => (Quantity * UnitPrice) - DiscountAmount;
    public decimal LineTax => LineSubtotal * TaxPct / 100m;
    public decimal LineTotal => LineSubtotal + LineTax;

    private QuotationLine() { }

    internal static QuotationLine Create(Guid quotationId, Guid? productId, short lineOrder,
        string description, decimal quantity, decimal unitPrice, decimal discountAmount,
        decimal taxPct, bool isOptional)
        => new()
        {
            Id = Guid.NewGuid(),
            QuotationId = quotationId,
            ProductId = productId,
            LineOrder = lineOrder,
            Description = description,
            Quantity = quantity,
            UnitPrice = unitPrice,
            DiscountAmount = discountAmount,
            TaxPct = taxPct,
            IsOptional = isOptional
        };

    internal QuotationLine CloneForRevision(Guid newQuotationId)
        => new()
        {
            Id = Guid.NewGuid(),
            QuotationId = newQuotationId,
            ProductId = ProductId,
            LineOrder = LineOrder,
            CategoryId = CategoryId,
            SubCategoryId = SubCategoryId,
            Description = Description,
            Quantity = Quantity,
            UnitPrice = UnitPrice,
            DiscountAmount = DiscountAmount,
            TaxPct = TaxPct,
            IsOptional = IsOptional
        };

    internal void SetOrder(short order) => LineOrder = order;
}
