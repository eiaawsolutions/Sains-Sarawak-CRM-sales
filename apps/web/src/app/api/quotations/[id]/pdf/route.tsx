import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq, asc } from "drizzle-orm";
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import React from "react";
import path from "node:path";
import fs from "node:fs";

// Load the SAINS lockup once. @react-pdf expects a Buffer / data URL — passing a raw
// Windows/POSIX path makes it attempt a network fetch (fails silently into a blank image).
let logoBuffer: Buffer | null = null;
function getLogo(): Buffer | null {
  if (logoBuffer) return logoBuffer;
  const p = path.join(process.cwd(), "public", "sains-logo.png");
  try { logoBuffer = fs.readFileSync(p); return logoBuffer; }
  catch { return null; }
}

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
Font.registerHyphenationCallback((word: string) => [word]);

/**
 * FSD §3.2.6 — PDF generation of an approved (or draft) quotation.
 * Renders SAINS letterhead template in 4 variants dispatched by quotation type
 * and discount presence: New, Revised, Discounted, AOQ (plus Proposal Costing Sheet).
 * Sample fidelity: see Requirement/Sample Quotations/*.docx extracted 2026-04-21.
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

  const type = await db.query.quotationTypes.findFirst({ where: eq(schema.quotationTypes.id, q.typeId) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, q.ownerUserId) });

  const buffer = await renderToBuffer(
    <QuotationPdf q={q} lines={lines} typeCode={type?.code ?? "new"} owner={owner ?? null} />
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${q.quotationNo}.pdf"`,
    },
  });
}

// --------------------- SAINS issuer constants ---------------------
// Letterhead + footer values transcribed verbatim from the sample .docx set.
// Move to an org_settings table once multi-issuer is in scope.

const SAINS = {
  name: "Sarawak Information Systems Sdn. Bhd.",
  addressLine1: "Wisma Bapa Malaysia, Petra Jaya",
  addressLine2: "93502 Kuching, Sarawak, Malaysia",
  tel: "082-668668",
  fax: "082-668669",
  mystRegNo: "Y60-1809-32000008",
  poEmail: "ronalnyc@sains.com.my",
  website: "www.sains.com.my",
};

// Default T&Cs — 6 clauses verbatim from sample quotations. Used when quotation.termsConditions is null.
const DEFAULT_TERMS: string[] = [
  "The above prices are valid for a period of Thirty (30) days from the date of quotation.",
  "The period delivery estimated is to be approximately 6 – 8 weeks upon confirmation of order, subject to part availability, production queue, logistic condition, and stock availability.",
  `Please sign and fax your Purchase Order / Service Order to ${SAINS.fax} or email at ${SAINS.poEmail} upon acceptance of this quotation.`,
  "The order cannot be revoked once the quotation is accepted.",
  "Invoice will be issued upon completion of the delivery; terms of payment is Thirty (30) days Net from date of invoice.",
  "The rate of service tax is in accordance to the Service Tax Act 2018 or at other statutory rates prevailing at the time when such consumption tax is charged or payable. If there is any change in the prescribed statutory rate, the Service Tax payable hereunder shall be adjusted accordingly.",
];

// --------------------- Styles (Claritas charcoal/crimson ink on SAINS letterhead) ---------------------

const INK = "#222222";
const MUTED = "#6b6b6b";
const LINE = "#3f3f3f";
const ACCENT = "#721011";

const styles = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 64, paddingHorizontal: 48, fontSize: 10, fontFamily: "Inter", color: INK, lineHeight: 1.4 },

  // Letterhead. alignItems: flex-start so the variant label (QUOTATION / AOQ / etc.)
  // sits at the top next to the logo rather than squashed against the bottom rule.
  letterhead: { borderBottomWidth: 2, borderBottomColor: ACCENT, paddingBottom: 10, marginBottom: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandLogo: { width: 150, height: 64, marginBottom: 6 },
  brandName: { fontSize: 9, color: INK, fontWeight: 700, marginTop: 2 },
  brandMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
  variantLabel: { fontSize: 10, color: ACCENT, fontWeight: 700, letterSpacing: 1, textAlign: "right" },

  // Top-right metadata (MySST, Ref, Date)
  metaRight: { textAlign: "right", fontSize: 9, color: INK, marginBottom: 18 },
  metaRightBold: { fontWeight: 700 },

  // Addressee + Attention
  addressee: { marginBottom: 14 },
  addresseeName: { fontWeight: 700, color: INK },

  // Subject
  subject: { fontWeight: 700, color: INK, textDecoration: "underline", marginTop: 6, marginBottom: 10 },

  // Intro / body paragraphs
  para: { marginBottom: 8, textAlign: "justify" },

  // Section headings (Summary of Charges, Optional Item, Terms & Conditions)
  sectionHead: { fontWeight: 700, textDecoration: "underline", marginTop: 16, marginBottom: 6, color: INK },

  // Pricing table
  tbl: { borderTopWidth: 1, borderTopColor: LINE, marginTop: 6 },
  trHead: { flexDirection: "row", backgroundColor: "#f2efe9", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dcdcdc", paddingVertical: 5 },
  trGroup: { flexDirection: "row", backgroundColor: "#f7f6f3", paddingVertical: 4 },
  trTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, paddingVertical: 5 },
  cNo: { width: 28, textAlign: "center", paddingHorizontal: 2 },
  cDesc: { flex: 1, paddingHorizontal: 4 },
  cQty: { width: 60, textAlign: "center", paddingHorizontal: 2 },
  cUnit: { width: 80, textAlign: "right", paddingHorizontal: 4 },
  cAmt: { width: 90, textAlign: "right", paddingHorizontal: 4 },
  cellHead: { fontWeight: 700, fontSize: 9 },
  cellGroup: { fontWeight: 700, color: ACCENT, fontSize: 10 },
  cellTotalLabel: { flex: 1, textAlign: "right", paddingRight: 8, fontWeight: 700 },

  // Summary of Charges (5 cols)
  soc: { marginTop: 6 },
  socTrHead: { flexDirection: "row", backgroundColor: "#f2efe9", borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE, paddingVertical: 5 },
  socTr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#dcdcdc", paddingVertical: 5 },
  socTrTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE, paddingVertical: 5 },
  socCNo: { width: 28, textAlign: "center" },
  socCDesc: { flex: 1, paddingHorizontal: 4 },
  socCPrice: { width: 85, textAlign: "right", paddingHorizontal: 4 },
  socCTax: { width: 85, textAlign: "right", paddingHorizontal: 4 },
  socCTotal: { width: 90, textAlign: "right", paddingHorizontal: 4 },

  // T&Cs / notes
  clause: { flexDirection: "row", marginBottom: 4 },
  clauseNum: { width: 20, fontWeight: 700 },
  clauseText: { flex: 1, textAlign: "justify" },

  // Signature
  sig: { marginTop: 22 },
  sigLine: { marginBottom: 2 },
  sigBold: { fontWeight: 700 },

  // AOQ acceptance block
  aoqBox: { marginTop: 28, paddingTop: 14, borderTopWidth: 1, borderTopColor: LINE },
  aoqRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  aoqLabel: { fontWeight: 700 },
  aoqField: { flexDirection: "row", marginBottom: 10, alignItems: "flex-end" },
  aoqFieldLabel: { width: 120, fontWeight: 700 },
  aoqFieldUnderline: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: INK, paddingBottom: 2, minHeight: 14 },
  aoqSigRow: { flexDirection: "row", marginTop: 18, alignItems: "flex-end" },
  aoqSigLeft: { flex: 1 },
  aoqSigRight: { flex: 1, textAlign: "right", fontWeight: 700 },

  // Page footer
  pageFooter: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: MUTED, textAlign: "center", borderTopWidth: 0.5, borderTopColor: "#dcdcdc", paddingTop: 6 },
  pageNum: { position: "absolute", bottom: 24, right: 48, fontSize: 8, color: MUTED },
});

// --------------------- Helpers ---------------------

const fmt = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(d: string | Date | null | undefined): string {
  const x = d ? new Date(d as string) : new Date();
  const day = x.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix} ${x.toLocaleString("en-MY", { month: "long" })} ${x.getFullYear()}`;
}

function splitTerms(t: string | null | undefined): string[] {
  if (!t) return DEFAULT_TERMS;
  const lines = t.split(/\r?\n+/).map(s => s.trim()).filter(Boolean);
  return lines.length > 0 ? lines : DEFAULT_TERMS;
}

// --------------------- Document ---------------------

function QuotationPdf({
  q, lines, typeCode, owner,
}: {
  q: typeof schema.quotations.$inferSelect;
  lines: typeof schema.quotationLines.$inferSelect[];
  typeCode: string;
  owner: typeof schema.users.$inferSelect | null;
}) {
  const isAOQ = typeCode === "aoq";
  const isRevised = typeCode === "revised";
  const isProposal = typeCode === "proposal_pricing";
  const discount = Number(q.discountMyr);
  const isDiscounted = discount > 0;

  // Intro wording per sample: inserts "revised" or "discounted" before "quotation"
  const quoteWord = isRevised ? "revised quotation" : isDiscounted ? "discounted quotation" : "quotation";

  const required = lines.filter(l => !l.isOptional);
  const optional = lines.filter(l => l.isOptional);

  const addrParts = [q.snapLine1, q.snapLine2, q.snapLine3,
    [q.snapPostcode, q.snapCity].filter(Boolean).join(" "),
    [q.snapStateCode === "E" ? "Sarawak" : q.snapStateCode, q.snapCountryCode === "MY" ? "Malaysia" : q.snapCountryCode].filter(Boolean).join(", "),
  ].filter(Boolean) as string[];

  const contactLine = [q.snapPhone && `Tel: ${q.snapPhone}`, q.snapFax && `Fax: ${q.snapFax}`].filter(Boolean).join(" | ");

  const subtotal = Number(q.subtotalMyr);
  const tax = Number(q.taxMyr);
  const total = Number(q.totalMyr);
  const afterDiscount = subtotal - discount;

  // Identify which line indexes are taxable — mirrors sample "8% Service on item 2 & 4" label
  const taxableIdx = required
    .map((l, i) => Number(l.taxPct) > 0 ? i + 1 : null)
    .filter((x): x is number => x !== null);
  const taxLabel = taxableIdx.length > 0
    ? `${tax === 0 ? "Service Tax" : "8% Service"} on item ${taxableIdx.join(" & ")} (RM)`
    : "8% Service Tax (RM)";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.letterhead}>
          <View>
            {getLogo() && <Image style={styles.brandLogo} src={getLogo() as Buffer} />}
            <Text style={styles.brandName}>{SAINS.name}</Text>
            <Text style={styles.brandMeta}>{SAINS.addressLine1}  ·  {SAINS.addressLine2}</Text>
            <Text style={styles.brandMeta}>Tel: {SAINS.tel}  ·  Fax: {SAINS.fax}  ·  {SAINS.website}</Text>
          </View>
          <View style={{ paddingTop: 8 }}>
            <Text style={styles.variantLabel}>
              {isProposal ? "PROPOSAL COSTING SHEET" : isAOQ ? "ACCEPTANCE OF QUOTATION" : "QUOTATION"}
            </Text>
          </View>
        </View>

        {/* Ref / Date metadata — right aligned; bold on New/Revised/Discounted per sample, NOT bold on AOQ */}
        <View style={styles.metaRight}>
          <Text>MySST Registration No: {SAINS.mystRegNo}</Text>
          <Text>
            Ref:{" "}
            <Text style={isAOQ ? undefined : styles.metaRightBold}>{q.quotationNo}</Text>
          </Text>
          <Text>Date: {formatDate(q.quotationDate ?? q.createdAt)}</Text>
        </View>

        {/* Addressee */}
        <View style={styles.addressee}>
          <Text style={styles.addresseeName}>{q.snapOrganizationName ?? "—"}</Text>
          {addrParts.map((a, i) => <Text key={i}>{a}</Text>)}
          {contactLine && <Text>{contactLine}</Text>}
        </View>

        {/* Attention line — uses first line of address as proxy for contact if none on quotation */}
        {/* Subject line (bold + underline) */}
        <Text style={styles.subject}>
          {isAOQ ? "Acceptance of Quotation — " : "Quotation for "}{q.subject ?? "(subject pending)"}
        </Text>

        {/* Intro paragraph */}
        {!isProposal && (
          <Text style={styles.para}>
            Reference is made to the above enquiry. We are pleased to forward this {quoteWord} for your kind consideration.
          </Text>
        )}
        {isProposal && (
          <Text style={styles.para}>
            Detailed project pricing for the proposed engagement. All prices quoted are based on assumptions
            made during the development of this proposal.
          </Text>
        )}

        {/* Main pricing table */}
        <View style={styles.tbl}>
          <View style={styles.trHead}>
            <Text style={[styles.cNo, styles.cellHead]}>No</Text>
            <Text style={[styles.cDesc, styles.cellHead]}>Description</Text>
            <Text style={[styles.cQty, styles.cellHead]}>Qty</Text>
            <Text style={[styles.cUnit, styles.cellHead]}>Unit Price (RM)</Text>
            <Text style={[styles.cAmt, styles.cellHead]}>Total (RM)</Text>
          </View>

          {required.length === 0 && (
            <View style={styles.tr}>
              <Text style={{ flex: 1, textAlign: "center", color: MUTED, paddingVertical: 10 }}>No line items</Text>
            </View>
          )}
          {required.map((l, i) => {
            const qty = Number(l.quantity);
            const price = Number(l.unitPriceMyr);
            const disc = Number(l.discountAmountMyr);
            const amt = qty * price - disc;
            return (
              <View key={l.id} style={styles.tr} wrap={false}>
                <Text style={styles.cNo}>{i + 1}</Text>
                <Text style={styles.cDesc}>{l.description}</Text>
                <Text style={styles.cQty}>{qty % 1 === 0 ? qty.toFixed(0) : qty.toString()}</Text>
                <Text style={styles.cUnit}>{fmt(price)}</Text>
                <Text style={styles.cAmt}>{fmt(amt)}</Text>
              </View>
            );
          })}

          <View style={styles.trTotal}>
            <Text style={styles.cellTotalLabel}>Amount Excluding Tax (RM):</Text>
            <Text style={[styles.cAmt, { fontWeight: 700 }]}>{fmt(subtotal)}</Text>
          </View>

          {isDiscounted && (
            <>
              <View style={styles.tr}>
                <Text style={styles.cellTotalLabel}>Discount (RM):</Text>
                <Text style={[styles.cAmt, { fontWeight: 700 }]}>{fmt(discount)}</Text>
              </View>
              <View style={styles.tr}>
                <Text style={styles.cellTotalLabel}>Amount Excluding Tax After Discount (RM):</Text>
                <Text style={[styles.cAmt, { fontWeight: 700 }]}>{fmt(afterDiscount)}</Text>
              </View>
            </>
          )}

          <View style={styles.tr}>
            <Text style={styles.cellTotalLabel}>{taxLabel}:</Text>
            <Text style={[styles.cAmt, { fontWeight: 700 }]}>{fmt(tax)}</Text>
          </View>

          <View style={[styles.trTotal, { backgroundColor: "#f2efe9" }]}>
            <Text style={[styles.cellTotalLabel, { color: ACCENT }]}>
              Total Amount Including Tax{isDiscounted ? " After Discount" : ""} (RM):
            </Text>
            <Text style={[styles.cAmt, { fontWeight: 700, color: ACCENT, fontSize: 11 }]}>{fmt(total)}</Text>
          </View>
        </View>

        {/* Optional items */}
        {optional.length > 0 && (
          <>
            <Text style={styles.sectionHead}>Optional Item:</Text>
            <View style={styles.tbl}>
              <View style={styles.trHead}>
                <Text style={[styles.cNo, styles.cellHead]}>No</Text>
                <Text style={[styles.cDesc, styles.cellHead]}>Description</Text>
                <Text style={[styles.cQty, styles.cellHead]}>Qty</Text>
                <Text style={[styles.cUnit, styles.cellHead]}>Unit Price (RM)</Text>
              </View>
              {optional.map((l, i) => (
                <View key={l.id} style={styles.tr} wrap={false}>
                  <Text style={styles.cNo}>{i + 1}</Text>
                  <Text style={styles.cDesc}>{l.description}</Text>
                  <Text style={styles.cQty}>{Number(l.quantity)}</Text>
                  <Text style={styles.cUnit}>{fmt(Number(l.unitPriceMyr))}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Terms & Conditions — 6 default clauses or custom DB-supplied list */}
        {!isProposal && (
          <>
            <Text style={styles.sectionHead} break={splitTerms(q.termsConditions).length > 4}>Terms &amp; Conditions:</Text>
            {splitTerms(q.termsConditions).map((clause, i) => (
              <View key={i} style={styles.clause}>
                <Text style={styles.clauseNum}>{i + 1}.</Text>
                <Text style={styles.clauseText}>{clause}</Text>
              </View>
            ))}
          </>
        )}

        {/* Proposal-specific Exclusions + Warranty sections */}
        {isProposal && (
          <>
            <Text style={styles.sectionHead}>Exclusions:</Text>
            <View style={styles.clause}><Text style={styles.clauseNum}>1.</Text><Text style={styles.clauseText}>The price quoted does NOT include connection to client networks or registration of users as network users.</Text></View>
            <View style={styles.clause}><Text style={styles.clauseNum}>2.</Text><Text style={styles.clauseText}>The price quoted excludes services or work outside the scope of this proposal or additional procurement of hardware. Additional data conversion or hardware shall be addressed and charged separately.</Text></View>
            <View style={styles.clause}><Text style={styles.clauseNum}>3.</Text><Text style={styles.clauseText}>The price quoted does NOT include scope of administrating the system for client.</Text></View>
            <Text style={styles.sectionHead}>Government Taxes:</Text>
            <Text style={styles.para}>
              The rate of service tax is in accordance to the Service Tax Act 2018 or at other statutory rates prevailing at the
              time when such consumption tax is charged or payable. If there is any change in the prescribed statutory rate, the
              Service Tax payable hereunder shall be adjusted accordingly.
            </Text>
            <Text style={styles.sectionHead}>Warranty:</Text>
            <Text style={styles.para}>
              The proposed solution&apos;s enhanced features shall be given a 12-months project warranty, starting from the date of
              commissioning and certification of completion.
            </Text>
          </>
        )}

        {/* Closing + Signature */}
        {!isProposal && (
          <View style={styles.sig}>
            <Text style={styles.para}>
              If you require further information or clarification, please do not hesitate to contact the undersigned.
              We shall be glad to help in any way we can.
            </Text>
            <Text style={[styles.para, { marginBottom: 16 }]}>Thank you.</Text>
            <Text style={styles.sigLine}>Yours faithfully,</Text>
            <Text style={[styles.sigLine, styles.sigBold]}>For Sarawak Information Systems Sdn. Bhd.</Text>
            <View style={{ height: 42 }} />
            <Text style={[styles.sigLine, styles.sigBold]}>{owner?.fullName ?? "[Account Manager Name]"}</Text>
            <Text style={[styles.sigLine, styles.sigBold]}>{owner?.jobTitle ?? "Account Management & Business Development"}</Text>
            <Text style={styles.sigLine}>
              Email: {owner?.email ?? "XXXX@sains.com.my"}
              {owner?.mobile ? `  |  Mobile: ${owner.mobile}` : "  |  Mobile: 016-XXXXXX"}
            </Text>
          </View>
        )}

        {/* AOQ — customer acceptance block (UNIQUE to AOQ variant) */}
        {isAOQ && (
          <View style={styles.aoqBox}>
            <View style={styles.aoqRow}>
              <Text style={styles.aoqLabel}>To: {SAINS.name}</Text>
              <Text>SAINS Ref No: {q.quotationNo}</Text>
            </View>
            <Text style={[styles.para, { fontWeight: 700, marginTop: 6 }]}>We hereby accept and approve the above quotation.</Text>
            <View style={styles.aoqField}>
              <Text style={styles.aoqFieldLabel}>Our PO / SO No:</Text>
              <Text style={styles.aoqFieldUnderline}>{q.wotReference ?? " "}</Text>
            </View>
            <View style={styles.aoqField}>
              <Text style={styles.aoqFieldLabel}>Authorized By:</Text>
              <Text style={styles.aoqFieldUnderline}> </Text>
            </View>
            <View style={styles.aoqField}>
              <Text style={styles.aoqFieldLabel}>Date:</Text>
              <Text style={styles.aoqFieldUnderline}>
                {q.acceptedAt ? new Date(q.acceptedAt).toLocaleDateString("en-MY") : " "}
              </Text>
            </View>
            <View style={styles.aoqSigRow}>
              <View style={styles.aoqSigLeft}>
                <View style={{ borderTopWidth: 0.5, borderTopColor: INK, paddingTop: 4, width: 180 }}>
                  <Text style={{ fontWeight: 700 }}>Authorized Signature &amp; Chop</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Page footer */}
        <Text style={styles.pageFooter} fixed>
          {SAINS.name}  ·  Private &amp; Confidential  ·  Generated {new Date().toISOString().slice(0, 10)}
        </Text>
        <Text style={styles.pageNum} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
