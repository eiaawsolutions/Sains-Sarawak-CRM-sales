/* ============================================================
   V0001 — Lookup/reference tables (picklists) + master data
   Forward-only. Re-running is safe (uses IF NOT EXISTS guards).
   MSSQL 2022 Standard+.
   ============================================================ */

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'crm')
    EXEC('CREATE SCHEMA crm');
GO

-- ----------------------------------------------------------------
-- Picklist: organization types (SAINS Integration API enum)
-- IDs preserved verbatim from SAINS Integration API v1.2
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.organization_types', N'U') IS NULL
CREATE TABLE crm.organization_types (
    id            smallint       PRIMARY KEY,     -- non-sequential, preserved
    name          nvarchar(100)  NOT NULL UNIQUE,
    is_active     bit            NOT NULL DEFAULT 1,
    sort_order    smallint       NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Picklist: salutations (Integration API enum — user + contact share)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.salutations', N'U') IS NULL
CREATE TABLE crm.salutations (
    id            smallint       PRIMARY KEY,     -- non-sequential, preserved
    name          nvarchar(50)   NOT NULL UNIQUE,
    is_active     bit            NOT NULL DEFAULT 1,
    sort_order    smallint       NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Picklist: designations (Integration API enum)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.designations', N'U') IS NULL
CREATE TABLE crm.designations (
    id            smallint       PRIMARY KEY,
    name          nvarchar(100)  NOT NULL UNIQUE,
    is_active     bit            NOT NULL DEFAULT 1,
    sort_order    smallint       NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Picklist: MY state codes (single letter per Integration API enum)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.my_states', N'U') IS NULL
CREATE TABLE crm.my_states (
    code          char(1)        PRIMARY KEY,
    name          nvarchar(50)   NOT NULL UNIQUE,
    is_active     bit            NOT NULL DEFAULT 1
);
GO

-- ----------------------------------------------------------------
-- Picklist: quotation statuses (6-state canonical per FSD v1.3)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.quotation_statuses', N'U') IS NULL
CREATE TABLE crm.quotation_statuses (
    id            tinyint        PRIMARY KEY,
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(64)   NOT NULL,
    is_terminal   bit            NOT NULL DEFAULT 0,
    is_editable   bit            NOT NULL DEFAULT 0,
    sort_order    tinyint        NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Picklist: quotation types (FSD §3.2 — 5 types)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.quotation_types', N'U') IS NULL
CREATE TABLE crm.quotation_types (
    id            tinyint        PRIMARY KEY,
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(64)   NOT NULL,
    is_active     bit            NOT NULL DEFAULT 1
);
GO

-- ----------------------------------------------------------------
-- Picklist: rejection reasons (FSD §3.2.10)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.rejection_reasons', N'U') IS NULL
CREATE TABLE crm.rejection_reasons (
    id            tinyint        PRIMARY KEY,
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(100)  NOT NULL,
    requires_text bit            NOT NULL DEFAULT 0,
    is_active     bit            NOT NULL DEFAULT 1,
    sort_order    tinyint        NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Product category + sub-category (configurable per FSD §3.2.2.1)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.product_categories', N'U') IS NULL
CREATE TABLE crm.product_categories (
    id            smallint       PRIMARY KEY,
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(100)  NOT NULL,
    is_active     bit            NOT NULL DEFAULT 1,
    sort_order    smallint       NOT NULL DEFAULT 0
);
GO

IF OBJECT_ID(N'crm.product_sub_categories', N'U') IS NULL
CREATE TABLE crm.product_sub_categories (
    id                 smallint       IDENTITY(1,1) PRIMARY KEY,
    category_id        smallint       NOT NULL REFERENCES crm.product_categories(id),
    code               varchar(64)    NOT NULL,
    name               nvarchar(100)  NOT NULL,
    is_active          bit            NOT NULL DEFAULT 1,
    sort_order         smallint       NOT NULL DEFAULT 0,
    CONSTRAINT UX_product_sub_category UNIQUE (category_id, code)
);
GO

-- ----------------------------------------------------------------
-- User roles (IDs preserved from SAINS mapping spreadsheet — non-sequential)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.roles', N'U') IS NULL
CREATE TABLE crm.roles (
    id            int            PRIMARY KEY,     -- 2949, 2950, 2961, 2963, 2965, 2966
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(64)   NOT NULL,
    description   nvarchar(500)  NULL,
    is_active     bit            NOT NULL DEFAULT 1,
    sort_order    smallint       NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Departments + sections (for hierarchy visibility RLS)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.departments', N'U') IS NULL
CREATE TABLE crm.departments (
    id            uniqueidentifier PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    code          varchar(32)      NOT NULL UNIQUE,  -- e.g. '8-40'
    name          nvarchar(200)    NOT NULL,
    is_active     bit              NOT NULL DEFAULT 1
);
GO

IF OBJECT_ID(N'crm.sections', N'U') IS NULL
CREATE TABLE crm.sections (
    id            uniqueidentifier PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    department_id uniqueidentifier NOT NULL REFERENCES crm.departments(id),
    code          varchar(32)      NOT NULL,          -- e.g. '011'
    name          nvarchar(200)    NOT NULL,
    is_active     bit              NOT NULL DEFAULT 1,
    CONSTRAINT UX_section UNIQUE (department_id, code)
);
GO

-- ----------------------------------------------------------------
-- Source-of-fund (SCSDU vs Non-SCSDU) — Integration API v1.2
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.fund_sources', N'U') IS NULL
CREATE TABLE crm.fund_sources (
    id            tinyint        PRIMARY KEY,
    code          varchar(16)    NOT NULL UNIQUE,
    name          nvarchar(64)   NOT NULL
);
GO

-- ----------------------------------------------------------------
-- Proposal statuses (FSD — 2 values)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.proposal_statuses', N'U') IS NULL
CREATE TABLE crm.proposal_statuses (
    id            tinyint        PRIMARY KEY,
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(64)   NOT NULL,
    is_terminal   bit            NOT NULL DEFAULT 0
);
GO

-- ----------------------------------------------------------------
-- Lead statuses (not in FSD — designed per workflow PDF)
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.lead_statuses', N'U') IS NULL
CREATE TABLE crm.lead_statuses (
    id            tinyint        PRIMARY KEY,
    code          varchar(32)    NOT NULL UNIQUE,
    name          nvarchar(64)   NOT NULL,
    is_terminal   bit            NOT NULL DEFAULT 0
);
GO

PRINT 'V0001 applied: lookup/reference tables';
