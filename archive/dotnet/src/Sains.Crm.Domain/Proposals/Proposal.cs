using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Proposals;

public enum ProposalStatus : byte
{
    Open                 = 1,
    ConvertedToQuotation = 2  // terminal
}

public sealed class Proposal : Entity
{
    public Guid LeadId { get; private set; }
    public Guid OwnerUserId { get; private set; }
    public string ProposalNoRaw { get; private set; } = string.Empty;
    public string Subject { get; private set; } = string.Empty;
    public ProposalStatus Status { get; private set; } = ProposalStatus.Open;
    public string? Note { get; private set; }
    public Guid? ConvertedQuotationId { get; private set; }
    public Guid? OwnerDepartmentId { get; private set; }
    public Guid? OwnerSectionId { get; private set; }

    private Proposal() { }

    public static Proposal Create(Guid id, UserContext owner, Guid leadId, string proposalNoRaw, string subject, string? note)
        => new()
        {
            Id = id,
            LeadId = leadId,
            OwnerUserId = owner.UserId,
            OwnerDepartmentId = owner.DepartmentId,
            OwnerSectionId = owner.SectionId,
            ProposalNoRaw = proposalNoRaw,
            Subject = subject,
            Note = note,
            Status = ProposalStatus.Open
        };

    public Result MarkConverted(Guid quotationId)
    {
        if (Status != ProposalStatus.Open)
            return Result.Fail("prop.convert.invalid_status", $"Cannot convert from {Status}.");

        Status = ProposalStatus.ConvertedToQuotation;
        ConvertedQuotationId = quotationId;
        return Result.Ok();
    }
}
