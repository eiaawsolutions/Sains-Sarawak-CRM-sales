# ADR 0004 — Auth: FIM 2.0 OIDC (browser) + Smart-XChange LDAP API (server)

- **Status:** Proposed
- **Date:** 2026-04-20

## Context

The stack exposes three identity systems:

1. Raw LDAP at `ldap.sarawak.gov.my` — the underlying directory.
2. **FIM 2.0** (SAINS's in-house OIDC/OAuth2 authorization server with MFA).
3. **Smart-XChange LDAP Query API** (WSO2 API Manager wrapping LDAP, Bearer-token auth).

The Tech Req doc names raw LDAP in passing. FIM doc and LDAP API doc are the actual published integration surfaces.

## Decision

**Layer the three:**

1. **End-user authentication** → FIM 2.0 **Authorization Code + PKCE** flow. CRM never sees passwords.
2. **Server-side directory enrichment** (pre-provisioning users, batch jobs, email-to-uid resolution) → Smart-XChange LDAP Query API via client_credentials → Bearer → `POST /users/email/query`.
3. **Raw LDAP bind** → **forbidden** for the CRM. The wrapper API is the official surface.

### FIM OIDC flow

- Client type: Confidential (server-side web app)
- Scopes: `openid email cn mobile`
- Grant: Authorization Code + PKCE (`S256`)
- Token validation: **local JWT verification via JWKS** (`/oauth/v1/keys`). Do not hammer `/validate`.
- Session: Server-side cookie (ASP.NET Core cookie auth), 12-hour sliding expiry, `SameSite=Lax`, `Secure`, `HttpOnly`
- Logout: `GET https://fim2.sarawak.gov.my/login.php?logout=1&redirect=<crm_home>`
- 403 page: redirect to FIM's combined 403+logout URL
- Refresh token: stored in encrypted server-side session (never sent to browser)
- MFA: enforced by FIM; CRM does not implement second factor

### Role mapping

FIM does not provide group/role claims. CRM maintains a local `users` table keyed by `fim_sub` (from the OIDC `sub` claim). Admin provisions roles per user. On first login with unknown `sub`, user is created in `Viewer` role; Admin must promote.

### LDAP API usage pattern

```csharp
// Server-side only; used in admin UI for "Add user by email"
var user = await _ldapApi.LookupByEmail("johndoe@sarawak.gov.my");
// returns { uid, name, email }
```

Bearer token is cached for 55 minutes (TTL is 3600s).

## Consequences

### Positive

- Zero password management in CRM.
- MFA enforced by FIM; no CRM-side MFA to build.
- LDAP API wrapping means no raw-LDAP network rules to negotiate.

### Negative

- Roles are CRM-local — potential drift if someone changes sections in HR but not in CRM. Mitigation: nightly job checks current LDAP attributes against CRM user records and flags deviations.
- Single IDP dependency: if FIM is down, CRM users cannot log in. Mitigation: document incident-response runbook + emergency break-glass local admin account (audited, rotated).

## Blocker

- FIM UAT domain needed from SAINS (only PROD listed in doc).
- FIM `client_id` / `client_secret` needed per environment.
- Callback URLs to register with SAINS: `https://crm-uat.sains.my/auth/fim/callback`, `https://crm.sains.my/auth/fim/callback`.
