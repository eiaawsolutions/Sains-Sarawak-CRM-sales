using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Quotations;

/// <summary>
/// Root aggregate for Quotation. All state transitions go through this class; the persistence
/// layer never mutates columns directly. Invariants protected by the state-transition matrix
/// in <see cref="CanTransitionTo"/> — mirrored by the MSSQL AFTER UPDATE trigger in V0010.
/// </summary>
public sealed class Quotation : Entity
{
    // Identity
    public string QuotationNoRaw { get; private set; } = string.Empty;

    // Revision chain
    public Guid RootQuotationId { get; private set; }
    public Guid? ParentQuotationId { get; private set; }
    public string RevisionLetter { get; private set; } = QuotationNumber.FirstRevision;

    // Linkage
    public Guid? AccountId { get; private set; }
    public Guid? LeadId { get; private set; }
    public Guid? ProposalId { get; private set; }
    public Guid OwnerUserId { get; private set; }
    public Guid? OwnerSectionId { get; private set; }
    public Guid? OwnerDepartmentId { get; private set; }

    // Lifecycle
    public QuotationStatus Status { get; private set; } = QuotationStatus.Draft;
    public QuotationType Type { get; private set; }
    public FundSource? SourceOfFund { get; private set; }

    // Totals
    public string Currency { get; private set; } = "MYR";
    public decimal Subtotal { get; private set; }
    public decimal Discount { get; private set; }
    public decimal Tax { get; private set; }
    public decimal Total { get; private set; }

    // Content
    public string? Subject { get; private set; }
    public string? TermsConditions { get; private set; }
    public string? Note { get; private set; }
    public string? ReferenceNumber { get; private set; }
    public DateOnly? QuotationDate { get; private set; }
    public DateOnly? ValidUntil { get; private set; }

    // Acceptance (orthogonal to Status)
    public bool IsAccepted { get; private set; }
    public DateTimeOffset? AcceptedAt { get; private set; }
    public AcceptanceChannel? AcceptedVia { get; private set; }
    public string? WotReference { get; private set; }

    // Rejection
    public RejectionReason? RejectionReason { get; private set; }
    public string? RejectionReasonOther { get; private set; }

    // Timestamps
    public DateTimeOffset? SubmittedAt { get; private set; }
    public DateTimeOffset? ApprovedAt { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }
    public DateTimeOffset? ReturnedAt { get; private set; }
    public Guid? ReturnedByUserId { get; private set; }
    public string? ReturnedNotes { get; private set; }
    public DateTimeOffset? SentAt { get; private set; }
    public DateTimeOffset? ClosedAt { get; private set; }

    // Lines
    private readonly List<QuotationLine> _lines = new();
    public IReadOnlyList<QuotationLine> Lines => _lines;

    // EF Core parameterless ctor
    private Quotation() { }

    /// <summary>
    /// Creates a brand-new Draft quotation. Use <see cref="CreateRevision"/> to create a revision row.
    /// </summary>
    public static Quotation CreateDraft(
        Guid id,
        string quotationNoRaw,
        Guid ownerUserId,
        Guid? ownerDepartmentId,
        Guid? ownerSectionId,
        QuotationType type,
        Guid? accountId = null,
        Guid? leadId = null,
        Guid? proposalId = null)
    {
        if (string.IsNullOrWhiteSpace(quotationNoRaw))
            throw new ArgumentException("quotationNoRaw required", nameof(quotationNoRaw));

        var q = new Quotation
        {
            Id = id,
            RootQuotationId = id,
            ParentQuotationId = null,
            RevisionLetter = QuotationNumber.FirstRevision,
            QuotationNoRaw = quotationNoRaw,
            OwnerUserId = ownerUserId,
            OwnerDepartmentId = ownerDepartmentId,
            OwnerSectionId = ownerSectionId,
            Type = type,
            Status = QuotationStatus.Draft,
            AccountId = accountId,
            LeadId = leadId,
            ProposalId = proposalId
        };
        q.Raise(new QuotationCreated(q.Id, q.QuotationNoRaw, q.OwnerUserId));
        return q;
    }

