using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Accounts;

public enum ContactStatus : byte { Active = 1, Inactive = 2 }

public sealed class AccountContact : Entity
{
    public Guid AccountId { get; private set; }
    public short? SalutationId { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? Mobile { get; private set; }
    public string? BusinessPhone { get; private set; }
    public string? Fax { get; private set; }
    public short? DesignationId { get; private set; }
    public string? ProfileImg { get; private set; }
    public string? Remark { get; private set; }
    public string? PersonalRemark { get; private set; }
    public ContactStatus Status { get; private set; } = ContactStatus.Active;

    private AccountContact() { }

    internal static AccountContact CreateFromCmd(
        Guid id, Guid accountId, short? salutationId, string fullName,
        string? email, string? mobile, string? businessPhone, string? fax,
        short? designationId, string? profileImg, string? remark, string? personalRemark)
        => new()
        {
            Id = id,
            AccountId = accountId,
            SalutationId = salutationId,
            FullName = fullName,
            Email = email,
            Mobile = mobile,
            BusinessPhone = businessPhone,
            Fax = fax,
            DesignationId = designationId,
            ProfileImg = profileImg,
            Remark = remark,
            PersonalRemark = personalRemark,
            Status = ContactStatus.Active
        };

    internal void Deactivate() => Status = ContactStatus.Inactive;
}
