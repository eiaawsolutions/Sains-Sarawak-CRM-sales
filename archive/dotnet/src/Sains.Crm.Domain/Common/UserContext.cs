namespace Sains.Crm.Domain.Common;

/// <summary>
/// Canonical "who is acting" shape. Passed through the Application layer into domain methods
/// that need to enforce role/section/department rules OR record actor identity on domain events.
/// Constructed from the authenticated ASP.NET Core principal + the user record; never trust
/// raw claims inside the Domain.
/// </summary>
public sealed record UserContext(
    Guid UserId,
    string FimSub,
    string FullName,
    RoleCode Role,
    Guid? DepartmentId,
    Guid? SectionId,
    string? StaffPrefix);

public enum RoleCode
{
    Administrator  = 2949,
    AccountManager = 2950,
    Viewer         = 2961,
    SectionHead    = 2963,
    Director       = 2965,
    UnitHead       = 2966
}
