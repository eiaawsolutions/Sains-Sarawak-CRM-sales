/* ============================================================
   V0008 — Row-Level Security policies
   Per ADR-0006 guardrail #2. Hierarchy visibility via SESSION_CONTEXT.
   Bypass role: 'Administrator' and 'Director' see all.
   ============================================================ */

-- RLS bypass role set by Infrastructure at connection time via sp_set_session_context
-- Keys used:
--   @user_id      uniqueidentifier   — current user
--   @role_code    varchar(32)        — 'Administrator', 'Director', 'SectionHead', 'UnitHead', 'AccountManager', 'Viewer'
--   @section_id   uniqueidentifier   — current user's section
--   @department_id uniqueidentifier  — current user's department
--   @bypass_rls   bit                — only for admin service accounts (background jobs)

CREATE SCHEMA security AUTHORIZATION dbo;
GO

-- ----------------------------------------------------------------
-- Predicate function — shared across user-scoped tables
-- ----------------------------------------------------------------
CREATE OR ALTER FUNCTION security.fn_visible_by_hierarchy
(
    @owner_user_id       uniqueidentifier,
    @owner_section_id    uniqueidentifier,
    @owner_department_id uniqueidentifier
)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS fn_result
WHERE
    CAST(SESSION_CONTEXT(N'bypass_rls') AS bit) = 1
    OR CAST(SESSION_CONTEXT(N'role_code') AS varchar(32)) IN ('Administrator', 'Director')
    OR (CAST(SESSION_CONTEXT(N'role_code') AS varchar(32)) = 'SectionHead'
        AND @owner_section_id = CAST(SESSION_CONTEXT(N'section_id') AS uniqueidentifier))
    OR (CAST(SESSION_CONTEXT(N'role_code') AS varchar(32)) = 'UnitHead'
        AND @owner_department_id = CAST(SESSION_CONTEXT(N'department_id') AS uniqueidentifier))
    OR (CAST(SESSION_CONTEXT(N'role_code') AS varchar(32)) = 'AccountManager'
        AND @owner_user_id = CAST(SESSION_CONTEXT(N'user_id') AS uniqueidentifier))
    OR (CAST(SESSION_CONTEXT(N'role_code') AS varchar(32)) = 'Viewer');
GO

-- Enforce on LEADS
CREATE SECURITY POLICY security.lead_visibility
ADD FILTER PREDICATE security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.leads,
ADD BLOCK PREDICATE  security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.leads AFTER INSERT,
ADD BLOCK PREDICATE  security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.leads AFTER UPDATE
WITH (STATE = ON);
GO

-- Enforce on QUOTATIONS
CREATE SECURITY POLICY security.quotation_visibility
ADD FILTER PREDICATE security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.quotations,
ADD BLOCK PREDICATE  security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.quotations AFTER INSERT,
ADD BLOCK PREDICATE  security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.quotations AFTER UPDATE
WITH (STATE = ON);
GO

-- Enforce on PROPOSALS
CREATE SECURITY POLICY security.proposal_visibility
ADD FILTER PREDICATE security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.proposals,
ADD BLOCK PREDICATE  security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.proposals AFTER INSERT,
ADD BLOCK PREDICATE  security.fn_visible_by_hierarchy(owner_user_id, owner_section_id, owner_department_id) ON crm.proposals AFTER UPDATE
WITH (STATE = ON);
GO

-- NOTE: accounts & account_contacts are CMD-sourced; visibility is broader.
--       Policy: everyone authenticated can read; only the webhook processor writes.
--       Enforced at Application layer (no user-facing write endpoints).
--       This is intentional — matches FSD v1.3 "CRM does not create or modify customer or contact records".

PRINT 'V0008 applied: RLS policies on leads, quotations, proposals';
