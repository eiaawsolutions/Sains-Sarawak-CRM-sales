namespace Sains.Crm.Mcp.Tools;

/// <summary>
/// The 10 tools exposed to v1.1 agents per ADR-0008. Keep the list tight — every tool is an
/// audit surface. Never add a tool without a corresponding Domain boundary and RLS check.
/// </summary>
public static class McpManifest
{
    public static readonly McpTool[] All =
    {
        new("search_leads",             "Search leads visible to the invoker.",                          InputSchema: Schemas.SearchLeads,         OutputSchema: Schemas.LeadList),
        new("get_lead",                 "Fetch a single lead.",                                          InputSchema: Schemas.ById,                OutputSchema: Schemas.LeadDetail),
        new("get_account_360",          "Fetch unified context on an account (contacts, deals, activity).",InputSchema: Schemas.ById,              OutputSchema: Schemas.Account360),
        new("search_products",          "Search product catalog.",                                       InputSchema: Schemas.SearchProducts,      OutputSchema: Schemas.ProductList),
        new("compose_quotation_draft",  "Compose a quotation draft. Returns editable preview; does NOT persist.", InputSchema: Schemas.ComposeQuote, OutputSchema: Schemas.QuotePreview),
        new("enrich_firmographics",     "Look up organisation firmographics from public sources.",        InputSchema: Schemas.EnrichOrg,           OutputSchema: Schemas.Firmographics),
        new("suggest_contacts",         "Suggest likely decision-maker contacts at an organisation.",     InputSchema: Schemas.EnrichOrg,           OutputSchema: Schemas.ContactSuggestions),
        new("query_pipeline",           "Query quotations by filter; RLS-scoped to invoker.",            InputSchema: Schemas.PipelineFilter,      OutputSchema: Schemas.QuotationList),
        new("query_audit_log",          "Query audit log entries. Director/Admin only.",                 InputSchema: Schemas.AuditFilter,         OutputSchema: Schemas.AuditList),
        new("compose_forecast_narrative", "Generate a narrative explaining pipeline risks for a period.", InputSchema: Schemas.Period,              OutputSchema: Schemas.ForecastNarrative)
    };
}

public sealed record McpTool(string Name, string Description, object InputSchema, object OutputSchema);

internal static class Schemas
{
    public static readonly object ById              = new { type = "object", required = new[] { "id" }, properties = new { id = new { type = "string", format = "uuid" } } };
    public static readonly object SearchLeads       = new { type = "object", properties = new { query = new { type = "string" }, limit = new { type = "integer", maximum = 50 } } };
    public static readonly object SearchProducts    = new { type = "object", properties = new { query = new { type = "string" }, categoryId = new { type = "integer" }, limit = new { type = "integer", maximum = 50 } } };
    public static readonly object ComposeQuote      = new { type = "object", required = new[] { "leadId", "productIds" }, properties = new { leadId = new { type = "string" }, productIds = new { type = "array", items = new { type = "string" } } } };
    public static readonly object EnrichOrg         = new { type = "object", required = new[] { "organizationName" }, properties = new { organizationName = new { type = "string" } } };
    public static readonly object PipelineFilter    = new { type = "object", properties = new { statusIds = new { type = "array", items = new { type = "integer" } }, ownerUserId = new { type = "string" } } };
    public static readonly object AuditFilter       = new { type = "object", properties = new { since = new { type = "string", format = "date-time" }, targetEntity = new { type = "string" }, limit = new { type = "integer", maximum = 500 } } };
    public static readonly object Period            = new { type = "object", required = new[] { "from", "to" }, properties = new { from = new { type = "string", format = "date" }, to = new { type = "string", format = "date" } } };

    public static readonly object LeadList          = new { type = "array" };
    public static readonly object LeadDetail        = new { type = "object" };
    public static readonly object Account360        = new { type = "object" };
    public static readonly object ProductList       = new { type = "array" };
    public static readonly object QuotePreview      = new { type = "object" };
    public static readonly object Firmographics     = new { type = "object" };
    public static readonly object ContactSuggestions= new { type = "array" };
    public static readonly object QuotationList     = new { type = "array" };
    public static readonly object AuditList         = new { type = "array" };
    public static readonly object ForecastNarrative = new { type = "object" };
}
