namespace Sains.Crm.Domain.Quotations;

/// <summary>
/// Infra-owned service. Generates the next quotation number under SERIALIZABLE isolation so
/// that two concurrent creates never collide. Also handles volume rollover at 200.
/// </summary>
public interface IQuotationNumberGenerator
{
    Task<QuotationNumber> NextForAgentAsync(Guid agentUserId, CancellationToken ct);
    Task<QuotationNumber> NextRevisionAsync(Guid rootQuotationId, Guid newRowId, CancellationToken ct);
}
