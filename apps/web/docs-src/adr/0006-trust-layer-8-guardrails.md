# ADR 0006 — Trust layer: 8 non-negotiable guardrails

- **Status:** Proposed
- **Date:** 2026-04-20

## Context

Per `crm-god-mode/references/trust-and-governance.md`, any CRM with AI/agents requires 8 specific guardrails. Even v1.0 (no agents) benefits from most of them for classic OWASP + PDPA hardening.

## Decision

Implement all 8 guardrails in v1.0 (minus PII redaction at LLM egress, which activates in v1.1 when agents come online).

### 1. Tool allowlist

- No dynamic SQL. All queries via EF Core parameterised `FromSqlInterpolated` or LINQ.
- No user-supplied SQL fragments anywhere.
- HTTP clients with allowlisted hosts (FIM, Smart-XChange, Bedrock).

### 2. Permission propagation (RLS)

- MSSQL Row-Level Security on all user-scoped tables (leads, quotations, activities).
- Every `DbContext` resolution sets `SESSION_CONTEXT` via `sp_set_session_context` with `@user_id`, `@user_role`, `@department_id`, `@section_id`.
- RLS predicates enforce hierarchy visibility:
  - `Administrator`, `Director` → see all
  - `SectionHead` → see own section (`section_id = SESSION_CONTEXT(N'section_id')`)
  - `UnitHead` → see own unit/department
  - `AccountManager` → see own records (`owner_user_id = SESSION_CONTEXT(N'user_id')`)
  - `Viewer` → see permitted scope (default: all read-only)

### 3. Rate limits

- IIS-level: ARR / Request Filtering on request count per IP.
- App-level: `AspNetCoreRateLimit` on sensitive endpoints:
  - Auth: 10 attempts / 5 minutes / IP
  - Webhook: 100 req/sec (CMD won't exceed but cap anyway)
  - Agent tools: 20 req/user/minute (v1.1)

### 4. PII redaction (v1.1 only)

- Microsoft Presidio wrapper at the LLM gateway.
- Redacted fields: `name`, `email`, `mobile`, `IC number` (if captured), any free-text that may contain them.
- Deanonymisation map stored in memory only for the duration of the agent loop.

### 5. Output schema validation

- All LLM structured outputs validated against System.Text.Json schemas before acting on them.
- Invalid → reject + retry with corrective feedback up to 2 times.

### 6. HITL triggers

- v1.0: the vetting flow IS the HITL gate for quotations ≥ threshold.
- v1.1: Slack/Teams approval bot for any agent action that would:
  - Send outbound communication
  - Modify records of high-value customers (SCSDU flagged)
  - Escalate beyond declared scope
  - Trigger any external API mutation

### 7. Kill switch

- `feature_flags` table with boolean columns:
  - `agents_enabled`
  - `ai_inference_enabled`
  - `cmd_webhook_enabled` (for maintenance windows)
  - `email_dispatch_enabled` (v1.1, Option 1 only)
- Every sensitive code path checks first.
- Flippable only by `Administrator` role via audited admin UI.

### 8. Append-only audit log

```sql
CREATE TABLE audit_log (
    id                    bigint IDENTITY(1,1) PRIMARY KEY,
    event_time            datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    event_type            varchar(64)  NOT NULL,  -- 'entity.create', 'quotation.submit', 'agent.tool_call', etc.
    actor_user_id         uniqueidentifier NULL,
    actor_ip              varchar(45) NULL,
    actor_user_agent      varchar(512) NULL,
    target_entity         varchar(64) NULL,       -- 'quotation', 'lead', etc.
    target_id             uniqueidentifier NULL,
    before_value          nvarchar(max) NULL,     -- JSON
    after_value           nvarchar(max) NULL,     -- JSON
    outcome               varchar(16) NOT NULL,   -- 'success' | 'reject' | 'error' | 'hitl_pending'
    latency_ms            int NULL,
    llm_provider          varchar(32) NULL,       -- v1.1
    llm_model             varchar(64) NULL,       -- v1.1
    llm_tokens_in         int NULL,               -- v1.1
    llm_tokens_out        int NULL,               -- v1.1
    llm_cost_usd          decimal(10,6) NULL,     -- v1.1
    reason                nvarchar(1000) NULL,
    correlation_id        uniqueidentifier NULL
);

-- Block mutations
CREATE TRIGGER trg_audit_log_no_update ON audit_log
INSTEAD OF UPDATE AS BEGIN
    RAISERROR ('audit_log is append-only', 16, 1);
END;

CREATE TRIGGER trg_audit_log_no_delete ON audit_log
INSTEAD OF DELETE AS BEGIN
    RAISERROR ('audit_log is append-only', 16, 1);
END;
```

Archive to Parquet on SAINS object storage after 3 years; retain forever.

## Consequences

### Positive

- Lawyer-ready "can the agent do X?" answer in 2 minutes.
- PDPA DSAR endpoints straightforward.
- Pentest-ready.

### Negative

- RLS adds complexity to local dev (need to set SESSION_CONTEXT or use a bypass role). Mitigation: EF Core interceptor handles it automatically.

## Blocker

- Exact hierarchy visibility rules (R-39 in the to-do list) need SAINS confirmation. Current assumption documented above.
