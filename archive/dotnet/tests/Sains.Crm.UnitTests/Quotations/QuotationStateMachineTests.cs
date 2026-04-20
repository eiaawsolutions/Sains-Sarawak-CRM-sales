using FluentAssertions;
using Sains.Crm.Domain.Common;
using Sains.Crm.Domain.Quotations;
using Xunit;

namespace Sains.Crm.UnitTests.Quotations;

public class QuotationStateMachineTests
{
    private static UserContext Owner() => new(Guid.NewGuid(), "sub-1", "Tester", RoleCode.AccountManager, null, null, "TEST");
    private static UserContext Vetter() => new(Guid.NewGuid(), "sub-2", "Vetter", RoleCode.SectionHead, null, null, "TEST");

    private static Quotation Draft(UserContext? owner = null)
    {
        owner ??= Owner();
        var q = Quotation.CreateDraft(
            id: Guid.NewGuid(),
            quotationNoRaw: "SAINS 8-40/011/TEST Vol.1 (1a)",
            ownerUserId: owner.UserId,
            ownerDepartmentId: null,
            ownerSectionId: null,
            type: QuotationType.New);
        q.AddLine(owner, null, "Server XYZ", quantity: 1, unitPrice: 1000m, discountAmount: 0, taxPct: 8, isOptional: false);
        return q;
    }

    [Fact]
    public void Submit_under_threshold_auto_approves()
    {
        var owner = Owner();
        var q = Draft(owner);
        var r = q.Submit(owner, vettingThreshold: 1_000_000m);
        r.IsSuccess.Should().BeTrue();
        q.Status.Should().Be(QuotationStatus.Approved);
    }

    [Fact]
    public void Submit_over_threshold_goes_to_vetting()
    {
        var owner = Owner();
        var q = Draft(owner);
        var r = q.Submit(owner, vettingThreshold: 10m);
        r.IsSuccess.Should().BeTrue();
        q.Status.Should().Be(QuotationStatus.UnderVetting);
    }

    [Fact]
    public void Submit_without_lines_fails()
    {
        var owner = Owner();
        var q = Quotation.CreateDraft(Guid.NewGuid(), "X", owner.UserId, null, null, QuotationType.New);
        var r = q.Submit(owner, 1000m);
        r.IsSuccess.Should().BeFalse();
        r.Error!.Value.Code.Should().Be("quot.submit.no_lines");
    }

    [Fact]
    public void Vetter_can_approve_under_vetting()
    {
        var owner = Owner();
        var vetter = Vetter();
        var q = Draft(owner);
        q.Submit(owner, 10m);   // → UnderVetting
        var r = q.VetApprove(vetter);
        r.IsSuccess.Should().BeTrue();
        q.Status.Should().Be(QuotationStatus.Approved);
        q.ApprovedByUserId.Should().Be(vetter.UserId);
    }

    [Fact]
    public void NonVetter_cannot_vet()
    {
        var owner = Owner();
        var q = Draft(owner);
        q.Submit(owner, 10m);
        var r = q.VetApprove(owner);   // owner is AM, not a vetter
        r.IsSuccess.Should().BeFalse();
        r.Error!.Value.Code.Should().Be("quot.vet.forbidden");
    }

    [Fact]
    public void MarkSent_only_from_Approved()
    {
        var owner = Owner();
        var q = Draft(owner);
        var bad = q.MarkSent(owner);
        bad.IsSuccess.Should().BeFalse();
        q.Submit(owner, 10m);
        q.VetApprove(Vetter());
        q.MarkSent(owner).IsSuccess.Should().BeTrue();
        q.Status.Should().Be(QuotationStatus.QuotationSent);
    }

    [Fact]
    public void Reject_requires_other_text_when_Others_selected()
    {
        var owner = Owner();
        var q = Draft(owner);
        q.Submit(owner, 1_000_000m); // auto-approve
        q.MarkSent(owner);
        var r = q.RecordRejection(owner, RejectionReason.Others, otherText: null);
        r.IsSuccess.Should().BeFalse();
        r.Error!.Value.Code.Should().Be("quot.reject.other_text_required");
    }

    [Fact]
    public void Closed_is_terminal()
    {
        var owner = Owner();
        var q = Draft(owner);
        q.Submit(owner, 1_000_000m);
        q.MarkSent(owner);
        q.RecordAcceptance(owner, AcceptanceChannel.Wot, wotReference: "WOT-001");
        q.IsTerminal.Should().BeTrue();
        q.Status.Should().Be(QuotationStatus.Closed);
        // subsequent transitions should fail
        q.MarkSent(owner).IsSuccess.Should().BeFalse();
    }
}
