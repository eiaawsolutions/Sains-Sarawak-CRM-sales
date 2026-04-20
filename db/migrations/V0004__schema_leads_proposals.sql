/* ============================================================
   V0004 — Leads + proposals
   Per ADR-0002 (separate lead & account tables).
   ============================================================ */

IF OBJECT_ID(N'crm.leads', N'U') IS NULL
CREATE TABLE crm.leads (
    id                         uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    owner_user_id              uniqueidentifier NOT NULL REFERENCES crm.users(id),
    account_id                 uniqueidentifier NULL REFERENCES crm.accounts(id),       -- pre-existing CMD account, optional
    converted_to_account_id    uniqueidentifier NULL REFERENCES crm.accounts(id),       -- set when CMD creates the account post-Won
    organization_name          nvarchar(200)    NOT NULL,
    primary_contact_name       nvarchar(200)    NULL,
    primary_contact_phone      nvarchar(50)     NULL,
    primary_contact_email      nvarchar(320)    NULL,
    source                     nvarchar(100)    NULL,       -- enquiry, referral, meeting, email, other
    status_id                  tinyint          NOT NULL REFERENCES crm.lead_statuses(id),
    needs_proposal             bit              NOT NULL DEFAULT 0,
    notes                      nvarchar(max)    NULL,
    -- RLS scope propagation — store owner's dept+section snapshot at create time
    owner_department_id        uniqueidentifier NULL,
    owner_section_id           uniqueidentifier NULL,
    created_at                 datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at                 datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.leads_history));
GO

CREATE INDEX IX_leads_owner_status        ON crm.leads(owner_user_id, status_id);
CREATE INDEX IX_leads_section_status      ON crm.leads(owner_section_id, status_id);
CREATE INDEX IX_leads_organization_name   ON crm.leads(organization_name);
GO

-- ----------------------------------------------------------------
-- Proposals (optional pre-quotation stage; FSD §3.4)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.proposals', N'U') IS NULL
CREATE TABLE crm.proposals (
    id                     uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    lead_id                uniqueidentifier NOT NULL REFERENCES crm.leads(id),
    owner_user_id          uniqueidentifier NOT NULL REFERENCES crm.users(id),
    proposal_no            varchar(64)      NOT NULL UNIQUE,   -- running #, same scheme family as quotation
    subject                nvarchar(500)    NOT NULL,
    status_id              tinyint          NOT NULL REFERENCES crm.proposal_statuses(id),
    note                   nvarchar(max)    NULL,
    converted_quotation_id uniqueidentifier NULL,              -- FK added post-quotations table exists
    owner_department_id    uniqueidentifier NULL,
    owner_section_id       uniqueidentifier NULL,
    created_at             datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at             datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.proposals_history));
GO

CREATE INDEX IX_proposals_lead_id    ON crm.proposals(lead_id);
CREATE INDEX IX_proposals_owner      ON crm.proposals(owner_user_id, status_id);
CREATE INDEX IX_proposals_section    ON crm.proposals(owner_section_id, status_id);
GO

PRINT 'V0004 applied: leads + proposals';
