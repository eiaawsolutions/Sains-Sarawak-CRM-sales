/* ============================================================
   V0007 — CMD webhook ledger + audit log + kill-switch audit
   Per ADR-0005 (CMD webhook) and ADR-0006 (audit log append-only).
   ============================================================ */

-- ----------------------------------------------------------------
-- CMD webhook idempotency ledger + raw payload archive
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.cmd_webhook_ledger', N'U') IS NULL
CREATE TABLE crm.cmd_webhook_ledger (
    idempotency_key    char(64)         NOT NULL PRIMARY KEY,   -- SHA256 hex of body
    received_at        datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    processed_at       datetime2(7)     NULL,
    status             tinyint          NOT NULL,               -- 1=Pending, 2=Processed, 3=Failed, 4=DeadLetter
    attempt_count      smallint         NOT NULL DEFAULT 0,
    module             varchar(32)      NULL,
    sp_key             varchar(32)      NULL,
    payload_ref        uniqueidentifier NULL,
    resolved_entity    varchar(32)      NULL,                   -- 'account', 'contact'
    resolved_id        uniqueidentifier NULL,
    error_message      nvarchar(2000)   NULL,
    correlation_id     uniqueidentifier NULL
);
GO

CREATE INDEX IX_ledger_status ON crm.cmd_webhook_ledger(status, received_at);
GO

IF OBJECT_ID(N'crm.cmd_webhook_payloads', N'U') IS NULL
CREATE TABLE crm.cmd_webhook_payloads (
    id                 uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    received_at        datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    body_json          nvarchar(max)    NOT NULL,
    body_bytes         int              NOT NULL,
    client_id_header   varchar(128)     NULL,
    unix_time_header   varchar(16)      NULL,
    signature_header   varchar(128)     NULL,
    source_ip          varchar(45)      NULL
);
GO

CREATE INDEX IX_payloads_received ON crm.cmd_webhook_payloads(received_at);
GO

-- ----------------------------------------------------------------
-- Append-only audit log (ADR-0006)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.audit_log', N'U') IS NULL
CREATE TABLE crm.audit_log (
    id                 bigint           IDENTITY(1,1) NOT NULL PRIMARY KEY,
    event_time         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    event_type         varchar(64)      NOT NULL,
    actor_user_id      uniqueidentifier NULL,
    actor_role_id      int              NULL,
    actor_ip           varchar(45)      NULL,
    actor_user_agent   varchar(512)     NULL,
    target_entity      varchar(64)      NULL,
    target_id          uniqueidentifier NULL,
    before_value       nvarchar(max)    NULL,
    after_value        nvarchar(max)    NULL,
    outcome            varchar(16)      NOT NULL,        -- success | reject | error | hitl_pending
    latency_ms         int              NULL,
    llm_provider       varchar(32)      NULL,
    llm_model          varchar(64)      NULL,
    llm_tokens_in      int              NULL,
    llm_tokens_out     int              NULL,
    llm_cost_usd       decimal(10,6)    NULL,
    reason             nvarchar(1000)   NULL,
    correlation_id     uniqueidentifier NULL
);
GO

CREATE INDEX IX_audit_time          ON crm.audit_log(event_time DESC);
CREATE INDEX IX_audit_actor         ON crm.audit_log(actor_user_id, event_time DESC);
CREATE INDEX IX_audit_target        ON crm.audit_log(target_entity, target_id, event_time DESC);
CREATE INDEX IX_audit_correlation   ON crm.audit_log(correlation_id);
CREATE INDEX IX_audit_event_type    ON crm.audit_log(event_type, event_time DESC);
GO

-- ----------------------------------------------------------------
-- Append-only enforcement — block UPDATE/DELETE on audit_log
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.trg_audit_log_no_update', N'TR') IS NULL
EXEC('
CREATE TRIGGER crm.trg_audit_log_no_update
ON crm.audit_log
INSTEAD OF UPDATE
AS
BEGIN
    RAISERROR (''crm.audit_log is append-only; UPDATE forbidden'', 16, 1);
END');
GO

IF OBJECT_ID(N'crm.trg_audit_log_no_delete', N'TR') IS NULL
EXEC('
CREATE TRIGGER crm.trg_audit_log_no_delete
ON crm.audit_log
INSTEAD OF DELETE
AS
BEGIN
    RAISERROR (''crm.audit_log is append-only; DELETE forbidden'', 16, 1);
END');
GO

PRINT 'V0007 applied: webhook ledger + audit log with append-only triggers';
