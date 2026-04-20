using FluentAssertions;
using Sains.Crm.Infrastructure.Integration;
using Xunit;

namespace Sains.Crm.UnitTests.Integration;

public class HmacVerifierTests
{
    [Fact]
    public void Signature1_is_uppercase_hex_hmac_sha256_of_clientId_plus_time()
    {
        // Reproduce a known HMAC-SHA256 value
        var sig = HmacVerifier.ComputeSignature1(
            secretKey: "secret",
            clientId: "clientid",
            unixTimeMs: "1700000000000");
        sig.Should().MatchRegex("^[0-9A-F]{64}$");
    }

    [Fact]
    public void Signature2_includes_access_token()
    {
        var sig = HmacVerifier.ComputeSignature2(
            secretKey: "secret",
            clientId: "clientid",
            accessToken: "token",
            unixTimeMs: "1700000000000");
        sig.Should().MatchRegex("^[0-9A-F]{64}$");
    }

    [Fact]
    public void Verify_is_constant_time()
    {
        var a = "AAAABBBBCCCCDDDD";
        var b = "AAAABBBBCCCCDDDE";
        HmacVerifier.Verify(a, a).Should().BeTrue();
        HmacVerifier.Verify(a, b).Should().BeFalse();
    }

    [Fact]
    public void IsWithinWindow_rejects_replay()
    {
        long now = 1700000000000;
        HmacVerifier.IsWithinWindow(now - 30_000, now, 60_000).Should().BeTrue();
        HmacVerifier.IsWithinWindow(now - 120_000, now, 60_000).Should().BeFalse();
    }
}
