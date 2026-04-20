/* ============================================================
   V0011 — v1.1 upgrades (SAINS-confirmed 2026-04-20)
   Guarded by feature_flags.v11_enabled — tables exist, but the v1.0 runtime never references them.
   ============================================================ */

-- ----------------------------------------------------------------
-- Opportunity entity — Lead + Opportunity + Quotation per workflow PDF
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.opportunity_statuses', N'U') IS NULL
CREATE TABLE crm.opportunity_statuses (
    id          tinyint       PRIMARY KEY,
    code        varchar(32)   NOT NULL UNIQUE,
    name        nvarchar(64)  NOT NULL,
    is_terminal bit           NOT NULL DEFAULT 0,
    sort_order  tinyint       NOT NULL DEFAULT 0
);
GO

MERGE crm.opportunity_statuses AS tgt
USING (VALUES
    (1, 'low_confidence',    N'Low Confidence',    0, 1),
    (2, 'normal_confidence', N'Normal Confidence', 0, 2),
    (3, 'high_confidence',   N'High Confidence',   0, 3),
    (4, 'converted',         N'Converted',         1, 4),
    (5, 'lost',              N'Lost',              1, 5),
    (6, 'kiv',               N'KIV',               0, 6)
) AS src(id, code, name, is_terminal, sort_order) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT VALUES (src.id, src.code, src.name, src.is_terminal, src.sort_order);
GO

IF OBJECT_ID(N'crm.opportunities', N'U') IS NULL
CREATE TABLE crm.opportunities (
    id                     uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    lead_id                uniqueidentifier NOT NULL REFERENCES crm.leads(id),
    owner_user_id          uniqueidentifier NOT NULL REFERENCES crm.users(id),
    opportunity_name       nvarchar(500)    NOT NULL,
    estimated_value_myr    decimal(18,2)    NULL,
    expected_close_date    date             NULL,
    status_id              tinyint          NOT NULL REFERENCES crm.opportunity_statuses(id),
    notes                  nvarchar(max)    NULL,
    owner_department_id    uniqueidentifier NULL,
    owner_section_id       uniqueidentifier NULL,
    created_at             datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at             datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.opportunities_history));
GO

CREATE INDEX IX_opportunities_lead    ON crm.opportunities(lead_id);
CREATE INDEX IX_opportunities_owner   ON crm.opportunities(owner_user_id, status_id);
CREATE INDEX IX_opportunities_section ON crm.opportunities(owner_section_id, status_id);
GO

-- link quotations to opportunities (nullable — v1.0 doesn't use)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'opportunity_id' AND object_id = OBJECT_ID('crm.quotations'))
ALTER TABLE crm.quotations ADD opportunity_id uniqueidentifier NULL REFERENCES crm.opportunities(id);
GO

-- ----------------------------------------------------------------
-- Extended quotation lifecycle overlay (v1.1 13-state parallel Revision track)
-- ----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = 'revision_track_phase' AND object_id = OBJECT_ID('crm.quotations'))
ALTER TABLE crm.quotations
ADD revision_track_phase  tinyint NULL,    -- 1=Draft-R, 2=PendingApproval-R, 3=Approved-R, 4=QuotationSent-R
    acceptance_artefact   varchar(8) NULL; -- 'WOT' | 'AOQ' | 'LOA'
GO

