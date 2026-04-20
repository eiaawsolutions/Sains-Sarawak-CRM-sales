using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using Sains.Crm.Infrastructure.Integration;
using Xunit;

namespace Sains.Crm.IntegrationTests;

public class CmdWebhookEndpointTests : IClassFixture<CrmWebAppFactory>
{
    private readonly HttpClient _http;
    public CmdWebhookEndpointTests(CrmWebAppFactory f) => _http = f.CreateClient();

    [Fact]
    public async Task Unauthorized_without_headers()
    {
        var resp = await _http.PostAsync("/api/CommonService.svc/SaveXml/124",
            new StringContent("{}", Encoding.UTF8, "application/json"));
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Accepted_with_valid_signature_and_payload()
    {
        var t = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        var body = """
            {"Module":"Account","SpKey":"LeadData","data":{"organization_name":"Acme Sdn Bhd","organization_type":15,"address":{"line_1":"1 Jalan X","state":"E","country":"MY"},"contact_person":[{"FullName":"John Doe","Email":"john@acme.my"}]}}
            """;
        var sign = HmacVerifier.ComputeSignature2("test-secret", "test-client", "test-token", t);

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/CommonService.svc/SaveXml/124")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        req.Headers.Add("client_id", "test-client");
        req.Headers.Add("t", t);
        req.Headers.Add("sign", sign);

        var resp = await _http.SendAsync(req);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Replay_rejected_outside_window()
    {
        var t = (DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - 10 * 60 * 1000).ToString();
        var body = "{}";
        var sign = HmacVerifier.ComputeSignature2("test-secret", "test-client", "test-token", t);

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/CommonService.svc/SaveXml/124")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        req.Headers.Add("client_id", "test-client");
        req.Headers.Add("t", t);
        req.Headers.Add("sign", sign);

        var resp = await _http.SendAsync(req);
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