    /// <summary>
    /// Creates a new Draft row that belongs to the same revision chain as <paramref name="parent"/>.
    /// Called when a Vetter returns a quotation for revision; the original row is NOT mutated
    /// beyond being marked Returned (the new row carries the editable content).
    /// </summary>
    public static Quotation CreateRevision(
        Quotation parent,
        Guid newId,
        string newQuotationNoRaw,
        string newRevisionLetter)
    {
        ArgumentNullException.ThrowIfNull(parent);
        if (string.IsNullOrWhiteSpace(newRevisionLetter))
            throw new ArgumentException("revision letter required", nameof(newRevisionLetter));

        var q = new Quotation
        {
            Id = newId,
            RootQuotationId = parent.RootQuotationId,
            ParentQuotationId = parent.Id,
            RevisionLetter = newRevisionLetter,
            QuotationNoRaw = newQuotationNoRaw,
            OwnerUserId = parent.OwnerUserId,
            OwnerDepartmentId = parent.OwnerDepartmentId,
            OwnerSectionId = parent.OwnerSectionId,
            AccountId = parent.AccountId,
            LeadId = parent.LeadId,
            ProposalId = parent.ProposalId,
            Type = QuotationType.Revised,
            SourceOfFund = parent.SourceOfFund,
            Status = QuotationStatus.Draft,
            Subject = parent.Subject,
            TermsConditions = parent.TermsConditions,
            Note = parent.Note,
            ReferenceNumber = parent.ReferenceNumber,
            QuotationDate = parent.QuotationDate,
            ValidUntil = parent.ValidUntil,
        };
        // copy lines
        foreach (var line in parent.Lines)
            q._lines.Add(line.CloneForRevision(q.Id));

        q.RecalculateTotals();
        q.Raise(new QuotationRevisionCreated(q.Id, parent.Id, q.RevisionLetter));
        return q;
    }

    // ----- State transitions ----------------------------------------------------------------

    public Result Submit(UserContext user, decimal vettingThreshold)
    {
        if (user.UserId != OwnerUserId && user.Role != RoleCode.Administrator)
            return Result.Fail("quot.submit.forbidden", "Only the owner may submit this quotation.");

        if (Status != QuotationStatus.Draft)
            return Result.Fail("quot.submit.invalid_status", $"Cannot submit from status {Status}.");

        if (_lines.Count == 0)
            return Result.Fail("quot.submit.no_lines", "Quotation must have at least one line.");

        SubmittedAt = DateTimeOffset.UtcNow;

        if (Total < vettingThreshold)
        {
            // Auto-approve path
            Status = QuotationStatus.Approved;
            ApprovedAt = SubmittedAt;
            ApprovedByUserId = null;  // system
            Raise(new QuotationAutoApproved(Id, Total, vettingThreshold));
        }
        else
        {
            Status = QuotationStatus.UnderVetting;
            Raise(new QuotationSubmittedForVetting(Id, OwnerUserId, Total));
        }

        return Result.Ok();
    }

    public Result VetApprove(UserContext user)
    {
        if (user.Role is not (RoleCode.SectionHead or RoleCode.UnitHead or RoleCode.Director or RoleCode.Administrator))
            return Result.Fail("quot.vet.forbidden", "User not authorised to vet.");

        if (Status != QuotationStatus.UnderVetting)
            return Result.Fail("quot.vet.invalid_status", $"Cannot approve from status {Status}.");

        Status = QuotationStatus.Approved;
        ApprovedAt = DateTimeOffset.UtcNow;
        ApprovedByUserId = user.UserId;
        Raise(new QuotationVetApproved(Id, user.UserId));
        return Result.Ok();
    }

