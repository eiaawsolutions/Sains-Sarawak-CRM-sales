using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Infrastructure.Persistence.Configurations;

internal sealed class QuotationConfig : IEntityTypeConfiguration<Quotation>
{
    public void Configure(EntityTypeBuilder<Quotation> e)
    {
        e.ToTable("quotations", "crm", tb => tb.IsTemporal());
        e.HasKey(x => x.Id);
        e.Property(x => x.QuotationNoRaw).HasColumnName("quotation_no").HasMaxLength(64).IsRequired();
        e.HasIndex(x => x.QuotationNoRaw).IsUnique();

        e.Property(x => x.RootQuotationId).HasColumnName("root_quotation_id").IsRequired();
        e.Property(x => x.ParentQuotationId).HasColumnName("parent_quotation_id");
        e.Property(x => x.RevisionLetter).HasColumnName("revision_letter").HasMaxLength(4).IsRequired();

        e.Property(x => x.AccountId).HasColumnName("account_id");
        e.Property(x => x.LeadId).HasColumnName("lead_id");
        e.Property(x => x.ProposalId).HasColumnName("proposal_id");
        e.Property(x => x.OwnerUserId).HasColumnName("owner_user_id").IsRequired();
        e.Property(x => x.OwnerDepartmentId).HasColumnName("owner_department_id");
        e.Property(x => x.OwnerSectionId).HasColumnName("owner_section_id");

        e.Property(x => x.Status).HasColumnName("status_id").HasConversion<byte>();
        e.Property(x => x.Type).HasColumnName("quotation_type_id").HasConversion<byte>();
        e.Property(x => x.SourceOfFund).HasColumnName("source_of_fund_id").HasConversion<byte?>();

        e.Property(x => x.Currency).HasColumnName("currency").HasMaxLength(3).IsRequired();
        e.Property(x => x.Subtotal).HasColumnName("subtotal_myr").HasPrecision(18, 2);
        e.Property(x => x.Discount).HasColumnName("discount_myr").HasPrecision(18, 2);
        e.Property(x => x.Tax).HasColumnName("tax_myr").HasPrecision(18, 2);
        e.Property(x => x.Total).HasColumnName("total_myr").HasPrecision(18, 2);

        e.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(500);
        e.Property(x => x.TermsConditions).HasColumnName("terms_conditions");
        e.Property(x => x.Note).HasColumnName("note");
        e.Property(x => x.ReferenceNumber).HasColumnName("reference_number").HasMaxLength(64);
        e.Property(x => x.QuotationDate).HasColumnName("quotation_date");
        e.Property(x => x.ValidUntil).HasColumnName("valid_until");

        e.Property(x => x.IsAccepted).HasColumnName("is_accepted");
        e.Property(x => x.AcceptedAt).HasColumnName("accepted_at");
        e.Property(x => x.AcceptedVia).HasColumnName("accepted_via").HasConversion<string?>().HasMaxLength(16);
        e.Property(x => x.WotReference).HasColumnName("wot_reference").HasMaxLength(256);

        e.Property(x => x.RejectionReason).HasColumnName("rejection_reason_id").HasConversion<byte?>();
        e.Property(x => x.RejectionReasonOther).HasColumnName("rejection_reason_other").HasMaxLength(500);

        e.Property(x => x.SubmittedAt).HasColumnName("submitted_at");
        e.Property(x => x.ApprovedAt).HasColumnName("approved_at");
        e.Property(x => x.ApprovedByUserId).HasColumnName("approved_by_user_id");
        e.Property(x => x.ReturnedAt).HasColumnName("returned_at");
        e.Property(x => x.ReturnedByUserId).HasColumnName("returned_by_user_id");
        e.Property(x => x.ReturnedNotes).HasColumnName("returned_notes");
        e.Property(x => x.SentAt).HasColumnName("sent_at");
        e.Property(x => x.ClosedAt).HasColumnName("closed_at");

        e.HasMany(x => x.Lines)
            .WithOne()
            .HasForeignKey(l => l.QuotationId)
            .OnDelete(DeleteBehavior.Cascade);

        e.Ignore(x => x.DomainEvents);
        e.Ignore(x => x.IsTerminal);
        e.Ignore(x => x.IsEditable);
    }
}
