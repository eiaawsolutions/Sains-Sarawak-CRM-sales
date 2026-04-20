# ADR 0005 — CMD → CRM webhook: HMAC-SHA256 + idempotency + dead-letter

- **Status:** Proposed
- **Date:** 2026-04-20

## Context

SAINS Integration API v1.2 defines `POST /api/CommonService.svc/SaveXml/124` for CMD pushing Account/Contact payloads to CRM. The spec defines HMAC-SHA256 header signatures but:

- Does not document idempotency semantics
- Does not document retry behaviour on CRM failure
- Does not document duplicate-push handling
- Does not document delete/deactivate
- Provides only `Module=Account, SpKey=LeadData`

## Decision

Implement the receiver with defensive defaults:

### 1. Signature verification (constant-time)

```csharp
var expectedSig = ComputeHmacSha256Hex(
    secretKey,
    clientId + accessToken + unixTimeMs
).ToUpperInvariant();

if (!CryptographicOperations.FixedTimeEquals(
    Encoding.ASCII.GetBytes(expectedSig),
    Encoding.ASCII.GetBytes(requestSig)))
    return Unauthorized();
```

### 2. Timestamp window

Reject requests where `|now - unixTimeMs| > 5 minutes`. Prevents replay.

### 3. Idempotency

Compute `idempotency_key = SHA256(request_body).ToHex()`. Store in `cmd_webhook_ledger`:

```sql
CREATE TABLE cmd_webhook_ledger (
  idempotency_key     char(64) PRIMARY KEY,
  received_at         datetime2 NOT NULL,
  processed_at        datetime2 NULL,
  status              tinyint NOT NULL,  -- 1=Pending, 2=Processed, 3=Failed, 4=DeadLetter
  payload_ref         uniqueidentifier NULL,  -- FK to raw payload table
  error_message       nvarchar(2000) NULL
);
```

On duplicate key → return 200 OK with the previous response (de-dup).

### 4. Raw payload archive

Store every verified-signature request body in `cmd_webhook_payloads` (append-only). Retention 90 days hot + move to archive storage. This lets us replay any missed event.

### 5. Async processing

Webhook handler does three things synchronously:
1. Verify signature
2. Check idempotency
3. Persist raw payload + return 200 `{success, data: {id: <future_crm_id>}}`

The actual Account/Contact row creation happens in a Hangfire background job. This decouples SAINS's 30-second HTTP timeout from our processing time.

### 6. Matching key for updates

Until SAINS confirms, treat the tuple `(organization_name + first_contact_email)` as the business key. Log a warning on any collision for manual reconciliation.

### 7. Dead letter

Failed jobs after 5 retries with exponential backoff go to the dead-letter queue (`cmd_webhook_ledger.status = 4`). Admin UI exposes them for manual review.

### 8. Module support

For v1.0: only `Module=Account, SpKey=LeadData`. If any other `(Module, SpKey)` arrives, respond `{success:false, data:{error:"Unsupported module/spkey"}}` and log for SAINS clarification.

## Consequences

### Positive

- Resilient to SAINS retries, network blips, and CRM transient failures.
- Full payload archive enables bug triage and replay.
- Constant-time signature comparison prevents timing attacks.

### Negative

- Extra tables and background-job complexity.
- Matching-key assumption needs SAINS confirmation — flag prominent in UAT.

## Blocker

SAINS confirmation on:
- Idempotency + update semantics (ADR will be updated post-response)
- Other modules/spkeys that may appear
- Rotation policy for the HMAC credentials (non-negotiable before go-live)