-- ----------------------------------------------------------------
-- Multi-level approval router (to-do v3 R13 + Notes sheet scenarios)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.approval_rules', N'U') IS NULL
CREATE TABLE crm.approval_rules (
    id                         uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    rule_name                  nvarchar(200)    NOT NULL,
    min_amount_myr             decimal(18,2)    NOT NULL,
    max_amount_myr             decimal(18,2)    NULL,
    first_level_role_id        int              NOT NULL REFERENCES crm.roles(id),  -- Verifier
    first_level_bypass_allowed bit              NOT NULL DEFAULT 0,
    second_level_role_id       int              NULL REFERENCES crm.roles(id),      -- Approver (null if only 1-level)
    department_scope_id        uniqueidentifier NULL REFERENCES crm.departments(id),
    section_scope_id           uniqueidentifier NULL REFERENCES crm.sections(id),
    is_active                  bit              NOT NULL DEFAULT 1,
    sort_order                 smallint         NOT NULL DEFAULT 0,
    created_at                 datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_approval_rules_range ON crm.approval_rules(min_amount_myr, max_amount_myr) WHERE is_active = 1;
GO

-- Seed the four scenarios from To-Do v3 Notes sheet. Figures are placeholders awaiting SAINS R13.
MERGE crm.approval_rules AS tgt
USING (VALUES
    ('AM → UH (1st-level verifier, bypass 2nd)',           0,       49999.99, 2966, 1, NULL),
    ('AM → UH → SH (2nd-level approver)',                  50000,   199999.99, 2966, 0, 2963),
    ('UH creates → SH (1st-level verifier, bypass 2nd)',   0,       49999.99, 2963, 1, NULL),
    ('UH → SH → Director (2nd-level approver)',            200000,  NULL,     2963, 0, 2965)
) AS src(rule_name, min_amount_myr, max_amount_myr, first_level_role_id, first_level_bypass_allowed, second_level_role_id)
ON tgt.rule_name = src.rule_name
WHEN NOT MATCHED THEN INSERT (rule_name, min_amount_myr, max_amount_myr, first_level_role_id, first_level_bypass_allowed, second_level_role_id)
VALUES (src.rule_name, src.min_amount_myr, src.max_amount_myr, src.first_level_role_id, src.first_level_bypass_allowed, src.second_level_role_id);
GO

-- Per-quotation approval trail (one row per approval step)
IF OBJECT_ID(N'crm.quotation_approval_steps', N'U') IS NULL
CREATE TABLE crm.quotation_approval_steps (
    id                 uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    quotation_id       uniqueidentifier NOT NULL REFERENCES crm.quotations(id) ON DELETE CASCADE,
    step_order         smallint         NOT NULL,
    rule_id            uniqueidentifier NULL REFERENCES crm.approval_rules(id),
    approver_role_id   int              NOT NULL REFERENCES crm.roles(id),
    approver_user_id   uniqueidentifier NULL REFERENCES crm.users(id),  -- NULL until acted
    decision           varchar(16)      NULL,          -- 'approve' | 'return' | 'bypass'
    decided_at         datetime2(7)     NULL,
    notes              nvarchar(max)    NULL
);
GO

CREATE INDEX IX_approval_steps_quotation ON crm.quotation_approval_steps(quotation_id, step_order);
GO

-- ----------------------------------------------------------------
-- Email integration (Option 1) — inbound reply correlation
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.email_threads', N'U') IS NULL
CREATE TABLE crm.email_threads (
    id                    uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    quotation_id          uniqueidentifier NOT NULL REFERENCES crm.quotations(id),
    subject_ref_token     varchar(128)     NOT NULL,    -- placed in outbound email subject line
    outbound_sent_at      datetime2(7)     NULL,
    outbound_to_addresses nvarchar(max)    NOT NULL,    -- JSON array
    outbound_message_id   varchar(512)     NULL,        -- Message-ID header
    last_inbound_at       datetime2(7)     NULL,
    inbound_count         int              NOT NULL DEFAULT 0,
    created_at            datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_email_threads_token ON crm.email_threads(subject_ref_token);
CREATE INDEX IX_email_threads_quotation ON crm.email_threads(quotation_id);
GO

IF OBJECT_ID(N'crm.email_messages', N'U') IS NULL
CREATE TABLE crm.email_messages (
    id              uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    thread_id       uniqueidentifier NOT NULL REFERENCES crm.email_threads(id) ON DELETE CASCADE,
    direction       varchar(8)       NOT NULL,         -- 'out' | 'in'
    message_id      varchar(512)     NULL,
    in_reply_to     varchar(512)     NULL,
    from_address    nvarchar(320)    NOT NULL,
    to_addresses    nvarchar(max)    NOT NULL,         -- JSON array
    cc_addresses    nvarchar(max)    NULL,
    subject         nvarchar(1000)   NULL,
    body_html       nvarchar(max)    NULL,
    body_text       nvarchar(max)    NULL,
    has_pdf         bit              NOT NULL DEFAULT 0,
    received_at     datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_email_messages_thread ON crm.email_messages(thread_id, received_at DESC);
GO

-- ----------------------------------------------------------------
-- Lead → Customer write-back ledger (v1.1 — reverse direction of SaveXml/124)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.lead_win_writeback_jobs', N'U') IS NULL
CREATE TABLE crm.lead_win_writeback_jobs (
    id                  uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    lead_id             uniqueidentifier NOT NULL REFERENCES crm.leads(id),
    triggering_quotation_id uniqueidentifier NOT NULL REFERENCES crm.quotations(id),
    attempt_count       smallint         NOT NULL DEFAULT 0,
    status              varchar(16)      NOT NULL DEFAULT 'pending',  -- pending | in_flight | success | failed | dead_letter
    cmd_response_id     uniqueidentifier NULL,
    error_message       nvarchar(2000)   NULL,
    created_at          datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE INDEX IX_lead_win_status ON crm.lead_win_writeback_jobs(status, created_at);
GO

-- ----------------------------------------------------------------
-- v1.1 master kill switches
-- ----------------------------------------------------------------
MERGE crm.feature_flags AS tgt
USING (VALUES
    ('v11_enabled',                      0, N'Master v1.1 switch — when OFF, all v1.1 tables/jobs are idle'),
    ('opportunities_enabled',            0, N'Opportunity entity between Lead and Quotation'),
    ('multi_level_approval_enabled',     0, N'Multi-level approval router (AM\u2192UH\u2192SH\u2192Director scenarios)'),
    ('email_option1_enabled',            0, N'Centralised CRM mailbox + inbound reply correlation'),
    ('lead_win_writeback_enabled',       0, N'Push Lead\u2192Customer to CMD on Quotation Closed'),
    ('ambient_capture_enabled',          0, N'Whisper meeting transcription \u2192 auto-activity log'),
    ('extended_quotation_lifecycle',     0, N'13-state Revision sub-track + acceptance artefacts (WOT/AOQ/LOA)')
) AS src([key], is_enabled, description) ON tgt.[key] = src.[key]
WHEN NOT MATCHED THEN INSERT ([key], is_enabled, description) VALUES (src.[key], src.is_enabled, src.description);
GO

PRINT 'V0011 applied: v1.1 upgrade tables (all behind feature flags, OFF by default)';
