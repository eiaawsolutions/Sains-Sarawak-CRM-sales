using MediatR;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;

namespace Sains.Crm.Application.Quotations;

public sealed record SubmitQuotationCommand(Guid QuotationId) : IRequest<Result>;

public sealed class SubmitQuotationHandler : IRequestHandler<SubmitQuotationCommand, Result>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationRepository _repo;
    private readonly IFeatureFlags _flags;

    public SubmitQuotationHandler(ICurrentUserAccessor user, IQuotationRepository repo, IFeatureFlags flags)
    {
        _user = user; _repo = repo; _flags = flags;
    }

    public async Task<Result> Handle(SubmitQuotationCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var q = await _repo.FindAsync(c.QuotationId, ct);
        if (q is null) return Result.Fail("quot.not_found", "Quotation not found or not visible.");

        var threshold = await _flags.GetNumericAsync("quotation_vetting_threshold_myr", ct) ?? 50000m;

        var result = q.Submit(user, threshold);
        if (!result.IsSuccess) return result;

        await _repo.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
