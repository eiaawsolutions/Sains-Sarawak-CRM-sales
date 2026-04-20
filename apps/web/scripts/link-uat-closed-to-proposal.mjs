/**
 * One-shot linker — sets proposal_id on a closed UAT quotation so the
 * Quotation Performance Report shows a populated Proposal column (UAT-QPR-07).
 * Run via: railway run --service web -- node apps/web/scripts/link-uat-closed-to-proposal.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const sql = postgres(url, { ssl: "prefer", max: 1 });

try {
  const [proposal] = await sql`
    SELECT id, proposal_no FROM crm.proposals WHERE proposal_no = 'UAT-PROP-2026-0001' LIMIT 1
  `;
  if (!proposal) {
    console.error("Proposal UAT-PROP-2026-0001 not found — run seed-uat-fixture.ts first.");
    process.exit(1);
  }
  console.log(`[link] Proposal: ${proposal.proposal_no} (${proposal.id})`);

  const [quot] = await sql`
    SELECT id, quotation_no, proposal_id, status_id
    FROM crm.quotations
    WHERE quotation_no = 'UAT-AA-SMALL-001' AND status_id = 5
    LIMIT 1
  `;
  if (!quot) {
    console.error("Closed quotation UAT-AA-SMALL-001 not found.");
    process.exit(1);
  }
  console.log(`[link] Quotation: ${quot.quotation_no} (${quot.id}) current proposal_id=${quot.proposal_id ?? "(null)"}`);

  if (quot.proposal_id === proposal.id) {
    console.log("[link] Already linked — no change.");
  } else {
    await sql`
      UPDATE crm.quotations
      SET proposal_id = ${proposal.id}, updated_at = NOW()
      WHERE id = ${quot.id}
    `;
    console.log(`[link] Linked ${quot.quotation_no} → proposal ${proposal.proposal_no}`);
  }

  const [verify] = await sql`
    SELECT q.quotation_no, p.proposal_no
    FROM crm.quotations q
    LEFT JOIN crm.proposals p ON p.id = q.proposal_id
    WHERE q.id = ${quot.id}
  `;
  console.log(`[verify] ${verify.quotation_no} → ${verify.proposal_no ?? "—"}`);
} finally {
  await sql.end();
}
