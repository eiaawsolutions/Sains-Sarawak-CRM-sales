using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Domain.Accounts;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Integration;

/// <summary>
/// Async processor for a single CMD payload. Looks up the existing account by match_key
/// (organization_name lower-cased), creates or updates it, and upserts the contact list.
/// Idempotent — safe to re-run on the same payload.
/// </summary>
public sealed class CmdPayloadProcessor : ICmdPayloadProcessor
{
    private readonly CrmDbContext _db;
    private readonly IClock _clock;
    private readonly ILogger<CmdPayloadProcessor> _log;

    public CmdPayloadProcessor(CrmDbContext db, IClock clock, ILogger<CmdPayloadProcessor> log)
    {
        _db = db; _clock = clock; _log = log;
    }

    public async Task ProcessAsync(string idempotencyKey, CancellationToken ct)
    {
        var payloadJson = await _db.Database
            .SqlQueryRaw<string>(
                @"SELECT p.body_json
                  FROM crm.cmd_webhook_ledger l
                  JOIN crm.cmd_webhook_payloads p ON p.id = l.payload_ref
                  WHERE l.idempotency_key = @k",
                new SqlParameter("@k", idempotencyKey))
            .AsNoTracking()
            .FirstAsync(ct);

        var envelope = JsonSerializer.Deserialize<CmdEnvelope>(payloadJson, JsonOpts)
            ?? throw new InvalidOperationException("Payload deserialise failed.");

        if (envelope.Module != "Account" || envelope.SpKey != "LeadData")
        {
            await MarkLedgerAsync(idempotencyKey, WebhookStatus.Failed, "Unsupported Module/SpKey", ct);
            return;
        }

        var data = envelope.Data ?? throw new InvalidOperationException("Missing data");
        var matchKey = (data.OrganizationName ?? string.Empty).Trim().ToLowerInvariant();

        var existing = await _db.Accounts
            .Include(a => a.Contacts)
            .FirstOrDefaultAsync(a => a.OrganizationName.ToLower() == matchKey, ct);

        Guid accountId;
        var addr = new Address(
            data.Address?.Line1, data.Address?.Line2, data.Address?.Line3,
            data.Address?.City, data.Address?.Postcode, data.Address?.State,
            data.Address?.Country ?? "MY");

        if (existing is null)
        {
            var acct = Account.__InstantiateForIngest();
            var method = typeof(Account).GetMethod("CreateFromCmd",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
            var created = (Account)method.Invoke(null, new object?[] {
                Guid.NewGuid(), null, data.OrganizationName ?? "", data.OrganizationShortName,
                (short?)data.OrganizationType, data.Website, data.OfficePhone, data.Fax,
                addr, data.Remark, data.Description, _clock.UtcNow
            })!;
            _db.Accounts.Add(created);
            accountId = created.Id;

            var contacts = (data.ContactPerson ?? new()).Select(c => AccountContact__CreateFromCmd(
                accountId, (short?)c.Salutation, c.FullName ?? "(unknown)",
                c.Email, c.Mobile, c.BusinessPhone, c.Fax, (short?)c.Designation,
                c.ProfileImg, c.Remark, c.PersonalRemark));
            foreach (var c in contacts) _db.AccountContacts.Add(c);
        }
        else
        {
            // Use reflection to call the internal ApplyCmdUpdate — keeps Account's surface area narrow
            typeof(Account).GetMethod("ApplyCmdUpdate",
                System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!
                .Invoke(existing, new object?[] {
                    data.OrganizationName ?? "", data.OrganizationShortName,
                    (short?)data.OrganizationType, data.Website, data.OfficePhone, data.Fax,
                    addr, data.Remark, data.Description, _clock.UtcNow
                });
            accountId = existing.Id;

            // Replace contacts — simple strategy; a richer one would reconcile by email.
            var incoming = (data.ContactPerson ?? new()).Select(c => AccountContact__CreateFromCmd(
                accountId, (short?)c.Salutation, c.FullName ?? "(unknown)",
                c.Email, c.Mobile, c.BusinessPhone, c.Fax, (short?)c.Designation,
                c.ProfileImg, c.Remark, c.PersonalRemark)).ToList();
            foreach (var ec in existing.Contacts.ToList())
                _db.AccountContacts.Remove(ec);
            foreach (var nc in incoming)
                _db.AccountContacts.Add(nc);
        }

        await _db.SaveChangesAsync(ct);
        await MarkLedgerAsync(idempotencyKey, WebhookStatus.Processed, null, ct, accountId);
    }

    private async Task MarkLedgerAsync(string key, WebhookStatus status, string? error, CancellationToken ct, Guid? resolvedId = null)
    {
        await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE crm.cmd_webhook_ledger
            SET status = {(byte)status},
                processed_at = {_clock.UtcNow},
                error_message = {error},
                resolved_entity = {(resolvedId.HasValue ? "account" : null)},
                resolved_id = {resolvedId}
            WHERE idempotency_key = {key};", ct);
    }

    private static AccountContact AccountContact__CreateFromCmd(Guid accountId, short? salutationId,
        string fullName, string? email, string? mobile, string? businessPhone, string? fax,
        short? designationId, string? profileImg, string? remark, string? personalRemark)
    {
        var m = typeof(AccountContact).GetMethod("CreateFromCmd",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!;
        return (AccountContact)m.Invoke(null, new object?[] {
            Guid.NewGuid(), accountId, salutationId, fullName,
            email, mobile, businessPhone, fax, designationId, profileImg, remark, personalRemark
        })!;
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = null,  // SAINS payload uses mixed-case (FullName, organization_name)
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private sealed class CmdEnvelope
    {
        public string? Module { get; set; }
        public string? SpKey  { get; set; }
        public CmdAccount? Data { get; set; }
    }

    private sealed class CmdAccount
    {
        [JsonPropertyName("organization_name")]       public string? OrganizationName { get; set; }
        [JsonPropertyName("organization_short_name")] public string? OrganizationShortName { get; set; }
        [JsonPropertyName("website")]                 public string? Website { get; set; }
        [JsonPropertyName("remark")]                  public string? Remark { get; set; }
        [JsonPropertyName("description")]             public string? Description { get; set; }
        [JsonPropertyName("office_phone")]            public string? OfficePhone { get; set; }
        [JsonPropertyName("fax")]                     public string? Fax { get; set; }
        [JsonPropertyName("organization_type")]       public int?    OrganizationType { get; set; }
        [JsonPropertyName("address")]                 public CmdAddress? Address { get; set; }
        [JsonPropertyName("contact_person")]          public List<CmdContact>? ContactPerson { get; set; }
    }

    private sealed class CmdAddress
    {
        [JsonPropertyName("line_1")]   public string? Line1 { get; set; }
        [JsonPropertyName("line_2")]   public string? Line2 { get; set; }
        [JsonPropertyName("line_3")]   public string? Line3 { get; set; }
        [JsonPropertyName("postcode")] public string? Postcode { get; set; }
        [JsonPropertyName("city")]     public string? City { get; set; }
        [JsonPropertyName("state")]    public string? State { get; set; }
        [JsonPropertyName("country")]  public string? Country { get; set; }
    }

    private sealed class CmdContact
    {
        public int?    Salutation { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? Mobile { get; set; }
        public string? BusinessPhone { get; set; }
        public string? Fax { get; set; }
        public int?    Designation { get; set; }
        [JsonPropertyName("profile_img")] public string? ProfileImg { get; set; }
        public string? Remark { get; set; }
        public string? PersonalRemark { get; set; }
    }
}

/// <summary>
/// Adds a zero-state helper for the processor to mint an <see cref="Account"/> without
/// touching the public API. Kept here to avoid expanding the Domain surface.
/// </summary>
public static class AccountInstantiationBridge
{
    public static Account __InstantiateForIngest(this Account _) => null!; // never called — purely a signature anchor
}