    /// <summary>
    /// Returns this quotation for revision per FSD v1.3 §3.2.3 step 5 & §3.2.9 #1:
    ///   "Quotation status <b>reverts to Draft</b>" and "the revision running number updated
    ///   accordingly". No new row is created in v1.0 — the same quotation row becomes editable
    ///   again with the next revision letter (e.g. `140b` → `140c`).
    ///
    /// The v1.1 upgrade introduces a parallel Revision sub-track via <c>CreateRevision</c>.
    /// </summary>
    public Result ReturnForRevision(UserContext user, string notes)
    {
        if (user.Role is not (RoleCode.SectionHead or RoleCode.UnitHead or RoleCode.Director or RoleCode.Administrator))
            return Result.Fail("quot.return.forbidden", "User not authorised to return.");

        if (Status != QuotationStatus.UnderVetting)
            return Result.Fail("quot.return.invalid_status", $"Cannot return from status {Status}.");

        if (string.IsNullOrWhiteSpace(notes))
            return Result.Fail("quot.return.notes_required", "Return notes are mandatory.");

        // FSD §3.2.9 #1: "This status is also used when a quotation is returned for revision,
        //                 with a new Revision ID generated."
        var nextLetter = QuotationNumber.NextRevisionLetter(RevisionLetter);
        RevisionLetter = nextLetter;
        QuotationNoRaw = System.Text.RegularExpressions.Regex.Replace(
            QuotationNoRaw, @"([0-9]+)([a-z]+)\)$", $"$1{nextLetter})");

        // FSD §3.2.3 step 5: status reverts to Draft
        Status = QuotationStatus.Draft;
        ReturnedAt = DateTimeOffset.UtcNow;
        ReturnedByUserId = user.UserId;
        ReturnedNotes = notes;

        // Reset prior-round approval artefacts
        ApprovedAt = null;
        ApprovedByUserId = null;

        Raise(new QuotationReturnedForRevision(Id, user.UserId, notes, QuotationNoRaw, RevisionLetter));
        return Result.Ok();
    }

    public Result MarkSent(UserContext user)
    {
        if (user.UserId != OwnerUserId && user.Role != RoleCode.Administrator)
            return Result.Fail("quot.send.forbidden", "Only the owner may mark as sent.");

        if (Status != QuotationStatus.Approved)
            return Result.Fail("quot.send.invalid_status", $"Cannot mark sent from status {Status}.");

        Status = QuotationStatus.QuotationSent;
        SentAt = DateTimeOffset.UtcNow;
        Raise(new QuotationMarkedSent(Id, user.UserId));
        return Result.Ok();
    }

    public Result RecordAcceptance(UserContext user, AcceptanceChannel via, string? wotReference)
    {
        if (user.UserId != OwnerUserId && user.Role != RoleCode.Administrator)
            return Result.Fail("quot.accept.forbidden", "Only the owner may record acceptance.");

        if (Status != QuotationStatus.QuotationSent)
            return Result.Fail("quot.accept.invalid_status", $"Cannot accept from status {Status}.");

        IsAccepted = true;
        AcceptedAt = DateTimeOffset.UtcNow;
        AcceptedVia = via;
        WotReference = wotReference;
        Status = QuotationStatus.Closed;
        ClosedAt = AcceptedAt;
        Raise(new QuotationClosed(Id, via, wotReference));
        return Result.Ok();
    }

    public Result RecordRejection(UserContext user, RejectionReason reason, string? otherText)
    {
        if (user.UserId != OwnerUserId && user.Role != RoleCode.Administrator)
            return Result.Fail("quot.reject.forbidden", "Only the owner may record rejection.");

        if (Status != QuotationStatus.QuotationSent)
            return Result.Fail("quot.reject.invalid_status", $"Cannot reject from status {Status}.");

        if (reason == Domain.Quotations.RejectionReason.Others && string.IsNullOrWhiteSpace(otherText))
            return Result.Fail("quot.reject.other_text_required", "Free-text reason required when 'Others' selected.");

        RejectionReason = reason;
        RejectionReasonOther = otherText;
        Status = QuotationStatus.RejectedExpired;
        ClosedAt = DateTimeOffset.UtcNow;
        Raise(new QuotationRejected(Id, reason, otherText));
        return Result.Ok();
    }

