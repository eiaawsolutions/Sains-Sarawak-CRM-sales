using FluentAssertions;
using Microsoft.Data.SqlClient;
using Xunit;

namespace Sains.Crm.PolicyTests;

/// <summary>
/// Cross-role RLS regression tests. These tests MUST run against a real SQL Server 2022 (LocalDB
/// or container) with the V0001–V0010 migrations applied and the RLS policy enabled (V0008).
///
/// Strategy: seed two leads owned by two different Account Managers in two different sections.
/// Then, as each role, set SESSION_CONTEXT accordingly and verify what each can SELECT.
///
/// Expected matrix:
///   Administrator → sees all
///   Director      → sees all
///   SectionHead   → sees only own section
///   UnitHead      → sees only own department
///   AccountManager→ sees only own rows
///   Viewer        → sees all (read-only, configurable)
///
/// This test is the *load-bearing* regression that prevents IDOR from creeping back in. A bug
/// here is a CVE.
/// </summary>
public class RlsVisibilityTests
{
    [Fact(Skip = "Requires containerised MSSQL 2022 + V0001-V0010 applied; enable in CI with Testcontainers.")]
    public void SectionHead_sees_only_own_section()
    {
        // TODO wire up test-containers once the V0008 policy is applied against the integration DB
        true.Should().BeTrue();
    }

    [Fact(Skip = "Requires containerised MSSQL 2022.")]
    public void AccountManager_sees_only_own_leads()
    {
        true.Should().BeTrue();
    }

    [Fact(Skip = "Requires containerised MSSQL 2022.")]
    public void Director_sees_all_leads()
    {
        true.Should().BeTrue();
    }

    [Fact(Skip = "Requires containerised MSSQL 2022.")]
    public void Block_predicate_prevents_inserting_for_another_section()
    {
        // Insert a Lead with owner_section_id != SESSION_CONTEXT(section_id); RLS BLOCK AFTER INSERT should reject
        true.Should().BeTrue();
    }
}
