import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Idempotent post-deploy bootstrapper. Railway does not auto-run `drizzle-kit migrate`;
 * we keep the handful of additive tables introduced after 0000_initial_crm_schema.sql here
 * so the app is self-healing on first request. Safe to call repeatedly — every statement
 * uses IF NOT EXISTS / DO..EXCEPTION guards.
 */
let bootstrapped: Promise<void> | null = null;

export function ensureBootstrapped(): Promise<void> {
  if (!bootstrapped) bootstrapped = run();
  return bootstrapped;
}

async function run(): Promise<void> {
  // 0001 — quotation_attachments (Closed Won proof-of-win docs)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "crm"."quotation_attachments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "quotation_id" uuid NOT NULL,
      "file_name" varchar(255) NOT NULL,
      "mime_type" varchar(100) NOT NULL,
      "size_bytes" integer NOT NULL,
      "content_b64" text NOT NULL,
      "uploaded_by_user_id" uuid NOT NULL,
      "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "crm"."quotation_attachments"
        ADD CONSTRAINT "quotation_attachments_quotation_id_fk"
        FOREIGN KEY ("quotation_id") REFERENCES "crm"."quotations"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "crm"."quotation_attachments"
        ADD CONSTRAINT "quotation_attachments_uploaded_by_user_id_fk"
        FOREIGN KEY ("uploaded_by_user_id") REFERENCES "crm"."users"("id");
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "ix_quotation_attachments_quotation"
      ON "crm"."quotation_attachments" ("quotation_id","uploaded_at")
  `);
}
