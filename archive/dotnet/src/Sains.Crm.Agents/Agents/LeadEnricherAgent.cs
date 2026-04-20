using Sains.Crm.Agents.Gateway;

namespace Sains.Crm.Agents.Agents;

public sealed record LeadEnricherInput(Guid LeadId, string OrganizationName);

public sealed record LeadEnricherOutput(
    string? Industry,
    int? EmployeeCount,
    string? Website,
    IReadOnlyList<string> PressMentions,
    IReadOnlyList<SuggestedContact> SuggestedContacts);

public sealed record SuggestedContact(string Name, string Role, string? Email, string? LinkedInUrl, decimal ConfidenceScore);

/// <summary>
/// L2 Draft — every suggestion lands in the <c>lead_enrichment_suggestions</c> table with
/// status=pending. AM must accept each field individually — no auto-apply.
/// </summary>
public sealed class LeadEnricherAgent : IAgent<LeadEnricherInput, LeadEnricherOutput>
{
    public string Name => "lead-enricher";
    public AutonomyLevel Autonomy => AutonomyLevel.L2_Draft;

    private readonly ILlmGateway _llm;
    private const string SystemPrompt = """
        You are an assistant that extracts firmographics and suggests decision-maker contacts
        for Malaysian state-government / GLC / commercial organisations. ONLY use information
        from the supplied search snippets — NEVER invent facts. Express every contact's
        confidence score as 0.000–1.000. Return JSON only.
        """;

    public LeadEnricherAgent(ILlmGateway llm) { _llm = llm; }

    public async Task<AgentResult<LeadEnricherOutput>> InvokeAsync(
        LeadEnricherInput input, AgentInvocationContext ctx, CancellationToken ct)
    {
        var userPrompt = $"""
            Extract firmographics and likely decision-makers for: {input.OrganizationName}.
            Use retrieved snippets only. Output JSON with keys: industry, employeeCount,
            website, pressMentions[], suggestedContacts[]. Each contact has name, role,
            email?, linkedInUrl?, confidenceScore.
            """;

        var resp = await _llm.CompleteStructuredAsync<LeadEnricherOutput>(
            new LlmRequest(SystemPrompt, userPrompt, Model: "anthropic.claude-sonnet-4-6-20260101-v1:0", MaxOutputTokens: 1536),
            outputSchemaJson: """{ "type": "object" }""",
            ct);

        return new AgentResult<LeadEnricherOutput>(
            IsSuccess: true,
            Output: new LeadEnricherOutput(null, null, null,
                Array.Empty<string>(), Array.Empty<SuggestedContact>()),
            ErrorCode: null, ErrorMessage: null,
            Cost: new AgentCostReport(resp.TokensIn, resp.TokensOut, resp.CostUsd, resp.Provider, resp.Model, resp.RedactionCount));
    }
}
