/* ============================================================
   V0006 — Quotations + quotation_lines + sequences
   Per ADR-0003 (6-state canonical + revision chain) and
   ADR-0007 (numbering scheme).
   ============================================================ */

IF OBJECT_ID(N'crm.quotation_sequences', N'U') IS NULL
CREATE TABLE crm.quotation_sequences (
    agent_user_id      uniqueidentifier NOT NULL PRIMARY KEY REFERENCES crm.users(id),
    current_volume     int              NOT NULL DEFAULT 1,
    next_running_no    int              NOT NULL DEFAULT 1,
    updated_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'crm.quotations', N'U') IS NULL
CREATE TABLE crm.quotations (
    id                     uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    quotation_no           varchar(64)      NOT NULL,
    root_quotation_id      uniqueidentifier NOT NULL,           -- self = for first version
    parent_quotation_id    uniqueidentifier NULL REFERENCES crm.quotations(id),
    revision_letter        varchar(4)       NOT NULL DEFAULT 'a',
    account_id             uniqueidentifier NULL REFERENCES crm.accounts(id),
    lead_id                uniqueidentifier NULL REFERENCES crm.leads(id),
    proposal_id            uniqueidentifier NULL REFERENCES crm.proposals(id),
    owner_user_id          uniqueidentifier NOT NULL REFERENCES crm.users(id),
    status_id              tinyint          NOT NULL REFERENCES crm.quotation_statuses(id),
    quotation_type_id      tinyint          NOT NULL REFERENCES crm.quotation_types(id),
    source_of_fund_id      tinyint          NULL REFERENCES crm.fund_sources(id),

    -- snapshot of account address at time of quotation (denormalised for historical stability)
    snap_organization_name nvarchar(200)    NULL,
    snap_line_1            nvarchar(100)    NULL,
    snap_line_2            nvarchar(100)    NULL,
    snap_line_3            nvarchar(100)    NULL,
    snap_city              nvarchar(50)     NULL,
    snap_postcode          varchar(10)      NULL,
    snap_state_code        char(1)          NULL,
    snap_country_code      char(2)          NULL,
    snap_phone             nvarchar(30)     NULL,
    snap_fax               nvarchar(30)     NULL,

    -- totals
    currency               char(3)          NOT NULL DEFAULT 'MYR',
    subtotal_myr           decimal(18,2)    NOT NULL DEFAULT 0,
    discount_myr           decimal(18,2)    NOT NULL DEFAULT 0,
    tax_myr                decimal(18,2)    NOT NULL DEFAULT 0,
    total_myr              decimal(18,2)    NOT NULL DEFAULT 0,

    -- content
    subject                nvarchar(500)    NULL,
    terms_conditions       nvarchar(max)    NULL,
    note                   nvarchar(max)    NULL,
    reference_number       varchar(64)      NULL,               -- customer-side ref
    quotation_date         date             NULL,
    valid_until            date             NULL,

    -- acceptance (orthogonal to status)
    is_accepted            bit              NOT NULL DEFAULT 0,
    accepted_at            datetime2(7)     NULL,
    accepted_via           varchar(16)      NULL,               -- 'WOT', 'AOQ', 'LOA'
    wot_reference          varchar(256)     NULL,

    -- rejection
    rejection_reason_id    tinyint          NULL REFERENCES crm.rejection_reasons(id),
    rejection_reason_other nvarchar(500)    NULL,

    -- lifecycle timestamps
    submitted_at           datetime2(7)     NULL,
    approved_at            datetime2(7)     NULL,
    approved_by_user_id    uniqueidentifier NULL REFERENCES crm.users(id),
    returned_at            datetime2(7)     NULL,
    returned_by_user_id    uniqueidentifier NULL REFERENCES crm.users(id),
    returned_notes         nvarchar(max)    NULL,
    sent_at                datetime2(7)     NULL,
    closed_at              datetime2(7)     NULL,

    -- scope for RLS
    owner_department_id    uniqueidentifier NULL,
    owner_section_id       uniqueidentifier NULL,

    created_at             datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at             datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UX_quotation_no UNIQUE (quotation_no)
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.quotations_history));
GO

-- add FK once quotations table exists
ALTER TABLE crm.proposals
  ADD CONSTRAINT FK_proposals_quotation
  FOREIGN KEY (converted_quotation_id) REFERENCES crm.quotations(id);
GO

CREATE INDEX IX_quotations_owner_status   ON crm.quotations(owner_user_id, status_id);
CREATE INDEX IX_quotations_section_status ON crm.quotations(owner_section_id, status_id);
CREATE INDEX IX_quotations_root           ON crm.quotations(root_quotation_id, revision_letter);
CREATE INDEX IX_quotations_account        ON crm.quotations(account_id);
CREATE INDEX IX_quotations_lead           ON crm.quotations(lead_id);
CREATE INDEX IX_quotations_open_by_date   ON crm.quotations(valid_until, status_id) WHERE status_id IN (1,2,3,4);
GO

-- ----------------------------------------------------------------
-- Quotation line items
-- ----------------------------------------------------------------
IF OBJECT_ID(N'crm.quotation_lines', N'U') IS NULL
CREATE TABLE crm.quotation_lines (
    id                  uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    quotation_id        uniqueidentifier NOT NULL REFERENCES crm.quotations(id) ON DELETE CASCADE,
    product_id          uniqueidentifier NULL REFERENCES crm.products(id),
    parent_line_id      uniqueidentifier NULL REFERENCES crm.quotation_lines(id),  -- for add-ons
    line_order          smallint         NOT NULL,
    category_id         smallint         NULL REFERENCES crm.product_categories(id),
    sub_category_id     smallint         NULL REFERENCES crm.product_sub_categories(id),
    description         nvarchar(max)    NOT NULL,         -- free-text per FSD (does NOT update product master)
    quantity            decimal(18,4)    NOT NULL DEFAULT 1,
    unit_price_myr      decimal(18,2)    NOT NULL DEFAULT 0,
    discount_amount_myr decimal(18,2)    NOT NULL DEFAULT 0,
    tax_pct             decimal(5,2)     NOT NULL DEFAULT 0,
    line_subtotal_myr   AS (quantity * unit_price_myr - discount_amount_myr) PERSISTED,
    line_tax_myr        AS ((quantity * unit_price_myr - discount_amount_myr) * tax_pct / 100.0) PERSISTED,
    line_total_myr      AS ((quantity * unit_price_myr - discount_amount_myr) * (1 + tax_pct / 100.0)) PERSISTED,
    is_optional         bit              NOT NULL DEFAULT 0  -- for 'Quotation with Optional item'
);
GO

CREATE INDEX IX_quotation_lines_quotation ON crm.quotation_lines(quotation_id, line_order);
GO

PRINT 'V0006 applied: quotations + lines + sequences';
