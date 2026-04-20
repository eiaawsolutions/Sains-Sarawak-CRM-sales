using System.Security.Cryptography;
using System.Text;

namespace Sains.Crm.Infrastructure.Integration;

/// <summary>
/// Computes and verifies HMAC-SHA256 signatures for SAINS Integration API v1.2.
/// Signature 1 = HMAC(secret, clientId + unixTimeMs)
/// Signature 2 = HMAC(secret, clientId + accessToken + unixTimeMs)
/// Both returned as UPPERCASE hex.
/// </summary>
public static class HmacVerifier
{
    public static string ComputeSignature1(string secretKey, string clientId, string unixTimeMs)
        => ComputeHmacSha256Hex(secretKey, clientId + unixTimeMs);

    public static string ComputeSignature2(string secretKey, string clientId, string accessToken, string unixTimeMs)
        => ComputeHmacSha256Hex(secretKey, clientId + accessToken + unixTimeMs);

    /// <summary>Constant-time compare. Never use ordinal <c>==</c> on signature strings.</summary>
    public static bool Verify(string expected, string actual)
    {
        if (expected.Length != actual.Length) return false;
        var a = Encoding.ASCII.GetBytes(expected);
        var b = Encoding.ASCII.GetBytes(actual);
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    private static string ComputeHmacSha256Hex(string key, string message)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(message));
        return Convert.ToHexString(hash); // uppercase hex by default
    }

    public static bool IsWithinWindow(long timestampMs, long nowMs, int windowMs)
        => Math.Abs(nowMs - timestampMs) <= windowMs;
}
