/* ============================================================
   V0003 — Accounts + contacts (read-only mirror of SAINS CMD)
   Temporal tables for full audit history.
   Always Encrypted on PII fields (enabled later once CMK/CEK provisioned).
   ============================================================ */

IF OBJECT_ID(N'crm.accounts', N'U') IS NULL
CREATE TABLE crm.accounts (
    id                       uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    cmd_ref_id               uniqueidentifier NULL UNIQUE,                -- SAINS CMD id
    organization_name        nvarchar(200)    NOT NULL,
    organization_short_name  nvarchar(200)    NULL,
    organization_type_id     smallint         NULL REFERENCES crm.organization_types(id),
    website                  nvarchar(200)    NULL,
    office_phone             nvarchar(30)     NULL,
    fax                      nvarchar(30)     NULL,
    line_1                   nvarchar(100)    NULL,
    line_2                   nvarchar(100)    NULL,
    line_3                   nvarchar(100)    NULL,
    city                     nvarchar(50)     NULL,
    postcode                 varchar(10)      NULL,
    state_code               char(1)          NULL REFERENCES crm.my_states(code),
    country_code             char(2)          NOT NULL DEFAULT 'MY',
    remark                   nvarchar(4000)   NULL,
    description              nvarchar(4000)   NULL,
    -- business key for webhook de-dup when cmd_ref_id unknown
    match_key                AS (LOWER(LTRIM(RTRIM(organization_name)))) PERSISTED,
    cmd_last_updated         datetime2(7)     NULL,
    created_at               datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at               datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.accounts_history));
GO

CREATE INDEX IX_accounts_match_key ON crm.accounts(match_key);
CREATE INDEX IX_accounts_org_type  ON crm.accounts(organization_type_id);
CREATE INDEX IX_accounts_state     ON crm.accounts(state_code);
CREATE INDEX IX_accounts_cmd_ref   ON crm.accounts(cmd_ref_id);
GO

-- ----------------------------------------------------------------
-- Account contacts (1:N with account; multi-contact per FSD)
-- PII fields will be marked Always Encrypted via V0011
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.account_contacts', N'U') IS NULL
CREATE TABLE crm.account_contacts (
    id                 uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    account_id         uniqueidentifier NOT NULL REFERENCES crm.accounts(id) ON DELETE CASCADE,
    salutation_id      smallint         NULL REFERENCES crm.salutations(id),
    full_name          nvarchar(200)    NOT NULL,
    email              nvarchar(320)    NULL,
    mobile             nvarchar(50)     NULL,
    business_phone     nvarchar(30)     NULL,
    fax                nvarchar(30)     NULL,
    designation_id     smallint         NULL REFERENCES crm.designations(id),
    profile_img        nvarchar(500)    NULL,
    remark             nvarchar(4000)   NULL,
    personal_remark    nvarchar(4000)   NULL,
    status_id          tinyint          NOT NULL DEFAULT 1,   -- 1=Active, 2=InActive
    cmd_last_updated   datetime2(7)     NULL,
    created_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.account_contacts_history));
GO

CREATE INDEX IX_contacts_account_id ON crm.account_contacts(account_id, status_id);
CREATE INDEX IX_contacts_email      ON crm.account_contacts(email);
GO

PRINT 'V0003 applied: accounts + account_contacts with temporal history';
