# Runbook — Deploy to UAT (CRMAPPUAT + CRMDBUAT)

**Maintainer:** Claritas × EIAAW engineering
**Audience:** SAINS ops + Claritas deploy engineer
**Estimated time:** 45 minutes for a clean deploy; 15 minutes for a subsequent deploy.

## Prereqs on the SAINS-provided UAT servers

Confirm with SAINS ops before proceeding:

1. `CRMAPPUAT` and `CRMDBUAT` VMs are reachable over RDP.
2. IIS is enabled on `CRMAPPUAT`; the `ASP.NET Core Module v2` (ANCM) is installed.
3. The .NET 8 **Hosting Bundle** is installed on `CRMAPPUAT`.
4. MSSQL 2022 is running on `CRMDBUAT` and a login `sains_crm_app` exists with `db_owner` on `SainsCrm_Uat`.
5. Outbound 443 from `CRMAPPUAT` to `fim2.sarawak.gov.my` and `apitnt.sains.com.my` is permitted.
6. Inbound 443 from CMD IP range to `CRMAPPUAT` is permitted.

## Step 1 — Apply DB migrations

From a workstation with `sqlcmd` and network access to `CRMDBUAT`:

```powershell
$server = "CRMDBUAT,1433"
$database = "SainsCrm_Uat"
$user = "sains_crm_admin"      # privileged account used only for migrations

Get-ChildItem .\db\migrations\V*.sql | Sort-Object Name | ForEach-Object {
    sqlcmd -S $server -d $database -U $user -i $_.FullName
}

# Seed reference data
Get-ChildItem .\db\seed\S*.sql | Sort-Object Name | ForEach-Object {
    sqlcmd -S $server -d $database -U $user -i $_.FullName
}
```

Verify:

```sql
SELECT OBJECT_NAME(object_id) AS tbl, type_desc
FROM sys.tables
WHERE schema_id = SCHEMA_ID('crm');
-- should list: accounts, account_contacts, leads, proposals, quotations, quotation_lines, users, ...

SELECT COUNT(*) FROM crm.organization_types;  -- 18
SELECT COUNT(*) FROM crm.salutations;         -- 18
SELECT COUNT(*) FROM crm.roles;               -- 6
```

## Step 2 — Publish the web host

```powershell
dotnet publish src/Sains.Crm.Web/Sains.Crm.Web.csproj -c Release -o publish/web --self-contained false
```

Copy `publish/web/` to `CRMAPPUAT:D:\apps\crm\web\`.

## Step 3 — Configure IIS

1. Create an Application Pool `SainsCrmAppPool` — **No Managed Code**, **Integrated pipeline**.
2. Create a Website `SAINS CRM Sales` bound to `https://crm-uat.sains.my:443` with the TLS certificate SAINS supplies.
3. Physical path → `D:\apps\crm\web\`.
4. Set App Pool identity to a service account with MSSQL access (see Step 4).

## Step 4 — Provision secrets

Never check these into git. Load into the machine's environment or `appsettings.Production.json` on the server (NTFS ACL: App Pool account read only):

```powershell
# As Administrator on CRMAPPUAT
[Environment]::SetEnvironmentVariable("ConnectionStrings__Crm",
    "Server=CRMDBUAT,1433;Database=SainsCrm_Uat;User Id=sains_crm_app;Password=<REDACTED>;TrustServerCertificate=true;Encrypt=true;",
    [EnvironmentVariableTarget]::Machine)

[Environment]::SetEnvironmentVariable("Fim__ClientId", "<FROM-SAINS>",  [EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("Fim__ClientSecret", "<FROM-SAINS>", [EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("SmartXChange__ConsumerKey",    "<FROM-SAINS>", [EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("SmartXChange__ConsumerSecret", "<FROM-SAINS>", [EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("CmdWebhook__ClientId",    "<ROTATED-BY-SAINS>", [EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("CmdWebhook__SecretKey",   "<ROTATED-BY-SAINS>", [EnvironmentVariableTarget]::Machine)
[Environment]::SetEnvironmentVariable("CmdWebhook__AccessToken", "<ROTATED-BY-SAINS>", [EnvironmentVariableTarget]::Machine)
```

## Step 5 — Smoke tests

From the SAINS admin workstation:

1. `curl -I https://crm-uat.sains.my/` — expect 302 to `fim2.sarawak.gov.my`.
2. Sign in as a test user — confirm you land on `/home`.
3. Navigate to `/admin/jobs` (Hangfire) as Administrator — confirm dashboard loads and no failed jobs.
4. POST a test webhook with a valid HMAC (see `ops/runbooks/02-cmd-webhook-test.md`) — expect 200 with an id.
5. Check `D:\logs\crm\crm-<today>.log` for errors.

## Step 6 — Enable feature flags

```sql
UPDATE crm.feature_flags SET is_enabled = 1 WHERE [key] = 'cmd_webhook_enabled';
UPDATE crm.feature_flags SET is_enabled = 1 WHERE [key] = 'ldap_lookup_enabled';
-- Leave agents OFF for v1.0 — enable after v1.1 change order signed
```

## Rollback

Stop the App Pool, restore the previous `D:\apps\crm\web\` folder from the weekly image backup, restart the App Pool. If a migration needs reverting, restore `SainsCrm_Uat` from the most recent full + log backups (MSSQL Management Studio → Restore Database).
