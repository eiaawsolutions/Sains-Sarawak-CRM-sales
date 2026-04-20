using MediatR;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Common;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Application.Quotations;

// --- Mark Sent --------------------------------------------------------------------------------

public sealed record MarkQuotationSentCommand(Guid QuotationId) : IRequest<Result>;

public sealed class MarkQuotationSentHandler : IRequestHandler<MarkQuotationSentCommand, Result>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationRepository _repo;
    public MarkQuotationSentHandler(ICurrentUserAccessor user, IQuotationRepository repo) { _user = user; _repo = repo; }

    public async Task<Result> Handle(MarkQuotationSentCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var q = await _repo.FindAsync(c.QuotationId, ct);
        if (q is null) return Result.Fail("quot.not_found", "Quotation not found.");
        var r = q.MarkSent(user);
        if (!r.IsSuccess) return r;
        await _repo.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// --- Accept -----------------------------------------------------------------------------------

public sealed record AcceptQuotationCommand(Guid QuotationId, AcceptanceChannel Via, string? WotReference) : IRequest<Result>;

public sealed class AcceptQuotationHandler : IRequestHandler<AcceptQuotationCommand, Result>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationRepository _repo;
    public AcceptQuotationHandler(ICurrentUserAccessor user, IQuotationRepository repo) { _user = user; _repo = repo; }

    public async Task<Result> Handle(AcceptQuotationCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var q = await _repo.FindAsync(c.QuotationId, ct);
        if (q is null) return Result.Fail("quot.not_found", "Quotation not found.");
        var r = q.RecordAcceptance(user, c.Via, c.WotReference);
        if (!r.IsSuccess) return r;
        await _repo.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// --- Reject -----------------------------------------------------------------------------------

public sealed record RejectQuotationCommand(Guid QuotationId, RejectionReason Reason, string? OtherText) : IRequest<Result>;

public sealed class RejectQuotationHandler : IRequestHandler<RejectQuotationCommand, Result>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationRepository _repo;
    public RejectQuotationHandler(ICurrentUserAccessor user, IQuotationRepository repo) { _user = user; _repo = repo; }

    public async Task<Result> Handle(RejectQuotationCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var q = await _repo.FindAsync(c.QuotationId, ct);
        if (q is null) return Result.Fail("quot.not_found", "Quotation not found.");
        var r = q.RecordRejection(user, c.Reason, c.OtherText);
        if (!r.IsSuccess) return r;
        await _repo.SaveChangesAsync(ct);
        return Result.Ok();
    }
}

// --- Add Line ---------------------------------------------------------------------------------

public sealed record AddQuotationLineCommand(
    Guid QuotationId,
    Guid? ProductId,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal TaxPct,
    bool IsOptional) : IRequest<Result>;

public sealed class AddQuotationLineHandler : IRequestHandler<AddQuotationLineCommand, Result>
{
    private readonly ICurrentUserAccessor _user;
    private readonly IQuotationRepository _repo;
    public AddQuotationLineHandler(ICurrentUserAccessor user, IQuotationRepository repo) { _user = user; _repo = repo; }

    public async Task<Result> Handle(AddQuotationLineCommand c, CancellationToken ct)
    {
        var user = _user.Current ?? throw new UnauthorizedAccessException();
        var q = await _repo.FindAsync(c.QuotationId, ct);
        if (q is null) return Result.Fail("quot.not_found", "Quotation not found.");
        var r = q.AddLine(user, c.ProductId, c.Description, c.Quantity, c.UnitPrice, c.DiscountAmount, c.TaxPct, c.IsOptional);
        if (!r.IsSuccess) return r;
        await _repo.SaveChangesAsync(ct);
        return Result.Ok();
    }
}
