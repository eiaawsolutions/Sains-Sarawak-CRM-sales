-- Additive migration. Idempotent so it can be re-applied safely on Railway
-- where migrations run via manual `drizzle-kit push` rather than in-order `migrate`.

CREATE TABLE IF NOT EXISTS "crm"."quotation_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_b64" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "crm"."quotation_attachments"
		ADD CONSTRAINT "quotation_attachments_quotation_id_fk"
		FOREIGN KEY ("quotation_id") REFERENCES "crm"."quotations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "crm"."quotation_attachments"
		ADD CONSTRAINT "quotation_attachments_uploaded_by_user_id_fk"
		FOREIGN KEY ("uploaded_by_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_quotation_attachments_quotation"
	ON "crm"."quotation_attachments" USING btree ("quotation_id","uploaded_at");
