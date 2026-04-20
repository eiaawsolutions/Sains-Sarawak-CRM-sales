/**
 * Seed-time classification rules — mirror UatSeeder.cs from the .NET archive.
 * Kept in its own module so both the seeder and unit tests can import.
 */

export function normaliseActual(raw: string | null | undefined): "Pass" | "Fail" | "Pending" {
  const t = (raw ?? "").trim();
  if (t === "Pass") return "Pass";
  if (t === "Fail") return "Fail";
  return "Pending";
}

export function deriveSeverity(baseline: string, remark: string | null | undefined): "Critical" | "High" | "Medium" | "Low" {
  if (baseline !== "Fail") return "Low";
  if (!remark?.trim()) return "Medium";
  const r = remark.toLowerCase();
  if (
    r.includes("can't proceed") || r.includes("cannot proceed") ||
    r.includes("nothing happens") || r.includes("server error") ||
    r.includes("ajax error") || r.includes("object reference")
  ) return "Critical";
  return "High";
}

export function mapModule(sheet: string): "Auth" | "Customer" | "Lead" | "Quotation" | "Proposal" | "Admin" | "Reporting" {
  switch (sheet.toUpperCase()) {
    case "SAINS CRM LOGIN VIA SSO": return "Auth";
    case "CUSTOMER MODULE":          return "Customer";
    case "LEAD MODULE":              return "Lead";
    case "QUOTATION MODULE":         return "Quotation";
    case "PROPOSAL MODULE":          return "Proposal";
    case "ADMIN MODULE":              return "Admin";
    case "REPORTING MODULE":         return "Reporting";
    default:                          return "Admin";
  }
}

export interface ExecutorChoice {
  executorType: "manual" | "http_probe" | "sql_assertion";
  executorConfig: Record<string, unknown> | null;
}

export function deriveExecutor(testId: string, module: string): ExecutorChoice {
  switch (testId) {
    case "LOGIN-001": return { executorType: "http_probe", executorConfig: { method: "GET", path: "/", expectStatus: [200, 302] } };
    case "LOGIN-002": return { executorType: "http_probe", executorConfig: { method: "GET", path: "/api/auth/signin/fim", expectStatus: [200, 302, 307] } };
    case "LOGIN-007": return { executorType: "http_probe", executorConfig: { method: "GET", path: "/api/auth/callback/fim", expectStatus: [400, 401, 302] } };
    case "LOGIN-008": return { executorType: "http_probe", executorConfig: { method: "POST", path: "/api/auth/signout", expectStatus: [200, 302] } };

    case "UAT-QPR-01": return { executorType: "http_probe", executorConfig: { method: "GET", path: "/api/reports/quotation-performance", expectStatus: [200, 401] } };
    case "UAT-QPR-05": return { executorType: "http_probe", executorConfig: { method: "GET", path: "/api/reports/quotation-performance/xlsx", expectStatus: [200, 401] } };

    case "SYS-001":
      return { executorType: "sql_assertion", executorConfig: { sql: "SELECT COUNT(*) FROM crm.feature_flags", expectMinValue: 5, note: "Feature flags seeded with ≥ 5 kill switches." } };
    case "AUD-001":
      return { executorType: "sql_assertion", executorConfig: { sql: "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'crm' AND table_name = 'audit_log'", expectValue: 1, note: "audit_log table exists (PDPA compliance)." } };
    case "AUD-002":
      return { executorType: "sql_assertion", executorConfig: { sql: "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'crm' AND table_name = 'audit_log' AND column_name IN ('before_value','after_value','actor_user_id','event_time')", expectValue: 4, note: "audit_log captures before/after/actor/timestamp (FSD §3.5.4)." } };
    case "AUD-003":
      return { executorType: "sql_assertion", executorConfig: { sql: "SELECT COUNT(*) FROM crm.audit_log", expectMinValue: 0, note: "audit_log is queryable." } };
    case "RUN-001":
      return { executorType: "sql_assertion", executorConfig: { sql: "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'crm' AND table_name = 'quotation_sequences'", expectValue: 1, note: "Running-number table exists (FSD §3.2.7)." } };

    default:
      if (testId.startsWith("CUST-") && module === "Customer") {
        return { executorType: "http_probe", executorConfig: { method: "GET", path: "/api/accounts", expectStatus: [200, 401] } };
      }
      return { executorType: "manual", executorConfig: null };
  }
}
