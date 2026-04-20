using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Quotations;

public sealed record QuotationCreated(Guid QuotationId, string QuotationNo, Guid OwnerUserId) : DomainEvent;
public sealed record QuotationLineAdded(Guid QuotationId, Guid LineId) : DomainEvent;
public sealed record QuotationSubmittedForVetting(Guid QuotationId, Guid OwnerUserId, decimal Total) : DomainEvent;
public sealed record QuotationAutoApproved(Guid QuotationId, decimal Total, decimal ThresholdUsed) : DomainEvent;
public sealed record QuotationVetApproved(Guid QuotationId, Guid ApprovedByUserId) : DomainEvent;
public sealed record QuotationReturnedForRevision(
    Guid QuotationId, Guid ReturnedByUserId, string Notes,
    string NewQuotationNo, string NewRevisionLetter) : DomainEvent;
public sealed record QuotationRevisionCreated(Guid NewQuotationId, Guid ParentQuotationId, string RevisionLetter) : DomainEvent;
public sealed record QuotationMarkedSent(Guid QuotationId, Guid OwnerUserId) : DomainEvent;
public sealed record QuotationClosed(Guid QuotationId, AcceptanceChannel Via, string? WotReference) : DomainEvent;
public sealed record QuotationRejected(Guid QuotationId, RejectionReason Reason, string? OtherText) : DomainEvent;
