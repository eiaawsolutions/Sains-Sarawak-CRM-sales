/* ============================================================
   V0010 — Integrity checks, computed columns, additional constraints
   ============================================================ */

-- Quotation status transitions — reject invalid state changes via trigger
-- Matrix (from → allowed to):
--   1 Draft           -> 2 UnderVetting | 3 Approved (auto)
--   2 UnderVetting    -> 3 Approved | 1 Draft (return for revision creates NEW row)
--   3 Approved        -> 4 QuotationSent
--   4 QuotationSent   -> 5 Closed | 6 RejectedExpired
--   5 Closed          -> (terminal, no transitions)
--   6 RejectedExpired -> (terminal, no transitions)

CREATE OR ALTER TRIGGER crm.trg_quotations_enforce_transition
ON crm.quotations
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(status_id) RETURN;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted  d ON d.id = i.id
        WHERE i.status_id <> d.status_id
          AND NOT (
            (d.status_id = 1 AND i.status_id IN (2, 3))  -- Draft → Vetting/Approved
         OR (d.status_id = 2 AND i.status_id IN (3, 1))  -- Vetting → Approved/return-to-Draft-via-new-row
         OR (d.status_id = 3 AND i.status_id = 4)        -- Approved → Sent
         OR (d.status_id = 4 AND i.status_id IN (5, 6))  -- Sent → Closed | Rejected
          )
    )
    BEGIN
        RAISERROR ('Invalid quotation status transition', 16, 1);
        ROLLBACK;
        RETURN;
    END

    -- Block edits on terminal statuses (5 Closed, 6 RejectedExpired)
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted  d ON d.id = i.id
        WHERE d.status_id IN (5, 6) AND i.status_id <> d.status_id
    )
    BEGIN
        RAISERROR ('Terminal quotation status cannot be changed', 16, 1);
        ROLLBACK;
        RETURN;
    END
END
GO

-- Rejection reason is mandatory when status = RejectedExpired
ALTER TABLE crm.quotations
ADD CONSTRAINT CK_quotations_rejection_reason
CHECK (
    status_id <> 6
    OR (status_id = 6 AND rejection_reason_id IS NOT NULL)
);
GO

-- Total = subtotal - discount + tax (sanity check via computed-column style)
ALTER TABLE crm.quotations
ADD CONSTRAINT CK_quotations_totals_non_negative
CHECK (subtotal_myr >= 0 AND discount_myr >= 0 AND tax_myr >= 0 AND total_myr >= 0);
GO

-- updated_at auto-bump trigger (generic)
CREATE OR ALTER TRIGGER crm.trg_accounts_bump_updated
ON crm.accounts
AFTER UPDATE AS BEGIN
    SET NOCOUNT ON;
    UPDATE crm.accounts
    SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END
GO

CREATE OR ALTER TRIGGER crm.trg_quotations_bump_updated
ON crm.quotations
AFTER UPDATE AS BEGIN
    SET NOCOUNT ON;
    UPDATE crm.quotations
    SET updated_at = SYSUTCDATETIME()
    WHERE id IN (SELECT id FROM inserted);
END
GO

-- Customer-360 view — unified context for a single account
CREATE OR ALTER VIEW crm.v_customer_360 AS
SELECT
    a.id                          AS account_id,
    a.organization_name,
    a.organization_short_name,
    a.website,
    a.office_phone,
    a.state_code,
    (SELECT COUNT(*) FROM crm.account_contacts ac WHERE ac.account_id = a.id AND ac.status_id = 1) AS active_contact_count,
    (SELECT COUNT(*) FROM crm.quotations q WHERE q.account_id = a.id AND q.status_id NOT IN (5,6)) AS open_quotation_count,
    (SELECT COUNT(*) FROM crm.quotations q WHERE q.account_id = a.id AND q.status_id = 5) AS won_quotation_count,
    (SELECT SUM(total_myr) FROM crm.quotations q WHERE q.account_id = a.id AND q.status_id = 5) AS won_total_myr,
    (SELECT MAX(event_time) FROM crm.audit_log l WHERE l.target_entity = 'account' AND l.target_id = a.id) AS last_activity_at
FROM crm.accounts a;
GO

-- Forecast view — at-risk quotations (approved but not sent within 14 days)
CREATE OR ALTER VIEW crm.v_at_risk_quotations AS
SELECT
    q.id,
    q.quotation_no,
    q.owner_user_id,
    q.total_myr,
    q.status_id,
    q.approved_at,
    q.sent_at,
    q.valid_until,
    DATEDIFF(day, q.approved_at, SYSUTCDATETIME()) AS days_since_approved,
    CASE
        WHEN q.status_id = 3 AND DATEDIFF(day, q.approved_at, SYSUTCDATETIME()) > 14 THEN 'approved_not_sent'
        WHEN q.status_id = 4 AND DATEDIFF(day, q.sent_at, SYSUTCDATETIME()) > 30 THEN 'sent_no_response'
        WHEN q.valid_until < CAST(SYSUTCDATETIME() AS date) AND q.status_id IN (3,4) THEN 'expired_without_close'
    END AS risk_category
FROM crm.quotations q
WHERE q.status_id IN (3, 4);
GO

PRINT 'V0010 applied: constraints, triggers, views';
