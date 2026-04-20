using FluentValidation;
using MediatR;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Leads;

namespace Sains.Crm.Application.Leads;

public sealed record CreateLeadCommand(
    string OrganizationName,
    string? PrimaryContactName,
    string? PrimaryContactPhone,
    string? PrimaryContactEmail,
    string? Source,
    string? Notes) : IRequest<CreateLeadResult>;

public sealed record CreateLeadResult(Guid Id);

public sealed class CreateLeadValidator : AbstractValidator<CreateLeadCommand>
{
    public CreateLeadValidator()
    {
        RuleFor(x => x.OrganizationName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.PrimaryContactEmail).EmailAddress().When(x => !string.IsNullOrEmpty(x.PrimaryContactEmail));
    }
}

public sealed class CreateLeadHandler : IRequestHandler<CreateLeadCommand, CreateLeadResult>
{
    private readonly ICurrentUserAccessor _user;
    private readonly ILeadRepository _repo;
    public CreateLeadHandler(ICurrentUserAccessor user, ILeadRepository repo) { _user = user; _repo = repo; }

    public async Task<CreateLeadResult> Handle(CreateLeadCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var lead = Lead.Create(Guid.NewGuid(), user, c.OrganizationName,
            c.PrimaryContactName, c.PrimaryContactPhone, c.PrimaryContactEmail, c.Source, c.Notes);
        await _repo.AddAsync(lead, ct);
        await _repo.SaveChangesAsync(ct);
        return new CreateLeadResult(lead.Id);
    }
}

public interface ILeadRepository
{
    Task AddAsync(Lead lead, CancellationToken ct);
    Task<Lead?> FindAsync(Guid id, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
