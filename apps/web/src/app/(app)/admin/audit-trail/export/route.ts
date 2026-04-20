import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, desc, gte, lte, ilike, SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user.roleCode !== "Administrator") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const module = (url.searchParams.get("module") ?? "").trim();
  const from   = (url.searchParams.get("from") ?? "").trim();
  const to     = (url.searchParams.get("to") ?? "").trim();

  const conds: SQL[] = [];
  if (module) conds.push(ilike(schema.auditLog.eventType, `%${module}%`));
  if (from)   conds.push(gte(schema.auditLog.eventTime, new Date(from)));
  if (to)     conds.push(lte(schema.auditLog.eventTime, new Date(to + "T23:59:59Z")));

  const where = conds.length > 0 ? and(...conds) : undefined;

  const rows = await db.select().from(schema.auditLog).where(where).orderBy(desc(schema.auditLog.eventTime)).limit(5000);

  const headers = ["id", "event_time", "event_type", "actor_user_id", "target_entity", "target_id", "outcome", "latency_ms", "reason"];
  const csv = [
    headers.join(","),
    ...rows.map(r => [
      r.id,
      r.eventTime.toISOString(),
      r.eventType,
      r.actorUserId ?? "",
      r.targetEntity ?? "",
      r.targetId ?? "",
      r.outcome,
      r.latencyMs ?? "",
      JSON.stringify(r.reason ?? "").replace(/^"|"$/g, ""),
    ].map(csvEscape).join(",")),
  ].join("\r\n");

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-trail-${ts}.csv"`,
    },
  });
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
