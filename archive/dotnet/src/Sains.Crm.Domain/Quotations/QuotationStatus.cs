namespace Sains.Crm.Domain.Quotations;

/// <summary>
/// Canonical 6-state lifecycle per FSD v1.3 §3.2.9 + ADR-0003.
/// IDs are stable on-wire and in-database; never renumber.
/// </summary>
public enum QuotationStatus : byte
{
    Draft           = 1,
    UnderVetting    = 2,
    Approved        = 3,
    QuotationSent   = 4,
    Closed          = 5,  // terminal — customer accepted
    RejectedExpired = 6   // terminal — customer rejected or lapsed
}

public enum QuotationType : byte
{
    New             = 1,
    Revised         = 2,
    WithAoq         = 3,
    WithOptional    = 4,
    ProposalPricing = 5
}

public enum FundSource : byte
{
    Scsdu    = 1,
    NonScsdu = 2
}

public enum RejectionReason : byte
{
    CustomerWithdrawal = 1,
    OtherVendor        = 2,
    BudgetConstraint   = 3,
    Others             = 4   // requires free-text
}

public enum AcceptanceChannel : byte
{
    Wot = 1,
    Aoq = 2,
    Loa = 3
}
