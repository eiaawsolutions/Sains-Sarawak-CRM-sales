namespace Sains.Crm.Domain.Uat;

/// <summary>
/// The four modules the harness recognises. Derived from the workbook sheet name, not from the
/// test_id prefix (prefixes overlap — QUO-RV-### and PROP-RV-### both use "-RV-").
/// </summary>
public enum UatModule : byte
{
    Auth       = 1,
    Customer   = 2,
    Lead       = 3,
    Quotation  = 4,
    Proposal   = 5,
    Admin      = 6,
    Reporting  = 7
}

public enum UatOutcome : byte
{
    Pass   = 1,
    Fail   = 2,
    Skip   = 3,
    Error  = 4,
    NotRun = 0
}

public enum UatSeverity : byte
{
    Critical = 1,
    High     = 2,
    Medium   = 3,
    Low      = 4
}

public enum UatExecutorType : byte
{
    /// <summary>Cannot be auto-executed — relies on a human UAT tester.</summary>
    Manual        = 0,
    /// <summary>HTTP probe against the running CRM (health checks, 401/403/200 expectations).</summary>
    HttpProbe     = 1,
    /// <summary>Pure domain-rule test — runs an in-process assertion against the domain model.</summary>
    DomainRule    = 2,
    /// <summary>Runs a SQL assertion (SELECT COUNT(*) = expected, etc.).</summary>
    SqlAssertion  = 3
}

public sealed record UatTestCase(
    string TestId,
    string Sheet,
    UatModule Module,
    string? Script,
    string? Ordinal,
    string Scenario,
    string Steps,
    string Expected,
    string SainsBaselineActual,     // "Pass" | "Fail" | "Pending" — from SAINS feedback
    string? SainsRemark,
    string? ClaritasRemark,
    UatSeverity Severity,
    UatExecutorType ExecutorType,
    string? ExecutorConfigJson);

public sealed record UatTestResult(
    string TestId,
    UatOutcome Outcome,
    int? LatencyMs,
    string? Evidence,
    string? FailureReason);
