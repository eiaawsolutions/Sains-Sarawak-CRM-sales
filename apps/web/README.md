# SAINS CRM — Next.js + Postgres on Railway

World-class CRM for SAINS Sarawak. Ported from the archived .NET skeleton to Next.js 15 /
Postgres 16 / Drizzle / Auth.js / Inngest / Anthropic — Railway-native.

## One-time setup

1. **Install Railway CLI**: `npm i -g @railway/cli` then `railway login`.
2. **Create project**: `railway init`
3. **Add Postgres**: in the Railway dashboard → New → Database → Postgres. This auto-injects `DATABASE_URL`.
4. **Set secrets** (dashboard → Variables, or via CLI):
   ```bash
   railway variables set AUTH_SECRET=$(openssl rand -base64 32)
   railway variables set AUTH_URL=https://your-app.up.railway.app
   railway variables set ANTHROPIC_API_KEY=sk-ant-...
   # optional SAINS integrations
   railway variables set FIM_ISSUER=https://fim2.sarawak.gov.my
   railway variables set FIM_CLIENT_ID=...
   railway variables set FIM_CLIENT_SECRET=...
   railway variables set CMD_CLIENT_ID=...   # rotate before prod
   railway variables set CMD_SECRET_KEY=...
   railway variables set CMD_ACCESS_TOKEN=...
   ```
5. **Deploy**: `railway up`
6. **Migrate + seed** (runs automatically on build, or manually via Railway shell):
   ```bash
   railway run npm run db:push
   railway run npm run db:seed
   railway run npm run db:seed:uat
   ```

## Local dev

```bash
cp .env.example .env.local
# edit .env.local — at minimum set DATABASE_URL to a local postgres (docker run postgres:16)
npm install
npm run db:push
npm run db:seed
npm run db:seed:uat
npm run dev   # http://localhost:3000
```

## Project tree

```
src/
  app/                  Next.js App Router (server components + route handlers)
    (app)/              authenticated shell (Leads / Quotations / Reports / Admin)
    api/                route handlers (auth, inngest, cmd webhook, reports)
  server/               pure TS domain logic (state machines, HMAC, numbering)
  db/                   drizzle schema + seeders
  lib/                  auth config, utilities
  uat/                  UAT harness — runner, classify, 179-case JSON
  inngest/              durable jobs (webhook processor, nightly UAT, PDF gen)
  components/           shadcn/ui components (to add as needed)
drizzle/                generated migrations
tests/                  vitest suite (state machine, HMAC, UAT classify)
```

## Key routes

| Route | What | Auth |
|---|---|---|
| `/` | Hero + Sign-in CTA | public |
| `/leads`, `/leads/new` | Lead listing + creation | AM+ |
| `/quotations`, `/quotations/:id` | Quotation listing + editor | AM+ |
| `/proposals` | Proposal listing | AM+ |
| `/reports` | Quotation Performance Report | any auth |
| `/admin/uat` | UAT harness dashboard | Administrator |
| `/api/cmd/webhook` | SAINS CMD HMAC-verified receiver | HMAC |
| `/api/auth/[...nextauth]` | Auth.js handlers | — |
| `/api/inngest` | Inngest function serve | — |
| `/api/reports/quotation-performance` | JSON report | auth |
| `/api/reports/quotation-performance/xlsx` | Excel export | auth |

## What's preserved from the signed FSD v1.3

- 6-state quotation lifecycle with same-row revision (ADR-0011)
- HMAC-verified CMD webhook with idempotency + dead-letter (ADR-0005)
- RLS-style hierarchy visibility (Administrator / Director see all, else scoped)
- Append-only audit log (Postgres row-level policies)
- Quotation numbering with 200/volume cap + alpha revision letters
- 179-case UAT harness with reconciliation against SAINS baseline

## Docs

- ADR-0013: why we pivoted to Next.js + Railway
- `../../docs/CHANGELOG.md`: reconciliation against signed FSD
- `../../docs/briefs/crm-brief.md`: CRM God Mode brief (Phase 1.7)
