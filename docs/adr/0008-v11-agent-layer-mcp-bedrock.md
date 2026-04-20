# ADR 0008 — v1.1 Agent layer: MCP server + Claude via Bedrock `ap-southeast-5`

- **Status:** Proposed (v1.1 — change-order upsell; not in signed FSD)
- **Date:** 2026-04-20

## Context

The signed FSD v1.3 is agent-free. The "world-class" differentiator vs competitor Malaysian gov CRMs is a carefully-scoped agent layer that honours PDPA + sovereignty and climbs the autonomy ladder slowly.

## Decision

### Scope (3 agents, first year at L1–L2 only)

| Agent | Purpose | Autonomy | Invocation |
|---|---|---|---|
| **Quotation Drafter** | Given a Lead + Product selections, draft a complete Quotation (line items, T&Cs, notes) for the AM to review-and-edit | L2 Draft | AM clicks "AI Draft" button on new quotation form |
| **Lead Enricher** | On Lead create, suggest firmographics + likely decision-maker contacts from public sources (SSM, news, press releases) | L2 Draft | Auto on Lead create; AM confirms each suggestion |
| **Forecast Narrator** | For Directors: "Which quotations are slipping this month and why?" — grounded in audit_log + quotation data | L1 Suggest | Director types question into NL query box |

No agent has write access beyond the HITL-gated surface. **L3 autonomy is explicitly forbidden in Year 1 without a new scope-change document.**

### Architecture

```
         Web UI (Blazor Server)
                │
                │ "AI Draft" button click
                ▼
       ┌────────────────────┐
       │  Agent Orchestrator │
       │  (hierarchical)     │
       └──────┬──────────────┘
              │ delegates
      ┌───────┼────────┐
      ▼       ▼        ▼
  ┌────────┐┌────────┐┌────────┐
  │Drafter ││Enricher││Forecast│
  └───┬────┘└───┬────┘└───┬────┘
      └────┬────┴─────────┘
           │ tool calls
           ▼
    ┌─────────────┐
    │  MCP Server │  (ASP.NET Core minimal API)
    └──────┬──────┘
           │ EF Core
           ▼
        MSSQL 2022
```

### MCP server (tool surface)

Internal ASP.NET Core minimal API on port 5443, not exposed externally. Each tool:
- Declares input + output JSON Schema
- Receives the invoking user's identity via internal JWT
- Runs under that user's RLS scope (via SESSION_CONTEXT)
- Audits every call

Tool surface v1.1:

```
search_leads(query, filters, limit)              → list[lead]
get_lead(lead_id)                                → lead
get_account_360(account_id)                      → unified context blob
search_products(query, category, limit)          → list[product]
compose_quotation_draft(lead_id, product_ids[])  → { items, subtotal, tax, total, suggested_tnc }
enrich_firmographics(org_name)                   → { industry, employee_count, website, press_mentions }
suggest_contacts(org_name)                       → list[{ name, role, email?, linkedin? }]
query_pipeline(filters)                          → list[quotation with status]
query_audit_log(filters, limit)                  → list[audit_entry]
compose_forecast_narrative(period)               → { summary, at_risk[], recommendations[] }
```

### LLM gateway

**LiteLLM internal deployment** routes to:

1. **Primary:** Anthropic Claude Opus 4.7 via **AWS Bedrock `ap-southeast-5`** (Malaysia region, launched 2025). PDPA exception needed from SAINS. Access via mTLS private endpoint from SAINS VPN.

2. **Fallback:** Self-hosted **Llama 4 70B** on SAINS VM (4× A100 or equivalent) if Bedrock is refused.

3. **Embeddings:** `voyage-3-large` via Bedrock OR `nomic-embed-text-v1.5` self-hosted.

### PII redaction

**Mandatory egress filter** via Microsoft Presidio:
- `name`, `email`, `mobile`, `IC`, `passport` tokenised before LLM call
- Mapping kept in memory only for the duration of the agent loop
- Deanonymised on return

### Cost + observability

- Token budget per user per day (configurable; default 100K input + 20K output tokens)
- Cost circuit breaker: global daily cap (default $200/day) — if exceeded, agents return deterministic fallbacks
- Every LLM call logged with `prompt_version`, `model`, `tokens_in`, `tokens_out`, `latency_ms`, `cost_usd`, `redaction_count`
- Dashboard: token burn, cost per agent, approval rate, HITL reject rate

### Evaluation

- Golden set of 50 quotation-drafting prompts in `tests/evals/quotation-drafter-golden.jsonl`
- LLM-as-judge rubric for enricher accuracy
- Weekly regression run in CI
- Drift monitor: rolling 7-day refusal + hallucination rate

## Consequences

### Positive

- Differentiation vs any competitor CRM in the Malaysian gov space
- Preserves data sovereignty (Bedrock MY region or self-hosted Llama)
- All guardrails operational before Year 2 autonomy increase

### Negative

- v1.1 requires change order from SAINS
- LLM costs non-trivial (~$200–$500/month at forecast volume)
- Ops team needs LLM runbook training

## Blocker

- SAINS PDPA exception for Bedrock `ap-southeast-5` (or agreement to self-hosted Llama)
- Change-order SOW for v1.1 signed
