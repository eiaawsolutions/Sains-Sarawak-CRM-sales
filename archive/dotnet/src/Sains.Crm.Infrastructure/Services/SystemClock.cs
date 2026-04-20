using Sains.Crm.Application.Abstractions;

namespace Sains.Crm.Infrastructure.Services;

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
