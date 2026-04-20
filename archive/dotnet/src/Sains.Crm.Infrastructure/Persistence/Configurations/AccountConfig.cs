using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sains.Crm.Domain.Accounts;

namespace Sains.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AccountConfig : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> e)
    {
        e.ToTable("accounts", "crm", tb => tb.IsTemporal());
        e.HasKey(x => x.Id);
        e.Property(x => x.CmdRefId).HasColumnName("cmd_ref_id");
        e.Property(x => x.OrganizationName).HasColumnName("organization_name").HasMaxLength(200).IsRequired();
        e.Property(x => x.OrganizationShortName).HasColumnName("organization_short_name").HasMaxLength(200);
        e.Property(x => x.OrganizationTypeId).HasColumnName("organization_type_id");
        e.Property(x => x.Website).HasColumnName("website").HasMaxLength(200);
        e.Property(x => x.OfficePhone).HasColumnName("office_phone").HasMaxLength(30);
        e.Property(x => x.Fax).HasColumnName("fax").HasMaxLength(30);
        e.Property(x => x.Remark).HasColumnName("remark").HasMaxLength(4000);
        e.Property(x => x.Description).HasColumnName("description").HasMaxLength(4000);
        e.Property(x => x.CmdLastUpdated).HasColumnName("cmd_last_updated");

        e.OwnsOne(x => x.Address, a =>
        {
            a.Property(p => p.Line1).HasColumnName("line_1").HasMaxLength(100);
            a.Property(p => p.Line2).HasColumnName("line_2").HasMaxLength(100);
            a.Property(p => p.Line3).HasColumnName("line_3").HasMaxLength(100);
            a.Property(p => p.City).HasColumnName("city").HasMaxLength(50);
            a.Property(p => p.Postcode).HasColumnName("postcode").HasMaxLength(10);
            a.Property(p => p.StateCode).HasColumnName("state_code").HasMaxLength(1);
            a.Property(p => p.CountryCode).HasColumnName("country_code").HasMaxLength(2);
        });

        e.HasMany(x => x.Contacts)
            .WithOne()
            .HasForeignKey(c => c.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        e.Ignore(x => x.DomainEvents);
    }
}
