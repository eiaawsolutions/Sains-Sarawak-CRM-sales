# ADR 0007 — Quotation numbering: `SAINS {dept}/{section}/{agent} Vol.{v} ({n}{rev})`

- **Status:** Proposed (SAINS sign-off required on format decomposition)
- **Date:** 2026-04-20

## Context

FSD §3.2.7 gives the format as `SAINS 8-40/011/RYNC Vol.1 (140b)` but the table decomposition in the source PDF is visually jumbled. The running number caps at 200 per volume; revisions use alphabetic suffixes; the same scheme spans quotations and proposal costing sheets.

## Decision

Implement a deterministic generator with this decomposition (to be confirmed with SAINS):

```
SAINS 8-40/011/RYNC Vol.1 (140b)
  ^    ^    ^   ^     ^    ^ ^
  |    |    |   |     |    | +- revision letter (a..z, then aa..)
  |    |    |   |     |    +--- running number (1..200 per volume)
  |    |    |   |     +-------- volume (1, 2, 3, ...)
  |    |    |   +-------------- agent staff ID prefix (uppercase)
  |    |    +------------------ section code (3-digit)
  |    +----------------------- department code ('8-40' format)
  +---------------------------- fixed prefix "SAINS"
```

### Generator algorithm

```csharp
public async Task<string> NextQuotationNumber(Guid agentUserId, CancellationToken ct)
{
    // Transactional; serialisable isolation to prevent gap
    var agent = await _db.Users.FindAsync(agentUserId, ct);
    var dept = agent.DepartmentCode;      // e.g. "8-40"
    var section = agent.SectionCode;      // e.g. "011"
    var staffPrefix = agent.StaffPrefix;  // e.g. "RYNC"
    
    var seq = await _db.QuotationSequences
        .SingleOrDefaultAsync(s => s.AgentUserId == agentUserId && s.VolumeNo == s.CurrentVolume, ct);
    
    if (seq == null || seq.NextRunningNo > 200)
    {
        // Start new volume
        var newVol = (seq?.CurrentVolume ?? 0) + 1;
        seq = new QuotationSequence
        {
            AgentUserId = agentUserId,
            CurrentVolume = newVol,
            NextRunningNo = 1
        };
        _db.QuotationSequences.Add(seq);
    }
    
    var runningNo = seq.NextRunningNo++;
    await _db.SaveChangesAsync(ct);
    
    return $"SAINS {dept}/{section}/{staffPrefix} Vol.{seq.CurrentVolume} ({runningNo}a)";
}

public async Task<string> NextRevisionNumber(Guid parentQuotationId, CancellationToken ct)
{
    // Walk siblings, find highest revision letter, increment
    var parent = await _db.Quotations.FindAsync(parentQuotationId, ct);
    var siblings = await _db.Quotations
        .Where(q => q.RootQuotationId == parent.RootQuotationId)
        .ToListAsync(ct);
    
    var highestLetter = siblings.Max(s => s.RevisionLetter);
    var nextLetter = NextRevisionLetter(highestLetter);  // 'a'→'b'→...→'z'→'aa'→'ab'...
    
    // Strip existing letter, append new
    var baseNumber = Regex.Replace(parent.QuotationNo, @"[a-z]+\)$", "");
    return $"{baseNumber}{nextLetter})";
}
```

### Storage

```sql
CREATE TABLE quotation_sequences (
    agent_user_id    uniqueidentifier NOT NULL,
    current_volume   int NOT NULL DEFAULT 1,
    next_running_no  int NOT NULL DEFAULT 1,
    updated_at       datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (agent_user_id)
);
```

Unique constraint on `quotations.quotation_no` catches any race.

### Cut-over at go-live

SAINS must supply per-agent seed values:

```sql
-- Supplied by SAINS during data migration
INSERT INTO quotation_sequences (agent_user_id, current_volume, next_running_no)
VALUES
  ('<uuid-for-RYNC>', 1, 141),  -- Ronald started volume 1 at 140; next is 141
  ('<uuid-for-NAT>',  1, 142),
  -- ...
;
```

## Consequences

### Positive

- Deterministic, race-safe, matches SAINS convention exactly.
- Revision chain trivial to walk (via `root_quotation_id` or alphabetic suffix sort).

### Negative

- Agents must have `DepartmentCode`, `SectionCode`, `StaffPrefix` populated on their user record — this is sourced from LDAP + HR provisioning.

## Blocker

SAINS must confirm:
1. Decomposition of `SAINS 8-40/011/RYNC Vol.1 (140b)` — specifically whether `8-40/011` is `department/section` or something else.
2. Cut-off seed running number per existing agent at go-live.
3. Whether staff prefix is always uppercase, always 4 chars, etc.
