import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { buildClosedWhere, parseFilters, XLSX_EXPORT_ROW_CAP } from "../../../../(app)/reports/filters";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const filters = parseFilters(req.nextUrl.searchParams);
  const where = buildClosedWhere(filters);

  const status = (await db.execute(sql`
    SELECT qs.name AS status, COUNT(q.id)::int AS count, COALESCE(SUM(q.total_myr),0)::numeric AS total
    FROM crm.quotation_statuses qs LEFT JOIN crm.quotations q ON q.status_id = qs.id
    GROUP BY qs.id, qs.name ORDER BY qs.id
  `)) as unknown as Array<{ status: string; count: number; total: string }>;

  const rejections = (await db.execute(sql`
    SELECT rr.name AS reason, COUNT(q.id)::int AS count, COALESCE(SUM(q.total_myr),0)::numeric AS total
    FROM crm.rejection_reasons rr LEFT JOIN crm.quotations q ON q.rejection_reason_id = rr.id AND q.status_id = 6
    GROUP BY rr.id, rr.name ORDER BY rr.id
  `)) as unknown as Array<{ reason: string; count: number; total: string }>;

  const revisions = (await db.execute(sql`
    SELECT MAX(quotation_no) AS latest_no, COUNT(*)::int AS revisions
    FROM crm.quotations GROUP BY root_quotation_id ORDER BY revisions DESC
  `)) as unknown as Array<{ latest_no: string; revisions: number }>;

  const closed = (await db.execute(sql`
    SELECT q.quotation_no,
           p.proposal_no AS proposal_no,
           a.organization_name AS customer,
           u.full_name AS owner,
           q.total_myr,
           q.closed_at
    FROM crm.quotations q
    LEFT JOIN crm.quotation_statuses qs ON qs.id = q.status_id
    LEFT JOIN crm.accounts a ON a.id = q.account_id
    LEFT JOIN crm.users u ON u.id = q.owner_user_id
    LEFT JOIN crm.proposals p ON p.id = q.proposal_id
    WHERE ${where}
    ORDER BY q.closed_at DESC NULLS LAST
    LIMIT ${XLSX_EXPORT_ROW_CAP + 1}
  `)) as unknown as Array<{
    quotation_no: string;
    proposal_no: string | null;
    customer: string | null;
    owner: string | null;
    total_myr: string;
    closed_at: string | null;
  }>;

  const truncated = closed.length > XLSX_EXPORT_ROW_CAP;
  const closedSlice = truncated ? closed.slice(0, XLSX_EXPORT_ROW_CAP) : closed;
  const closedSheet = closedSlice.map(r => ({
    "Quotation No": r.quotation_no,
    "Proposal No": r.proposal_no ?? "",
    "Customer": r.customer ?? "",
    "Owner": r.owner ?? "",
    "Total (MYR)": Number(r.total_myr),
    "Closed": r.closed_at ? new Date(r.closed_at).toISOString().slice(0, 10) : "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(status), "Status Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rejections), "Rejections");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revisions), "Revisions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(closedSheet), "Closed");

  if (truncated) {
    const notice = [{
      "Notice": `Export capped at ${XLSX_EXPORT_ROW_CAP.toLocaleString()} rows. Narrow your filters to export the full dataset.`,
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notice), "Notice");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quotation-performance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
