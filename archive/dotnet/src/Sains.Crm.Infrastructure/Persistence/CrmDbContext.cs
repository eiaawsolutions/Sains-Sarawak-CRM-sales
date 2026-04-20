using Microsoft.EntityFrameworkCore;
using Sains.Crm.Domain.Accounts;
using Sains.Crm.Domain.Leads;
using Sains.Crm.Domain.Proposals;
using Sains.Crm.Domain.Quotations;
using Sains.Crm.Infrastructure.Persistence.Configurations;

namespace Sains.Crm.Infrastructure.Persistence;

/// <summary>
/// Primary DbContext for the operational database. Uses the MSSQL <c>crm</c> schema.
/// The Web host registers a <see cref="SessionContextInterceptor"/> on every connection to
/// propagate the invoker's role/section into <c>SESSION_CONTEXT</c> — the foundation of
/// RLS (V0008) and audit attribution.
/// </summary>
public sealed class CrmDbContext : DbContext
{
    public CrmDbContext(DbContextOptions<CrmDbContext> options) : base(options) { }

    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<AccountContact> AccountContacts => Set<AccountContact>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Proposal> Proposals => Set<Proposal>();
    public DbSet<Quotation> Quotations => Set<Quotation>();
    public DbSet<QuotationLine> QuotationLines => Set<QuotationLine>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("crm");
        b.ApplyConfiguration(new AccountConfig());
        b.ApplyConfiguration(new AccountContactConfig());
        b.ApplyConfiguration(new LeadConfig());
        b.ApplyConfiguration(new ProposalConfig());
        b.ApplyConfiguration(new QuotationConfig());
        b.ApplyConfiguration(new QuotationLineConfig());
    }
}
