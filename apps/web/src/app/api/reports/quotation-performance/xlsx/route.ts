import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
    SELECT quotation_no, total_myr, closed_at
    FROM crm.quotations WHERE status_id = 5 ORDER BY closed_at DESC NULLS LAST
  `)) as unknown as Array<{ quotation_no: string; total_myr: string; closed_at: string | null }>;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(status), "Status Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rejections), "Rejections");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revisions), "Revisions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(closed), "Closed");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quotation-performance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
