# CMD → CRM Webhook Sequence

```mermaid
sequenceDiagram
    autonumber
    participant CMD as SAINS CMD
    participant CRM as CRM Webhook Endpoint
    participant Ledger as cmd_webhook_ledger
    participant Payloads as cmd_webhook_payloads
    participant Hangfire as Hangfire job queue
    participant Processor as Webhook Processor
    participant Audit

    CMD->>CRM: POST /api/CommonService.svc/SaveXml/124<br/>Headers: client_id, t, sign<br/>Body: { Module:"Account", SpKey:"LeadData", data:{...} }

    CRM->>CRM: Verify |now - t| ≤ 5 min
    alt timestamp out of window
        CRM-->>CMD: 401 { success:false, data:{ error:"Not authorized" } }
    end

    CRM->>CRM: Compute expected sign = HMAC-SHA256(secret, client_id + access_token + t)
    CRM->>CRM: CryptographicOperations.FixedTimeEquals
    alt signature mismatch
        CRM-->>CMD: 401 { success:false, data:{ error:"Not authorized" } }
        CRM->>Audit: event_type='webhook.sig_fail'
    end

    CRM->>CRM: Compute idempotency_key = SHA256(body)
    CRM->>Ledger: SELECT ... WHERE idempotency_key = ?
    alt duplicate
        Ledger-->>CRM: existing record (status = Processed)
        CRM-->>CMD: 200 { success:true, data:{ id: existing_id } }
        Note over CRM: Return the same id as before — idempotent
    end

    CRM->>Payloads: INSERT raw body (encrypted at rest)
    CRM->>Ledger: INSERT { idempotency_key, received_at, status=Pending }
    CRM->>Hangfire: Enqueue ProcessCmdWebhookJob(idempotency_key)
    CRM-->>CMD: 200 { success:true, data:{ id: future_id } }

    Note over Hangfire: Async processing begins

    Hangfire->>Processor: ProcessCmdWebhookJob
    Processor->>Payloads: SELECT body
    Processor->>Processor: Deserialise → AccountDto + Address + Contacts[]

    Processor->>Processor: Match key = organization_name + first_contact_email
    Processor->>DB: SELECT account WHERE match_key = ?
    alt exists
        Processor->>DB: UPDATE account SET ...
    else new
        Processor->>DB: INSERT account
    end
    Processor->>DB: UPSERT contacts

    Processor->>Ledger: UPDATE status=Processed, processed_at=NOW()
    Processor->>Audit: event_type='webhook.cmd.process', outcome=success

    alt transient failure (retryable)
        Processor->>Ledger: UPDATE status=Failed, error_message=?
        Note over Processor: Hangfire retries 5× with exp backoff
    end

    alt all retries exhausted
        Processor->>Ledger: UPDATE status=DeadLetter
        Processor->>Audit: event_type='webhook.cmd.dead_letter'
        Note over Processor: Admin UI surfaces for manual review
    end
```

## Failure semantics

| Condition | HTTP | Response body | Action |
|---|---|---|---|
| Timestamp out of window | 401 | `{ success:false, data:{ error:"Not authorized" } }` | Audit `webhook.sig_fail` |
| Signature mismatch | 401 | `{ success:false, data:{ error:"Not authorized" } }` | Audit `webhook.sig_fail` + alert on >10/min |
| Token expired | 401 | `{ success:false, data:{ error:"Token expired" } }` | — |
| Duplicate (same idempotency key) | 200 | `{ success:true, data:{ id: <original_id> } }` | No side effects |
| Unknown Module/SpKey | 400 | `{ success:false, data:{ error:"Unsupported module/spkey" } }` | Audit + alert to engineering |
| Body too large (>512KB) | 413 | `{ success:false, data:{ error:"Payload too large" } }` | Audit |
| Kill switch off | 503 | `{ success:false, data:{ error:"Service temporarily unavailable" } }` | Don't accept during maintenance |
| Valid | 200 | `{ success:true, data:{ id: <future_id> } }` | Enqueue + process async |
```
