using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sains.Crm.Domain.Proposals;

namespace Sains.Crm.Infrastructure.Persistence.Configurations;

internal sealed class ProposalConfig : IEntityTypeConfiguration<Proposal>
{
    public void Configure(EntityTypeBuilder<Proposal> e)
    {
        e.ToTable("proposals", "crm", tb => tb.IsTemporal());
        e.HasKey(x => x.Id);
        e.Property(x => x.LeadId).HasColumnName("lead_id");
        e.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        e.Property(x => x.ProposalNoRaw).HasColumnName("proposal_no").HasMaxLength(64);
        e.HasIndex(x => x.ProposalNoRaw).IsUnique();
        e.Property(x => x.Subject).HasColumnName("subject").HasMaxLength(500);
        e.Property(x => x.Status).HasColumnName("status_id").HasConversion<byte>();
        e.Property(x => x.Note).HasColumnName("note");
        e.Property(x => x.ConvertedQuotationId).HasColumnName("converted_quotation_id");
        e.Property(x => x.OwnerDepartmentId).HasColumnName("owner_department_id");
        e.Property(x => x.OwnerSectionId).HasColumnName("owner_section_id");
        e.Ignore(x => x.DomainEvents);
    }
}
