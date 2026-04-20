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

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(status), "Status Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rejections), "Rejections");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="quotation-performance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
