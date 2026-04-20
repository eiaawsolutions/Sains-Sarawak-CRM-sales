# Runbook — Test the CMD webhook endpoint

Use this after deploy to verify that CMD can successfully push an account to CRM UAT.

## PowerShell one-liner

```powershell
$clientId    = "<from-env>"
$secret      = "<from-env>"
$accessToken = "<from-env>"
$base        = "https://crm-uat.sains.my"

$t = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$body = '{"Module":"Account","SpKey":"LeadData","data":{"organization_name":"Test Acme Sdn Bhd","organization_type":15,"address":{"line_1":"1 Jalan Test","state":"E","country":"MY"},"contact_person":[{"FullName":"Test User","Email":"test@acme.my"}]}}'

$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
$msg  = [Text.Encoding]::UTF8.GetBytes("$clientId$accessToken$t")
$sign = [BitConverter]::ToString($hmac.ComputeHash($msg)).Replace("-","").ToUpperInvariant()

Invoke-WebRequest -Method Post `
  -Uri "$base/api/CommonService.svc/SaveXml/124" `
  -Headers @{ client_id = $clientId; t = $t; sign = $sign } `
  -ContentType "application/json" `
  -Body $body
```

Expected response:

```json
{"success":true,"data":{"id":"<guid>"}}
```

Verify the account was persisted (may take ~2 seconds via Hangfire):

```sql
SELECT * FROM crm.accounts WHERE organization_name = 'Test Acme Sdn Bhd';
SELECT * FROM crm.cmd_webhook_ledger WHERE status = 2 ORDER BY received_at DESC;
```

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| 401 "Not authorized" | Clock drift between sender + CRM > 5 min | `w32tm /resync` on both ends |
| 401 repeatedly | Wrong secret / access token | Confirm env vars match SAINS-issued values |
| 503 "Service temporarily unavailable" | `cmd_webhook_enabled = 0` | `UPDATE crm.feature_flags SET is_enabled = 1 WHERE [key]='cmd_webhook_enabled'` |
| 200 but account not visible | Hangfire worker stopped | Check `/admin/jobs`, restart App Pool |
| 200 but ledger shows Failed | Unsupported Module/SpKey | Check `error_message` column |
