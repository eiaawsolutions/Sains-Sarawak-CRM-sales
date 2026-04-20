import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = await db.query.quotationAttachments.findFirst({
    where: and(
      eq(schema.quotationAttachments.id, attachmentId),
      eq(schema.quotationAttachments.quotationId, id),
    ),
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const buf = Buffer.from(row.content, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Length": String(row.sizeBytes),
      "Content-Disposition": `inline; filename="${row.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
