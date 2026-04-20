/**
 * UAT fixture — seeds:
 *   - one sample Account Manager user (for re-assignment tests)
 *   - one account (with two contacts)
 *   - one lead, one proposal, one quotation (with 2 lines)
 * Idempotent: re-runs overwrite the same fixture records by synthetic refs.
 */
import { db, schema } from "./index";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "eiaawsolutions3097@gmail.com";
const AM_EMAIL = process.env.AM_EMAIL ?? "uat-am@sains.local";
const AM_PASSWORD = process.env.AM_PASSWORD ?? "AccountMgr!2026";
const FIXTURE_CMD_REF_ID = "00000000-0000-0000-0000-000000000aaa";
const FIXTURE_QUOTATION_NO = "UAT-QTN-2026-0001";
const FIXTURE_PROPOSAL_NO = "UAT-PROP-2026-0001";
const ROLE_AM = 2950;

async function main() {
  const owner = await db.query.users.findFirst({ where: eq(schema.users.email, TEST_EMAIL) });
  if (!owner) throw new Error(`Test user ${TEST_EMAIL} missing; run db:seed:test-user first.`);

  // ---------- Account Manager user for re-assignment ----------
  const amHash = await bcrypt.hash(AM_PASSWORD, 10);
  const existingAM = await db.query.users.findFirst({ where: eq(schema.users.email, AM_EMAIL) });
  if (!existingAM) {
    await db.insert(schema.users).values({
      oidcSub: `credentials:${AM_EMAIL}`,
      fullName: "UAT Account Manager",
      email: AM_EMAIL,
      roleId: ROLE_AM,
      isActive: true,
      passwordHash: amHash,
    });
    console.log(`[fixture] Created Account Manager user ${AM_EMAIL}`);
  } else {
    await db.update(schema.users)
      .set({ passwordHash: amHash, isActive: true, roleId: ROLE_AM, updatedAt: new Date() })
      .where(eq(schema.users.id, existingAM.id));
    console.log(`[fixture] Updated Account Manager user ${AM_EMAIL}`);
  }

  // ---------- Account ----------
  let account = await db.query.accounts.findFirst({
    where: eq(schema.accounts.cmdRefId, FIXTURE_CMD_REF_ID),
  });
  if (!account) {
    const [row] = await db.insert(schema.accounts).values({
      cmdRefId: FIXTURE_CMD_REF_ID,
      organizationName: "Sarawak Energy Berhad",
      organizationShortName: "SEB",
      organizationTypeId: 3,
      website: "https://www.sarawakenergy.com",
      officePhone: "+60 82 388 388",
      fax: "+60 82 341 063",
      line1: "Menara Sarawak Energy",
      line2: "No. 1, The Isthmus",
      line3: "",
      city: "Kuching",
      postcode: "93050",
      stateCode: "E",
      countryCode: "MY",
      description: "Integrated power utility serving Sarawak.",
      cmdLastUpdated: new Date(),
    }).returning();
    account = row;
    console.log(`[fixture] Created account ${account.organizationName} (${account.id})`);
  } else {
    console.log(`[fixture] Reusing account ${account.organizationName} (${account.id})`);
  }

  // ---------- Contacts ----------
  const existingContacts = await db.select().from(schema.accountContacts)
    .where(eq(schema.accountContacts.accountId, account.id));
  if (existingContacts.length === 0) {
    await db.insert(schema.accountContacts).values([
      {
        accountId: account.id,
        salutationId: 3,
        fullName: "Datu Sharbini Suhaili",
        email: "sharbini@sarawakenergy.com",
        mobile: "+60 19 888 1234",
        businessPhone: "+60 82 388 101",
        designationId: 3,
        statusId: 1,
        cmdLastUpdated: new Date(),
      },
      {
        accountId: account.id,
        salutationId: 6,
        fullName: "Tan Mei Ling",
        email: "meiling@sarawakenergy.com",
        mobile: "+60 17 555 7788",
        businessPhone: "+60 82 388 202",
        designationId: 6,
        statusId: 1,
        cmdLastUpdated: new Date(),
      },
    ]);
    console.log("[fixture] Inserted 2 contacts");
  } else {
    console.log(`[fixture] Reusing ${existingContacts.length} existing contacts`);
  }

  // ---------- Lead ----------
  let lead = await db.query.leads.findFirst({
    where: eq(schema.leads.accountId, account.id),
  });
  if (!lead) {
    const [row] = await db.insert(schema.leads).values({
      ownerUserId: owner.id,
      accountId: account.id,
      organizationName: account.organizationName,
      primaryContactName: "Datu Sharbini Suhaili",
      primaryContactPhone: "+60 19 888 1234",
      primaryContactEmail: "sharbini@sarawakenergy.com",
      source: "Meeting",
      statusId: 1,
      needsProposal: true,
      notes: "Interest in CRM expansion for regional ops.",
    }).returning();
    lead = row;
    console.log(`[fixture] Created lead ${lead.id}`);
  } else {
    console.log(`[fixture] Reusing lead ${lead.id}`);
  }

  // ---------- Proposal ----------
  let proposal = await db.query.proposals.findFirst({
    where: eq(schema.proposals.proposalNo, FIXTURE_PROPOSAL_NO),
  });
  if (!proposal) {
    const [row] = await db.insert(schema.proposals).values({
      leadId: lead.id,
      ownerUserId: owner.id,
      proposalNo: FIXTURE_PROPOSAL_NO,
      subject: "CRM Regional Rollout Proposal",
      statusId: 1,
      note: "Baseline proposal for SEB regional CRM rollout.",
    }).returning();
    proposal = row;
    console.log(`[fixture] Created proposal ${proposal.proposalNo}`);
  } else {
    console.log(`[fixture] Reusing proposal ${proposal.proposalNo}`);
  }

  // ---------- Quotation ----------
  const existingQ = await db.query.quotations.findFirst({
    where: eq(schema.quotations.quotationNo, FIXTURE_QUOTATION_NO),
  });
  if (!existingQ) {
    const newId = crypto.randomUUID();
    await db.insert(schema.quotations).values({
      id: newId,
      quotationNo: FIXTURE_QUOTATION_NO,
      rootQuotationId: newId,
      revisionLetter: "a",
      accountId: account.id,
      leadId: lead.id,
      proposalId: proposal.id,
      ownerUserId: owner.id,
      statusId: 1,
      typeId: 1,
      subject: "CRM Regional Rollout - Phase 1",
      snapOrganizationName: account.organizationName,
      snapLine1: account.line1,
      snapLine2: account.line2,
      snapCity: account.city,
      snapPostcode: account.postcode,
      snapStateCode: account.stateCode,
      snapCountryCode: account.countryCode,
      snapPhone: account.officePhone,
      subtotalMyr: "50000.00",
      taxMyr: "4000.00",
      totalMyr: "54000.00",
      quotationDate: new Date().toISOString().slice(0, 10),
    });
    await db.insert(schema.quotationLines).values([
      {
        quotationId: newId,
        lineOrder: 1,
        description: "CRM Professional Edition - 50 user licences",
        quantity: "50",
        unitPriceMyr: "800.00",
        taxPct: "8.00",
      },
      {
        quotationId: newId,
        lineOrder: 2,
        description: "Implementation & training services",
        quantity: "1",
        unitPriceMyr: "10000.00",
        taxPct: "8.00",
      },
    ]);
    console.log(`[fixture] Created quotation ${FIXTURE_QUOTATION_NO}`);
  } else {
    console.log(`[fixture] Reusing quotation ${FIXTURE_QUOTATION_NO}`);
  }

  console.log("[fixture] Done.");
  process.exit(0);
}

main().catch(err => { console.error("[fixture] FAILED:", err); process.exit(1); });
