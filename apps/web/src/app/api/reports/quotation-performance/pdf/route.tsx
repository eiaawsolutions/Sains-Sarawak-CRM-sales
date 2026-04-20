import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import React from "react";
import path from "node:path";
import { buildClosedWhere, parseFilters } from "../../../../(app)/reports/filters";

// @react-pdf v4 no longer ships a resolvable Helvetica AFM through the Next bundler,
// which causes "Cannot read properties of undefined (reading 'unitsPerEm')" on Railway.
// Register the Inter TTF that is already shipped for the quotation PDF.
let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  const fontPath = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
  Font.register({ family: "Inter", src: fontPath });
  fontRegistered = true;
}
Font.registerHyphenationCallback((word: string) => [word]);

type Status = { status: string; count: number; total: string };
type Rejection = { reason: string; count: number };
type Revision = { latest_no: string; revisions: number };
type Closed = {
  quotation_no: string;
  proposal_no: string | null;
  customer: string | null;
  owner: string | null;
  total_myr: string;
  closed_at: string | null;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  ensureFont();

  const filters = parseFilters(req.nextUrl.searchParams);
  const where = buildClosedWhere(filters);

  const status = (await db.execute(sql`
    SELECT qs.name AS status, COUNT(q.id)::int AS count, COALESCE(SUM(q.total_myr),0)::numeric AS total
    FROM crm.quotation_statuses qs LEFT JOIN crm.quotations q ON q.status_id = qs.id
    GROUP BY qs.id, qs.name ORDER BY qs.id
  `)) as unknown as Status[];

  const rejections = (await db.execute(sql`
    SELECT rr.name AS reason, COUNT(q.id)::int AS count
    FROM crm.rejection_reasons rr LEFT JOIN crm.quotations q ON q.rejection_reason_id = rr.id AND q.status_id = 6
    GROUP BY rr.id, rr.name ORDER BY rr.id
  `)) as unknown as Rejection[];

  const revisions = (await db.execute(sql`
    SELECT MAX(quotation_no) AS latest_no, COUNT(*)::int AS revisions
    FROM crm.quotations GROUP BY root_quotation_id ORDER BY revisions DESC LIMIT 50
  `)) as unknown as Revision[];

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
    LIMIT 500
  `)) as unknown as Closed[];

  const buffer = await renderToBuffer(
    <ReportPdf status={status} rejections={rejections} revisions={revisions} closed={closed} filterCount={filters.length} />
  );
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quotation-performance-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Inter", color: "#3f3f3f" },
  h1: { fontSize: 18, fontWeight: 700, color: "#721011" },
  meta: { fontSize: 9, color: "#6b6b6b", marginTop: 2, marginBottom: 14 },
  h2: { fontSize: 11, fontWeight: 700, color: "#721011", marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5" },
  rowHead: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#3f3f3f", backgroundColor: "#f7f6f3" },
  col: { flex: 1.2, paddingHorizontal: 4 },
  colNarrow: { flex: 0.8, paddingHorizontal: 4 },
  colRight: { flex: 1, paddingHorizontal: 4, textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 8, color: "#9a9a9a", textAlign: "center" },
});

function ReportPdf({ status, rejections, revisions, closed, filterCount }: {
  status: Status[]; rejections: Rejection[]; revisions: Revision[]; closed: Closed[]; filterCount: number;
}) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Quotation Performance Report</Text>
        <Text style={s.meta}>
          FSD §3.6.1 · Generated {new Date().toISOString().slice(0, 19).replace("T", " ")}
          {filterCount > 0 ? ` · ${filterCount} filter${filterCount > 1 ? "s" : ""} applied` : ""}
        </Text>

        <Text style={s.h2}>Status Summary</Text>
        <View style={s.rowHead}>
          <Text style={s.col}>Status</Text>
          <Text style={s.colRight}>Count</Text>
          <Text style={s.colRight}>Total (MYR)</Text>
        </View>
        {status.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={s.col}>{r.status}</Text>
            <Text style={s.colRight}>{r.count}</Text>
            <Text style={s.colRight}>{Number(r.total).toLocaleString()}</Text>
          </View>
        ))}

        <Text style={s.h2}>Rejected Quotations Breakdown</Text>
        <View style={s.rowHead}>
          <Text style={s.col}>Reason</Text>
          <Text style={s.colRight}>Count</Text>
        </View>
        {rejections.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={s.col}>{r.reason}</Text>
            <Text style={s.colRight}>{r.count}</Text>
          </View>
        ))}

        <Text style={s.h2}>Submission / Revision Summary</Text>
        <View style={s.rowHead}>
          <Text style={s.col}>Latest Quotation No</Text>
          <Text style={s.colRight}>Revisions</Text>
        </View>
        {revisions.length === 0 && <View style={s.row}><Text style={s.col}>No data</Text></View>}
        {revisions.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={s.col}>{r.latest_no}</Text>
            <Text style={s.colRight}>{r.revisions}</Text>
          </View>
        ))}

        <Text style={s.h2}>Closed Quotations Overview</Text>
        <View style={s.rowHead}>
          <Text style={s.colNarrow}>Quotation No</Text>
          <Text style={s.colNarrow}>Proposal</Text>
          <Text style={s.col}>Customer</Text>
          <Text style={s.col}>Owner</Text>
          <Text style={s.colRight}>Total (MYR)</Text>
          <Text style={s.colRight}>Closed</Text>
        </View>
        {closed.length === 0 && <View style={s.row}><Text style={s.col}>No data</Text></View>}
        {closed.map((r, i) => (
          <View key={i} style={s.row}>
            <Text style={s.colNarrow}>{r.quotation_no}</Text>
            <Text style={s.colNarrow}>{r.proposal_no ?? "—"}</Text>
            <Text style={s.col}>{r.customer ?? "—"}</Text>
            <Text style={s.col}>{r.owner ?? "—"}</Text>
            <Text style={s.colRight}>{Number(r.total_myr).toLocaleString()}</Text>
            <Text style={s.colRight}>{r.closed_at ? new Date(r.closed_at).toISOString().slice(0, 10) : "—"}</Text>
          </View>
        ))}

        <Text style={s.footer} fixed>SAINS CRM · Claritas × EIAAW Solutions</Text>
      </Page>
    </Document>
  );
}
