# ADR 0012 — Reporting module: Quotation Performance Report

- **Status:** Accepted (2026-04-20)
- **Relates to:** FSD v1.3 §3.6

## Context

FSD v1.3 §3.6.1 defines exactly one consolidated report — the "Quotation Performance Report" — with four views and Excel + PDF export. Deliberately narrow. The FSD explicitly states:

> "Reporting is intended for **monitoring and overview purposes** and does not include advanced analytics or dashboards."

## Decision

### The four views (server-side rendered from SQL views)

1. **Quotation Status Summary** — count of quotations by status (from `crm.quotation_statuses` joined with `crm.quotations`)
2. **Rejected Quotations Breakdown** — count grouped by `rejection_reason_id`, mapped via `crm.rejection_reasons`
3. **Submission / Revision Summary** — count of revisions per root quotation, resolved via `max(revision_letter_to_int(revision_letter))` per `root_quotation_id`
4. **Closed Quotations Overview** — summary of quotations where `status_id = 5` (Closed)

### Views defined in `db/migrations/V0012__schema_reporting_views.sql`

```sql
CREATE OR ALTER VIEW crm.vw_rpt_status_summary AS ...
CREATE OR ALTER VIEW crm.vw_rpt_rejected_breakdown AS ...
CREATE OR ALTER VIEW crm.vw_rpt_revision_summary AS ...
CREATE OR ALTER VIEW crm.vw_rpt_closed_overview AS ...
```

### Export

- **PDF**: QuestPDF render of the consolidated report
- **Excel**: ClosedXML workbook with one sheet per view

### Filters (v1.0 minimum — FSD silent, these are common-sense defaults)

- Date range on `submitted_at` (Quotation Status Summary) or `closed_at` (Rejected, Closed views)
- Section filter (respects RLS)
- Owner filter (respects RLS)

### v1.1 additions (SAINS-confirmed upgrade)

- **Monthly Sales Report** (to-do v3 R34) — separate from Quotation Performance Report. Pipeline view with SCSDU / Non-SCSDU breakdown, outstanding quotations, aged pipeline.
- **Forecast Narrator agent** — natural-language pipeline querying (already scaffolded in `Sains.Crm.Agents/`).

## Consequences

### Positive
- v1.0 delivers exactly what FSD §3.6.1 lists. Nothing more, nothing less.
- Exports are vanilla tech — QuestPDF + ClosedXML, no services, no licences.
- v1.1 upgrades layer on top without rewriting v1.0 reports.

### Negative
- v1.0 has no drill-down, no charts, no scheduled delivery. This is *intentional* per FSD but may surprise stakeholders used to Salesforce-grade reporting.

### Mitigation
- Include a one-page user guide highlighting what's in / out of v1.0 reporting, and signposting the v1.1 upgrade for the Monthly Sales Report and NL pipeline querying.
