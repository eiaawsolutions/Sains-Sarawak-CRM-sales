# Runbook — Incident response

## Severity matrix

| Severity | Definition | Example | Response time |
|---|---|---|---|
| **P0** | Production down or data at risk | RLS leak; MSSQL unreachable; PDPA data breach | 15 min ack / 1 h fix |
| **P1** | Major feature broken | Webhook 100% failing; auth broken for one role | 1 h ack / 4 h fix |
| **P2** | Minor feature broken | PDF generation intermittent | 1 day ack / 3 days fix |
| **P3** | Cosmetic / low impact | UI copy typo | Next sprint |

## P0 playbook

1. **Halt the blast radius first** — flip relevant kill switches (see `03-kill-switches.md`).
2. **Alert the chain** —
   - Claritas PM (Koay Tze Lee)
   - SAINS Unit Head (Wellington Wee / Ronald Ng Yuan-Chang)
   - Security officer if PDPA data is involved
3. **Preserve forensics** — do NOT truncate `audit_log` or `cmd_webhook_payloads`. Snapshot MSSQL and the log files.
4. **Investigate** — correlate via `correlation_id` across `audit_log` and Serilog files.
5. **Fix + verify** — small scoped change, integration-tested, deployed via the normal deploy-UAT workflow promoted to PROD.
6. **Post-incident** — within 48h, write a 1-page post-mortem covering: timeline, cause, detection, fix, follow-ups.

## Common incidents + fixes

### "RLS is returning zero rows for everyone"
Cause: `SessionContextInterceptor` failed to set SESSION_CONTEXT (likely DI misconfig or the user has no authenticated principal).
Fix: check `SELECT SESSION_CONTEXT(N'user_id')` in an application session — if NULL, fix the interceptor registration in `DependencyInjection.cs`.

### "Webhook returning 401 for legitimate requests"
Cause: credentials out of sync (rotation happened but env vars not updated).
Fix: coordinate with SAINS to confirm current `client_id`/`secret_key`/`access_token`; update env vars on `CRMAPPUAT` / `CRMAPPPRD`; restart App Pool.

### "Quotation numbers colliding"
Cause: SERIALIZABLE isolation in `QuotationNumberGenerator` somehow circumvented.
Fix: add `UPDLOCK, HOLDLOCK` hints to any concurrent access path; re-test under load; consider `sp_getapplock` fallback.

### "Hangfire dashboard shows 100% failing ProcessCmdWebhookJob"
Cause: payload schema mismatch or missing reference-data row.
Fix: check `crm.cmd_webhook_ledger.error_message` for the specific failure; either add the missing reference row, or coordinate with SAINS to fix the payload shape.

### "Agents returning empty / refusing"
Cause: kill switch flipped, cost circuit breaker tripped, or model provider down.
Fix: check `crm.feature_flags`, `crm.agent_cost_ledger`, and Bedrock status.
