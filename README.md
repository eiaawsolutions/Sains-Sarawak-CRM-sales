# SAINS Sarawak CRM Sales

**Client:** Sarawak Information Systems Sdn Bhd (SAINS) — Sarawak state government IT arm
**Vendor:** Claritas (implementing) × EIAAW Solutions (engineering)
**Framework:** ClaritasTM CRM Professional Edition (configured) + custom v1.1 agent layer
**Contract baseline:** FSD v1.3 signed 26-Dec-2025 by SAINS + Claritas
**Document source:** `C:\Users\User\Documents\EIAAW Solutions\SAINS project-CRM sales\…\Functional Specification Documents (FSD)`

## Status

Greenfield. Pre-implementation. **Scope-lock meeting outstanding** — signed FSD v1.3 and workflow PDF + to-do list v3 conflict materially. See [`docs/briefs/scope-clarification-memo.md`](docs/briefs/scope-clarification-memo.md).

## Stack

- **Runtime:** .NET 8 (ASP.NET Core hosted in IIS via ANCM) — pending SAINS confirmation vs `.NET Framework 4.8` literal reading
- **Database:** Microsoft SQL Server 2022 Standard+ with Temporal Tables, Row-Level Security, Full-Text Search
- **UI:** Blazor Server (recommended) OR MVC + Razor (fallback) — pending SAINS approval
- **Auth:** FIM 2.0 OIDC (Authorization Code + PKCE) for end-users + LDAP Query API (Smart-XChange) for server-side directory lookups
- **Inbound integration:** SAINS Integration API v1.2 — HMAC-SHA256-signed webhook receiver for CMD → CRM account/contact push
- **PDF:** QuestPDF
- **Background jobs:** Hangfire (MSSQL storage)
- **Observability:** OpenTelemetry → SAINS SIEM (TBC)
- **Hosting:** On-prem virtual servers in SAINS Sarawak Data Center (UAT + PROD)
- **v1.1 AI layer (upsell):** MCP server + Anthropic Claude via AWS Bedrock `ap-southeast-5` (Malaysia) OR self-hosted Llama 4 on SAINS VM (residency-dependent)

## Structure

```
docs/
  adr/          Architecture Decision Records (immutable log of why)
  briefs/       CRM Brief, Tech Brief, Domain Brief, Scope Memo
  diagrams/     Mermaid: context / component / ER / sequence
db/
  migrations/   MSSQL DDL migrations (forward-only, numbered)
  seed/         Reference/lookup seed data
  scripts/      Utility scripts (RLS policies, audit triggers)
src/
  Sains.Crm.Domain/          Pure domain model, business rules (no deps)
  Sains.Crm.Application/     Use cases, CQRS handlers, DTOs
  Sains.Crm.Infrastructure/  EF Core DbContext, integrations (FIM, LDAP, CMD webhook), email, PDF
  Sains.Crm.Web/             ASP.NET Core host — Blazor Server UI + REST API + MCP server
  Sains.Crm.Mcp/             v1.1 MCP server exposing CRM tools to agents
  Sains.Crm.Agents/          v1.1 agent orchestrator + 3 specialists
tests/
  Sains.Crm.UnitTests/
  Sains.Crm.IntegrationTests/
  Sains.Crm.PolicyTests/     Cross-tenant/RLS regression tests
ops/
  iis/          web.config + IIS setup guide
  runbooks/     Operational runbooks
.github/workflows/
  ci.yml        build + test + lint + security scan
  deploy-uat.yml
```

## Quick links

- [Scope clarification memo (SEND TO SAINS)](docs/briefs/scope-clarification-memo.md)
- [CRM Brief (Phase 1.7)](docs/briefs/crm-brief.md)
- [Tech Brief (integrations + constraints)](docs/briefs/tech-brief.md)
- [Architecture Decision Records](docs/adr/)
- [System context diagram](docs/diagrams/01-context.md)
- [Data model ER diagram](docs/diagrams/03-er.md)
- [Auth sequence diagram](docs/diagrams/04-auth-sequence.md)

## Development

```powershell
# Prereqs: .NET 8 SDK, SQL Server 2022 (or Docker mssql/server:2022-latest), dotnet-ef global tool
dotnet restore
dotnet build
cd src/Sains.Crm.Web
dotnet ef database update
dotnet run
```

## Licence

Proprietary — SAINS Sarawak × EIAAW Solutions × Claritas. All rights reserved.
