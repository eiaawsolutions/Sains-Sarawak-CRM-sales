# Tech Brief — Integrations, Constraints, NFRs

*Distilled from `SAINS Technical Requirement Document v1.0`, `SAINS Integration API Document v1.2`, `FIM2.0-Developer GuideV1.6`, `LDAP Query API Developer Guide v1.0`.*

## 1. Hosting & infrastructure (SAINS-prescribed)

| Env | Role | OS | CPU | RAM | Disk | Software |
|---|---|---|---|---|---|---|
| PROD | App (CRMAPPPRD) | Windows Server 2022 Std+ | 8 core | 16 GB | 1 TB (C:125 / D:875) | IIS, .NET |
| PROD | DB  (CRMDBPRD)  | Windows Server 2022 Std+ | 8 core | 24 GB | 1 TB | **MSSQL 2022 Std+**, IIS, .NET |
| UAT  | App (CRMAPPUAT) | Windows Server 2022 Std+ | 4 core | 8 GB  | 500 GB | IIS, .NET |
| UAT  | DB  (CRMDBUAT)  | Windows Server 2022 Std+ | 4 core | 8 GB  | 500 GB | MSSQL 2022 Std+, IIS, .NET |

- **Ports:** App 443 (HTTPS only), DB 1433 (MSSQL default)
- **Two envs only** (UAT + PROD). **No DEV** → we develop locally against Docker SQL Server 2022 + local IIS Express
- **App server must have outbound internet** to reach SAINS Outlook cloud
- **DR site:** not specified — flag in ADR-0009

## 2. Endpoint (user desktop)

- Windows 10 or 11 Pro
- Chrome / Edge / Firefox / Safari (any)
- Min i5 dual core, 8 GB RAM, 100 GB HDD
- **No mobile** support in v1.0

## 3. Authentication — three-layer identity model

```
                 ┌──────────────────────────────────────┐
                 │ Sarawak Government LDAP (SarawakNet) │
                 │   ldap.sarawak.gov.my (raw LDAP)     │
                 └────────────┬─────────────────────────┘
                              │  (internal only)
                ┌─────────────┴──────────────┐
                │                            │
   ┌────────────▼────────────┐  ┌────────────▼────────────────────┐
   │ FIM 2.0 Auth Server     │  │ SAINS Smart-XChange API Gateway │
   │ (OIDC / OAuth2)         │  │   LDAP Query API v1.0           │
   │ fim2.sarawak.gov.my     │  │   api.sains.com.my              │
   └────────────┬────────────┘  └────────────┬────────────────────┘
                │ (OIDC code flow,            │ (Bearer token,
                │  HTTPS, browser)            │  HTTPS, server)
                └──────────────┬──────────────┘
                               │
                  ┌────────────▼────────────┐
                  │  New CRM (IIS/.NET)     │
                  │  CRMAPPPRD              │
                  └─────────────────────────┘
```

### 3.1 FIM 2.0 — browser SSO

