# ADR 0009 — Observability, backup, and DR posture

- **Status:** Proposed (SAINS silent on NFRs; these are our defaults)
- **Date:** 2026-04-20

## Context

SAINS Tech Req doc is silent on backup, DR, monitoring, logging, SIEM, patch cadence, performance NFRs, pentest, PDPA. We cannot ship without defaults.

## Decision

### Observability stack

- **Structured logging:** Serilog → JSON → Windows Event Log + file sink (`D:\logs\crm\`) with 14-day retention on disk.
- **Metrics:** OpenTelemetry via `OpenTelemetry.Exporter.Prometheus.AspNetCore`. Prometheus scraper runs on SAINS ops network.
- **Traces:** OpenTelemetry + OTLP → Jaeger (if SAINS provides) or local file export.
- **APM:** Application Insights (if SAINS allows Azure endpoint egress) OR Elastic APM self-hosted on SAINS VM.
- **SIEM integration:** Syslog forwarding of security events (auth failures, audit_log writes, kill-switch flips) to SAINS SIEM (endpoint TBC).

### Logged events (minimum)

- Every HTTP request (method, path, status, latency_ms, user_id, correlation_id)
- Every DB modification (via EF Core SaveChanges interceptor → audit_log)
- Every auth event (login, logout, refresh, failure)
- Every CMD webhook (received, signature-verified, processed, failed)
- Every LDAP API call
- Every agent invocation (v1.1)
- Every kill-switch flip
- Every RLS denial (suspicious)

### Backup policy

| Backup | Frequency | Retention on-prem | Retention off-site |
|---|---|---|---|
| MSSQL full | Daily (02:00 MYT) | 30 days | 90 days |
| MSSQL differential | Every 6h | 14 days | — |
| MSSQL transaction log | Every 15 min | 7 days | — |
| App server image | Weekly | 30 days | 90 days |
| Audit log archive | Monthly → Parquet | Forever | Forever |

### RPO / RTO targets

- **RPO (Recovery Point Objective): 15 minutes** — we lose at most 15 min of committed data (from tx-log cadence).
- **RTO (Recovery Time Objective): 4 hours** — we restore service within 4h of declared outage (restore full + diff + logs, swing DNS, validate).

### DR site

- Recommended: **secondary DC in Kuching** (or wherever SAINS has DR). If unavailable, pure backup-restore with offsite media storage is acceptable for this system's criticality.
- Hot standby not required (internal gov CRM, 8×5 business-hours usage).

### Patch cadence

- **Windows Server:** monthly (Microsoft Patch Tuesday + 2 weeks). Maintenance window Sunday 06:00–08:00 MYT.
- **MSSQL:** quarterly CU, tested in UAT two weeks before PROD.
- **.NET runtime:** monthly LTS patches.
- **App releases:** fortnightly (as ready, outside patch windows).

### Pentest

- **Pre-go-live:** third-party pentest mandatory (SAINS-approved vendor, scope = OWASP Top 10 + OWASP API Top 10 + OWASP LLM Top 10 for v1.1).
- **Annual:** retest.
- **Continuous:** Weekly OWASP ZAP scan in CI.

### PDPA compliance

- **Data Controller:** SAINS (we document this in the DPA).
- **Data Processor:** Claritas / EIAAW (us; we sign the DPA).
- **DSAR endpoints:** `GET /api/me/export`, `POST /api/me/erase`, `POST /api/me/rectify` — all audited.
- **Consent ledger:** capture on first login; retain forever.
- **Breach notification:** 72-hour SAINS-side, documented runbook.

### Performance NFRs (proposed baselines)

| Metric | Target |
|---|---|
| Page load p95 (Blazor Server hub latency) | < 2s |
| API p99 | < 500ms |
| CMD webhook ack latency | < 300ms |
| LDAP lookup p99 (cached) | < 50ms |
| LDAP lookup p99 (cold) | < 1s |
| Availability | 99.5% (business hours) |
| Concurrent users | 200 sustained |

## Consequences

### Positive

- All the "silent" NFRs are resolved with defensible defaults.
- SAINS can push back on any individual target; easier to negotiate than starting blank.

### Negative

- Some choices (e.g. App Insights vs Elastic APM) may require revision once SAINS tells us their internal stack.

## Blocker

SAINS must confirm:
- DR site availability
- SIEM syslog endpoint + format
- Pentest vendor allowlist
- Monitoring stack preference (Elastic? Prometheus? SCOM? App Insights?)
