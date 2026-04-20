import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { renderToBuffer, Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import React from "react";
import fs from "node:fs";
import path from "node:path";

// @react-pdf v4 no longer ships resolvable Helvetica AFM data through the Next
// bundler, which caused "Cannot read properties of undefined (reading 'unitsPerEm')"
// on the Railway runtime. Register a real TTF from disk instead. The file is
// shipped at apps/web/public/fonts/Inter-Regular.ttf and traced into the build.
let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  const fontPath = path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf");
  Font.register({ family: "Inter", src: fontPath });
  fontRegistered = true;
}
// Disable hyphenation so we do not pull any extra runtime assets.
Font.registerHyphenationCallback((word: string) => [word]);

/**
 * FSD §3.2.6 — PDF generation of an approved (or draft) quotation.
 * Users download this and mail manually; no SMTP integration in scope.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureFont();

  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const lines = await db
    .select()
    .from(schema.quotationLines)
    .where(eq(schema.quotationLines.quotationId, id))
    .orderBy(asc(schema.quotationLines.lineOrder));

  const status = await db.query.quotationStatuses.findFirst({ where: eq(schema.quotationStatuses.id, q.statusId) });
  const type = await db.query.quotationTypes.findFirst({ where: eq(schema.quotationTypes.id, q.typeId) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, q.ownerUserId) });

  const buffer = await renderToBuffer(
    <QuotationPdf
      q={q}
      lines={lines}
      statusName={status?.name ?? "?"}
      typeName={type?.name ?? "?"}
      ownerName={owner?.fullName ?? "—"}
    />
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${q.quotationNo}.pdf"`,
    },
  });
}

// -------- PDF document --------

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Inter", color: "#3f3f3f" },
  headerBar: { borderBottomWidth: 2, borderBottomColor: "#721011", paddingBottom: 10, marginBottom: 18 },
  title: { fontSize: 20, fontWeight: 700, color: "#721011" },
  meta: { fontSize: 9, color: "#6b6b6b", marginTop: 4 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#721011", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  twoCol: { flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5" },
  rowHead: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#3f3f3f", backgroundColor: "#f7f6f3" },
  c1: { width: 30, textAlign: "center" },
  c2: { flex: 4, paddingHorizontal: 4 },
  c3: { width: 40, textAlign: "right" },
  c4: { width: 65, textAlign: "right" },
  c5: { width: 40, textAlign: "right" },
  c6: { width: 75, textAlign: "right" },
  totals: { marginTop: 18, alignSelf: "flex-end", width: 220 },
  totalsRow: { flexDirection: "row", paddingVertical: 3 },
  totalsLabel: { flex: 1, textAlign: "right", paddingRight: 10, color: "#6b6b6b" },
  totalsValue: { width: 100, textAlign: "right", fontWeight: 700 },
  grandTotal: { fontSize: 12, color: "#721011" },
  footer: { position: "absolute", bottom: 30, left: 48, right: 48, fontSize: 8, color: "#9a9a9a", textAlign: "center" },
  label: { color: "#6b6b6b", fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 10, marginTop: 2 },
});

function QuotationPdf({
  q, lines, statusName, typeName, ownerName,
}: {
  q: typeof schema.quotations.$inferSelect;
  lines: typeof schema.quotationLines.$inferSelect[];
  statusName: string;
  typeName: string;
  ownerName: string;
}) {
  const addressParts = [q.snapLine1, q.snapLine2, q.snapLine3,
    [q.snapCity, q.snapPostcode].filter(Boolean).join(" "),
    [q.snapStateCode, q.snapCountryCode].filter(Boolean).join(", "),
  ].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.title}>QUOTATION</Text>
          <Text style={styles.meta}>{q.quotationNo}  ·  Revision {q.revisionLetter}  ·  Type: {typeName}  ·  Status: {statusName}</Text>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Billed To</Text>
            <Text style={styles.value}>{q.snapOrganizationName ?? "—"}</Text>
            {addressParts.map((a, i) => <Text key={i} style={styles.value}>{a}</Text>)}
            {q.snapPhone && <Text style={styles.value}>Phone: {q.snapPhone}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Meta</Text>
            <Text style={styles.label}>Subject</Text>
            <Text style={styles.value}>{q.subject ?? "—"}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Prepared by</Text>
            <Text style={styles.value}>{ownerName}</Text>
            <Text style={[styles.label, { marginTop: 6 }]}>Date</Text>
            <Text style={styles.value}>{q.quotationDate ? String(q.quotationDate) : new Date(q.createdAt).toLocaleDateString()}</Text>
            {q.validUntil && (
              <>
                <Text style={[styles.label, { marginTop: 6 }]}>Valid until</Text>
                <Text style={styles.value}>{String(q.validUntil)}</Text>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Line items</Text>
        <View style={styles.rowHead}>
          <Text style={styles.c1}>#</Text>
          <Text style={styles.c2}>Description</Text>
          <Text style={styles.c3}>Qty</Text>
          <Text style={styles.c4}>Unit (MYR)</Text>
          <Text style={styles.c5}>Tax%</Text>
          <Text style={styles.c6}>Amount (MYR)</Text>
        </View>
        {lines.length === 0 && (
          <View style={styles.row}>
            <Text style={{ flex: 1, textAlign: "center", color: "#9a9a9a", paddingVertical: 10 }}>No line items</Text>
          </View>
        )}
        {lines.map((l, i) => {
          const qty = Number(l.quantity);
          const price = Number(l.unitPriceMyr);
          const disc = Number(l.discountAmountMyr);
          const amt = qty * price - disc;
          return (
            <View key={l.id} style={styles.row}>
              <Text style={styles.c1}>{i + 1}</Text>
              <Text style={styles.c2}>
                {l.description}{l.isOptional ? "  (optional)" : ""}
              </Text>
              <Text style={styles.c3}>{qty}</Text>
              <Text style={styles.c4}>{price.toLocaleString()}</Text>
              <Text style={styles.c5}>{Number(l.taxPct).toFixed(2)}</Text>
              <Text style={styles.c6}>{amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
          );
        })}

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{Number(q.subtotalMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Discount</Text>
            <Text style={styles.totalsValue}>{Number(q.discountMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Tax</Text>
            <Text style={styles.totalsValue}>{Number(q.taxMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={[styles.totalsRow, { borderTopWidth: 1, borderTopColor: "#3f3f3f", paddingTop: 6, marginTop: 4 }]}>
            <Text style={[styles.totalsLabel, styles.grandTotal]}>Total (MYR)</Text>
            <Text style={[styles.totalsValue, styles.grandTotal]}>{Number(q.totalMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {q.note && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.value}>{q.note}</Text>
          </>
        )}
        {q.termsConditions && (
          <>
            <Text style={styles.sectionTitle}>Terms &amp; conditions</Text>
            <Text style={styles.value}>{q.termsConditions}</Text>
          </>
        )}

        <Text style={styles.footer} fixed>
          SAINS CRM · Claritas × EIAAW Solutions · Generated {new Date().toISOString().slice(0, 19).replace("T", " ")}
        </Text>
      </Page>
    </Document>
  );
}
