#!/usr/bin/env node
/**
 * Seed for QUO-VA-003/004/005 end-to-end click-through test:
 *   1. SectionHead user with bcrypt password (email = uat-sectionhead@sains.com.my, pw = UatSectionHead!2026)
 *   2. AccountManager owner user (reuse existing if present) + ≥RM10,000 draft quotation
 *   3. Submit the quotation so its statusId becomes 2 (Under Vetting) — visible on the approval list
 *
 * Required env: DATABASE_URL, UAT_SECTIONHEAD_PASSWORD
 * Optional env: UAT_SECTIONHEAD_EMAIL, UAT_OWNER_EMAIL, UAT_QUOTATION_NO
 *
 * Run via: railway run --service web -- node apps/web/scripts/seed-uat-section-head.mjs
 */
import postgres from "postgres";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL missing"); process.exit(1); }

const sql = postgres(url, { prepare: false });

const SECTION_HEAD_EMAIL = process.env.UAT_SECTIONHEAD_EMAIL || "uat-sectionhead@sains.com.my";
const SECTION_HEAD_PASSWORD = process.env.UAT_SECTIONHEAD_PASSWORD;
const OWNER_EMAIL = process.env.UAT_OWNER_EMAIL || "eiaawsolutions3097@gmail.com";
const QUOT_NO = process.env.UAT_QUOTATION_NO || "UAT-VA-LARGE-001";

if (!SECTION_HEAD_PASSWORD) { console.error("UAT_SECTIONHEAD_PASSWORD env var required"); process.exit(1); }

async function main() {
  console.log("=== Seeding SectionHead + ≥RM10k quotation under vetting ===");

  const roles = await sql`SELECT id, code FROM crm.roles WHERE code IN ('SectionHead','AccountManager','Administrator') ORDER BY code`;
  console.log("Roles in DB:", roles.map(r => `${r.code}=${r.id}`).join(", "));
  const sectionHeadRole = roles.find(r => r.code === "SectionHead");
  if (!sectionHeadRole) throw new Error("No SectionHead role in crm.roles");

  // 1) Upsert SectionHead user
  const pwHash = await bcrypt.hash(SECTION_HEAD_PASSWORD, 10);
  const [existingSh] = await sql`SELECT id FROM crm.users WHERE email = ${SECTION_HEAD_EMAIL}`;
  let shId;
  if (existingSh) {
    await sql`UPDATE crm.users SET password_hash = ${pwHash}, role_id = ${sectionHeadRole.id}, is_active = true WHERE id = ${existingSh.id}`;
    shId = existingSh.id;
    console.log(`  updated SectionHead: ${SECTION_HEAD_EMAIL} (id=${shId})`);
  } else {
    const [row] = await sql`
      INSERT INTO crm.users (oidc_sub, email, full_name, password_hash, role_id, is_active)
      VALUES (${'uat-sectionhead'}, ${SECTION_HEAD_EMAIL}, 'UAT Section Head', ${pwHash}, ${sectionHeadRole.id}, true)
      RETURNING id
    `;
    shId = row.id;
    console.log(`  created SectionHead: ${SECTION_HEAD_EMAIL} (id=${shId})`);
  }

  // 2) Verify owner account manager exists
  const [owner] = await sql`SELECT id, department_id, section_id FROM crm.users WHERE email = ${OWNER_EMAIL} LIMIT 1`;
  if (!owner) throw new Error(`Owner user ${OWNER_EMAIL} not found — run the main UAT seed first`);

  const [acct] = await sql`SELECT id, organization_name FROM crm.accounts ORDER BY organization_name LIMIT 1`;
  if (!acct) throw new Error("No account in DB");

  // 3) Create ≥RM10,000 quotation, then SUBMIT it so it lands in Under Vetting (statusId=2)
  const [existing] = await sql`SELECT id FROM crm.quotations WHERE quotation_no = ${QUOT_NO}`;
  let quotId;
  if (existing) {
    quotId = existing.id;
    console.log(`  quotation exists: ${QUOT_NO} = ${quotId} — refreshing lines + status`);
    await sql`DELETE FROM crm.quotation_lines WHERE quotation_id = ${quotId}`;
  } else {
    const [row] = await sql`
      INSERT INTO crm.quotations (
        quotation_no, root_quotation_id, revision_letter,
        account_id, owner_user_id, status_id, quotation_type_id,
        snap_organization_name, snap_country_code, currency,
        subject, quotation_date,
        owner_department_id, owner_section_id
      )
      VALUES (
        ${QUOT_NO}, gen_random_uuid(), 'a',
        ${acct.id}, ${owner.id}, 1, 1,
        ${acct.organization_name}, 'MY', 'MYR',
        'UAT Section Head vetting fixture (RM15,000)', CURRENT_DATE,
        ${owner.department_id}, ${owner.section_id}
      )
      RETURNING id
    `;
    quotId = row.id;
    await sql`UPDATE crm.quotations SET root_quotation_id = id WHERE id = ${quotId}`;
    console.log(`  created quotation: ${QUOT_NO} = ${quotId}`);
  }

  // Line: 15 × 1000 = RM15,000 (≥ RM10,000 threshold → will go to Under Vetting on submit)
  const qty = 15, price = 1000, taxPct = 0;
  const total = qty * price;
  await sql`
    INSERT INTO crm.quotation_lines (quotation_id, line_order, description, quantity, unit_price_myr, tax_pct)
    VALUES (${quotId}, 1, 'CRM enterprise licence - 15 users', ${qty}, ${price}, ${taxPct})
  `;
  // Move to Under Vetting directly (equivalent to submitting ≥ RM10k)
  await sql`
    UPDATE crm.quotations
    SET subtotal_myr = ${total}, tax_myr = 0, total_myr = ${total},
        status_id = 2, submitted_at = NOW(), updated_at = NOW()
    WHERE id = ${quotId}
  `;
  console.log(`  quotation status → Under Vetting (statusId=2), total = RM ${total.toFixed(2)}`);

  // Audit trail entry matching the server action
  await sql`
    INSERT INTO crm.audit_log (
      event_type, actor_user_id, actor_role_id, target_entity, target_id,
      before_value, after_value, outcome, reason
    )
    VALUES (
      'quotation.submit.under_vetting', ${owner.id}, (SELECT role_id FROM crm.users WHERE id = ${owner.id}),
      'quotation', ${quotId},
      ${sql.json({ status: 1 })}, ${sql.json({ status: 2, total })},
      'success', ${'seeded by seed-uat-section-head.mjs'}
    )
  `;

  console.log("=== Done ===");
  console.log(JSON.stringify({
    section_head_email: SECTION_HEAD_EMAIL,
    section_head_password: SECTION_HEAD_PASSWORD,
    section_head_id: shId,
    quotation_no: QUOT_NO,
    quotation_id: quotId,
    total_myr: total,
  }, null, 2));

  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
