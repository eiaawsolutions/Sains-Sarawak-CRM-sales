# CRM Brief — SAINS Sarawak CRM Sales

*Output of `/full-stack-engineer` Phase 1.7 + `/crm-god-mode`.*

## 1. Archetype

**Archetype D-Vendor-Framework** — technically a custom build, in practice a configured deployment of ClaritasTM CRM Professional Edition framework on SAINS-prescribed Windows/MSSQL/.NET stack. Data-sovereignty mandate requires on-prem hosting in SAINS Sarawak Data Center.

## 2. 7-capability scorecard (FSD v1.0)

| Capability | Status | Path forward |
|---|---|---|
| 1. Ambient capture (auto-log calls/emails/meetings) | **OUT OF SCOPE v1.0** | v1.2 upsell — Whisper on SAINS VM transcribing Zoom/Teams |
| 2. Live enrichment (continuous account data refresh) | **OUT OF SCOPE** | CMD is source of truth by design |
| 3. Predictive intent + scoring | **OUT OF SCOPE v1.0** | v1.1 — Lead Enricher agent |
| 4. Autonomous execution (multi-step without human-per-step) | **OUT OF SCOPE v1.0** | v1.1 — L2 Draft autonomy on Quotation Drafter |
| 5. NL pipeline querying ("which deals slipped this month") | **OUT OF SCOPE v1.0** | v1.1 — Forecast Narrator agent |
| 6. Multi-agent orchestration | **OUT OF SCOPE v1.0** | v1.1 — hierarchical topology, 3 specialists |
| 7. Trust layer (PII masking + RBAC + audit + HITL + guardrails) | **PARTIAL v1.0** | Harden in v1.0 to full 8-guardrail compliance |

## 3. Three strategic paths

| Path | Description | Risk | Reward | Recommendation |
|---|---|---|---|---|
| **A** | Build exactly to signed FSD v1.3 | Safe, contracted, low risk | Delivers minimum; not "world-class" | Acceptable but limiting |
| **B** | FSD v1.0 + v1.1 agent upsell as documented change order | Needs SAINS buy-in for v1.1 | World-class, preserves contract | **RECOMMENDED** |
| **C** | Expand scope now to match workflow PDF + to-do v3 | Full change-order process, schedule risk | True opportunity-pipeline CRM | Only if SAINS funds the change |

## 4. 7-layer architecture decisions

### Layer 1 — Sources

| Source | Mechanism | Direction | Auth | Cadence |
|---|---|---|---|---|
| CMD (Customer Master Data) | `POST /api/CommonService.svc/SaveXml/124` | CMD → CRM | HMAC-SHA256 (client_id + secret_key + refresh_token) | Real-time push on CMD writes + batch CSV for initial load |
| LDAP | Smart-XChange `POST /ldapquery/v1.0/users/email/query` | CRM → LDAP | OAuth 2.0 client_credentials → Bearer | On-demand (user onboarding, batch jobs) |
| FIM 2.0 | OIDC Authorization Code + PKCE | Browser → FIM → CRM | Client ID + Client Secret + PKCE | Every user login |
| Products | Manual seed + admin CRUD | Internal | RBAC | Low-frequency |
| Users | Derived from FIM claims + local role table | Internal | RBAC | On-demand |

### Layer 2 — Data

- **Operational DB:** MSSQL 2022 with Temporal Tables (built-in audit), Row-Level Security, Full-Text Search, JSON columns, Always Encrypted for PII fields.
- **Vector store (v1.1):** SQL Server 2025 native `VECTOR` type OR Azure AI Search OR self-hosted Qdrant (residency-dependent).
- **Graph (v1.2):** SQL Server 2022 has native graph tables — no Neo4j required unless queries become hot.
- **Time-series (v1.2):** Not required v1.0. Intent signals go into regular tables with covering indexes; revisit if volume justifies.

### Layer 3 — Integration

