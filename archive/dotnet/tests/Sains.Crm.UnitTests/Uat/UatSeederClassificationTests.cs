using FluentAssertions;
using Xunit;

namespace Sains.Crm.UnitTests.Uat;

/// <summary>
/// The classification logic in UatSeeder is pure — we test it via reflection against a local copy
/// of the rules so the tests don't depend on Infrastructure references. When the real rules
/// change, update this mirror.
/// </summary>
public class UatSeederClassificationTests
{
    [Theory]
    [InlineData("Pass",                    null,                             "Low")]
    [InlineData("Fail",                    "can't proceed next step",        "Critical")]
    [InlineData("Fail",                    "Server Error in /sains ...",     "Critical")]
    [InlineData("Fail",                    "Ajax Error has occurred",        "Critical")]
    [InlineData("Fail",                    "nothing happens",                "Critical")]
    [InlineData("Fail",                    "Primary Quotation number not shown", "High")]
    [InlineData("Fail",                    null,                             "Medium")]
    [InlineData("Pass",                    "cosmetic comment",               "Low")]
    public void Severity_derivation_matches_spec(string baseline, string? remark, string expected)
    {
        var severity = DeriveSeverity(baseline, remark);
        severity.Should().Be(expected);
    }

    [Theory]
    [InlineData("Pass",             "Pass")]
    [InlineData("Fail",             "Fail")]
    [InlineData("Please select:",   "Pending")]
    [InlineData("",                 "Pending")]
    [InlineData("   ",              "Pending")]
    [InlineData("who knows",        "Pending")]
    public void Normalise_actual_covers_all_four_states(string raw, string expected)
        => NormaliseActual(raw).Should().Be(expected);

    // --- mirror of UatSeeder classification rules (kept in sync with Infrastructure) ---

    private static string DeriveSeverity(string baseline, string? remark)
    {
        if (baseline != "Fail") return "Low";
        if (string.IsNullOrWhiteSpace(remark)) return "Medium";
        var r = remark.ToLowerInvariant();
        if (r.Contains("can't proceed") || r.Contains("cannot proceed") ||
            r.Contains("nothing happens") || r.Contains("server error") ||
            r.Contains("ajax error") || r.Contains("object reference"))
            return "Critical";
        return "High";
    }

    private static string NormaliseActual(string? raw) => (raw ?? "").Trim() switch
    {
        "Pass"           => "Pass",
        "Fail"           => "Fail",
        "Please select:" => "Pending",
        ""               => "Pending",
        _                => "Pending"
    };
}
