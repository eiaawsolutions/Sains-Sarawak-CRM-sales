import { sql, type SQL } from "drizzle-orm";

/**
 * Quotation Performance Report — filter contract.
 * UAT-QPR-02/03: up to 5 filter rows, composable as AND.
 */
export type FilterField =
  | "quotation_no"
  | "status"
  | "customer"
  | "owner"
  | "proposal_no"
  | "closed_from"
  | "closed_to";

export type FilterRow = { field: FilterField; value: string };

export const FILTER_FIELDS: Array<{ value: FilterField; label: string }> = [
  { value: "quotation_no", label: "Quotation No" },
  { value: "status", label: "Status" },
  { value: "customer", label: "Customer" },
  { value: "owner", label: "Owner" },
  { value: "proposal_no", label: "Proposal No" },
  { value: "closed_from", label: "Closed From (YYYY-MM-DD)" },
  { value: "closed_to", label: "Closed To (YYYY-MM-DD)" },
];

const ALLOWED = new Set<FilterField>(FILTER_FIELDS.map(f => f.value));

export const MAX_FILTER_ROWS = 5;
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const MAX_PAGE_SIZE = 100;
export const XLSX_EXPORT_ROW_CAP = 50_000;

export function parseFilters(params: URLSearchParams | Record<string, string | string[] | undefined>): FilterRow[] {
  const get = (k: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(k);
    const v = (params as Record<string, string | string[] | undefined>)[k];
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  };
  const fields = get("f");
  const values = get("v");
  const rows: FilterRow[] = [];
  for (let i = 0; i < fields.length && rows.length < MAX_FILTER_ROWS; i++) {
    const field = fields[i] as FilterField;
    const value = (values[i] ?? "").trim();
    if (!ALLOWED.has(field) || !value) continue;
    rows.push({ field, value });
  }
  return rows;
}

export function parsePage(params: URLSearchParams | Record<string, string | string[] | undefined>): number {
  const raw = params instanceof URLSearchParams ? params.get("page") : (params as Record<string, unknown>)["page"];
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export function parsePageSize(params: URLSearchParams | Record<string, string | string[] | undefined>): number {
  const raw = params instanceof URLSearchParams ? params.get("pageSize") : (params as Record<string, unknown>)["pageSize"];
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(n)));
}

/** Build a SQL predicate for the closed-quotations query. Safe — parameters bound via drizzle sql`` tag. */
export function buildClosedWhere(rows: FilterRow[]): SQL {
  const clauses: SQL[] = [sql`q.status_id = 5`];
  for (const r of rows) {
    const v = r.value;
    switch (r.field) {
      case "quotation_no": clauses.push(sql`q.quotation_no ILIKE ${"%" + v + "%"}`); break;
      case "status":       clauses.push(sql`qs.name ILIKE ${"%" + v + "%"}`); break;
      case "customer":     clauses.push(sql`a.organization_name ILIKE ${"%" + v + "%"}`); break;
      case "owner":        clauses.push(sql`u.full_name ILIKE ${"%" + v + "%"}`); break;
      case "proposal_no":  clauses.push(sql`p.proposal_no ILIKE ${"%" + v + "%"}`); break;
      case "closed_from":  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) clauses.push(sql`q.closed_at >= ${v}::date`); break;
      case "closed_to":    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) clauses.push(sql`q.closed_at < (${v}::date + INTERVAL '1 day')`); break;
    }
  }
  return sql.join(clauses, sql` AND `);
}
