# Infrastructure Diagram

```mermaid
flowchart LR
    subgraph Internet["Internet"]
        browser[Windows 10/11 Pro<br/>Chrome / Edge / Firefox / Safari]
    end

    subgraph SAINSDC["SAINS Sarawak Data Center"]
        direction TB
        subgraph AppTier["App tier (DMZ, 443 only)"]
            iis[CRMAPPPRD<br/>Windows Server 2022<br/>IIS + .NET 8<br/>8C / 16GB / 1TB]
        end
        subgraph DBTier["DB tier (internal, 1433)"]
            mssql[CRMDBPRD<br/>Windows Server 2022<br/>MSSQL 2022 Std<br/>8C / 24GB / 1TB]
        end
        subgraph Obs["Observability"]
            prom[Prometheus]
            siem[SAINS SIEM]
        end
        subgraph Backup["Backup"]
            bkp[Backup target<br/>Daily full + 6h diff + 15min tx-log]
        end
    end

    subgraph SAINSGov["SAINS government network"]
        fim[fim2.sarawak.gov.my]
        ldapapi[api.sains.com.my]
        cmd[SAINS CMD]
        ldap[ldap.sarawak.gov.my]
    end

    subgraph CloudMY["Optional cloud (v1.1)"]
        bedrock[AWS Bedrock<br/>ap-southeast-5 MY<br/>Claude Opus 4.7]
        outlook[SAINS Outlook<br/>cloud-hosted Exchange]
    end

    browser -->|HTTPS 443| iis
    iis <-->|TDS 1433 encrypted| mssql
    iis -->|HTTPS OIDC| fim
    iis -->|HTTPS Bearer| ldapapi
    cmd -->|HTTPS HMAC<br/>webhook push| iis
    iis -.v1.1 SMTP.-> outlook
    iis -.v1.1 mTLS.-> bedrock
    fim -->|LDAP| ldap
    ldapapi -->|LDAP| ldap

    iis -. metrics .-> prom
    iis -. syslog .-> siem
    mssql -->|Backup| bkp

    classDef prod fill:#3f3f3f,color:#fff,stroke:#721011,stroke-width:2px
    classDef ext fill:#fff,color:#3f3f3f,stroke:#3f3f3f
    classDef v11 fill:#fff,color:#721011,stroke:#721011,stroke-dasharray: 5 5
    class iis,mssql prod
    class fim,ldapapi,cmd,ldap,outlook,prom,siem,bkp ext
    class bedrock v11
```

## Network ports inventory

| Source | Destination | Port | Protocol | Direction | Purpose |
|---|---|---|---|---|---|
| User desktop | CRMAPPPRD | 443 | HTTPS | Inbound | UI access |
| CRMAPPPRD | CRMDBPRD | 1433 | TDS | Outbound | DB queries |
| CRMAPPPRD | fim2.sarawak.gov.my | 443 | HTTPS | Outbound | OIDC |
| CRMAPPPRD | api.sains.com.my | 443 | HTTPS | Outbound | LDAP Query API |
| SAINS CMD | CRMAPPPRD | 443 | HTTPS | Inbound | Webhook push (allowlist CMD IPs) |
| CRMAPPPRD | SAINS Outlook | 587/993/443 | SMTP/IMAP/HTTPS | Outbound | v1.1 email |
| CRMAPPPRD | bedrock-runtime.ap-southeast-5 | 443 | HTTPS+mTLS | Outbound | v1.1 LLM |
| CRMAPPPRD | Prometheus | 9090 | HTTP | Outbound | metrics scrape (pull from ops net) |
| CRMAPPPRD | SAINS SIEM | 514 | Syslog | Outbound | security events |

## DR strategy (proposed)

Primary: SAINS Sarawak DC.
Secondary: (TBC) either second DC in Kuching or pure backup-restore.

RPO: 15 min (from tx-log backup cadence)
RTO: 4 hours
