using Sains.Crm.Agents.Gateway;

namespace Sains.Crm.Agents.Agents;

public sealed record QuotationDrafterInput(Guid LeadId, IReadOnlyList<Guid> ProductIds);

public sealed record QuotationDrafterOutput(
    IReadOnlyList<QuotationDrafterLine> Items,
    decimal Subtotal,
    decimal Tax,
    decimal Total,
    string SuggestedTermsConditions,
    string Note);

public sealed record QuotationDrafterLine(
    Guid ProductId,
    string Description,
    int Quantity,
    decimal UnitPrice,
    decimal TaxPct,
    string Rationale);

/// <summary>
/// L2 Draft — the agent proposes a quotation, the AM reviews + edits + saves. Nothing persists
/// until the AM explicitly clicks Save in the normal Quotation UI.
/// </summary>
public sealed class QuotationDrafterAgent : IAgent<QuotationDrafterInput, QuotationDrafterOutput>
{
    public string Name => "quotation-drafter";
    public AutonomyLevel Autonomy => AutonomyLevel.L2_Draft;

    private readonly ILlmGateway _llm;
    private const string SystemPrompt = """
        You are an assistant that drafts B2B IT-services quotations for SAINS Sarawak.
        You MUST output valid JSON matching the provided schema. NEVER include free text
        outside the JSON structure. Ground every rationale in the retrieved product/price data
        — NEVER invent products, prices, or tax rates.
        If you cannot draft a complete quotation, return { "error": "insufficient_context" }.
        """;

    public QuotationDrafterAgent(ILlmGateway llm) { _llm = llm; }

    public async Task<AgentResult<QuotationDrafterOutput>> InvokeAsync(
        QuotationDrafterInput input, AgentInvocationContext ctx, CancellationToken ct)
    {
        // The caller (orchestrator) has already fetched lead + products via MCP.
        // Keep this agent stateless w.r.t. the DB — it only composes text.
        var userPrompt = $"""
            Compose a quotation for lead {input.LeadId} covering product IDs: {string.Join(",", input.ProductIds)}.
            Use retrieved product data. Present 1-3 lines. Suggest T&C appropriate for government client.
            Return JSON only.
            """;

        var resp = await _llm.CompleteStructuredAsync<QuotationDrafterOutput>(
            new LlmRequest(SystemPrompt, userPrompt, Model: "anthropic.claude-opus-4-7-20260101-v1:0", MaxOutputTokens: 2048),
            outputSchemaJson: """{ "type": "object" }""",
            ct);

        // In production: deserialise resp.RawJson to QuotationDrafterOutput with schema validation.
        // For v1.1 scaffolding we return a stub.
        return new AgentResult<QuotationDrafterOutput>(
            IsSuccess: true,
            Output: new QuotationDrafterOutput(
                Items: new List<QuotationDrafterLine>(),
                Subtotal: 0m, Tax: 0m, Total: 0m,
                SuggestedTermsConditions: "Standard SAINS T&C v2026.01",
                Note: "AI draft — review before saving."),
            ErrorCode: null, ErrorMessage: null,
            Cost: new AgentCostReport(resp.TokensIn, resp.TokensOut, resp.CostUsd, resp.Provider, resp.Model, resp.RedactionCount));
    }
}
