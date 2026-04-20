/* ============================================================
   V0002 — Users + identity
   Keyed by FIM 2.0 OIDC 'sub' claim.
   ============================================================ */

IF OBJECT_ID(N'crm.users', N'U') IS NULL
CREATE TABLE crm.users (
    id                 uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    fim_sub            varchar(128)     NOT NULL UNIQUE,       -- OIDC sub
    uid                varchar(64)      NULL,                  -- LDAP uid
    staff_prefix       varchar(16)      NULL,                  -- e.g. 'RYNC' for quotation #
    full_name          nvarchar(200)    NOT NULL,
    email              nvarchar(320)    NOT NULL,
    mobile             nvarchar(50)     NULL,
    role_id            int              NOT NULL REFERENCES crm.roles(id),
    department_id      uniqueidentifier NULL REFERENCES crm.departments(id),
    section_id         uniqueidentifier NULL REFERENCES crm.sections(id),
    job_title          nvarchar(200)    NULL,
    salutation_id      smallint         NULL REFERENCES crm.salutations(id),
    is_active          bit              NOT NULL DEFAULT 1,
    last_login_at      datetime2(7)     NULL,
    created_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.users_history));
GO

-- Hot-path lookups
CREATE INDEX IX_users_email   ON crm.users(email) WHERE is_active = 1;
CREATE INDEX IX_users_section ON crm.users(section_id, role_id) WHERE is_active = 1;
GO

-- ----------------------------------------------------------------
-- Feature flags — kill switches per ADR-0006
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.feature_flags', N'U') IS NULL
CREATE TABLE crm.feature_flags (
    [key]              varchar(64)      NOT NULL PRIMARY KEY,
    is_enabled         bit              NOT NULL,
    description        nvarchar(500)    NULL,
    updated_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_by_user_id uniqueidentifier NULL REFERENCES crm.users(id)
);
GO

PRINT 'V0002 applied: users + feature flags';
