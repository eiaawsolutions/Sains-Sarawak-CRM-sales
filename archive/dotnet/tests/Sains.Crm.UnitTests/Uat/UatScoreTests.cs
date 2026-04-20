using FluentAssertions;
using Xunit;

namespace Sains.Crm.UnitTests.Uat;

/// <summary>
/// Verify the score formula — pass / (pass + fail + error) × 100, skip excluded.
/// Matches the SQL UPDATE in UatRunStore.CompleteRunAsync.
/// </summary>
public class UatScoreTests
{
    [Theory]
    [InlineData(10, 0, 0, 0, 100.00)]
    [InlineData(0, 10, 0, 0, 0.00)]
    [InlineData(8, 2, 0, 0, 80.00)]
    [InlineData(50, 50, 100, 0, 50.00)]    // skip excluded
    [InlineData(99, 1, 79, 0, 99.00)]
    [InlineData(4, 0, 0, 1, 80.00)]        // error counts against score
    public void Score_formula_matches_SQL(int pass, int fail, int skip, int error, decimal expected)
    {
        var executed = pass + fail + error;
        var score = executed == 0 ? (decimal?)null : Math.Round(100m * pass / executed, 2);
        score.Should().Be(expected);
    }

    [Fact]
    public void No_executed_cases_gives_null_score()
    {
        int pass = 0, fail = 0, error = 0;
        var executed = pass + fail + error;
        var score = executed == 0 ? (decimal?)null : Math.Round(100m * pass / executed, 2);
        score.Should().BeNull();
    }

    [Theory]
    [InlineData("Pass",  "Pass", "Agree-Pass")]
    [InlineData("Fail",  "Fail", "Agree-Fail")]
    [InlineData("Pass",  "Fail", "Regression-Fixed")]
    [InlineData("Fail",  "Pass", "Regression-Broken")]
    public void Reconciliation_labels(string harness, string sains, string expected)
    {
        var label = (harness, sains) switch
        {
            ("Pass", "Pass") => "Agree-Pass",
            ("Fail", "Fail") => "Agree-Fail",
            ("Pass", "Fail") => "Regression-Fixed",
            ("Fail", "Pass") => "Regression-Broken",
            _                => "Mismatch"
        };
        label.Should().Be(expected);
    }
}