- **Inbound:** Single webhook endpoint receiving CMD pushes. HMAC signature verified constant-time. Idempotency key = SHA256 of request body.
- **Outbound:** FIM OIDC, Smart-XChange Bearer, SAINS Outlook (v1.1 only, if Option 1 email chosen).
- **MCP server (v1.1):** Standalone ASP.NET Core minimal API on internal subnet exposing 8 tools. Agent inherits invoker's auth context.
- **Event bus:** MSSQL-based Hangfire for background jobs. NServiceBus if cross-service messaging becomes necessary.

### Layer 4 — Trust & Governance

All **8 guardrails** mapped to concrete MSSQL/IIS/app-layer controls:

| # | Guardrail | Implementation |
|---|---|---|
| 1 | Tool allowlist | App-layer whitelist; no dynamic SQL; parameterised queries only |
| 2 | Permission propagation | MSSQL RLS via `SESSION_CONTEXT()` keyed on `user_id`; every connection sets it |
| 3 | Rate limits | `AspNetCoreRateLimit` on endpoints; per-user/per-tool token bucket |
| 4 | PII redaction (v1.1 only) | Presidio wrapper at LLM gateway — `name/email/mobile/IC/passport` redacted before egress |
| 5 | Output schema validation | JSON Schema enforced on LLM outputs (System.Text.Json schema validator) |
| 6 | HITL triggers | Vetting flow IS the HITL gate for v1.0 quotations ≥ threshold; v1.1 adds Slack/Teams approval bot |
| 7 | Kill switch | `feature_flags.agents_enabled` row in DB; every agent invocation checks first |
| 8 | Append-only audit | MSSQL Temporal Tables + `INSTEAD OF UPDATE/DELETE` triggers on `audit_log` |

### Layer 5 — Reasoning + Model (v1.1)

- **Primary model:** Claude Opus 4.7 via AWS Bedrock `ap-southeast-5` (Malaysia region) — requires PDPA exception approval from SAINS. Uses mTLS private endpoint from SAINS VM.
- **Fallback:** Self-hosted Llama 4 on SAINS VM if residency stricter than Bedrock MY.
- **Gateway:** LiteLLM internal deployment for BYOM abstraction + cost tracking + PII redaction enforcement at egress.

### Layer 6 — Agents (v1.1)

Topology: **Hierarchical** (Orchestrator + 3 specialists). All at **L1–L2 autonomy in Year 1**.

| Agent | Tools | Autonomy | HITL Gate |
|---|---|---|---|
| **Quotation Drafter** | `get_customer_360`, `search_products`, `compose_quotation_draft` | L2 — drafts; AM edits + approves | Mandatory AM review before quotation leaves Draft status |
| **Lead Enricher** | `search_org_public_sources`, `suggest_contacts`, `enrich_firmographics` | L2 — suggests; AM confirms each field | Mandatory AM confirmation before Lead becomes eligible for Opportunity conversion |
| **Forecast Narrator** | `query_pipeline`, `query_audit_log`, `compose_narrative` | L1 — answers only, never acts | Read-only; no writes possible |

### Layer 7 — Experience

- **v1.0:** Blazor Server web UI (or MVC+Razor if SAINS mandates); Chrome/Edge/Firefox/Safari on Win 10/11 Pro desktops; **no mobile**, no IE.
- **v1.1:** Add conversational "Ask AI" panel surfaced on every entity detail page.
- **v1.2:** Mobile (Flutter), BM/EN bilingual UI, Voice-first capture, MyMS 2.0 accessibility.

## 5. Agent topology + autonomy ladder (v1.1)

```
┌──────────────────────────────────────────────────┐
│  Orchestrator  (no autonomy; pure delegator)    │
│  Tools: route_request, escalate_to_human         │
└──┬───────────────┬──────────────┬────────────────┘
   │               │              │
┌──▼──────┐   ┌────▼────┐   ┌─────▼──────┐
│Quotation│   │  Lead   │   │  Forecast  │
│Drafter  │   │Enricher │   │ Narrator   │
│  L2     │   │   L2    │   │    L1      │
└─────────┘   └─────────┘   └────────────┘
```

