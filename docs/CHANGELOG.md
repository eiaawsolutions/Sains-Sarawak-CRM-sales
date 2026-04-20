# Changelog

All notable reconciliations against the signed FSD v1.3 are logged here. New features tied to v1.0 (FSD baseline) and v1.1 (confirmed upgrades beyond signed scope) are tracked separately.

## [Unreleased] — Reconciliation pass 1 (2026-04-20)

### Fixed — alignment to signed FSD v1.3

- **ADR-0002 superseded**: v1.0 no longer implements `leads.converted_to_account_id`. FSD §3.1.3 forbids lead→account conversion. The FK is removed from the schema and the column is deferred to v1.1 (where SAINS has now confirmed the write-back upgrade).
- **ADR-0003 superseded**: quotation return-for-revision now mutates the **same row** per FSD §3.2.3/§3.2.9. Status reverts Draft; the revision letter increments (e.g. `140b → 140c`). The revision-row-chain model is deferred to v1.1 (where the 13-state parallel Revision track lives).
- **Quotation.ReturnForRevision** now actually flips status back to Draft and increments `RevisionLetter`, matching the FSD literal wording.
- **Quotation Editability**: `IsEditable` is true while `Status == Draft`, regardless of whether the Draft was reached via initial create or via vet-return.
- **PDF generation** is now triggered by the `QuotationApproved` / `QuotationAutoApproved` domain event (ADR-0011). Previously missing.
- **Reporting Module** implemented: single Quotation Performance Report with the four views explicitly named in FSD §3.6.1, Excel + PDF export (ADR-0012).
- **Product Catalog** repositioned under Admin Module per FSD §3.5 — the entity stays the same, the menu surface moves.
- **Lead assignment rule** implemented per FSD §3.3.2 Step 3 — Section Head must pick an AM; AM-created leads auto-assign to self.
- **Proposal→Lead backlink** implemented per FSD §3.3.2 Step 7 — every proposal has `lead_id` enforced NOT NULL at the API layer.
- **Viewer role** clarified as **C-suite read-only across permitted scope** per FSD §3.5.2, with RLS adjusted accordingly.

### Added — v1.1 upgrades (SAINS-confirmed 2026-04-20 as "upgraded version of what was signed")

- **Opportunity** as a distinct entity between Lead and Quotation — from the workflow PDF + To-Do v3 R40 (renamed `Sales Module`). Adds an `opportunities` table with confidence-based sub-statuses (LowConfidence / NormalConfidence / HighConfidence / Converted / Lost / KIV).
- **Multi-level approval router** — four scenarios from To-Do v3 Notes sheet: AM→UH (1st-verifier, bypass 2nd), AM→UH→SH (2nd-approver), UH→SH (verifier, bypass 2nd), UH→SH→Director (2nd-approver). Routing rules stored in a new `approval_rules` reference table.
- **13-state extended quotation lifecycle** with parallel Revision sub-track (Closed-Revision-Created, Draft-Revision, Pending-Approval-Revision, Approved-Revision, Quotation-Sent-Revision, Accepted, WOT, AOQ, Rejected). Implemented as canonical 6-state + `revision_track_phase` + acceptance artefacts (WOT / AOQ / Letter-of-Award) per To-Do v3 Notes sheet.
- **Email Option 1** (centralised CRM mailbox + reply correlation) from To-Do v3 R15. Inbound-reply correlation by quotation reference number in subject header. SMTP via SAINS Outlook (outbound internet required).
- **Lead → Customer write-back on Won** — when a quotation reaches `Closed` status (accepted), the originating Lead's `status` is set to `Won` and a CMD-side Account is materialised via the outbound `SaveXml/124` endpoint (push direction reversed).
- **Ambient capture (v1.1 pre-work)** — Whisper-on-SAINS-VM pipeline for Zoom/Teams meeting auto-logging. Transcripts land as `activities` linked to the Lead/Opportunity/Quotation.
- **v1.1 Agents** already scaffolded (Quotation Drafter L2, Lead Enricher L2, Forecast Narrator L1).

### Superseded ADRs

- ADR-0002 → ADR-0010 (new entity model for v1.0 + v1.1 split)
- ADR-0003 → ADR-0011 (revision semantics per FSD literal + v1.1 extended lifecycle)

### Supersedes / replaces

- `db/migrations/V0004__schema_leads_proposals.sql` — column `converted_to_account_id` removed; replaced by `V0011__schema_v11_upgrades.sql` which re-adds it under v1.1 alongside the `opportunities` table
- `db/migrations/V0006__schema_quotations.sql` — `parent_quotation_id` column kept but v1.0 only uses it for v1.1 extension; the revision row-chain is v1.1 only
- `src/Sains.Crm.Domain/Quotations/Quotation.cs` — `ReturnForRevision` now mutates same row; `CreateRevision` retained for v1.1 only
- `src/Sains.Crm.Domain/Leads/Lead.cs` — `ConvertedToAccountId` property deferred to v1.1

### Reference

- Source: Signed `FSD_SAINS_v1.3_26122025.pdf` dated December 2025, countersigned by SAINS Unit Heads Wellington Wee + Ronald Ng Yuan-Chang and the Accordia/Claritas team.
- v1.1 upgrades confirmed via user directive dated 2026-04-20 ("the added scope consider confirmed as its an upgraded version of what was signed").
