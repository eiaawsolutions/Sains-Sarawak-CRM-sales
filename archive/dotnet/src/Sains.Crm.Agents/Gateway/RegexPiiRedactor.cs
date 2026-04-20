using System.Text.RegularExpressions;

namespace Sains.Crm.Agents.Gateway;

/// <summary>
/// Lightweight stop-gap redactor. Replace with Microsoft Presidio in production for NER-based
/// detection of names / orgs / locations. This class intentionally over-redacts — better to
/// corrupt the prompt than leak PII.
/// </summary>
public sealed partial class RegexPiiRedactor : IPiiRedactor
{
    [GeneratedRegex(@"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", RegexOptions.IgnoreCase)]
    private static partial Regex EmailRegex();

    // Malaysian phones: +60, 01X-XXXXXXX, etc.
    [GeneratedRegex(@"(\+?60|0)[1-9](?:[-\s]?\d){7,9}")]
    private static partial Regex MyPhoneRegex();

    // Malaysian IC: XXXXXX-XX-XXXX
    [GeneratedRegex(@"\d{6}-\d{2}-\d{4}")]
    private static partial Regex MyIcRegex();

    public PiiRedactionResult Redact(string input)
    {
        if (string.IsNullOrEmpty(input))
            return new PiiRedactionResult(input ?? string.Empty, new Dictionary<string, string>());

        var map = new Dictionary<string, string>();
        var output = input;

        int emailCounter = 1, phoneCounter = 1, icCounter = 1;

        output = EmailRegex().Replace(output, m =>
        {
            var token = $"[EMAIL_{emailCounter++}]";
            map[token] = m.Value;
            return token;
        });

        output = MyPhoneRegex().Replace(output, m =>
        {
            var token = $"[PHONE_{phoneCounter++}]";
            map[token] = m.Value;
            return token;
        });

        output = MyIcRegex().Replace(output, m =>
        {
            var token = $"[IC_{icCounter++}]";
            map[token] = m.Value;
            return token;
        });

        return new PiiRedactionResult(output, map);
    }

    public string Deanonymise(string text, IReadOnlyDictionary<string, string> map)
    {
        foreach (var (token, original) in map)
            text = text.Replace(token, original);
        return text;
    }
}
