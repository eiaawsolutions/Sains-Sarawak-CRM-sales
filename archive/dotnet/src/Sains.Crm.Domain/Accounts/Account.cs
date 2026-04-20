using Sains.Crm.Domain.Common;

namespace Sains.Crm.Domain.Accounts;

/// <summary>
/// Read-only mirror of SAINS CMD. Only the CMD webhook processor ever calls the creation/update
/// methods; no user-facing command path mutates Account per FSD v1.3.
/// </summary>
public sealed class Account : Entity
{
    public Guid? CmdRefId { get; private set; }
    public string OrganizationName { get; private set; } = string.Empty;
    public string? OrganizationShortName { get; private set; }
    public short? OrganizationTypeId { get; private set; }
    public string? Website { get; private set; }
    public string? OfficePhone { get; private set; }
    public string? Fax { get; private set; }
    public Address Address { get; private set; } = Address.Empty;
    public string? Remark { get; private set; }
    public string? Description { get; private set; }
    public DateTimeOffset? CmdLastUpdated { get; private set; }

    private readonly List<AccountContact> _contacts = new();
    public IReadOnlyList<AccountContact> Contacts => _contacts;

    private Account() { }

    /// <summary>Called by CMD webhook processor only.</summary>
    internal static Account CreateFromCmd(
        Guid id, Guid? cmdRefId, string organizationName, string? shortName,
        short? orgTypeId, string? website, string? phone, string? fax,
        Address address, string? remark, string? description, DateTimeOffset cmdLastUpdated)
    {
        var a = new Account
        {
            Id = id,
            CmdRefId = cmdRefId,
            OrganizationName = organizationName,
            OrganizationShortName = shortName,
            OrganizationTypeId = orgTypeId,
            Website = website,
            OfficePhone = phone,
            Fax = fax,
            Address = address,
            Remark = remark,
            Description = description,
            CmdLastUpdated = cmdLastUpdated
        };
        a.Raise(new AccountIngested(a.Id, organizationName));
        return a;
    }

    /// <summary>Called by CMD webhook processor on updates.</summary>
    internal void ApplyCmdUpdate(
        string organizationName, string? shortName, short? orgTypeId,
        string? website, string? phone, string? fax, Address address,
        string? remark, string? description, DateTimeOffset cmdLastUpdated)
    {
        OrganizationName = organizationName;
        OrganizationShortName = shortName;
        OrganizationTypeId = orgTypeId;
        Website = website;
        OfficePhone = phone;
        Fax = fax;
        Address = address;
        Remark = remark;
        Description = description;
        CmdLastUpdated = cmdLastUpdated;
        Raise(new AccountUpdatedFromCmd(Id, organizationName, cmdLastUpdated));
    }

    internal void ReplaceContacts(IEnumerable<AccountContact> incoming)
    {
        _contacts.Clear();
        _contacts.AddRange(incoming);
    }
}

public sealed record Address(
    string? Line1,
    string? Line2,
    string? Line3,
    string? City,
    string? Postcode,
    string? StateCode,
    string? CountryCode)
{
    public static Address Empty { get; } = new(null, null, null, null, null, null, "MY");
}

public sealed record AccountIngested(Guid AccountId, string OrganizationName) : DomainEvent;
public sealed record AccountUpdatedFromCmd(Guid AccountId, string OrganizationName, DateTimeOffset CmdTimestamp) : DomainEvent;
