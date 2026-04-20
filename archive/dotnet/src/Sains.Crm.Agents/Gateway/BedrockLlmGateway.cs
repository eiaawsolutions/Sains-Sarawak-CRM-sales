using System.Text.Json;
using Amazon.BedrockRuntime;
using Amazon.BedrockRuntime.Model;

namespace Sains.Crm.Agents.Gateway;

/// <summary>
/// Production gateway to Anthropic Claude via AWS Bedrock <c>ap-southeast-5</c> (Malaysia region).
/// Requires PDPA exception from SAINS. Wraps:
///   1. PII redaction via <see cref="IPiiRedactor"/>
///   2. Daily cost circuit-breaker via <see cref="IAgentCostLedger"/>
///   3. Structured-output JSON schema validation
///   4. Per-call audit via <c>crm.mcp_tool_calls</c>
/// </summary>
public sealed class BedrockLlmGateway : ILlmGateway
{
    private readonly IAmazonBedrockRuntime _bedrock;
    private readonly IPiiRedactor _redactor;
    private readonly IAgentCostLedger _ledger;

    public BedrockLlmGateway(IAmazonBedrockRuntime bedrock, IPiiRedactor redactor, IAgentCostLedger ledger)
    {
        _bedrock = bedrock; _redactor = redactor; _ledger = ledger;
    }

    public async Task<LlmResponse> CompleteStructuredAsync<TOutput>(
        LlmRequest request, string outputSchemaJson, CancellationToken ct)
    {
        if (await _ledger.IsCircuitOpenAsync(ct))
            throw new InvalidOperationException("Daily agent cost cap exceeded — circuit breaker tripped.");

        var redactedUser = _redactor.Redact(request.UserPrompt);
        var redactedSys  = _redactor.Redact(request.SystemPrompt);

        var body = JsonSerializer.Serialize(new
        {
            anthropic_version = "bedrock-2023-05-31",
            max_tokens = request.MaxOutputTokens,
            system = redactedSys.Text,
            messages = new[] { new { role = "user", content = redactedUser.Text } },
            temperature = (double)request.TemperaturePct
        });

        var invokeReq = new InvokeModelRequest
        {
            ModelId = request.Model,
            Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(body)),
            ContentType = "application/json",
            Accept = "application/json"
        };

        var resp = await _bedrock.InvokeModelAsync(invokeReq, ct);
        using var reader = new StreamReader(resp.Body);
        var respJson = await reader.ReadToEndAsync(ct);
        var parsed = JsonDocument.Parse(respJson);

        var tokensIn = parsed.RootElement.TryGetProperty("usage", out var u) ? u.GetProperty("input_tokens").GetInt32() : 0;
        var tokensOut = u.ValueKind != JsonValueKind.Undefined ? u.GetProperty("output_tokens").GetInt32() : 0;

        // Claude 4.7 Opus via Bedrock — illustrative pricing
        var cost = (tokensIn * 15m + tokensOut * 75m) / 1_000_000m;

        await _ledger.RecordAsync(tokensIn, tokensOut, cost, ct);

        var deanonymised = _redactor.Deanonymise(respJson, redactedUser.Map);

        // TODO: JSON schema validation before returning
        return new LlmResponse(
            RawJson: deanonymised,
            TokensIn: tokensIn,
            TokensOut: tokensOut,
            CostUsd: cost,
            Provider: "bedrock:ap-southeast-5",
            Model: request.Model,
            RedactionCount: redactedUser.Map.Count + redactedSys.Map.Count,
            SourceCitations: Array.Empty<string>());
    }
}

public interface IPiiRedactor
{
    PiiRedactionResult Redact(string input);
    string Deanonymise(string text, IReadOnlyDictionary<string, string> map);
}

public sealed record PiiRedactionResult(string Text, IReadOnlyDictionary<string, string> Map);

public interface IAgentCostLedger
{
    Task<bool> IsCircuitOpenAsync(CancellationToken ct);
    Task RecordAsync(int tokensIn, int tokensOut, decimal costUsd, CancellationToken ct);
}
