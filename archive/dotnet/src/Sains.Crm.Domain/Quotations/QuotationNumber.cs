namespace Sains.Crm.Domain.Quotations;

/// <summary>
/// Value object for the SAINS quotation number per ADR-0007.
/// Canonical string form: <c>SAINS {dept}/{section}/{agentPrefix} Vol.{volume} ({running}{revision})</c>.
/// Example: <c>SAINS 8-40/011/RYNC Vol.1 (140b)</c>.
/// </summary>
public readonly record struct QuotationNumber(
    string DepartmentCode,
    string SectionCode,
    string AgentStaffPrefix,
    int Volume,
    int RunningNumber,
    string RevisionLetter)
{
    public const int RunningNumberMaxPerVolume = 200;
    public const string FirstRevision = "a";

    /// <inheritdoc/>
    public override string ToString()
        => $"SAINS {DepartmentCode}/{SectionCode}/{AgentStaffPrefix} Vol.{Volume} ({RunningNumber}{RevisionLetter})";

    public QuotationNumber WithRevision(string newRevisionLetter)
        => this with { RevisionLetter = newRevisionLetter };

    /// <summary>Increments 'a'→'b'→…→'z'→'aa'→'ab'…</summary>
    public static string NextRevisionLetter(string current)
    {
        if (string.IsNullOrEmpty(current))
            return FirstRevision;

        var chars = current.ToCharArray();
        var i = chars.Length - 1;

        while (i >= 0)
        {
            if (chars[i] < 'z')
            {
                chars[i]++;
                return new string(chars);
            }
            chars[i] = 'a';
            i--;
        }
        // rolled over all positions → extend length
        return new string('a', chars.Length + 1);
    }
}
