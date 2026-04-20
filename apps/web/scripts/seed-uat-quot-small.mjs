#!/usr/bin/env node
/**
 * Create two UAT fixture quotations on the live Railway DB:
 *   A)  UAT-AA-SMALL   — Draft, 1 line, total = MYR 5,000  (for QUO-AA-001..013 auto-approval → WON)
 *   B)  UAT-AA-REJECT  — Sent,  1 line, total = MYR 4,000  (for QUO-AA-014/015 reject flow)
 *
 * Run via:  railway run node apps/web/scripts/seed-uat-quot-small.mjs
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }

const sql = postgres(url, { prepare: false });

async function main() {
  const [acct] = await sql`SELECT id FROM crm.accounts ORDER BY organization_name LIMIT 1`;
  const [me]   = await sql`SELECT id, department_id, section_id FROM crm.users WHERE email = 'eiaawsolutions3097@gmail.com' LIMIT 1`;
  if (!acct) throw new Error("No account in DB");
  if (!me)   throw new Error("Test user not found");

  async function createQuot({ no, subject, statusId }) {
    const [existing] = await sql`SELECT id FROM crm.quotations WHERE quotation_no = ${no}`;
    if (existing) { console.log(`  already exists: ${no} = ${existing.id}`); return existing.id; }

    const [row] = await sql`
      INSERT INTO crm.quotations (
        quotation_no, root_quotation_id, revision_letter,
        account_id, owner_user_id, status_id, quotation_type_id,
        snap_organization_name, snap_country_code, currency,
        subject, quotation_date,
        owner_department_id, owner_section_id
      )
      VALUES (
        ${no}, gen_random_uuid(), 'a',
        ${acct.id}, ${me.id}, ${statusId}, 1,
        (SELECT organization_name FROM crm.accounts WHERE id = ${acct.id}),
        'MY', 'MYR',
        ${subject}, CURRENT_DATE,
        ${me.department_id}, ${me.section_id}
      )
      RETURNING id
    `;
    // Patch root_quotation_id = id (same-row revision pattern)
    await sql`UPDATE crm.quotations SET root_quotation_id = id WHERE id = ${row.id}`;
    console.log(`  created: ${no} = ${row.id}`);
    return row.id;
  }

  async function addLine(qid, { description, qty, price, taxPct }) {
    const gross = qty * price;
    const tax = gross * taxPct / 100;
    const total = gross + tax;
    await sql`
      INSERT INTO crm.quotation_lines (
        quotation_id, line_order, description, quantity, unit_price_myr, tax_pct
      )
      VALUES (${qid}, 1, ${description}, ${qty}, ${price}, ${taxPct})
    `;
    await sql`
      UPDATE crm.quotations
      SET subtotal_myr = ${gross}, tax_myr = ${tax}, total_myr = ${total}, updated_at = NOW()
      WHERE id = ${qid}
    `;
    console.log(`    line added; total = MYR ${total.toFixed(2)}`);
    return total;
  }

  console.log("Seeding UAT quotations on Railway DB...");
  const qSmall = await createQuot({
    no: "UAT-AA-SMALL-001",
    subject: "UAT auto-approval fixture (under RM10k)",
    statusId: 1,
  });
  // Wipe any prior lines in case we're re-running
  await sql`DELETE FROM crm.quotation_lines WHERE quotation_id = ${qSmall}`;
  await addLine(qSmall, { description: "CRM starter licence - 5 users", qty: 5, price: 1000, taxPct: 0 });

  const qReject = await createQuot({
    no: "UAT-AA-REJECT-001",
    subject: "UAT reject-flow fixture (Sent)",
    statusId: 4, // QuotationSent — so Reject button appears immediately
  });
  await sql`DELETE FROM crm.quotation_lines WHERE quotation_id = ${qReject}`;
  await addLine(qReject, { description: "Annual support subscription - 2 users", qty: 2, price: 2000, taxPct: 0 });
  // Mark it Sent so the Reject button is allowed
  await sql`
    UPDATE crm.quotations
    SET approved_at = NOW(), approved_by_user_id = ${me.id},
        submitted_at = NOW(), sent_at = NOW(),
        status_id = 4
    WHERE id = ${qReject}
  `;

  console.log("Done.");
  console.log(JSON.stringify({ qSmall, qReject }, null, 2));
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
