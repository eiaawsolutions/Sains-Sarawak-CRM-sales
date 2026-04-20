using AspNetCoreRateLimit;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;
using Sains.Crm.Application;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Application.Leads;
using Sains.Crm.Application.Quotations;
using Sains.Crm.Infrastructure;
using Sains.Crm.Infrastructure.Persistence;
using Sains.Crm.Web;
using Sains.Crm.Web.Security;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// ------ Logging --------------------------------------------------------------
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.File(path: @"D:\logs\crm\crm-.log", rollingInterval: RollingInterval.Day,
                  retainedFileCountLimit: 14, shared: true)
    .WriteTo.EventLog("SAINS.CRM", manageEventSource: true)
    .CreateLogger();
builder.Host.UseSerilog();

// ------ Application + Infrastructure -----------------------------------------
builder.Services.AddCrmApplication();
builder.Services.AddCrmInfrastructure(builder.Configuration);

builder.Services.AddScoped<IQuotationRepository, QuotationRepository>();
builder.Services.AddScoped<ILeadRepository, LeadRepository>();
builder.Services.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();

// ------ Web -------------------------------------------------------------------
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ------ Authorization — hierarchy-based role policies --------------------------
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CanVet",       p => p.RequireClaim("role", "SectionHead", "UnitHead", "Director", "Administrator"));
    options.AddPolicy("CanAdmin",     p => p.RequireClaim("role", "Administrator"));
    options.AddPolicy("CanViewAll",   p => p.RequireClaim("role", "Director", "Administrator"));
    options.AddPolicy("CanManageLead",p => p.RequireClaim("role", "AccountManager", "UnitHead", "SectionHead", "Administrator"));
});

// ------ Security headers + rate limits ----------------------------------------
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IProcessingStrategy, AsyncKeyLockProcessingStrategy>();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// ------ OpenTelemetry ---------------------------------------------------------
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddPrometheusExporter());

// ------ Anti-forgery, HSTS, forwarded headers ---------------------------------
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-XSRF-TOKEN"; o.Cookie.Name = "x-csrf"; });
builder.Services.Configure<Microsoft.AspNetCore.HttpOverrides.ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.All;
});

var app = builder.Build();

// ------ Pipeline --------------------------------------------------------------
app.UseForwardedHeaders();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Security headers — applied globally
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["Content-Security-Policy"]   = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: https:; img-src 'self' data:; font-src 'self' data:;";
    ctx.Response.Headers["X-Content-Type-Options"]    = "nosniff";
    ctx.Response.Headers["X-Frame-Options"]           = "DENY";
    ctx.Response.Headers["Referrer-Policy"]           = "strict-origin-when-cross-origin";
    ctx.Response.Headers["Permissions-Policy"]        = "camera=(), microphone=(), geolocation=()";
    ctx.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    ctx.Response.Headers.Remove("X-Powered-By");
    ctx.Response.Headers.Remove("Server");
    await next();
});

app.UseStaticFiles();
app.UseRouting();

app.UseIpRateLimiting();

app.UseAuthentication();
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI();

app.MapControllers();
app.MapRazorPages();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.MapPrometheusScrapingEndpoint();

// Hangfire dashboard — admin only
app.UseHangfireDashboard("/admin/jobs", new Hangfire.DashboardOptions
{
    Authorization = new[] { new AdminHangfireAuthorizationFilter() }
});

// Schedule the nightly UAT run at 03:00 MYT (19:00 UTC)
Hangfire.RecurringJob.AddOrUpdate<Sains.Crm.Infrastructure.Uat.NightlyUatJob>(
    Sains.Crm.Infrastructure.Uat.NightlyUatJob.JobId,
    j => j.RunAsync(),
    Sains.Crm.Infrastructure.Uat.NightlyUatJob.CronMyt,
    TimeZoneInfo.Utc);

// Quick migrate in dev; in prod migrations are applied manually via sqlcmd
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
    await db.Database.EnsureCreatedAsync();
}

app.Run();

public partial class Program { }
