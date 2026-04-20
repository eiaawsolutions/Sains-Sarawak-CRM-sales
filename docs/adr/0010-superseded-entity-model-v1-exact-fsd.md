# ADR 0010 — Entity model (supersedes ADR-0002): exact FSD v1.3

- **Status:** Accepted (2026-04-20)
- **Supersedes:** ADR-0002
- **Relates to:** FSD v1.3 §3.1.3, §3.3.2

## Context

ADR-0002 proposed two tables (`leads` + `accounts` with `leads.converted_to_account_id`) in anticipation of a Lead → Customer conversion. The signed FSD v1.3 explicitly forbids this for v1.0:

> "The CRM does **not** support conversion of leads into Customer (accounts) or contacts. Leads represent **business opportunities** only (refer to Lead Module)." — FSD §3.1.3

SAINS-confirmed v1.1 upgrades (2026-04-20) re-enable the conversion via a **push back to CMD** (reversed direction of the existing `SaveXml/124` endpoint), so the column + FK are retained in schema but are unused in v1.0.

## Decision

- **v1.0**: `leads.converted_to_account_id` is always NULL. The Lead entity does **not** expose a public `MarkWon(..., convertedToAccountId)` path — the `Won` status flip happens after a Quotation reaches `Closed`, and the Account is *not* materialised in CRM.
- **v1.1**: Same column re-enters service. A new Hangfire job `LeadWinWriteBackJob` runs on the `QuotationClosed` domain event:
  1. Compose a CMD-shape payload from the Lead's Account (snapshot) + Contacts
  2. POST to `{cmd_url}/api/CommonService.svc/SaveXml/124` with valid HMAC
  3. Receive the resulting CMD `id`, store as `accounts.cmd_ref_id`, link `leads.converted_to_account_id` to it
  4. Flip `Lead.Status = Won`
  5. Flip `Quotation.is_accepted = 1`

The v1.1 job lives in `Sains.Crm.Infrastructure/Integration/LeadWinWriteBackJob.cs` and is scheduled but disabled via `feature_flags.lead_win_writeback_enabled = 0` until SAINS confirms the outbound direction is authorised.

## Consequences

### Positive
- v1.0 matches the FSD literally. No ambiguity, no scope breach.
- v1.1 unlocks the closed-loop sales cycle the workflow PDF describes.
- Schema is forward-compatible — no migration gymnastics between v1.0 and v1.1.

### Negative
- v1.1 write-back requires SAINS to open outbound auth on their Integration API. If they refuse, the column stays NULL forever and we document the workaround (manual CMD entry).

## Open items for SAINS

- Confirm the outbound direction of `SaveXml/124` is authorised for CRM → CMD.
- Provide the matching key semantics for upsert (organization_name? or a new CRM-side `client_ref`?).
