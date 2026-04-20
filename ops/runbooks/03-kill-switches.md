# Runbook — Kill-switch flips

Per ADR-0006 guardrail #7. All flags live in `crm.feature_flags` and propagate within 15 seconds (cache TTL).

| Flag | Purpose | When to flip OFF |
|---|---|---|
| `agents_enabled` | Master kill for v1.1 agents | Any incident where an agent behaves badly |
| `ai_inference_enabled` | LLM-call kill (agents return deterministic fallbacks) | Model provider outage or unexpected cost spike |
| `cmd_webhook_enabled` | Stop accepting CMD pushes | Planned DB maintenance; SAINS-side incident |
| `email_dispatch_enabled` | v1.1 Option 1 email send | Zimbra outage |
| `ldap_lookup_enabled` | LDAP/Smart-XChange calls | SAINS API gateway outage |

## Flip procedure

Admin UI (preferred):
1. Sign in as Administrator.
2. Navigate to `/admin/feature-flags`.
3. Toggle the relevant flag.
4. Confirm the audit entry appears at `/admin/audit?event_type=feature_flag.update`.

Emergency SQL (if the admin UI is itself down):

```sql
-- Disable all agents immediately
UPDATE crm.feature_flags SET is_enabled = 0, updated_at = SYSUTCDATETIME()
WHERE [key] IN ('agents_enabled', 'ai_inference_enabled');

-- Manually write audit entry (normally the app does this)
INSERT INTO crm.audit_log (event_type, outcome, reason, actor_user_id)
VALUES ('feature_flag.kill_all_agents', 'success', 'Emergency manual flip', NULL);
```

After a flip, the cache clears on the next hit (≤15s). No restart needed.
