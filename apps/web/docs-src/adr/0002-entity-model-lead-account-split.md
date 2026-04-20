# ADR 0002 — Entity model: separate Lead and Account tables

- **Status:** Proposed (conflicts with SAINS informal position; explicit sign-off required)
- **Date:** 2026-04-20

## Context

The mapping spreadsheet row R7 records a conflict:

- SAINS position: "Organization shall be recognized as customers regardless of leads or not" — implies **single Account table with a type discriminator**.
- Claritas position: separate Lead (manual) + Customer/Account (CMD-synced) — implies **two tables with Lead → Account conversion**.

The workflow PDF shows `contact_type` flipping Lead → Customer on Won, which the SAINS reading satisfies. But the FSD v1.3 explicitly says "CRM does not support conversion of leads into Customer (accounts) or contacts" — forbidding the write-back the single-table model would require.

## Decision

Implement **two physically separate tables**:

- `leads` — CRM-local, manually created, represents business opportunities not yet CMD-registered
- `accounts` — mirror of CMD, read-only except via CMD webhook; never written by CRM

A `leads.converted_to_account_id` nullable FK captures the eventual link (set **manually** by AM when the customer becomes CMD-registered; CMD itself creates the Account record via its own workflow).

This honours FSD v1.3 literally (CRM does not *create* accounts — CMD does) while giving us a clean data model. If SAINS later approves Path C, a Lead → Account conversion workflow is added without schema changes.

## Consequences

### Positive

- Clean separation of authority: CMD owns Accounts, CRM owns Leads.
- No ambiguity about which table a given query hits.
- Easier RLS (Lead visibility scoped to AM/section; Account visibility can be broader since CMD already has its own access model).

### Negative

- Two tables to query when building a unified customer-360 view → use a `customer_360` SQL view that UNIONs them.
- Slight UX friction: "Lead" and "Account" are distinct tabs in the UI.

## Blocker

SAINS must confirm in writing whether this reading of FSD v1.3 is correct before schema lock.
