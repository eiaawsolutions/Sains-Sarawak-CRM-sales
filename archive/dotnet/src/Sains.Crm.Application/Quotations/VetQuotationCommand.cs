using MediatR;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Application.Quotations;

public enum VettingDecision { Approve, Return }

public sealed record VetQuotationCommand(Guid QuotationId, VettingDecision Decision, string? ReturnNotes) : IRequest<VetQuotationResult>;

/// <summary>
/// Shape of the result. In v1.0 (FSD literal) the same row ID is returned for both Approve and
/// Return decisions — the row stays put, only its status + revision letter change. The shape
/// retains <see cref="RevisionCreated"/> because the v1.1 upgrade re-enables row-chain revisions
/// for some scenarios (extended lifecycle).
/// </summary>
public sealed record VetQuotationResult(Guid ResultingQuotationId, string ResultingQuotationNo, bool RevisionCreated);

public sealed class VetQuotationHandler : IRequestHandler<VetQuotationCommand, VetQuotationResult>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationRepository _repo;

    public VetQuotationHandler(ICurrentUserAccessor user, IQuotationRepository repo)
    {
        _user = user; _repo = repo;
    }

    public async Task<VetQuotationResult> Handle(VetQuotationCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var q = await _repo.FindAsync(c.QuotationId, ct) ?? throw new InvalidOperationException("Quotation not found.");

        if (c.Decision == VettingDecision.Approve)
        {
            var r = q.VetApprove(user);
            if (!r.IsSuccess) throw new InvalidOperationException(r.Error!.Value.Message);
            await _repo.SaveChangesAsync(ct);
            return new VetQuotationResult(q.Id, q.QuotationNoRaw, RevisionCreated: false);
        }

        // FSD §3.2.3 step 5 + §3.2.9 #1: same-row return-for-revision. The Quotation aggregate
        // mutates its own Status back to Draft + increments RevisionLetter + rebuilds
        // QuotationNoRaw. No new row is inserted in v1.0.
        var returned = q.ReturnForRevision(user, c.ReturnNotes ?? "Return for revision.");
        if (!returned.IsSuccess) throw new InvalidOperationException(returned.Error!.Value.Message);

        await _repo.SaveChangesAsync(ct);

        return new VetQuotationResult(q.Id, q.QuotationNoRaw, RevisionCreated: false);
    }
}
