using FluentValidation;
using MediatR;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Application.Quotations;

public sealed record CreateQuotationCommand(
    Guid? AccountId,
    Guid? LeadId,
    Guid? ProposalId,
    QuotationType Type,
    FundSource? SourceOfFund,
    string? Subject,
    DateOnly? QuotationDate,
    DateOnly? ValidUntil) : IRequest<CreateQuotationResult>;

public sealed record CreateQuotationResult(Guid Id, string QuotationNo);

public sealed class CreateQuotationValidator : AbstractValidator<CreateQuotationCommand>
{
    public CreateQuotationValidator()
    {
        RuleFor(x => x).Must(x => x.AccountId.HasValue || x.LeadId.HasValue || x.ProposalId.HasValue)
            .WithMessage("Quotation must be linked to at least one of: Account, Lead, Proposal.");
        RuleFor(x => x.ValidUntil).GreaterThanOrEqualTo(x => x.QuotationDate)
            .When(x => x.QuotationDate.HasValue && x.ValidUntil.HasValue)
            .WithMessage("Valid Until must be on or after Quotation Date.");
    }
}

public sealed class CreateQuotationHandler : IRequestHandler<CreateQuotationCommand, CreateQuotationResult>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationNumberGenerator _numberGen;
    private readonly IQuotationRepository _repo;

    public CreateQuotationHandler(ICurrentUserAccessor user, IQuotationNumberGenerator numberGen, IQuotationRepository repo)
    {
        _user = user; _numberGen = numberGen; _repo = repo;
    }

    public async Task<CreateQuotationResult> Handle(CreateQuotationCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var id = Guid.NewGuid();
        var number = await _numberGen.NextForAgentAsync(user.UserId, ct);

        var q = Quotation.CreateDraft(
            id: id,
            quotationNoRaw: number.ToString(),
            ownerUserId: user.UserId,
            ownerDepartmentId: user.DepartmentId,
            ownerSectionId: user.SectionId,
            type: c.Type,
            accountId: c.AccountId,
            leadId: c.LeadId,
            proposalId: c.ProposalId);

        q.SetHeader(c.Subject, termsConditions: null, note: null,
            quotationDate: c.QuotationDate, validUntil: c.ValidUntil,
            fund: c.SourceOfFund, referenceNumber: null);

        await _repo.AddAsync(q, ct);
        await _repo.SaveChangesAsync(ct);
        return new CreateQuotationResult(q.Id, q.QuotationNoRaw);
    }
}

public interface IQuotationRepository
{
    Task AddAsync(Quotation q, CancellationToken ct);
    Task<Quotation?> FindAsync(Guid id, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
}
