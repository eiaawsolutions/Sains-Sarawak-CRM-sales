using Sains.Crm.Agents.Agents;

namespace Sains.Crm.Agents;

/// <summary>
/// The hierarchical orchestrator per ADR-0008. It never talks to an LLM directly; it delegates
/// to one of the three specialist agents. HITL gates live in the caller (Blazor UI) — when the
/// orchestrator returns a result, the UI decides whether to persist or discard.
/// </summary>
public interface IAgentOrchestrator
{
    Task<AgentResult<QuotationDrafterOutput>> InvokeQuotationDrafterAsync(QuotationDrafterInput input, AgentInvocationContext ctx, CancellationToken ct);
    Task<AgentResult<LeadEnricherOutput>> InvokeLeadEnricherAsync(LeadEnricherInput input, AgentInvocationContext ctx, CancellationToken ct);
    Task<AgentResult<ForecastNarratorOutput>> InvokeForecastNarratorAsync(ForecastNarratorInput input, AgentInvocationContext ctx, CancellationToken ct);
}

public sealed class AgentOrchestrator : IAgentOrchestrator
{
    private readonly QuotationDrafterAgent _drafter;
    private readonly LeadEnricherAgent _enricher;
    private readonly ForecastNarratorAgent _narrator;

    public AgentOrchestrator(QuotationDrafterAgent drafter, LeadEnricherAgent enricher, ForecastNarratorAgent narrator)
    {
        _drafter = drafter; _enricher = enricher; _narrator = narrator;
    }

    public Task<AgentResult<QuotationDrafterOutput>> InvokeQuotationDrafterAsync(QuotationDrafterInput i, AgentInvocationContext c, CancellationToken ct)
        => _drafter.InvokeAsync(i, c, ct);

    public Task<AgentResult<LeadEnricherOutput>> InvokeLeadEnricherAsync(LeadEnricherInput i, AgentInvocationContext c, CancellationToken ct)
        => _enricher.InvokeAsync(i, c, ct);

    public Task<AgentResult<ForecastNarratorOutput>> InvokeForecastNarratorAsync(ForecastNarratorInput i, AgentInvocationContext c, CancellationToken ct)
        => _narrator.InvokeAsync(i, c, ct);
}