    // ----- Line management ------------------------------------------------------------------

    public Result AddLine(UserContext user, Guid? productId, string description, decimal quantity,
        decimal unitPrice, decimal discountAmount, decimal taxPct, bool isOptional)
    {
        if (Status != QuotationStatus.Draft)
            return Result.Fail("quot.line.add.locked", "Lines can only be edited in Draft status.");

        if (quantity <= 0)
            return Result.Fail("quot.line.add.qty", "Quantity must be positive.");

        if (unitPrice < 0 || discountAmount < 0 || taxPct < 0)
            return Result.Fail("quot.line.add.non_negative", "Amounts cannot be negative.");

        var line = QuotationLine.Create(Id, productId, (short)(_lines.Count + 1),
            description, quantity, unitPrice, discountAmount, taxPct, isOptional);
        _lines.Add(line);
        RecalculateTotals();
        Raise(new QuotationLineAdded(Id, line.Id));
        return Result.Ok();
    }

    public Result RemoveLine(UserContext user, Guid lineId)
    {
        if (Status != QuotationStatus.Draft)
            return Result.Fail("quot.line.remove.locked", "Lines can only be edited in Draft status.");

        var line = _lines.FirstOrDefault(l => l.Id == lineId);
        if (line is null) return Result.Fail("quot.line.not_found", "Line not found.");

        _lines.Remove(line);
        // Re-order
        for (short i = 0; i < _lines.Count; i++)
            _lines[i].SetOrder((short)(i + 1));
        RecalculateTotals();
        return Result.Ok();
    }

    internal void RecalculateTotals()
    {
        decimal sub = 0, disc = 0, tax = 0, total = 0;
        foreach (var line in _lines.Where(l => !l.IsOptional))
        {
            var lineSub = line.Quantity * line.UnitPrice;
            var lineDisc = line.DiscountAmount;
            var lineNet = lineSub - lineDisc;
            var lineTax = lineNet * line.TaxPct / 100m;
            sub += lineSub;
            disc += lineDisc;
            tax += lineTax;
            total += lineNet + lineTax;
        }
        Subtotal = sub;
        Discount = disc;
        Tax = tax;
        Total = total;
    }

    public void SetHeader(string? subject, string? termsConditions, string? note,
        DateOnly? quotationDate, DateOnly? validUntil, FundSource? fund, string? referenceNumber)
    {
        if (Status != QuotationStatus.Draft)
            throw new InvalidOperationException($"Cannot edit header in status {Status}.");

        Subject = subject;
        TermsConditions = termsConditions;
        Note = note;
        QuotationDate = quotationDate;
        ValidUntil = validUntil;
        SourceOfFund = fund;
        ReferenceNumber = referenceNumber;
    }

    public bool IsTerminal => Status is QuotationStatus.Closed or QuotationStatus.RejectedExpired;
    public bool IsEditable => Status == QuotationStatus.Draft;

    private static bool CanTransitionTo(QuotationStatus from, QuotationStatus to) => (from, to) switch
    {
        (QuotationStatus.Draft, QuotationStatus.UnderVetting)            => true,
        (QuotationStatus.Draft, QuotationStatus.Approved)                => true, // auto-approve below threshold
        (QuotationStatus.UnderVetting, QuotationStatus.Approved)         => true,
        (QuotationStatus.UnderVetting, QuotationStatus.Draft)            => true, // return-for-revision (legacy, not used)
        (QuotationStatus.Approved, QuotationStatus.QuotationSent)        => true,
        (QuotationStatus.QuotationSent, QuotationStatus.Closed)          => true,
        (QuotationStatus.QuotationSent, QuotationStatus.RejectedExpired) => true,
        _                                                                 => false
    };
}
