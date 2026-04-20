/* ============================================================
   V0009 — v1.1 agent layer support tables
   Applied in v1.0 (empty and unused) so v1.1 is a data migration, not a schema change.
   ============================================================ */

-- Lead enrichment suggestions — populated by Lead Enricher agent, accepted/rejected by AM
IF OBJECT_ID(N'crm.lead_enrichment_suggestions', N'U') IS NULL
CREATE TABLE crm.lead_enrichment_suggestions (
    id                 uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    lead_id            uniqueidentifier NOT NULL REFERENCES crm.leads(id) ON DELETE CASCADE,
    suggested_at       datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    agent_version      varchar(32)      NULL,
    field_name         varchar(64)      NOT NULL,
    current_value      nvarchar(max)    NULL,
    suggested_value    nvarchar(max)    NULL,
    source_urls        nvarchar(max)    NULL,             -- JSON array
    confidence_score   decimal(4,3)     NULL,             -- 0.000 – 1.000
    status             varchar(16)      NOT NULL DEFAULT 'pending',  -- pending | accepted | rejected | expired
    decided_at         datetime2(7)     NULL,
    decided_by_user_id uniqueidentifier NULL REFERENCES crm.users(id),
    llm_cost_usd       decimal(10,6)    NULL
);
GO

CREATE INDEX IX_les_lead_status ON crm.lead_enrichment_suggestions(lead_id, status);
GO

-- User token budget (per-user LLM spend cap)
IF OBJECT_ID(N'crm.user_token_budgets', N'U') IS NULL
CREATE TABLE crm.user_token_budgets (
    user_id                uniqueidentifier NOT NULL,
    budget_date            date             NOT NULL,
    tokens_in_used         int              NOT NULL DEFAULT 0,
    tokens_out_used        int              NOT NULL DEFAULT 0,
    cost_usd_used          decimal(10,6)    NOT NULL DEFAULT 0,
    daily_tokens_in_limit  int              NOT NULL DEFAULT 100000,
    daily_tokens_out_limit int              NOT NULL DEFAULT 20000,
    daily_cost_usd_limit   decimal(10,2)    NOT NULL DEFAULT 10.00,
    CONSTRAINT PK_user_token_budgets PRIMARY KEY (user_id, budget_date),
    CONSTRAINT FK_user_token_budgets_user FOREIGN KEY (user_id) REFERENCES crm.users(id)
);
GO

-- Global agent cost circuit breaker
IF OBJECT_ID(N'crm.agent_cost_ledger', N'U') IS NULL
CREATE TABLE crm.agent_cost_ledger (
    ledger_date            date             NOT NULL PRIMARY KEY,
    total_cost_usd         decimal(12,4)    NOT NULL DEFAULT 0,
    total_tokens_in        bigint           NOT NULL DEFAULT 0,
    total_tokens_out       bigint           NOT NULL DEFAULT 0,
    invocation_count       int              NOT NULL DEFAULT 0,
    daily_cap_usd          decimal(10,2)    NOT NULL DEFAULT 200.00,
    circuit_open           bit              NOT NULL DEFAULT 0,  -- set to 1 when cap exceeded
    last_updated_at        datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- MCP tool call log (every tool call audited)
IF OBJECT_ID(N'crm.mcp_tool_calls', N'U') IS NULL
CREATE TABLE crm.mcp_tool_calls (
    id                 bigint           IDENTITY(1,1) NOT NULL PRIMARY KEY,
    called_at          datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    agent_name         varchar(64)      NOT NULL,      -- 'quotation_drafter' | 'lead_enricher' | 'forecast_narrator'
    agent_run_id       uniqueidentifier NOT NULL,
    invoker_user_id    uniqueidentifier NOT NULL REFERENCES crm.users(id),
    tool_name          varchar(128)     NOT NULL,
    input_payload      nvarchar(max)    NOT NULL,
    input_pii_redacted nvarchar(max)    NULL,
    output_payload     nvarchar(max)    NULL,
    outcome            varchar(16)      NOT NULL,
    latency_ms         int              NULL,
    llm_provider       varchar(32)      NULL,
    llm_model          varchar(64)      NULL,
    llm_tokens_in      int              NULL,
    llm_tokens_out     int              NULL,
    llm_cost_usd       decimal(10,6)    NULL,
    error_message      nvarchar(2000)   NULL
);
GO

CREATE INDEX IX_mcp_calls_run     ON crm.mcp_tool_calls(agent_run_id);
CREATE INDEX IX_mcp_calls_invoker ON crm.mcp_tool_calls(invoker_user_id, called_at DESC);
CREATE INDEX IX_mcp_calls_agent   ON crm.mcp_tool_calls(agent_name, called_at DESC);
GO

-- Vector embeddings staging (MSSQL 2025 VECTOR column; for v1.0 keep nvarchar(max) JSON)
IF OBJECT_ID(N'crm.embeddings', N'U') IS NULL
CREATE TABLE crm.embeddings (
    id               uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    source_entity    varchar(32)      NOT NULL,        -- 'account', 'quotation', 'activity', 'kb'
    source_id        uniqueidentifier NOT NULL,
    chunk_index      smallint         NOT NULL DEFAULT 0,
    chunk_text       nvarchar(max)    NOT NULL,
    embedding_json   nvarchar(max)    NOT NULL,        -- JSON array of floats; migrate to VECTOR type in 2025+
    embedding_model  varchar(64)      NOT NULL,
    created_at       datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_embeddings_source ON crm.embeddings(source_entity, source_id);
GO

PRINT 'V0009 applied: v1.1 agent-layer tables';
