/**
 * One-shot seeder — adds password_hash column if missing and creates/updates the
 * UAT test user. Idempotent. Runs via `railway run -- tsx src/db/seed-test-user.ts`.
 */
import { db, schema } from "./index";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "eiaawsolutions3097@gmail.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Passw0rd!CRM";
const ROLE_ADMIN = 2949;

async function main() {
  console.log("[seed] Adding password_hash column if missing…");
  await db.execute(sql`
    ALTER TABLE crm.users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100)
  `);

  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, TEST_EMAIL),
  });

  if (existing) {
    await db.update(schema.users)
      .set({ passwordHash: hash, isActive: true, roleId: ROLE_ADMIN, updatedAt: new Date() })
      .where(eq(schema.users.id, existing.id));
    console.log(`[seed] Updated existing user ${TEST_EMAIL} (role=Administrator, active=true)`);
  } else {
    await db.insert(schema.users).values({
      oidcSub: `credentials:${TEST_EMAIL}`,
      fullName: "UAT Test User",
      email: TEST_EMAIL,
      roleId: ROLE_ADMIN,
      isActive: true,
      passwordHash: hash,
    });
    console.log(`[seed] Created user ${TEST_EMAIL} (role=Administrator)`);
  }

  console.log(`[seed] Password: ${TEST_PASSWORD}`);
  console.log("[seed] Done.");
  process.exit(0);
}

main().catch(err => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
