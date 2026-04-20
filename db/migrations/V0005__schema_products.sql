/* ============================================================
   V0005 — Products catalog
   Standalone maintenance inside CRM per FSD §3.2.2.
   ============================================================ */

IF OBJECT_ID(N'crm.products', N'U') IS NULL
CREATE TABLE crm.products (
    id                 uniqueidentifier NOT NULL PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    product_code       varchar(64)      NOT NULL UNIQUE,
    product_name       nvarchar(200)    NOT NULL,
    category_id        smallint         NOT NULL REFERENCES crm.product_categories(id),
    sub_category_id    smallint         NULL REFERENCES crm.product_sub_categories(id),
    cost_price_myr     decimal(18,2)    NULL,
    retail_price_myr   decimal(18,2)    NOT NULL DEFAULT 0,
    default_tax_pct    decimal(5,2)     NOT NULL DEFAULT 0,
    description        nvarchar(max)    NULL,
    allows_child_items bit              NOT NULL DEFAULT 0,    -- e.g. printer + add-ons
    is_active          bit              NOT NULL DEFAULT 1,
    created_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at         datetime2(7)     NOT NULL DEFAULT SYSUTCDATETIME()
) WITH (SYSTEM_VERSIONING = ON (HISTORY_TABLE = crm.products_history));
GO

CREATE INDEX IX_products_category     ON crm.products(category_id, sub_category_id) WHERE is_active = 1;
CREATE INDEX IX_products_name         ON crm.products(product_name) WHERE is_active = 1;
CREATE UNIQUE INDEX UX_products_code  ON crm.products(product_code);
GO

PRINT 'V0005 applied: products';
