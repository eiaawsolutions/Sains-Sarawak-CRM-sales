using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sains.Crm.Domain.Leads;

namespace Sains.Crm.Infrastructure.Persistence.Configurations;

internal sealed class LeadConfig : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> e)
    {
        e.ToTable("leads", "crm", tb => tb.IsTemporal());
        e.HasKey(x => x.Id);
        e.Property(x => x.OwnerUserId).HasColumnName("owner_user_id");
        e.Property(x => x.AccountId).HasColumnName("account_id");
        e.Property(x => x.ConvertedToAccountId).HasColumnName("converted_to_account_id");
        e.Property(x => x.OrganizationName).HasColumnName("organization_name").HasMaxLength(200).IsRequired();
        e.Property(x => x.PrimaryContactName).HasColumnName("primary_contact_name").HasMaxLength(200);
        e.Property(x => x.PrimaryContactPhone).HasColumnName("primary_contact_phone").HasMaxLength(50);
        e.Property(x => x.PrimaryContactEmail).HasColumnName("primary_contact_email").HasMaxLength(320);
        e.Property(x => x.Source).HasColumnName("source").HasMaxLength(100);
        e.Property(x => x.Status).HasColumnName("status_id").HasConversion<byte>();
        e.Property(x => x.NeedsProposal).HasColumnName("needs_proposal");
        e.Property(x => x.Notes).HasColumnName("notes");
        e.Property(x => x.OwnerDepartmentId).HasColumnName("owner_department_id");
        e.Property(x => x.OwnerSectionId).HasColumnName("owner_section_id");
        e.Ignore(x => x.DomainEvents);
    }
}
