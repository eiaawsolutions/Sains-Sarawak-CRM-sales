/**
 * FSD §3.6.1 — Quotation Performance Report (JSON view). Excel + PDF variants live in
 * sibling routes `./xlsx/route.ts` and `./pdf/route.tsx`.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { buildClosedWhere, parseFilters, parsePage, DEFAULT_PAGE_SIZE } from "../../../(app)/reports/filters";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const filters = parseFilters(req.nextUrl.searchParams);
  const page = parsePage(req.nextUrl.searchParams);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const where = buildClosedWhere(filters);

  const statusSummary = await db.execute(sql`
    SELECT qs.id AS status_id, qs.code AS status_code, qs.name AS status_name,
           COUNT(q.id)::int AS quotation_count,
           COALESCE(SUM(q.total_myr), 0)::numeric AS total_value_myr
    FROM crm.quotation_statuses qs
    LEFT JOIN crm.quotations q ON q.status_id = qs.id
    GROUP BY qs.id, qs.code, qs.name
    ORDER BY qs.id
  `);

  const rejectionBreakdown = await db.execute(sql`
    SELECT rr.id AS reason_id, rr.code AS reason_code, rr.name AS reason_name,
           COUNT(q.id)::int AS quotation_count,
           COALESCE(SUM(q.total_myr), 0)::numeric AS total_value_myr
    FROM crm.rejection_reasons rr
    LEFT JOIN crm.quotations q ON q.rejection_reason_id = rr.id AND q.status_id = 6
    GROUP BY rr.id, rr.code, rr.name
    ORDER BY rr.id
  `);

  const totalRow = (await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM crm.quotations q
    LEFT JOIN crm.quotation_statuses qs ON qs.id = q.status_id
    LEFT JOIN crm.accounts a ON a.id = q.account_id
    LEFT JOIN crm.users u ON u.id = q.owner_user_id
    LEFT JOIN crm.proposals p ON p.id = q.proposal_id
    WHERE ${where}
  `)) as unknown as Array<{ n: number }>;
  const total = totalRow[0]?.n ?? 0;

  const closedOverview = await db.execute(sql`
    SELECT q.id, q.quotation_no, q.owner_user_id, u.full_name AS owner_name,
           q.account_id, a.organization_name AS customer_name,
           q.total_myr, q.closed_at, q.accepted_via, q.wot_reference,
           p.proposal_no AS proposal_no,
           fs.name AS source_of_fund
    FROM crm.quotations q
    LEFT JOIN crm.quotation_statuses qs ON qs.id = q.status_id
    LEFT JOIN crm.users u ON u.id = q.owner_user_id
    LEFT JOIN crm.accounts a ON a.id = q.account_id
    LEFT JOIN crm.proposals p ON p.id = q.proposal_id
    LEFT JOIN crm.fund_sources fs ON fs.id = q.source_of_fund_id
    WHERE ${where}
    ORDER BY q.closed_at DESC
    LIMIT ${DEFAULT_PAGE_SIZE} OFFSET ${offset}
  `);

  return NextResponse.json({
    statusSummary,
    rejectionBreakdown,
    closedOverview,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    total,
    totalPages: Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE)),
    filters,
    generatedAt: new Date().toISOString(),
    generatedByName: session.user.name ?? session.user.email,
  });
}
