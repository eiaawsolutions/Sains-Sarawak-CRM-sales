/* ============================================================
   S0001 — Reference / lookup seed data
   IDs preserved verbatim from SAINS Integration API v1.2 + mapping spreadsheet.
   DO NOT renumber — LDAP/CMD ecosystem depends on these IDs.
   Idempotent via MERGE.
   ============================================================ */

SET NOCOUNT ON;

-- ----------------------------------------------------------------
-- Organization types (SAINS Integration API enum)
-- ----------------------------------------------------------------
MERGE crm.organization_types AS tgt
USING (VALUES
    (3,  N'Commercial'),
    (6,  N'Federal Government'),
    (9,  N'State Statutory Bodies'),
    (12, N'Government'),
    (15, N'Private'),
    (18, N'Chief Minister''s Department'),
    (21, N'State Department'),
    (24, N'Government Link Company'),
    (27, N'State Civic Centre'),
    (30, N'State Local Authorities'),
    (31, N'Non Government Organisation (NGO)'),
    (34, N'State Ministries'),
    (37, N'Medical'),
    (40, N'Resident Office'),
    (43, N'State Government Linked Companies'),
    (46, N'Public'),
    (49, N'District Office'),
    (50, N'Ministry')
) AS src(id, name) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (src.id, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Salutations (18 values, non-sequential IDs preserved)
-- ----------------------------------------------------------------
MERGE crm.salutations AS tgt
USING (VALUES
    (3,  N'Tuan'),    (6,  N'Puan'),     (9,  N'Cik'),      (12, N'Dato'''),
    (15, N'Datin'),   (18, N'Dato'' Sri'), (21, N'Datin Sri'),(24, N'Tan Sri'),
    (27, N'Puan Sri'),(30, N'Datuk'),    (33, N'Datuk Seri'),(36, N'Tun'),
    (39, N'Toh Puan'),(42, N'Encik'),    (45, N'Haji'),     (48, N'Hajjah'),
    (51, N'Doctor'),  (52, N'Datu')
) AS src(id, name) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (src.id, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Designations (11 values, IDs preserved)
-- ----------------------------------------------------------------
MERGE crm.designations AS tgt
USING (VALUES
    (3,  N'CEO'),
    (6,  N'ACIO'),
    (9,  N'Director'),
    (12, N'Staff'),
    (15, N'C-Suite'),
    (18, N'Secretary'),
    (21, N'Ketua Bahagian'),
    (24, N'Ketua Penolong Pengarah'),
    (27, N'General Manager'),
    (30, N'Head of Department'),
    (31, N'Controller')
) AS src(id, name) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, name) VALUES (src.id, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Malaysian state codes (single letter per Integration API)
-- ----------------------------------------------------------------
MERGE crm.my_states AS tgt
USING (VALUES
    ('J', N'Johor'),     ('K', N'Kedah'),   ('D', N'Kelantan'),  ('M', N'Melaka'),
    ('N', N'Negeri Sembilan'), ('C', N'Pahang'), ('P', N'Penang'), ('A', N'Perak'),
    ('R', N'Perlis'),    ('S', N'Sabah'),   ('E', N'Sarawak'),   ('B', N'Selangor'),
    ('T', N'Terengganu'),('U', N'Wilayah Putrajaya'), ('W', N'WP Kuala Lumpur'), ('L', N'WP Labuan')
) AS src(code, name) ON tgt.code = src.code
WHEN NOT MATCHED THEN INSERT (code, name) VALUES (src.code, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Quotation statuses (6-state canonical per FSD v1.3)
-- ----------------------------------------------------------------
MERGE crm.quotation_statuses AS tgt
USING (VALUES
    (1, 'draft',           N'Draft',             0, 1, 1),
    (2, 'under_vetting',   N'Under Vetting',     0, 0, 2),
    (3, 'approved',        N'Approved',          0, 0, 3),
    (4, 'quotation_sent',  N'Quotation Sent',    0, 0, 4),
    (5, 'closed',          N'Closed',            1, 0, 5),
    (6, 'rejected_expired',N'Rejected/Expired',  1, 0, 6)
) AS src(id, code, name, is_terminal, is_editable, sort_order) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT VALUES (src.id, src.code, src.name, src.is_terminal, src.is_editable, src.sort_order)
WHEN MATCHED THEN UPDATE SET tgt.code=src.code, tgt.name=src.name, tgt.is_terminal=src.is_terminal, tgt.is_editable=src.is_editable, tgt.sort_order=src.sort_order;

-- ----------------------------------------------------------------
-- Quotation types (FSD §3.2 — 5 types)
-- ----------------------------------------------------------------
MERGE crm.quotation_types AS tgt
USING (VALUES
    (1, 'new',              N'New Quotation'),
    (2, 'revised',          N'Revised Quotation'),
    (3, 'aoq',              N'Quotation with Acceptance of Quotation (AOQ)'),
    (4, 'optional_item',    N'Quotation with Optional Item'),
    (5, 'proposal_pricing', N'Proposal Pricing Schedule')
) AS src(id, code, name) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, code, name) VALUES (src.id, src.code, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Rejection reasons (FSD §3.2.10)
-- ----------------------------------------------------------------
MERGE crm.rejection_reasons AS tgt
USING (VALUES
    (1, 'customer_withdrawal', N'Customer Withdrawal / Cancelled',  0, 1),
    (2, 'other_vendor',        N'Other Vendor Preferred',           0, 2),
    (3, 'budget_constraint',   N'Budget Constraint',                0, 3),
    (4, 'others',              N'Others',                           1, 4)
) AS src(id, code, name, requires_text, sort_order) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT VALUES (src.id, src.code, src.name, src.requires_text, src.sort_order)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name, tgt.requires_text = src.requires_text;

-- ----------------------------------------------------------------
-- Product categories (FSD §3.2.2.1 — 4 configurable)
-- ----------------------------------------------------------------
MERGE crm.product_categories AS tgt
USING (VALUES
    (1, 'hardware',     N'Hardware'),
    (2, 'software',     N'Software'),
    (3, 'subscription', N'Subscription'),
    (4, 'services',     N'Services')
) AS src(id, code, name) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, code, name) VALUES (src.id, src.code, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Product sub-categories (mapped to parent)
-- ----------------------------------------------------------------
WITH src AS (
    SELECT * FROM (VALUES
        (1, 'pc',                N'PC'),
        (1, 'server',            N'Server'),
        (1, 'printer_scanner',   N'Printer/Scanner'),
        (1, 'network_switch',    N'Network Switch'),
        (1, 'spare_parts',       N'Spare Parts / Consumable Items'),
        (1, 'hw_other',          N'Others'),
        (2, 'sw_other',          N'Others'),
        (3, 'iaas',              N'Infrastructure-as-a-Service (IaaS)'),
        (3, 'sub_other',         N'Others'),
        (4, 'system_dev_install',N'System Development & Installation'),
        (4, 'implementation',    N'Implementation'),
        (4, 'training',          N'Training'),
        (4, 'project_management',N'Project Management'),
        (4, 'srv_other',         N'Others')
    ) AS x(category_id, code, name)
)
MERGE crm.product_sub_categories AS tgt
USING src ON tgt.category_id = src.category_id AND tgt.code = src.code
WHEN NOT MATCHED THEN INSERT (category_id, code, name) VALUES (src.category_id, src.code, src.name);

-- ----------------------------------------------------------------
-- Roles (IDs preserved from User mapping spreadsheet)
-- ----------------------------------------------------------------
MERGE crm.roles AS tgt
USING (VALUES
    (2949, 'Administrator',    N'Administrator',    N'Full system access + config'),
    (2950, 'AccountManager',   N'Account Manager',  N'Creates leads, drafts quotations'),
    (2961, 'Viewer',           N'Viewer',           N'Read-only permitted scope'),
    (2963, 'SectionHead',      N'Section Head',     N'Vets quotations above threshold, section visibility'),
    (2965, 'Director',         N'Director',         N'Organisation-wide reporting view'),
    (2966, 'UnitHead',         N'Unit Head',        N'Same as AM + unit visibility')
) AS src(id, code, name, description) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, code, name, description) VALUES (src.id, src.code, src.name, src.description)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name, tgt.description = src.description;

-- ----------------------------------------------------------------
-- Fund sources (SCSDU / Non-SCSDU)
-- ----------------------------------------------------------------
MERGE crm.fund_sources AS tgt
USING (VALUES
    (1, 'scsdu',     N'SCSDU'),
    (2, 'non_scsdu', N'Non-SCSDU')
) AS src(id, code, name) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT (id, code, name) VALUES (src.id, src.code, src.name)
WHEN MATCHED THEN UPDATE SET tgt.name = src.name;

-- ----------------------------------------------------------------
-- Proposal statuses
-- ----------------------------------------------------------------
MERGE crm.proposal_statuses AS tgt
USING (VALUES
    (1, 'open',                  N'Open',                     0),
    (2, 'converted_to_quotation',N'Converted into Quotation', 1)
) AS src(id, code, name, is_terminal) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT VALUES (src.id, src.code, src.name, src.is_terminal);

-- ----------------------------------------------------------------
-- Lead statuses (designed per workflow PDF — not in FSD)
-- ----------------------------------------------------------------
MERGE crm.lead_statuses AS tgt
USING (VALUES
    (1, 'open',       N'Open',       0),
    (2, 'qualified',  N'Qualified',  0),
    (3, 'won',        N'Won',        1),
    (4, 'lost',       N'Lost',       1)
) AS src(id, code, name, is_terminal) ON tgt.id = src.id
WHEN NOT MATCHED THEN INSERT VALUES (src.id, src.code, src.name, src.is_terminal);

-- ----------------------------------------------------------------
-- Feature flags — kill switches (ADR-0006)
-- ----------------------------------------------------------------
MERGE crm.feature_flags AS tgt
USING (VALUES
    ('agents_enabled',           0, N'Master kill switch for v1.1 AI agents'),
    ('ai_inference_enabled',     0, N'Allow LLM calls (overrides agents_enabled)'),
    ('cmd_webhook_enabled',      1, N'Accept inbound CMD webhook pushes'),
    ('email_dispatch_enabled',   0, N'v1.1 Option 1 email sending'),
    ('ldap_lookup_enabled',      1, N'Allow server-side LDAP lookups'),
    ('quotation_vetting_threshold_myr', 50000, N'Amount above which vetting required (numeric value stored in is_enabled col — will refactor)')
) AS src([key], is_enabled, description) ON tgt.[key] = src.[key]
WHEN NOT MATCHED THEN INSERT ([key], is_enabled, description) VALUES (src.[key], src.is_enabled, src.description);

PRINT 'S0001 applied: reference data seeded';
