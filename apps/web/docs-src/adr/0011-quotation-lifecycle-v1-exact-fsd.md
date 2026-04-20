# ADR 0011 — Quotation lifecycle (supersedes ADR-0003): same-row revision per FSD

- **Status:** Accepted (2026-04-20)
- **Supersedes:** ADR-0003
- **Relates to:** FSD v1.3 §3.2.3, §3.2.7, §3.2.9, §3.2.10

## Context

ADR-0003 proposed a revision chain — a new row per revision with `parent_quotation_id`. The signed FSD is simpler and explicit:

> "Returned for Revision: → Quotation status **reverts to Draft** → Quotation is returned to the Account Manager for amendment and resubmission, **with the revision running number updated accordingly**." — FSD §3.2.3 step 5
>
> "This status is also used when a quotation is returned for revision, **with a new Revision ID generated**." — FSD §3.2.9 #1

SAINS's format example confirms this: `(140b) → (140c)`. Same running number (`140`), next revision letter — not a new row with a new running number.

## Decision

### v1.0 — same-row revision (FSD literal)

- Return-for-revision **mutates the same row**:
  - `Status`: UnderVetting → Draft
  - `RevisionLetter`: 'a' → 'b' → 'c' → ...
  - `QuotationNoRaw`: regex-replace the trailing letter suffix
  - `ApprovedAt` / `ApprovedByUserId` / `ReturnedAt` / `ReturnedByUserId` / `ReturnedNotes`: reset or set per lifecycle
- **No new row is inserted.**
- Temporal tables (SYSTEM_VERSIONING = ON) preserve the pre-return snapshot automatically, so audit history is complete.
- The `parent_quotation_id` / `root_quotation_id` columns remain in schema, always set to `(Id, Id)` for v1.0 — reserved for v1.1.

### v1.1 — extended lifecycle (SAINS-confirmed upgrade)

- The To-Do v3 Notes sheet documents 13 statuses with a parallel Revision sub-track (Draft-Revision, Pending-Approval-Revision, Approved-Revision, Quotation-Sent-Revision, Closed-Revision-Created) and acceptance artefacts (WOT, AOQ, Accepted).
- v1.1 activates these via:
  - New column `revision_track_phase` (nullable byte) — 1..4 mapping to Draft-R, PendingApproval-R, Approved-R, QuotationSent-R
  - New column `acceptance_artefact` (nullable varchar) — 'WOT' / 'AOQ' / 'LOA'
  - When a Quotation reaches `Approved` and is returned a second time, CRM creates a *new row* (re-enabling ADR-0003's chain model) so the original Approved audit trail stays cleanly attributable
- The canonical 6-state enum is unchanged — the new phases are an overlay, not a replacement. All existing reports continue to work.

## Consequences

### Positive
- v1.0 is a direct read of FSD §3.2.3. Zero interpretation risk.
- Temporal tables give us full history for free — no manual row-chain walk.
- v1.1 is additive: a new column + a flag, not a lifecycle rewrite.

### Negative
- Anyone reading `quotations.revision_letter` in v1.0 needs to understand that 140a and 140b are the **same row at different times** — the Temporal history table `quotations_history` holds the 140a snapshot.

### Mitigation
- The admin UI surfaces revision history via `SELECT * FROM quotations FOR SYSTEM_TIME ALL WHERE id = ?` — one-line query, no recursion.

## Open items

None. FSD is definitive.