- Standard: **OpenID Connect Core 1.0** + OAuth 2.0 (RFC 6749) + JWT (RFC 7519) + PKCE (RFC 7636)
- Discovery: `https://fim2.sarawak.gov.my/.well-known/openid-configuration`
- Flow: Authorization Code + PKCE
- Access token TTL: **3600s**
- Scopes requested: `openid email cn mobile`
- Claims mapped to CRM user: `sub` → CRM user ID surrogate; `mail`, `cn`, `mobile` from LDAP
- **Role / group claims not provided by FIM** — CRM maintains its own `users.role` table keyed by `sub`
- Logout: `GET /login.php?logout=1&redirect=<crm_home>`
- JWKS verification: `GET /oauth/v1/keys` (do local validation; don't hammer `/validate`)

### 3.2 Smart-XChange LDAP Query API — server-side lookups

- Base URL: **PROD** `https://api.sains.com.my` / **TNT/UAT** `https://apitnt.sains.com.my`
- Flow: OAuth 2.0 **client_credentials** → Bearer → `POST /ldapquery/v1.0/users/email/query`
- Token TTL: **3600s**
- Single endpoint: email lookup only — returns `{ uid, name, email }`
- Throttling: multi-level (subscription / app / resource / burst) — specific numbers TBC from SAINS
- Error codes: 400/401/403/404/429/500 with 9xx numeric codes
- **Direct LDAP bind to `ldap.sarawak.gov.my` should NOT be used** — the wrapper API is the official surface

## 4. Inbound integration — SAINS Integration API v1.2

Single endpoint: **`POST {url}/api/CommonService.svc/SaveXml/124`**

- Direction: CMD → CRM (one-way push, real-time on CMD writes)
- Content-Type: `text/plain` (but body is JSON — confirm with SAINS if `application/json` accepted)
- Auth headers: `client_id`, `t` (unix ms), `sign` (HMAC-SHA256 of `client_id + access_token + unix_time`, UPPERCASE hex)
- Body shape: `{ "Module": "Account", "SpKey": "LeadData", "data": { ...Account } }`
- Response: `{ "success": true, "data": { "id": "<guid>" } }`

### 4.1 Token endpoint

- `GET {url}/api/CommonService.svc/token?refresh_token=<rt>`
- Headers: `client_id`, `t`, `sign` (HMAC-SHA256 of `client_id + unix_time`)
- Response: `{ success, result: { access_token, expire_time: "1440" [minutes, i.e. 24h], refresh_token } }`
- Refresh token rotates on every call

### 4.2 Account payload schema

```typescript
{
  organization_name: string;         // varchar(200), required
  organization_short_name: string;   // varchar(200)
  website?: string;                  // varchar(200)
  remark?: string;                   // varchar(4000)
  description?: string;              // varchar(4000)
  office_phone?: string;             // varchar(30)
  fax?: string;                      // varchar(30)
  organization_type: number;         // enum: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 31, 34, 37, 40, 43, 46, 49, 50
  address: {
    line_1?: string;                 // varchar(100)
    line_2?: string;                 // varchar(100)
    line_3?: string;                 // varchar(100)
    postcode?: string;               // varchar(10)
    city?: string;                   // varchar(50)
    state?: string;                  // single-letter MY state code (E=Sarawak)
    country?: string;                // ISO-2 ('MY')
  };
  contact_person: Array<{
    profile_img?: string;
    Salutation?: number;             // enum: 3..52
    FullName?: string;
    Email?: string;
    Mobile?: string;
    BusinessPhone?: string;
    Fax?: string;
    Designation?: number;            // enum: 3..31
    Remark?: string;
    PersonalRemark?: string;
  }>;
}
```

### 4.3 Security note on credentials

The doc prints these verbatim — rotate before go-live:

- `client_id = 15D5A24B3CFA46096ADD0B3BA10551A938E0AE51`
- `secret_key = 115209B9F44E0F0F535C261F3736255072D851DD`
- `refresh_token = DA2B5879BFCBA0EF4433CC2B4606BCD6F2BAE8C38764049855BB0299ECF1D943`

**These are treated as COMPROMISED until SAINS confirms otherwise.**

### 4.4 Open issues on inbound API

- No idempotency key documented → CRM invents one (SHA256 of body)
- No update-vs-create semantics → matching key assumed to be `organization_name` (confirm)
- No delete/deactivate endpoint
- Only `Module=Account, SpKey=LeadData` documented; path suggests a generic dispatcher — other modules may exist

## 5. Outbound integrations

| Target | Status | Auth | Notes |
|---|---|---|---|
| FIM 2.0 | Required v1.0 | OIDC | Browser flow |
| LDAP Query API | Required v1.0 | client_credentials → Bearer | Server-side |
| SAINS Outlook (email) | **v1.1 only** if Option 1 chosen | SMTP/OAuth (TBC) | Requires internet egress from app server |
| AWS Bedrock (LLM) | v1.1 | IAM role or access key | mTLS private endpoint preferred |
| SAINS SIEM | v1.0 | Syslog/REST (TBC) | For audit + security log shipping |

## 6. NFRs — explicit + implied

### Explicit (from Tech Req doc)

- Hosting: on-prem SAINS DC
- OS: Win Server 2022 Std+
- DB: MSSQL 2022 Std+
- Web server: IIS
- Runtime: .NET (Framework vs modern — pending SAINS confirmation)
- Browsers: Chrome/Edge/Firefox/Safari
- Transport: HTTPS only (443)
- Auth: FIM OIDC + LDAP Query API

### Silent in docs — we propose defaults (to be confirmed by SAINS)

| NFR | Proposed default | Rationale |
|---|---|---|
| Availability target | 99.5% (43.8h/year downtime) | Gov internal CRM; not 24/7 customer-facing |
| Concurrent users | 200 | SAINS has ~6 roles × ~30 users per section estimate |
| Page load p95 | < 2s | Reasonable for internal web app |
| API p99 | < 500ms | Reasonable for in-DC calls |
| Backup | Daily full + hourly diff + 15-min log backups | MSSQL standard |
| RPO | 15 min | From log backup cadence |
| RTO | 4 hours | Single DC, manual restore acceptable |
| Log retention | 7 years | PDPA + gov records |
| Audit trail retention | Forever (append-only, archive after 3y) | PDPA evidence |
| Patch cadence | Monthly (2nd Tuesday + 2 weeks) | Follow Microsoft |
| Pentest | Pre-go-live by third-party | Gov standard |
| Penetration test retest | Annually | Gov standard |
| PDPA compliance | Full — DPA, DSAR endpoints, 72h breach notification | PDPA 2010 |
| Accessibility | MyMS 2.0 AA (v1.2) | Public sector target |
| Language | EN-primary v1.0, BM v1.2 | Internal CRM acceptable EN-first |

## 7. Forbidden technologies (inferred from Tech Req)

- Linux (IIS + .NET prescribed)
- Apache / Nginx (IIS prescribed)
- Oracle / MySQL / Postgres (MSSQL prescribed)
- PHP / Java / Node / Python for the **host runtime** (Python/Node allowed for auxiliary MCP server if justified)
- Public cloud for the app itself (SAINS DC prescribed)
- IE 11 (not in browser list)

## 8. Stack-deviation requests (require SAINS written approval)

| Deviation | Rationale | Risk if refused |
|---|---|---|
| .NET 8 instead of .NET Framework 4.8 | Modern is in LTS; Framework is maintenance-only | Use Framework 4.8 (viable but dated) |
| Blazor Server UI | Fewer lines of code, typed end-to-end, faster iteration | Fall back to MVC+Razor (more code, slower iteration) |
| EF Core | Productivity + migrations; type-safe queries | Fall back to Dapper + SP-only |
| QuestPDF (AGPL/Community) for PDF | Free, high-quality output | Fall back to IronPDF (commercial licence needed) |
| AWS Bedrock (v1.1) | PDPA-compliant MY region available 2025 | Fall back to self-hosted Llama 4 on SAINS VM |
