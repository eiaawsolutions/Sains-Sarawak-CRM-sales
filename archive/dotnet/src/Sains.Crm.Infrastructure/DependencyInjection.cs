using Hangfire;
using Hangfire.SqlServer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Sains.Crm.Application.Abstractions;
using Sains.Crm.Application.Uat;
using Sains.Crm.Domain.Quotations;
using Sains.Crm.Infrastructure.Identity;
using Sains.Crm.Infrastructure.Integration;
using Sains.Crm.Infrastructure.Persistence;
using Sains.Crm.Infrastructure.Reporting;
using Sains.Crm.Infrastructure.Services;
using Sains.Crm.Infrastructure.Uat;
using Sains.Crm.Infrastructure.Uat.Executors;

namespace Sains.Crm.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddCrmInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<FimOptions>(config.GetSection(FimOptions.Section));
        services.Configure<SmartXChangeOptions>(config.GetSection(SmartXChangeOptions.Section));
        services.Configure<CmdWebhookOptions>(config.GetSection(CmdWebhookOptions.Section));

        services.AddMemoryCache();

        services.AddScoped<SessionContextInterceptor>();
        services.AddScoped<AuditInterceptor>();

        services.AddDbContext<CrmDbContext>((sp, opt) =>
        {
            opt.UseSqlServer(config.GetConnectionString("Crm"), sql =>
            {
                sql.MigrationsHistoryTable("__EfMigrationsHistory", "crm");
                sql.EnableRetryOnFailure(maxRetryCount: 3);
            });
            opt.AddInterceptors(
                sp.GetRequiredService<SessionContextInterceptor>(),
                sp.GetRequiredService<AuditInterceptor>());
        });

        services.AddScoped<IQuotationNumberGenerator, QuotationNumberGenerator>();
        services.AddScoped<IAuditSink, SqlAuditSink>();
        services.AddScoped<IFeatureFlags, SqlFeatureFlags>();
        services.AddScoped<IUserDirectory, UserDirectory>();
        services.AddScoped<ICmdWebhookSink, CmdWebhookSink>();
        services.AddScoped<ICmdPayloadProcessor, CmdPayloadProcessor>();
        services.AddSingleton<IClock, SystemClock>();

        services.AddHttpClient<ILdapApiClient, LdapApiClient>();

        services.AddHangfire(cfg => cfg
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UseSqlServerStorage(config.GetConnectionString("Crm"), new SqlServerStorageOptions
            {
                CommandBatchMaxTimeout = TimeSpan.FromMinutes(5),
                SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
                QueuePollInterval = TimeSpan.Zero,
                UseRecommendedIsolationLevel = true,
                DisableGlobalLocks = true,
                SchemaName = "hangfire"
            }));
        services.AddHangfireServer();

        services.AddFimAuthentication();

        // Reporting exporter (ClosedXML + QuestPDF)
        services.AddScoped<IReportExporter, ReportExporter>();

        // UAT harness
        services.AddScoped<IUatCaseStore, UatCaseStore>();
        services.AddScoped<IUatRunStore, UatRunStore>();
        services.AddScoped<IUatRunner, UatRunner>();
        services.AddScoped<SqlAssertionExecutor>();
        services.AddHttpClient<HttpProbeExecutor>(c =>
        {
            var self = config["Uat:SelfBaseUrl"] ?? "http://localhost:5000";
            c.BaseAddress = new Uri(self);
            c.Timeout = TimeSpan.FromSeconds(10);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = false  // we WANT to see the 302s
        });
        services.AddHostedService<UatSeeder>();

        return services;
    }
}
