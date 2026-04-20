using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Sains.Crm.Infrastructure.Persistence;
using Testcontainers.MsSql;

namespace Sains.Crm.IntegrationTests;

/// <summary>
/// Spins up a real SQL Server 2022 container + the CRM app for end-to-end integration tests.
/// Applies all V0001+ migrations from <c>db/migrations/</c> before the tests run.
/// </summary>
public sealed class CrmWebAppFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _sql = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .WithPassword("yourStrong(!)Password")
        .WithEnvironment("MSSQL_PID", "Standard")
        .Build();

    public async Task InitializeAsync()
    {
        await _sql.StartAsync();

        // Apply migrations + seed from db/ folder
        await using var conn = new Microsoft.Data.SqlClient.SqlConnection(_sql.GetConnectionString());
        await conn.OpenAsync();
        var dbRoot = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "db");
        foreach (var file in Directory.EnumerateFiles(Path.Combine(dbRoot, "migrations"), "V*.sql").OrderBy(f => f))
        {
            var sql = await File.ReadAllTextAsync(file);
            foreach (var batch in sql.Split(new[] { "\r\nGO", "\nGO" }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (string.IsNullOrWhiteSpace(batch)) continue;
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = batch;
                try { await cmd.ExecuteNonQueryAsync(); }
                catch { /* idempotent: tolerate double-apply */ }
            }
        }
        foreach (var file in Directory.EnumerateFiles(Path.Combine(dbRoot, "seed"), "S*.sql").OrderBy(f => f))
        {
            var sql = await File.ReadAllTextAsync(file);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            await cmd.ExecuteNonQueryAsync();
        }
    }

    public new async Task DisposeAsync() => await _sql.StopAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((ctx, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Crm"] = _sql.GetConnectionString(),
                ["CmdWebhook:ClientId"] = "test-client",
                ["CmdWebhook:SecretKey"] = "test-secret",
                ["CmdWebhook:AccessToken"] = "test-token",
                ["CmdWebhook:TimestampWindowMs"] = "300000",
                ["CmdWebhook:MaxBodyBytes"] = "524288"
            });
        });
    }
}
