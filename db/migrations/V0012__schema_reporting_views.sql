/* ============================================================
   V0012 — Reporting views for Quotation Performance Report (FSD §3.6.1)
   Four views, exported by the Reporting module to Excel + PDF.
   ============================================================ */

-- View 1: Quotation Status Summary — count of quotations by status
CREATE OR ALTER VIEW crm.vw_rpt_status_summary AS
SELECT
    qs.id            AS status_id,
    qs.code          AS status_code,
    qs.name          AS status_name,
    COUNT(q.id)      AS quotation_count,
    SUM(q.total_myr) AS total_value_myr
FROM crm.quotation_statuses qs
LEFT JOIN crm.quotations q ON q.status_id = qs.id
GROUP BY qs.id, qs.code, qs.name;
GO

-- View 2: Rejected Quotations Breakdown — by rejection reason
CREATE OR ALTER VIEW crm.vw_rpt_rejected_breakdown AS
SELECT
    rr.id           AS reason_id,
    rr.code         AS reason_code,
    rr.name         AS reason_name,
    COUNT(q.id)     AS quotation_count,
    SUM(q.total_myr) AS total_value_myr
FROM crm.rejection_reasons rr
LEFT JOIN crm.quotations q
       ON q.rejection_reason_id = rr.id
      AND q.status_id = 6
GROUP BY rr.id, rr.code, rr.name;
GO

-- View 3: Submission / Revision Summary — revisions per quotation
CREATE OR ALTER VIEW crm.vw_rpt_revision_summary AS
SELECT
    q.id            AS quotation_id,
    q.quotation_no,
    q.owner_user_id,
    q.status_id,
    q.revision_letter,
    -- convert the alphabetic revision letter into a 1-based count
    (LEN(q.revision_letter) - 1) * 26 + ASCII(RIGHT(q.revision_letter, 1)) - ASCII('a') + 1 AS revision_count,
    q.total_myr,
    q.submitted_at
FROM crm.quotations q;
GO

-- View 4: Closed Quotations Overview
CREATE OR ALTER VIEW crm.vw_rpt_closed_overview AS
SELECT
    q.id,
    q.quotation_no,
    q.owner_user_id,
    u.full_name      AS owner_name,
    q.account_id,
    a.organization_name AS customer_name,
    q.total_myr,
    q.closed_at,
    q.accepted_via,
    q.wot_reference,
    fs.name          AS source_of_fund
FROM crm.quotations q
LEFT JOIN crm.users u           ON u.id  = q.owner_user_id
LEFT JOIN crm.accounts a        ON a.id  = q.account_id
LEFT JOIN crm.fund_sources fs   ON fs.id = q.source_of_fund_id
WHERE q.status_id = 5;   -- Closed
GO

PRINT 'V0012 applied: 4 reporting views for Quotation Performance Report';
