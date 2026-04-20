using MediatR;
using Sains.Crm.Application.Abstractions;

namespace Sains.Crm.Application.Common;

/// <summary>
/// MediatR pipeline behaviour — refuses to execute commands tagged with <see cref="IAgentGated"/>
/// when <c>agents_enabled</c> is off. ADR-0006 guardrail #7.
/// </summary>
public sealed class KillSwitchBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IFeatureFlags _flags;
    public KillSwitchBehavior(IFeatureFlags flags) => _flags = flags;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (request is IAgentGated)
        {
            if (!await _flags.IsOnAsync("agents_enabled", ct))
                throw new KillSwitchException("Agents are currently disabled.");
        }
        return await next();
    }
}

/// <summary>Marker — put on any CQRS request that invokes the v1.1 agent layer.</summary>
public interface IAgentGated { }

public sealed class KillSwitchException : Exception
{
    public KillSwitchException(string message) : base(message) { }
}
