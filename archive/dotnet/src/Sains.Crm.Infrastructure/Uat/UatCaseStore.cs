using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Uat;
using Sains.Crm.Infrastructure.Persistence;

namespace Sains.Crm.Infrastructure.Uat;

public sealed class UatCaseStore : IUatCaseStore
{
    private readonly CrmDbContext _db;
    public UatCaseStore(CrmDbContext db) { _db = db; }

    public async Task<int> UpsertManyAsync(IReadOnlyList<UatTestCase> cases, CancellationToken ct)
    {
        var upserted = 0;
        foreach (var c in cases)
        {
            var rows = await _db.Database.ExecuteSqlInterpolatedAsync($@"
                MERGE crm.uat_test_cases AS tgt
                USING (SELECT
                         {c.TestId}              AS test_id,
                         {c.Sheet}               AS sheet,
                         {c.Module.ToString()}   AS module,
                         {c.Script}              AS script,
                         {c.Ordinal}             AS ordinal,
                         {c.Scenario}            AS scenario,
                         {c.Steps}               AS steps,
                         {c.Expected}            AS expected,
                         {c.SainsBaselineActual} AS sains_actual,
                         {c.SainsRemark}         AS sains_remark,
                         {c.ClaritasRemark}      AS claritas_remark,
                         {c.Severity.ToString()} AS severity,
                         {c.ExecutorType.ToString()} AS executor_type,
                         {c.ExecutorConfigJson}  AS executor_config) AS src
                ON tgt.test_id = src.test_id
                WHEN MATCHED THEN UPDATE SET
                    sheet = src.sheet, module = src.module, script = src.script, ordinal = src.ordinal,
                    scenario = src.scenario, steps = src.steps, expected = src.expected,
                    sains_actual = src.sains_actual, sains_remark = src.sains_remark,
                    claritas_remark = src.claritas_remark, severity = src.severity,
                    executor_type = src.executor_type, executor_config = src.executor_config,
                    updated_at = SYSUTCDATETIME()
                WHEN NOT MATCHED THEN INSERT
                    (test_id, sheet, module, script, ordinal, scenario, steps, expected,
                     sains_actual, sains_remark, claritas_remark, severity,
                     executor_type, executor_config)
                VALUES
                    (src.test_id, src.sheet, src.module, src.script, src.ordinal, src.scenario,
                     src.steps, src.expected, src.sains_actual, src.sains_remark,
                     src.claritas_remark, src.severity, src.executor_type, src.executor_config);", ct);
            if (rows > 0) upserted++;
        }
        return upserted;
    }

    public async Task<IReadOnlyList<UatTestCase>> GetAllAsync(UatModule? filter, CancellationToken ct)
    {
        var sql = filter.HasValue
            ? "SELECT * FROM crm.uat_test_cases WHERE module = @m ORDER BY module, script, ordinal"
            : "SELECT * FROM crm.uat_test_cases ORDER BY module, script, ordinal";

        var rows = await _db.Database.SqlQueryRaw<UatCaseRow>(
            sql,
            filter.HasValue ? new SqlParameter("@m", filter.Value.ToString()) : new SqlParameter("@m", DBNull.Value))
            .AsNoTracking().ToListAsync(ct);

        return rows.Select(MapRow).ToList();
    }

    public async Task<UatTestCase?> GetAsync(string testId, CancellationToken ct)
    {
        var row = await _db.Database.SqlQueryRaw<UatCaseRow>(
            "SELECT * FROM crm.uat_test_cases WHERE test_id = @t",
            new SqlParameter("@t", testId))
            .AsNoTracking().FirstOrDefaultAsync(ct);
        return row is null ? null : MapRow(row);
    }

    private static UatTestCase MapRow(UatCaseRow r) => new(
        TestId: r.test_id,
        Sheet: r.sheet,
        Module: Enum.Parse<UatModule>(r.module, ignoreCase: true),
        Script: r.script,
        Ordinal: r.ordinal,
        Scenario: r.scenario,
        Steps: r.steps,
        Expected: r.expected,
        SainsBaselineActual: r.sains_actual,
        SainsRemark: r.sains_remark,
        ClaritasRemark: r.claritas_remark,
        Severity: Enum.Parse<UatSeverity>(r.severity, ignoreCase: true),
        ExecutorType: Enum.Parse<UatExecutorType>(r.executor_type, ignoreCase: true),
        ExecutorConfigJson: r.executor_config);

    private sealed class UatCaseRow
    {
        public string test_id { get; set; } = "";
        public string sheet { get; set; } = "";
        public string module { get; set; } = "";
        public string? script { get; set; }
        public string? ordinal { get; set; }
        public string scenario { get; set; } = "";
        public string steps { get; set; } = "";
        public string expected { get; set; } = "";
        public string sains_actual { get; set; } = "Pending";
        public string? sains_remark { get; set; }
        public string? claritas_remark { get; set; }
        public string severity { get; set; } = "Medium";
        public string executor_type { get; set; } = "Manual";
        public string? executor_config { get; set; }
        public DateTime created_at { get; set; }
        public DateTime updated_at { get; set; }
    }
}
