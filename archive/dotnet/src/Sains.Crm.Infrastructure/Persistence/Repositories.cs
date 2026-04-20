using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Leads;
using Sains.Crm.Application.Quotations;
using Sains.Crm.Domain.Leads;
using Sains.Crm.Domain.Quotations;

namespace Sains.Crm.Infrastructure.Persistence;

public sealed class QuotationRepository : IQuotationRepository
{
    private readonly CrmDbContext _db;
    public QuotationRepository(CrmDbContext db) { _db = db; }

    public async Task AddAsync(Quotation q, CancellationToken ct) => await _db.Quotations.AddAsync(q, ct);

    public Task<Quotation?> FindAsync(Guid id, CancellationToken ct)
        => _db.Quotations.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct);

    public Task SaveChangesAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);
}

public sealed class LeadRepository : ILeadRepository
{
    private readonly CrmDbContext _db;
    public LeadRepository(CrmDbContext db) { _db = db; }

    public async Task AddAsync(Lead l, CancellationToken ct) => await _db.Leads.AddAsync(l, ct);
    public Task<Lead?> FindAsync(Guid id, CancellationToken ct) => _db.Leads.FirstOrDefaultAsync(x => x.Id == id, ct);
    public Task SaveChangesAsync(CancellationToken ct) => _db.SaveChangesAsync(ct);
}
