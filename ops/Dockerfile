# For local dev only. Production runs on IIS per SAINS Tech Req v1.0.
# This Dockerfile exists so a developer can `docker compose up` a full stack
# (web + mssql) without needing local IIS.

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["global.json", "."]
COPY ["Directory.Build.props", "."]
COPY ["Sains.Crm.sln", "."]
COPY ["src/Sains.Crm.Domain/Sains.Crm.Domain.csproj", "src/Sains.Crm.Domain/"]
COPY ["src/Sains.Crm.Application/Sains.Crm.Application.csproj", "src/Sains.Crm.Application/"]
COPY ["src/Sains.Crm.Infrastructure/Sains.Crm.Infrastructure.csproj", "src/Sains.Crm.Infrastructure/"]
COPY ["src/Sains.Crm.Web/Sains.Crm.Web.csproj", "src/Sains.Crm.Web/"]
RUN dotnet restore "src/Sains.Crm.Web/Sains.Crm.Web.csproj"
COPY . .
WORKDIR /src/src/Sains.Crm.Web
RUN dotnet build "Sains.Crm.Web.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Sains.Crm.Web.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Development
ENTRYPOINT ["dotnet", "Sains.Crm.Web.dll"]
