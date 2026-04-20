/**
 * Reference-data seeder. Mirrors S0001__reference_data.sql from the archived .NET build.
 * Idempotent — uses ON CONFLICT DO UPDATE. Run via `pnpm db:seed` / `npm run db:seed`.
 */
import { db, schema } from "./index";
import { sql } from "drizzle-orm";

async function upsertBy<T extends Record<string, unknown>>(
  table: typeof schema[keyof typeof schema] & { [k: string]: unknown },
  rows: readonly T[],
  onConflict: string,
) {
  for (const row of rows) {
    // Use raw SQL MERGE-equivalent via Drizzle's `onConflictDoUpdate`
    // Each caller provides rows shaped for its table.
    // Kept inside a helper to keep the seed file clean; see specific calls below.
    throw new Error("use table-specific upsert below");
  }
}

async function main() {
  console.log("🌱 Seeding reference data ...");

  // organization_types (18 values)
  const orgTypes = [
    [3, "Commercial"],[6, "Federal Government"],[9, "State Statutory Bodies"],[12, "Government"],
    [15, "Private"],[18, "Chief Minister's Department"],[21, "State Department"],
    [24, "Government Link Company"],[27, "State Civic Centre"],[30, "State Local Authorities"],
    [31, "Non Government Organisation (NGO)"],[34, "State Ministries"],[37, "Medical"],
    [40, "Resident Office"],[43, "State Government Linked Companies"],[46, "Public"],
    [49, "District Office"],[50, "Ministry"],
  ] as const;
  for (const [id, name] of orgTypes) {
    await db.insert(schema.organizationTypes)
      .values({ id, name })
      .onConflictDoUpdate({ target: schema.organizationTypes.id, set: { name } });
  }

  // salutations (18 values, non-sequential IDs preserved)
  const saluts = [
    [3,"Tuan"],[6,"Puan"],[9,"Cik"],[12,"Dato'"],[15,"Datin"],[18,"Dato' Sri"],[21,"Datin Sri"],
    [24,"Tan Sri"],[27,"Puan Sri"],[30,"Datuk"],[33,"Datuk Seri"],[36,"Tun"],[39,"Toh Puan"],
    [42,"Encik"],[45,"Haji"],[48,"Hajjah"],[51,"Doctor"],[52,"Datu"],
  ] as const;
  for (const [id, name] of saluts) {
    await db.insert(schema.salutations)
      .values({ id, name })
      .onConflictDoUpdate({ target: schema.salutations.id, set: { name } });
  }

  // designations (11 values)
  const desigs = [
    [3,"CEO"],[6,"ACIO"],[9,"Director"],[12,"Staff"],[15,"C-Suite"],[18,"Secretary"],
    [21,"Ketua Bahagian"],[24,"Ketua Penolong Pengarah"],[27,"General Manager"],
    [30,"Head of Department"],[31,"Controller"],
  ] as const;
  for (const [id, name] of desigs) {
    await db.insert(schema.designations)
      .values({ id, name })
      .onConflictDoUpdate({ target: schema.designations.id, set: { name } });
  }

  // MY states
  const states = [
    ["J","Johor"],["K","Kedah"],["D","Kelantan"],["M","Melaka"],["N","Negeri Sembilan"],
    ["C","Pahang"],["P","Penang"],["A","Perak"],["R","Perlis"],["S","Sabah"],["E","Sarawak"],
    ["B","Selangor"],["T","Terengganu"],["U","Wilayah Putrajaya"],["W","WP Kuala Lumpur"],["L","WP Labuan"],
  ] as const;
  for (const [code, name] of states) {
    await db.insert(schema.myStates)
      .values({ code, name })
      .onConflictDoUpdate({ target: schema.myStates.code, set: { name } });
  }

  // quotation_statuses — canonical 6-state per FSD v1.3 §3.2.9
  const qStatuses = [
    [1,"draft","Draft",false,true,1],
    [2,"under_vetting","Under Vetting",false,false,2],
    [3,"approved","Approved",false,false,3],
    [4,"quotation_sent","Quotation Sent",false,false,4],
    [5,"closed","Closed",true,false,5],
    [6,"rejected_expired","Rejected/Expired",true,false,6],
  ] as const;
  for (const [id, code, name, term, edit, sort] of qStatuses) {
    await db.insert(schema.quotationStatuses)
      .values({ id, code, name, isTerminal: term, isEditable: edit, sortOrder: sort })
      .onConflictDoUpdate({
        target: schema.quotationStatuses.id,
        set: { code, name, isTerminal: term, isEditable: edit, sortOrder: sort },
      });
  }

  // quotation_types (5) — FSD §3.2.1
  const qTypes = [
    [1,"new","New Quotation"],[2,"revised","Revised Quotation"],
    [3,"aoq","Quotation with Acceptance of Quotation (AOQ)"],
    [4,"optional_item","Quotation with Optional Item"],
    [5,"proposal_pricing","Proposal Pricing Schedule"],
  ] as const;
  for (const [id, code, name] of qTypes) {
    await db.insert(schema.quotationTypes)
      .values({ id, code, name })
      .onConflictDoUpdate({ target: schema.quotationTypes.id, set: { code, name } });
  }

  // rejection_reasons — FSD §3.2.10
  const rejects = [
    [1,"customer_withdrawal","Customer Withdrawal / Cancelled", false, 1],
    [2,"other_vendor","Other Vendor Preferred", false, 2],
    [3,"budget_constraint","Budget Constraint", false, 3],
    [4,"others","Others", true, 4],
  ] as const;
  for (const [id, code, name, reqText, sort] of rejects) {
    await db.insert(schema.rejectionReasons)
      .values({ id, code, name, requiresText: reqText, sortOrder: sort })
      .onConflictDoUpdate({
        target: schema.rejectionReasons.id,
        set: { code, name, requiresText: reqText, sortOrder: sort },
      });
  }

  // product_categories (4)
  const pCats = [
    [1,"hardware","Hardware"],[2,"software","Software"],
    [3,"subscription","Subscription"],[4,"services","Services"],
  ] as const;
  for (const [id, code, name] of pCats) {
    await db.insert(schema.productCategories)
      .values({ id, code, name })
      .onConflictDoUpdate({ target: schema.productCategories.id, set: { code, name } });
  }

  // product_sub_categories (14) — cascaded per FSD §3.2.2.1
  const pSub = [
    [1,"pc","PC"],[1,"server","Server"],[1,"printer_scanner","Printer/Scanner"],
    [1,"network_switch","Network Switch"],[1,"spare_parts","Spare Parts / Consumable Items"],
    [1,"hw_other","Others"],
    [2,"sw_other","Others"],
    [3,"iaas","Infrastructure-as-a-Service (IaaS)"],[3,"sub_other","Others"],
    [4,"system_dev_install","System Development & Installation"],[4,"implementation","Implementation"],
    [4,"training","Training"],[4,"project_management","Project Management"],[4,"srv_other","Others"],
  ] as const;
  for (const [cat, code, name] of pSub) {
    await db.execute(sql`
      INSERT INTO crm.product_sub_categories (category_id, code, name)
      VALUES (${cat}, ${code}, ${name})
      ON CONFLICT (category_id, code) DO UPDATE SET name = EXCLUDED.name
    `);
  }

  // roles — IDs preserved from SAINS mapping
  const rs = [
    [2949,"Administrator","Administrator","Full system access + config"],
    [2950,"AccountManager","Account Manager","Creates leads, drafts quotations"],
    [2961,"Viewer","Viewer","Read-only permitted scope"],
    [2963,"SectionHead","Section Head","Vets quotations above threshold, section visibility"],
    [2965,"Director","Director","Organisation-wide reporting view"],
    [2966,"UnitHead","Unit Head","Same as AM + unit visibility"],
  ] as const;
  for (const [id, code, name, description] of rs) {
    await db.insert(schema.roles)
      .values({ id, code, name, description })
      .onConflictDoUpdate({ target: schema.roles.id, set: { code, name, description } });
  }

  // fund_sources
  await db.insert(schema.fundSources)
    .values([{ id: 1, code: "scsdu", name: "SCSDU" }, { id: 2, code: "non_scsdu", name: "Non-SCSDU" }])
    .onConflictDoNothing();

  // proposal_statuses
  await db.insert(schema.proposalStatuses)
    .values([
      { id: 1, code: "open", name: "Open", isTerminal: false },
      { id: 2, code: "converted_to_quotation", name: "Converted into Quotation", isTerminal: true },
    ])
    .onConflictDoNothing();

  // lead_statuses
  await db.insert(schema.leadStatuses)
    .values([
      { id: 1, code: "open", name: "Open", isTerminal: false },
      { id: 2, code: "qualified", name: "Qualified", isTerminal: false },
      { id: 3, code: "won", name: "Won", isTerminal: true },
      { id: 4, code: "lost", name: "Lost", isTerminal: true },
    ])
    .onConflictDoNothing();

  // feature flags (kill switches + thresholds)
  const flags = [
    { key: "agents_enabled", isEnabled: false, description: "Master kill switch for v1.1 AI agents" },
    { key: "ai_inference_enabled", isEnabled: false, description: "Allow LLM calls (overrides agents_enabled)" },
    { key: "cmd_webhook_enabled", isEnabled: true, description: "Accept inbound CMD webhook pushes" },
    { key: "email_dispatch_enabled", isEnabled: false, description: "v1.1 Option 1 email sending" },
    { key: "ldap_lookup_enabled", isEnabled: true, description: "Allow server-side LDAP lookups" },
    { key: "quotation_vetting_threshold_myr", isEnabled: true, numericValue: "10000", description: "Amount above which vetting required" },
  ];
  for (const f of flags) {
    await db.insert(schema.featureFlags)
      .values(f)
      .onConflictDoUpdate({
        target: schema.featureFlags.key,
        set: { isEnabled: f.isEnabled, description: f.description, numericValue: (f.numericValue as string | undefined) ?? null },
      });
  }

  console.log("✅ Reference data seeded.");
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
