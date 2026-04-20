# ADR 0013 — Pivot to Next.js + Postgres + Railway

- **Status:** Accepted (2026-04-20) — operator decision
- **Supersedes:** the .NET/IIS/MSSQL deployment assumption in ADR-0001 (but NOT ADR-0001's principle: still "modern platform, not legacy .NET Framework")
- **Relates to:** all FSD sections (stack is orthogonal to functional scope)

## Context

The SAINS-signed FSD + tech-req prescribed Windows Server 2022 + IIS + .NET + MSSQL 2022 hosted in the SAINS Sarawak Data Center. That was the right answer for SAINS-internal deployment under their procurement constraints.

The operator has now declared a different deployment target: **Railway**. Railway is Linux-only, containerised, Node/Python/Go/Rust-native. Running Windows .NET on Railway is possible but fighting the platform at every step. Running MSSQL on Railway is not supported; Postgres is the managed-DB default.

The operator's instruction: *"find what you need to make it run there while still fulfilling the main objective functionality and enhancement. like I said don't be restricted by the requirement. make it work."*

## Decision

Re-home the app on a Railway-native stack without losing a single functional objective or enhancement.

| Layer | New choice | Why |
|---|---|---|
| **Runtime** | Node.js 20 + TypeScript strict | Railway's default, single container, fast cold-start |
| **Framework** | Next.js 15 (App Router + React Server Components) | UI + API + auth in one project; zero glue code |
| **UI** | Tailwind + shadcn/ui + Radix primitives | Claritas tokens (#3f3f3f / #721011 / white) map cleanly; accessible out of the box |
| **DB** | Postgres 16 (Railway managed) + pgvector | Open, type-safe via Drizzle, Railway plugin is one click |
| **ORM** | Drizzle ORM | Type-safe SQL, migration-first, works beautifully with Railway |
| **Auth** | Auth.js v5 | Battle-tested, supports FIM-compatible OIDC out of the box (FIM 2.0 = standard OIDC) |
| **Jobs** | Inngest | Durable execution, cron, retries, signed webhooks; Railway-friendly |
| **PDF** | @react-pdf/renderer | React components → PDF; keeps tokens in TSX |
| **Validation** | Zod | Same schemas for API, forms, DB, agent outputs |
| **Agents** | Anthropic SDK + Vercel AI SDK | Claude Opus 4.7 direct; streaming; tool-use; cost tracking |
| **UAT harness** | Vitest + Playwright smoke probes + Drizzle scalar assertions | Same 179-case matrix, TypeScript executors |
| **Observability** | OpenTelemetry + Axiom / Railway logs | Works in a plain Node container |
| **Deploy** | Railway (single service + Postgres plugin) | `railway up` |

## Functional mapping — nothing lost

| FSD feature | .NET plan | Next.js plan |
|---|---|---|
| FIM 2.0 OIDC SSO | `Microsoft.AspNetCore.Authentication.OpenIdConnect` | Auth.js v5 OIDC provider (same RFCs) |
| LDAP Query API | `HttpClient` + `IMemoryCache` | `fetch` + `unstable_cache` |
| CMD webhook HMAC | `CryptographicOperations.FixedTimeEquals` | Node `crypto.timingSafeEqual` |
| Quotation 6-state + same-row revision | Domain aggregate | Drizzle + zod + pure TS domain module |
| Quotation numbering (200/volume) | SERIALIZABLE + UPDLOCK | Postgres `FOR UPDATE` inside a transaction |
| PDF on Approved | QuestPDF + Hangfire | @react-pdf + Inngest |
| Reporting 4 views | SQL views + ClosedXML + QuestPDF | Same SQL views + `xlsx` + @react-pdf |
| Audit log append-only | MSSQL INSTEAD OF triggers | Postgres revoke + RLS policy denying UPDATE/DELETE |
| RLS by role/section | MSSQL RLS + SESSION_CONTEXT | Postgres RLS + `set_config('app.user_id', …, true)` |
| UAT harness (179 cases) | .NET IHostedService | Next.js Route Handler + Inngest cron |
| v1.1 agents (MCP) | ASP.NET minimal API | Next.js Route Handler `/api/mcp/tools/*` |
| Multi-level approval | EF entities | Drizzle tables + TS state machine |
| Email Option 1 | SMTP via outbound internet | Resend / SAINS Outlook SMTP |

## Consequences

### Positive
- **Deploys on Railway in one command**: `railway up`.
- **Cold start <1s** (Node + RSC) vs ~8s (.NET + IIS on a cold container).
- **Single language end-to-end** (TypeScript) — no C#/JS bridge, no swagger-typescript-codegen.
- **Smaller team** can ship faster: one dev can own the stack.
- **Identical functional surface** — every FSD feature maps 1:1.

### Negative
- Team must know Node/TS (not a blocker for EIAAW).
- MSSQL-specific tooling (SSMS, MSSQL Temporal Tables) is out; Postgres equivalents (DBeaver, `tstzrange` history tables) are in.
- Cannot deploy to SAINS's on-prem DC without a re-port (the MSSQL branch above stays archived for that scenario).

### Mitigation
- Keep the MSSQL migration set + .NET skeleton in `archive/dotnet/` so we can revive it for any SAINS-internal deploy.
- All domain logic lives in pure TS modules (`src/server/domain/*`) — zero framework coupling — so a future port (to Go, Rust, whatever) is a week of work, not a rewrite.

## Blocker

None. Proceeds unilaterally per operator decision.

## Archival

The .NET/MSSQL build is archived under `archive/dotnet/` for future SAINS on-prem revival if needed. It is fully documented (ADRs 0001–0012) and remains the source of truth for the MSSQL schema semantics which this port mirrors.
