using Sains.Crm.Agents.Gateway;

namespace Sains.Crm.Agents.Agents;

public sealed record ForecastNarratorInput(DateOnly From, DateOnly To, string FreeFormQuestion);

public sealed record ForecastNarratorOutput(
    string Narrative,
    IReadOnlyList<AtRiskItem> AtRisk,
    IReadOnlyList<string> Recommendations,
    IReadOnlyList<string> CitedQuotationIds);

public sealed record AtRiskItem(Guid QuotationId, string QuotationNo, decimal Total, string Reason, string Category);

/// <summary>
/// L1 Suggest — read-only; never writes. Summarises pipeline, cites specific quotation IDs,
/// and explicitly lists recommendations as human tasks. AM/Director must navigate and act
/// on each recommendation manually.
/// </summary>
public sealed class ForecastNarratorAgent : IAgent<ForecastNarratorInput, ForecastNarratorOutput>
{
    public string Name => "forecast-narrator";
    public AutonomyLevel Autonomy => AutonomyLevel.L1_Suggest;

    private readonly ILlmGateway _llm;
    private const string SystemPrompt = """
        You are a sales-ops analyst. Given a table of pipeline quotations + a table of recent
        audit events, produce a concise narrative explaining what is slipping and why. EVERY
        claim must cite at least one quotation ID from the input — NEVER reference quotations
        not in the provided data. Return JSON only with keys: narrative, atRisk[], recommendations[],
        citedQuotationIds[].
        """;

    public ForecastNarratorAgent(ILlmGateway llm) { _llm = llm; }

    public async Task<AgentResult<ForecastNarratorOutput>> InvokeAsync(
        ForecastNarratorInput input, AgentInvocationContext ctx, CancellationToken ct)
    {
        var userPrompt = $"""
            Period: {input.From:yyyy-MM-dd} to {input.To:yyyy-MM-dd}.
            User question: {input.FreeFormQuestion}
            Use retrieved pipeline + audit data. Return JSON only.
            """;

        var resp = await _llm.CompleteStructuredAsync<ForecastNarratorOutput>(
            new LlmRequest(SystemPrompt, userPrompt, Model: "anthropic.claude-opus-4-7-20260101-v1:0", MaxOutputTokens: 2048),
            outputSchemaJson: """{ "type": "object" }""",
            ct);

        return new AgentResult<ForecastNarratorOutput>(
            IsSuccess: true,
            Output: new ForecastNarratorOutput(
                Narrative: "(v1.1 scaffolding — wire RawJson deserialise here)",
                AtRisk: Array.Empty<AtRiskItem>(),
                Recommendations: Array.Empty<string>(),
                CitedQuotationIds: Array.Empty<string>()),
            ErrorCode: null, ErrorMessage: null,
            Cost: new AgentCostReport(resp.TokensIn, resp.TokensOut, resp.CostUsd, resp.Provider, resp.Model, resp.RedactionCount));
    }
}
