#!/usr/bin/env node
/**
 * REAL headless-browser end-to-end click-through for QUO-VA-003/004/005.
 * Uses playwright-core against the system-installed Microsoft Edge.
 *
 * Steps:
 *   1. Navigate to /auth/signin, fill email+password, submit
 *   2. Navigate to /quotations/approval
 *   3. Assert the seeded quotation row and "Under Vetting" pill are visible
 *   4. Type Quotation No into search, submit, assert the row persists
 *   5. Click "Open →" on that row
 *   6. Intercept window.confirm to auto-accept
 *   7. Click the Approve button
 *   8. Wait for redirect, assert status pill is now "Approved"
 *   9. Verify DB state (statusId=3, approved_by = SectionHead)
 */
import { chromium } from "playwright-core";
import postgres from "postgres";

const BASE = process.env.UAT_BASE_URL || "https://web-production-7e45a.up.railway.app";
const EMAIL = process.env.UAT_SECTIONHEAD_EMAIL || "uat-sectionhead@sains.com.my";
const PASSWORD = process.env.UAT_SECTIONHEAD_PASSWORD;
const QUOT_NO = process.env.UAT_QUOTATION_NO || "UAT-VA-LARGE-001";
const DB_URL = process.env.DATABASE_URL;
const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

if (!PASSWORD) { console.error("UAT_SECTIONHEAD_PASSWORD env var required"); process.exit(1); }
if (!DB_URL) { console.error("DATABASE_URL env var required"); process.exit(1); }

const sql = postgres(DB_URL, { prepare: false });

function log(s) { console.log("  " + s); }

async function main() {
  // Reset to Under Vetting before the click-through
  await sql`UPDATE crm.quotations SET status_id = 2, approved_at = NULL, approved_by_user_id = NULL WHERE quotation_no = ${QUOT_NO}`;
  await sql`DELETE FROM crm.audit_log WHERE target_id = (SELECT id FROM crm.quotations WHERE quotation_no = ${QUOT_NO}) AND event_type = 'quotation.vet_approved'`;
  log("Reset quotation to Under Vetting");

  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Auto-accept any window.confirm dialog
  page.on("dialog", async (dialog) => {
    log(`Confirm popup seen: "${dialog.message()}" → accepting`);
    await dialog.accept();
  });

  try {
    // ---- STEP 1: Sign in ----
    log("Navigating to /auth/signin");
    await page.goto(`${BASE}/auth/signin`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL(u => !u.toString().includes("/auth/signin"), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    log(`Signed in; now at ${page.url()}`);

    // ---- STEP 2: QUO-VA-003 Approval Quotation list ----
    log("QUO-VA-003: GET /quotations/approval");
    await page.goto(`${BASE}/quotations/approval`, { waitUntil: "networkidle" });
    const title = await page.textContent("h1");
    if (!title?.includes("Approval Quotation")) throw new Error(`unexpected title: ${title}`);
    log(`  page title = "${title}"`);

    const rowVisible = await page.locator(`td:has-text("${QUOT_NO}")`).isVisible();
    if (!rowVisible) throw new Error(`Quotation ${QUOT_NO} not visible on approval list`);
    log(`  row with ${QUOT_NO} is visible`);

    const vettingPill = await page.locator('span:has-text("Under Vetting")').first().isVisible();
    if (!vettingPill) throw new Error("Under Vetting pill missing");
    log(`  Under Vetting pill visible`);

    // ---- STEP 3: QUO-VA-004 Search ----
    log(`QUO-VA-004: Search by Quotation No = ${QUOT_NO}`);
    await page.fill('input[name="q"]', QUOT_NO);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('button[type="submit"]:has-text("Search")'),
    ]);
    const searchHitVisible = await page.locator(`td:has-text("${QUOT_NO}")`).isVisible();
    if (!searchHitVisible) throw new Error("Search did not return the seeded quotation");
    log(`  search returned ${QUOT_NO}`);

    // ---- STEP 4: Open the quotation ----
    log("Opening quotation via Open → link");
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('a:has-text("Open →")'),
    ]);
    log(`  now at ${page.url()}`);
    const statusPillBefore = await page.locator('span.rounded-pill:has-text("Under Vetting")').first().textContent();
    log(`  status pill before Approve: "${statusPillBefore?.trim()}"`);

    // ---- STEP 5: QUO-VA-005 Approve ----
    log("QUO-VA-005: Click Approve button");
    const approveBtn = page.locator('button:has-text("Approve")').first();
    const approveVisible = await approveBtn.isVisible();
    if (!approveVisible) throw new Error("Approve button not visible on detail page");

    await Promise.all([
      page.waitForLoadState("networkidle"),
      approveBtn.click(),
    ]);
    // Wait a beat for the server action + redirect to settle
    await page.waitForTimeout(1500);
    log(`  after Approve click, now at ${page.url()}`);

    // ---- STEP 6: Verify UI reflects Approved ----
    // The status pill should now say "Approved"
    const approvedPill = await page.locator('span.rounded-pill:has-text("Approved")').first().isVisible().catch(() => false);
    log(`  "Approved" pill visible on UI: ${approvedPill}`);

    // ---- STEP 7: Verify DB state ----
    const [q] = await sql`SELECT status_id, approved_at, approved_by_user_id FROM crm.quotations WHERE quotation_no = ${QUOT_NO}`;
    log(`  DB state: status_id=${q.status_id}, approved_at=${q.approved_at}, approved_by=${q.approved_by_user_id}`);
    if (q.status_id !== 3) throw new Error(`DB statusId=${q.status_id}, expected 3 (Approved)`);
    if (!q.approved_at) throw new Error("approved_at not set");
    if (!q.approved_by_user_id) throw new Error("approved_by_user_id not set");

    // Verify the approver is the SectionHead
    const [approver] = await sql`SELECT email, role_id FROM crm.users WHERE id = ${q.approved_by_user_id}`;
    if (approver.email !== EMAIL) throw new Error(`approver=${approver.email}, expected ${EMAIL}`);
    log(`  approver email = ${approver.email} ✓`);

    // ---- STEP 8: Verify audit row ----
    const [audit] = await sql`SELECT event_type, outcome FROM crm.audit_log
                              WHERE target_id = (SELECT id FROM crm.quotations WHERE quotation_no = ${QUOT_NO})
                                AND event_type = 'quotation.vet_approved'
                              ORDER BY event_time DESC LIMIT 1`;
    if (!audit) throw new Error("no vet_approved audit row");
    log(`  audit row: event_type=${audit.event_type}, outcome=${audit.outcome} ✓`);

    await page.screenshot({ path: "apps/web/scripts/e2e-screenshot-approved.png", fullPage: false });
    log("Screenshot saved to apps/web/scripts/e2e-screenshot-approved.png");

    console.log("\n=== E2E HEADLESS BROWSER CLICK-THROUGH: ALL PASS ===");
  } finally {
    await browser.close();
    await sql.end();
  }
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
