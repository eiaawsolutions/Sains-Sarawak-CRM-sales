#!/usr/bin/env node
/**
 * One-off: seed a third Sent quotation for negative-path UAT (QUO-AA-008 mandatory attachment).
 * Idempotent — deletes prior rows with this quotation_no first.
 */
import postgres from "postgres";
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }
const sql = postgres(url, { prepare: false });

const [acct] = await sql`SELECT id, organization_name FROM crm.accounts ORDER BY organization_name LIMIT 1`;
const [me]   = await sql`SELECT id, department_id, section_id FROM crm.users WHERE email = 'eiaawsolutions3097@gmail.com' LIMIT 1`;

// Reset if exists
const [prior] = await sql`SELECT id FROM crm.quotations WHERE quotation_no = 'UAT-AA-NOATTACH-001'`;
if (prior) {
  await sql`DELETE FROM crm.quotation_attachments WHERE quotation_id = ${prior.id}`;
  await sql`DELETE FROM crm.quotation_lines WHERE quotation_id = ${prior.id}`;
  await sql`DELETE FROM crm.quotations WHERE id = ${prior.id}`;
}

const [q] = await sql`
  INSERT INTO crm.quotations (
    quotation_no, root_quotation_id, revision_letter,
    account_id, owner_user_id, status_id, quotation_type_id,
    snap_organization_name, snap_country_code, currency,
    subject, quotation_date,
    owner_department_id, owner_section_id,
    submitted_at, approved_at, approved_by_user_id, sent_at,
    subtotal_myr, tax_myr, total_myr
  )
  VALUES (
    'UAT-AA-NOATTACH-001', gen_random_uuid(), 'a',
    ${acct.id}, ${me.id}, 4, 1,
    ${acct.organization_name}, 'MY', 'MYR',
    'UAT mandatory-attachment fixture', CURRENT_DATE,
    ${me.department_id}, ${me.section_id},
    NOW(), NOW(), ${me.id}, NOW(),
    3000, 0, 3000
  )
  RETURNING id
`;
await sql`UPDATE crm.quotations SET root_quotation_id = id WHERE id = ${q.id}`;
await sql`INSERT INTO crm.quotation_lines (quotation_id, line_order, description, quantity, unit_price_myr, tax_pct) VALUES (${q.id}, 1, 'Support tier 1', 1, 3000, 0)`;
console.log("Created UAT-AA-NOATTACH-001 =", q.id);
await sql.end();