First-year policy: **no agent above L3** without an explicit sign-off meeting and a new change order. HITL gates are Slack-bot-driven (pending Teams/Zimbra decision).

## 6. Trust-layer guardrails (detailed)

See ADR-0006 for the full threat model. Key summary:

- **PDPA data-subject rights** endpoints: `GET /api/me/export`, `POST /api/me/erase`, `POST /api/me/rectify`. All writes audited.
- **Field-level encryption** via MSSQL Always Encrypted on `contacts.email`, `contacts.mobile`, `contacts.ic_number` (if captured), `users.email`.
- **Kill switch:** `feature_flags` table with `agents_enabled`, `ai_inference_enabled`, `cmd_webhook_enabled` toggles. Flipped by Admin role only; audited.
- **Audit log:** append-only via `INSTEAD OF` triggers; MSSQL Temporal Tables on all business entities for point-in-time history.
- **RLS:** hierarchy-based visibility — AM sees own, Unit Head sees unit, Section Head sees section, Director sees all. Implemented via `sp_set_session_context` on every DbContext resolution.

## 7. Vertical playbook reference

**Government & Public Sector** (from `crm-god-mode/references/vertical-playbooks.md` §5.12). Key constraints:

- **MAMPU standards** — Malaysian Administrative Modernisation & Management Planning Unit
- **MyGovCloud** — preferred for federal, but this is Sarawak state → SAINS data center supersedes
- **PDPA 2010** — Data Controller / Processor distinction required in contract
- **Data sovereignty:** ALL data + inference + backup in SAINS Sarawak DC
- **Bilingual UI:** BM required for general public-facing surfaces, but this is internal CRM so EN-primary is acceptable with BM fallback as v1.2

## 8. Data residency

| Workload | v1.0 | v1.1 | v1.2 |
|---|---|---|---|
| App servers | SAINS Sarawak DC (on-prem Windows) | same | same |
| Database | SAINS Sarawak DC (MSSQL) | same | same |
| Backups | SAINS Sarawak DC + DR site (TBC) | same | same |
| LLM inference | n/a | AWS Bedrock `ap-southeast-5` (MY) OR self-hosted Llama on SAINS VM | same |
| Vector embeddings | n/a | MSSQL VECTOR type on SAINS DC | same |
| Observability | SAINS SIEM (TBC) | same | same |

**Non-negotiable:** zero customer PII leaves Malaysia under any circumstance.

## 9. Futurecast readiness

Close-out checklist (target v1.0 + v1.1 + v1.2):

- [ ] **MCP-ready:** v1.1 target — MCP server exposes 8 tools
- [x] **BYOM abstraction:** v1.0 includes `IAiProvider` interface; v1.1 wires Claude + Llama
- [ ] **Intent-graph extension path:** v1.2 — SQL Server graph tables + covering indexes on `signals` table
- [x] **Sovereign data path:** already sovereign (single-tenant, gov-owned)
- [ ] **A2A endpoint:** v1.2 — expose meeting-booking endpoint for cross-agency integration
- [x] **Outcome instrumentation:** v1.0 `audit_log.outcome` field captured on every write
- [x] **Data residency:** mandatory on day 1

## 10. Open assumptions

- Signed FSD v1.3 takes precedence over workflow PDF + to-do v3 where they conflict (**Path B**)
- .NET 8 on IIS is acceptable to SAINS (we will use it pending confirmation)
- Lead ≠ Opportunity entity in v1.0 (we implement Lead only per FSD; Opportunity deferred to v1.1)
- LHDN e-Invoice out of scope for v1.0 (can layer on in v1.2 if SAINS extends to quotation→invoice flow)
- BM UI deferred to v1.2
- The static credentials in Integration API v1.2 doc will be rotated before go-live
