using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sains.Crm.Domain.Accounts;

namespace Sains.Crm.Infrastructure.Persistence.Configurations;

internal sealed class AccountContactConfig : IEntityTypeConfiguration<AccountContact>
{
    public void Configure(EntityTypeBuilder<AccountContact> e)
    {
        e.ToTable("account_contacts", "crm", tb => tb.IsTemporal());
        e.HasKey(x => x.Id);
        e.Property(x => x.AccountId).HasColumnName("account_id").IsRequired();
        e.Property(x => x.SalutationId).HasColumnName("salutation_id");
        e.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(200).IsRequired();
        e.Property(x => x.Email).HasColumnName("email").HasMaxLength(320);
        e.Property(x => x.Mobile).HasColumnName("mobile").HasMaxLength(50);
        e.Property(x => x.BusinessPhone).HasColumnName("business_phone").HasMaxLength(30);
        e.Property(x => x.Fax).HasColumnName("fax").HasMaxLength(30);
        e.Property(x => x.DesignationId).HasColumnName("designation_id");
        e.Property(x => x.ProfileImg).HasColumnName("profile_img").HasMaxLength(500);
        e.Property(x => x.Remark).HasColumnName("remark").HasMaxLength(4000);
        e.Property(x => x.PersonalRemark).HasColumnName("personal_remark").HasMaxLength(4000);
        e.Property(x => x.Status).HasColumnName("status_id").HasConversion<byte>();
        e.Ignore(x => x.DomainEvents);
    }
}
