namespace Sains.Crm.Domain.Common;

/// <summary>
/// Explicit success/failure envelope — used for command outcomes where throwing would be overkill.
/// Pattern-match in call sites; <see cref="Value"/> is non-null iff <see cref="IsSuccess"/>.
/// </summary>
public readonly record struct Result<T>(bool IsSuccess, T? Value, DomainError? Error)
{
    public static Result<T> Ok(T value) => new(true, value, null);
    public static Result<T> Fail(DomainError error) => new(false, default, error);
    public static Result<T> Fail(string code, string message) => new(false, default, new DomainError(code, message));
}

public readonly record struct Result(bool IsSuccess, DomainError? Error)
{
    public static Result Ok() => new(true, null);
    public static Result Fail(DomainError error) => new(false, error);
    public static Result Fail(string code, string message) => new(false, new DomainError(code, message));
}

public sealed record DomainError(string Code, string Message);
