namespace Sains.Crm.Agents.Gateway;

/// <summary>
/// The only way agents speak to an LLM. Enforces: BYOM routing, PII redaction, JSON schema
/// validation, cost capture, circuit-breaker on daily cap. Never call Anthropic / Bedrock
/// SDKs directly from an agent.
/// </summary>
public interface ILlmGateway
{
    Task<LlmResponse> CompleteStructuredAsync<TOutput>(
        LlmRequest request,
        string outputSchemaJson,
        CancellationToken ct);
}

public sealed record LlmRequest(
    string SystemPrompt,
    string UserPrompt,
    string Model,
    int MaxOutputTokens,
    decimal TemperaturePct = 0.1m);

public sealed record LlmResponse(
    string RawJson,
    int TokensIn,
    int TokensOut,
    decimal CostUsd,
    string Provider,
    string Model,
    int RedactionCount,
    IReadOnlyList<string> SourceCitations);
