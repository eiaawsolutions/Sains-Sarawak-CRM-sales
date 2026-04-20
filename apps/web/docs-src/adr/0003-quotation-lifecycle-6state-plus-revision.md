# ADR 0003 — Quotation lifecycle: 6-state canonical + revision chain

- **Status:** Proposed
- **Date:** 2026-04-20

## Context

Three different quotation lifecycles are documented:

- Mapping spreadsheet (canonical, matches signed FSD): **6 states** — Draft, Under Vetting, Approved, Quotation Sent, Closed, Rejected/Expired.
- To-Do v2 Notes: 10 states including "Verified by Director", "Negotiation", "Waiting Reply", "Closed Won", "Closed Lost", "Invoice Generated".
- To-Do v3 Notes: 13 states with parallel "Revision" track plus WOT + AOQ + Accepted.

An enum with 13 values + parallel tracks is hostile to maintainability and makes reporting hard.

## Decision

Use the **6-state canonical lifecycle from the mapping spreadsheet + FSD** as the single `status` column. Model revisions and acceptance concepts via **dedicated columns**, not enum states:

```sql
CREATE TABLE quotations (
  id                   uniqueidentifier   PRIMARY KEY,
  quotation_no         varchar(64)        NOT NULL UNIQUE,  -- 'SAINS 8-40/011/RYNC Vol.1 (140b)'
  parent_quotation_id  uniqueidentifier   NULL  REFERENCES quotations(id),
  revision_letter      char(1)            NOT NULL DEFAULT 'a', -- a, b, c, ...
  status               tinyint            NOT NULL,
  quotation_type       tinyint            NOT NULL,  -- New, Revised, AOQ, Optional, ProposalPricing
  is_accepted          bit                NOT NULL DEFAULT 0,
  accepted_at          datetime2          NULL,
  accepted_via         varchar(16)        NULL,  -- 'WOT' | 'AOQ'
  wot_reference        varchar(128)       NULL,
  -- ... other columns
);
```

### Canonical 6-state enum

| ID | Status | Set by | Locks edits? |
|----|---|---|---|
| 1 | Draft | AM (on create or return-for-revision) | No (AM can edit) |
| 2 | Under Vetting | System (on submit if amount ≥ threshold) | Yes (locked) |
| 3 | Approved | System (auto-approve below threshold) or Section Head (manual approve) | Yes |
| 4 | Quotation Sent | User (manual, after sending email out-of-CRM) | Yes |
| 5 | Closed | User (manual, customer accepted) | Yes (terminal) |
| 6 | Rejected/Expired | User (manual, with mandatory reason) | Yes (terminal) |

### Revision chain

When a vetter returns a quotation for revision, create a **new row** with `parent_quotation_id = original.id` and `revision_letter = 'b'` (then 'c', 'd', …). The original row stays — never update. This gives immutable history and clean audit.

### Acceptance concepts

- WOT / AOQ / Letter of Award are **orthogonal** to status; they are **artifacts** that flip `is_accepted = 1` and set `accepted_via`. Status moves from Quotation Sent → Closed once `is_accepted = 1` is set.

## Consequences

### Positive

- Single enum, easy to reason about, easy to seed.
- Revision history is first-class (just walk the `parent_quotation_id` chain).
- Acceptance is decoupled from status — lets us extend (add `AcceptedViaContractSignature` etc.) without enum migration.
- Matches the signed FSD v1.3 literally.

### Negative

- Reports that want to show "all revisions of this quotation" need a recursive CTE.

### Mitigation

Create a SQL view `quotation_with_root_id` that walks the chain and exposes the root quotation ID for simple grouping.

## Blocker

None. Proceeds on Path B.
