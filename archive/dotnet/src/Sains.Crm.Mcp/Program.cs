using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sains.Crm.Application;
using Sains.Crm.Infrastructure;
using Sains.Crm.Mcp.Tools;

var builder = WebApplication.CreateBuilder(args);

// v1.1 MCP server — internal only, not exposed externally. Listens on port 5443 on the app subnet.
// Every tool call inherits the invoking user's auth context via a short-lived internal JWT minted
// by the main Web host. The MCP server treats that JWT as read-only (no tokenservice of its own).

builder.Services.AddCrmApplication();
builder.Services.AddCrmInfrastructure(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddAuthorization();

builder.WebHost.ConfigureKestrel(k => k.ListenLocalhost(5443));

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Tool discovery endpoint — returns the MCP manifest
app.MapGet("/mcp/tools", () => McpManifest.All);

app.Run();

public partial class Program { }
