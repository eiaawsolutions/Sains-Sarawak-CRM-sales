using FluentAssertions;
using Sains.Crm.Domain.Quotations;
using Xunit;

namespace Sains.Crm.UnitTests.Quotations;

public class QuotationNumberTests
{
    [Fact]
    public void ToString_renders_canonical_format()
    {
        var n = new QuotationNumber("8-40", "011", "RYNC", Volume: 1, RunningNumber: 140, RevisionLetter: "b");
        n.ToString().Should().Be("SAINS 8-40/011/RYNC Vol.1 (140b)");
    }

    [Theory]
    [InlineData("a", "b")]
    [InlineData("b", "c")]
    [InlineData("z", "aa")]
    [InlineData("aa", "ab")]
    [InlineData("az", "ba")]
    [InlineData("zz", "aaa")]
    public void NextRevisionLetter_increments_alphabetically(string current, string expected)
        => QuotationNumber.NextRevisionLetter(current).Should().Be(expected);

    [Fact]
    public void NextRevisionLetter_empty_returns_first()
        => QuotationNumber.NextRevisionLetter("").Should().Be("a");
}
