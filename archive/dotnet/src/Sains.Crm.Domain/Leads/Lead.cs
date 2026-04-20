using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Leads;

public enum LeadStatus : byte
{
    Open      = 1,
    Qualified = 2,
    Won       = 3,  // terminal — converted to Account (in CMD) and has a winning Quotation
    Lost      = 4   // terminal — no quotation won
}

public sealed class Lead : Entity
{
    public Guid OwnerUserId { get; private set; }
    public Guid? AccountId { get; private set; }

    /// <summary>
    /// v1.1 only. Signed FSD v1.3 §3.1.3 forbids lead→account conversion inside v1.0. The
    /// column is always NULL for v1.0 and is populated by the v1.1 Lead-Won write-back job
    /// that invokes the outbound CMD <c>SaveXml/124</c> endpoint (direction reversed) to
    /// materialise an Account, then links it here.
    /// </summary>
    public Guid? ConvertedToAccountId { get; private set; }

    public string OrganizationName { get; private set; } = string.Empty;
    public string? PrimaryContactName { get; private set; }
    public string? PrimaryContactPhone { get; private set; }
    public string? PrimaryContactEmail { get; private set; }
    public string? Source { get; private set; }
    public LeadStatus Status { get; private set; } = LeadStatus.Open;
    public bool NeedsProposal { get; private set; }
    public string? Notes { get; private set; }
    public Guid? OwnerDepartmentId { get; private set; }
    public Guid? OwnerSectionId { get; private set; }

    private Lead() { }

    public static Lead Create(Guid id, UserContext owner, string organizationName,
        string? contactName, string? contactPhone, string? contactEmail, string? source, string? notes)
    {
        if (string.IsNullOrWhiteSpace(organizationName))
            throw new ArgumentException("organization name required", nameof(organizationName));

        var lead = new Lead
        {
            Id = id,
            OwnerUserId = owner.UserId,
            OwnerDepartmentId = owner.DepartmentId,
            OwnerSectionId = owner.SectionId,
            OrganizationName = organizationName.Trim(),
            PrimaryContactName = contactName?.Trim(),
            PrimaryContactPhone = contactPhone?.Trim(),
            PrimaryContactEmail = contactEmail?.Trim(),
            Source = source?.Trim(),
            Notes = notes,
            Status = LeadStatus.Open,
            NeedsProposal = false
        };
        lead.Raise(new LeadCreated(lead.Id, lead.OwnerUserId, lead.OrganizationName));
        return lead;
    }

    public Result Qualify(UserContext user)
    {
        if (Status != LeadStatus.Open)
            return Result.Fail("lead.qualify.invalid_status", $"Cannot qualify from {Status}.");

        Status = LeadStatus.Qualified;
        Raise(new LeadQualified(Id, user.UserId));
        return Result.Ok();
    }

    /// <summary>
    /// FSD §3.3.2 step 3 — Section/Unit Head reassigns the lead to an AM. Caller-side role
    /// check lives in the application handler; this method enforces only the state precondition
    /// (cannot reassign a terminal Lead).
    /// </summary>
    public void Reassign(UserContext actor, Guid newOwnerId)
    {
        if (Status is LeadStatus.Won or LeadStatus.Lost)
            throw new InvalidOperationException($"Cannot reassign a {Status} lead.");
        var previousOwner = OwnerUserId;
        OwnerUserId = newOwnerId;
        Raise(new LeadReassigned(Id, actor.UserId, previousOwner, newOwnerId));
    }

    public Result MarkWon(UserContext user, Guid convertedToAccountId)
    {
        if (Status is LeadStatus.Won or LeadStatus.Lost)
            return Result.Fail("lead.win.terminal", $"Lead already in terminal state {Status}.");

        Status = LeadStatus.Won;
        ConvertedToAccountId = convertedToAccountId;
        Raise(new LeadWon(Id, user.UserId, convertedToAccountId));
        return Result.Ok();
    }

    public Result MarkLost(UserContext user)
    {
        if (Status is LeadStatus.Won or LeadStatus.Lost)
            return Result.Fail("lead.lost.terminal", $"Lead already in terminal state {Status}.");

        Status = LeadStatus.Lost;
        Raise(new LeadLost(Id, user.UserId));
        return Result.Ok();
    }

    public void MarkNeedsProposal(bool needs)
    {
        NeedsProposal = needs;
    }
}

public sealed record LeadCreated(Guid LeadId, Guid OwnerUserId, string OrganizationName) : DomainEvent;
public sealed record LeadQualified(Guid LeadId, Guid UserId) : DomainEvent;
public sealed record LeadReassigned(Guid LeadId, Guid ActorUserId, Guid PreviousOwnerId, Guid NewOwnerId) : DomainEvent;
public sealed record LeadWon(Guid LeadId, Guid UserId, Guid ConvertedToAccountId) : DomainEvent;
public sealed record LeadLost(Guid LeadId, Guid UserId) : DomainEvent;
