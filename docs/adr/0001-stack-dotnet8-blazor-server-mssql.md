# ADR 0001 — Runtime stack: .NET 8 + Blazor Server + MSSQL 2022

- **Status:** Proposed (pending SAINS written approval)
- **Date:** 2026-04-20
- **Supersedes:** none
- **Superseded by:** none

## Context

SAINS Technical Requirement Document v1.0 Section 3 specifies Windows Server 2022 + IIS + ".NET Framework" + MSSQL 2022. The phrase ".NET Framework" is ambiguous — it may mean the **legacy .NET Framework 4.8** (the last version, in maintenance-only mode since 2019) or **modern .NET 8** (ASP.NET Core hosted in IIS via the ASP.NET Core Module). Both run on IIS + Windows Server 2022 + MSSQL 2022.

## Decision

Propose **.NET 8 (ASP.NET Core in IIS via ANCM)** with **Blazor Server** UI and **EF Core** data access. Record the decision here; obtain SAINS written approval before implementation starts.

## Consequences

### Positive

- **Active LTS** through Nov 2026 (with .NET 10 LTS taking over late 2026). Legacy Framework 4.8 is in maintenance only — no new features, only security patches.
- **2–3× faster** runtime perf (Kestrel, native AOT option, optimised GC).
- **Modern primitives:** `async/await` first-class, nullable reference types, records, pattern matching, source generators, minimal APIs for the MCP server, System.Text.Json.
- **Type-safe end-to-end** with Blazor Server (C# on both sides; same DTOs shared UI ↔ API). Fewer bugs than MVC + JS.
- **EF Core** provides migrations-as-code, change tracking, temporal-table support (EF Core 8), LINQ-to-SQL — materially faster delivery than Dapper-plus-stored-procs.
- **Nuget ecosystem is fresher** for .NET 8 (Hangfire, QuestPDF, Duende IdentityServer, Serilog all ship .NET 8 targets).

### Negative

- SAINS ops team familiarity with legacy Framework may be higher. Mitigated by writing a 1-page ops runbook and training session.
- IIS configuration differs slightly (ANCM in-process / out-of-process model) — documented in `ops/iis/`.

### Fallback

If SAINS rejects .NET 8, fall back to **.NET Framework 4.8 + ASP.NET MVC 5 + Entity Framework 6 + Web Forms/MVC Razor**. Schedule impact: +2–3 weeks due to less ergonomic tooling and more boilerplate.

## Alternatives considered

1. **.NET Framework 4.8 + MVC 5** — safe, but dated. Chosen only as fallback.
2. **.NET 8 + MVC + Razor (no Blazor)** — middle ground; compromises on typed UI but safer if SAINS rejects Blazor Server.
3. **Node/Express + MSSQL** — forbidden by prescribed stack.
4. **Laravel + MSSQL** (the `crm-god-mode` default) — forbidden by prescribed stack. Only viable if SAINS approves the deviation (unlikely given they specify IIS + .NET).

## Blocker

None. Decision can proceed unilaterally for local-dev scaffolding; deployment target needs SAINS sign-off.
