# Component Diagram — Inside the CRM App

```mermaid
flowchart TB
    subgraph "Sains.Crm.Web (ASP.NET Core host)"
        ui[Blazor Server UI]
        api[REST API controllers]
        webhook[CMD Webhook Receiver]
        auth[FIM OIDC middleware]
    end

    subgraph "Sains.Crm.Application"
        cqrs[MediatR handlers]
        policies[Authorization policies]
        validators[FluentValidation]
    end

    subgraph "Sains.Crm.Domain"
        agg_lead[Lead aggregate]
        agg_acct[Account aggregate]
        agg_quot[Quotation aggregate]
        agg_prop[Proposal aggregate]
        agg_prod[Product aggregate]
        quotenum[QuotationNumberGenerator]
        sm[State machines]
    end

    subgraph "Sains.Crm.Infrastructure"
        efcore[EF Core DbContext]
        rls[RLS session setter]
        audit[Audit interceptor]
        hangfire[Hangfire jobs]
        pdf[QuestPDF adapter]
        fimclient[FIM OIDC client]
        ldapclient[Smart-XChange LDAP client]
        cmdsink[CMD Webhook processor]
        killswitch[Feature flag reader]
    end

    subgraph "Sains.Crm.Mcp (v1.1)"
        mcpapi[MCP tool endpoints]
    end
    subgraph "Sains.Crm.Agents (v1.1)"
        orch[Orchestrator]
        drafter[Quotation Drafter]
        enricher[Lead Enricher]
        narrator[Forecast Narrator]
        gateway[LiteLLM gateway + Presidio]
    end

    ui --> cqrs
    api --> cqrs
    webhook --> cqrs
    cqrs --> policies
    cqrs --> validators
    cqrs --> agg_lead & agg_acct & agg_quot & agg_prop & agg_prod
    cqrs --> efcore
    efcore --> rls
    efcore --> audit
    cqrs --> hangfire
    cqrs --> pdf
    auth --> fimclient
    cqrs --> ldapclient
    webhook --> cmdsink
    cqrs --> killswitch

    ui -.v1.1.-> orch
    orch --> drafter & enricher & narrator
    drafter & enricher & narrator --> gateway
    drafter & enricher & narrator --> mcpapi
    mcpapi --> cqrs
```

## Project references (dependency arrows follow Clean Architecture)

```
Web  ──►  Application  ──►  Domain
  │           │
  ▼           ▼
Infrastructure ──► Domain
Mcp  ──►  Application  ──►  Domain
Agents  ──►  Mcp
```

Domain has **zero outgoing dependencies** (pure C#, no EF, no ASP.NET).
