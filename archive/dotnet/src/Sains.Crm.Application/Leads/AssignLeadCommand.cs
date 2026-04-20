using FluentValidation;
using MediatR;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;

namespace Sains.Crm.Application.Leads;

/// <summary>
/// FSD §3.3.2 step 3: "If the lead is created by a Supervisor/Section Head, they shall assign
/// the lead to the appropriate Account Manager for follow-up." AM-created leads auto-assign
/// to the creator in <see cref="CreateLeadCommand"/>; this command covers the Section-Head path.
/// </summary>
public sealed record AssignLeadCommand(Guid LeadId, Guid TargetAccountManagerId) : IRequest<Result>;

public sealed class AssignLeadValidator : AbstractValidator<AssignLeadCommand>
{
    public AssignLeadValidator()
    {
        RuleFor(x => x.LeadId).NotEmpty();
        RuleFor(x => x.TargetAccountManagerId).NotEmpty();
    }
}

public sealed class AssignLeadHandler : IRequestHandler<AssignLeadCommand, Result>
{
    private readonly ICurrentUserAccessor _user;
    private readonly ILeadRepository _repo;

    public AssignLeadHandler(ICurrentUserAccessor user, ILeadRepository repo)
    {
        _user = user; _repo = repo;
    }

    public async Task<Result> Handle(AssignLeadCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();

        // FSD §3.3.2 step 3: only Section Head / Unit Head / Admin can re-assign.
        if (user.Role is not (RoleCode.SectionHead or RoleCode.UnitHead or RoleCode.Administrator))
            return Result.Fail("lead.assign.forbidden", "Only Section Head, Unit Head, or Administrator can re-assign leads.");

        var lead = await _repo.FindAsync(c.LeadId, ct);
        if (lead is null) return Result.Fail("lead.not_found", "Lead not found.");

        lead.Reassign(user, c.TargetAccountManagerId);
        await _repo.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
