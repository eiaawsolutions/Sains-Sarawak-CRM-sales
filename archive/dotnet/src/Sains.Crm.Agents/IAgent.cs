namespace Sains.Crm.Agents;

/// <summary>
/// Minimal agent interface. Each agent gets (a) a typed input, (b) the invoker's context,
/// (c) an LLM gateway it must route through (PII redaction enforced there). Output is structured;
/// any hallucination is caught by schema validation before returning.
/// </summary>
public interface IAgent<TInput, TOutput>
{
    /// <summary>Kebab-case canonical name — matches the audit event_type suffix.</summary>
    string Name { get; }
    /// <summary>Declared autonomy level. L3+ requires all 8 guardrails provably real.</summary>
    AutonomyLevel Autonomy { get; }
    Task<AgentResult<TOutput>> InvokeAsync(TInput input, AgentInvocationContext ctx, CancellationToken ct);
}

public enum AutonomyLevel
{
    L1_Suggest       = 1,
    L2_Draft         = 2,
    L3_ActThenNotify = 3,
    L4_ActInBounds   = 4,
    L5_FullAutonomy  = 5
}

public sealed record AgentInvocationContext(
    Guid InvokerUserId,
    Guid AgentRunId,
    string CorrelationId);

public sealed record AgentResult<T>(
    bool IsSuccess,
    T? Output,
    string? ErrorCode,
    string? ErrorMessage,
    AgentCostReport Cost);

public sealed record AgentCostReport(
    int TokensIn,
    int TokensOut,
    decimal CostUsd,
    string Provider,
    string Model,
    int RedactionCount);
