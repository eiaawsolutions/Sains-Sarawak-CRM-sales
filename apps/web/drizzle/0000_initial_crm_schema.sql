CREATE SCHEMA "crm";
--> statement-breakpoint
CREATE TABLE "crm"."account_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"salutation_id" smallint,
	"full_name" varchar(200) NOT NULL,
	"email" varchar(320),
	"mobile" varchar(50),
	"business_phone" varchar(30),
	"fax" varchar(30),
	"designation_id" smallint,
	"profile_img" varchar(500),
	"remark" text,
	"personal_remark" text,
	"status_id" smallint DEFAULT 1 NOT NULL,
	"cmd_last_updated" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cmd_ref_id" uuid,
	"organization_name" varchar(200) NOT NULL,
	"organization_short_name" varchar(200),
	"organization_type_id" smallint,
	"website" varchar(200),
	"office_phone" varchar(30),
	"fax" varchar(30),
	"line_1" varchar(100),
	"line_2" varchar(100),
	"line_3" varchar(100),
	"city" varchar(50),
	"postcode" varchar(10),
	"state_code" char(1),
	"country_code" char(2) DEFAULT 'MY' NOT NULL,
	"remark" text,
	"description" text,
	"match_key" text GENERATED ALWAYS AS (LOWER(TRIM("organization_name"))) STORED,
	"cmd_last_updated" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_cmd_ref_id_unique" UNIQUE("cmd_ref_id")
);
--> statement-breakpoint
CREATE TABLE "crm"."audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "crm"."audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_time" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_user_id" uuid,
	"actor_role_id" integer,
	"actor_ip" varchar(45),
	"actor_user_agent" varchar(512),
	"target_entity" varchar(64),
	"target_id" uuid,
	"before_value" jsonb,
	"after_value" jsonb,
	"outcome" varchar(16) NOT NULL,
	"latency_ms" integer,
	"llm_provider" varchar(32),
	"llm_model" varchar(64),
	"llm_tokens_in" integer,
	"llm_tokens_out" integer,
	"llm_cost_usd" numeric(10, 6),
	"reason" text,
	"correlation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."cmd_webhook_ledger" (
	"idempotency_key" char(64) PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" smallint NOT NULL,
	"attempt_count" smallint DEFAULT 0 NOT NULL,
	"module" varchar(32),
	"sp_key" varchar(32),
	"payload_ref" uuid,
	"resolved_entity" varchar(32),
	"resolved_id" uuid,
	"error_message" text,
	"correlation_id" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."cmd_webhook_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"body_json" text NOT NULL,
	"body_bytes" integer NOT NULL,
	"client_id_header" varchar(128),
	"unix_time_header" varchar(16),
	"signature_header" varchar(128),
	"source_ip" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "crm"."departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."designations" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "designations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crm"."feature_flags" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"is_enabled" boolean NOT NULL,
	"numeric_value" numeric(18, 2),
	"description" varchar(500),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "crm"."fund_sources" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(64) NOT NULL,
	CONSTRAINT "fund_sources_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."lead_statuses" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "lead_statuses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"account_id" uuid,
	"converted_to_account_id" uuid,
	"organization_name" varchar(200) NOT NULL,
	"primary_contact_name" varchar(200),
	"primary_contact_phone" varchar(50),
	"primary_contact_email" varchar(320),
	"source" varchar(100),
	"status_id" smallint NOT NULL,
	"needs_proposal" boolean DEFAULT false NOT NULL,
	"notes" text,
	"owner_department_id" uuid,
	"owner_section_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."my_states" (
	"code" char(1) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "my_states_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crm"."organization_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "organization_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crm"."product_categories" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "product_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."product_sub_categories" (
	"id" smallint PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY (sequence name "crm"."product_sub_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1),
	"category_id" smallint NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" varchar(64) NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"category_id" smallint NOT NULL,
	"sub_category_id" smallint,
	"cost_price_myr" numeric(18, 2),
	"retail_price_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"default_tax_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"allows_child_items" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_product_code_unique" UNIQUE("product_code")
);
--> statement-breakpoint
CREATE TABLE "crm"."proposal_statuses" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "proposal_statuses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"proposal_no" varchar(64) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"status_id" smallint NOT NULL,
	"note" text,
	"converted_quotation_id" uuid,
	"owner_department_id" uuid,
	"owner_section_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_proposal_no_unique" UNIQUE("proposal_no")
);
--> statement-breakpoint
CREATE TABLE "crm"."quotation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"product_id" uuid,
	"parent_line_id" uuid,
	"line_order" smallint NOT NULL,
	"category_id" smallint,
	"sub_category_id" smallint,
	"description" text NOT NULL,
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_amount_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."quotation_sequences" (
	"agent_user_id" uuid PRIMARY KEY NOT NULL,
	"current_volume" integer DEFAULT 1 NOT NULL,
	"next_running_no" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."quotation_statuses" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"is_editable" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "quotation_statuses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."quotation_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "quotation_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_no" varchar(64) NOT NULL,
	"root_quotation_id" uuid NOT NULL,
	"parent_quotation_id" uuid,
	"revision_letter" varchar(4) DEFAULT 'a' NOT NULL,
	"account_id" uuid,
	"lead_id" uuid,
	"proposal_id" uuid,
	"owner_user_id" uuid NOT NULL,
	"status_id" smallint NOT NULL,
	"quotation_type_id" smallint NOT NULL,
	"source_of_fund_id" smallint,
	"snap_organization_name" varchar(200),
	"snap_line_1" varchar(100),
	"snap_line_2" varchar(100),
	"snap_line_3" varchar(100),
	"snap_city" varchar(50),
	"snap_postcode" varchar(10),
	"snap_state_code" char(1),
	"snap_country_code" char(2),
	"snap_phone" varchar(30),
	"snap_fax" varchar(30),
	"currency" char(3) DEFAULT 'MYR' NOT NULL,
	"subtotal_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_myr" numeric(18, 2) DEFAULT '0' NOT NULL,
	"subject" varchar(500),
	"terms_conditions" text,
	"note" text,
	"reference_number" varchar(64),
	"quotation_date" date,
	"valid_until" date,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_via" varchar(16),
	"wot_reference" varchar(256),
	"rejection_reason_id" smallint,
	"rejection_reason_other" varchar(500),
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"returned_at" timestamp with time zone,
	"returned_by_user_id" uuid,
	"returned_notes" text,
	"sent_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"owner_department_id" uuid,
	"owner_section_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_quotation_no_unique" UNIQUE("quotation_no")
);
--> statement-breakpoint
CREATE TABLE "crm"."rejection_reasons" (
	"id" smallint PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(100) NOT NULL,
	"requires_text" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "rejection_reasons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."roles" (
	"id" integer PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "crm"."salutations" (
	"id" smallint PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "salutations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "crm"."sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."uat_test_cases" (
	"test_id" varchar(64) PRIMARY KEY NOT NULL,
	"sheet" varchar(100) NOT NULL,
	"module" varchar(32) NOT NULL,
	"script" varchar(200),
	"ordinal" varchar(8),
	"scenario" varchar(500) NOT NULL,
	"steps" text NOT NULL,
	"expected" text NOT NULL,
	"sains_actual" varchar(24) DEFAULT 'Pending' NOT NULL,
	"sains_remark" text,
	"claritas_remark" text,
	"severity" varchar(16) DEFAULT 'Medium' NOT NULL,
	"executor_type" varchar(32) DEFAULT 'manual' NOT NULL,
	"executor_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."uat_test_results" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "crm"."uat_test_results_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"run_id" uuid NOT NULL,
	"test_id" varchar(64) NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"latency_ms" integer,
	"evidence" text,
	"failure_reason" text,
	"matches_sains" boolean DEFAULT false NOT NULL,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."uat_test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"triggered_by_user_id" uuid,
	"trigger_source" varchar(32) NOT NULL,
	"module_filter" varchar(32),
	"total_cases" integer DEFAULT 0 NOT NULL,
	"pass_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"skip_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"score_pct" numeric(5, 2),
	"status" varchar(16) DEFAULT 'running' NOT NULL,
	"notes" varchar(1000)
);
--> statement-breakpoint
CREATE TABLE "crm"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oidc_sub" varchar(128) NOT NULL,
	"uid" varchar(64),
	"staff_prefix" varchar(16),
	"full_name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"mobile" varchar(50),
	"role_id" integer NOT NULL,
	"department_id" uuid,
	"section_id" uuid,
	"job_title" varchar(200),
	"salutation_id" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub")
);
--> statement-breakpoint
ALTER TABLE "crm"."account_contacts" ADD CONSTRAINT "account_contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."account_contacts" ADD CONSTRAINT "account_contacts_salutation_id_salutations_id_fk" FOREIGN KEY ("salutation_id") REFERENCES "crm"."salutations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."account_contacts" ADD CONSTRAINT "account_contacts_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "crm"."designations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."accounts" ADD CONSTRAINT "accounts_organization_type_id_organization_types_id_fk" FOREIGN KEY ("organization_type_id") REFERENCES "crm"."organization_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."accounts" ADD CONSTRAINT "accounts_state_code_my_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "crm"."my_states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."feature_flags" ADD CONSTRAINT "feature_flags_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_converted_to_account_id_accounts_id_fk" FOREIGN KEY ("converted_to_account_id") REFERENCES "crm"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."leads" ADD CONSTRAINT "leads_status_id_lead_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "crm"."lead_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."product_sub_categories" ADD CONSTRAINT "product_sub_categories_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "crm"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "crm"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."products" ADD CONSTRAINT "products_sub_category_id_product_sub_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "crm"."product_sub_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."proposals" ADD CONSTRAINT "proposals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."proposals" ADD CONSTRAINT "proposals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."proposals" ADD CONSTRAINT "proposals_status_id_proposal_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "crm"."proposal_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotation_lines" ADD CONSTRAINT "quotation_lines_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "crm"."quotations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotation_lines" ADD CONSTRAINT "quotation_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "crm"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotation_lines" ADD CONSTRAINT "quotation_lines_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "crm"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotation_lines" ADD CONSTRAINT "quotation_lines_sub_category_id_product_sub_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "crm"."product_sub_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotation_sequences" ADD CONSTRAINT "quotation_sequences_agent_user_id_users_id_fk" FOREIGN KEY ("agent_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "crm"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "crm"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "crm"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_status_id_quotation_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "crm"."quotation_statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_quotation_type_id_quotation_types_id_fk" FOREIGN KEY ("quotation_type_id") REFERENCES "crm"."quotation_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_source_of_fund_id_fund_sources_id_fk" FOREIGN KEY ("source_of_fund_id") REFERENCES "crm"."fund_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_rejection_reason_id_rejection_reasons_id_fk" FOREIGN KEY ("rejection_reason_id") REFERENCES "crm"."rejection_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."quotations" ADD CONSTRAINT "quotations_returned_by_user_id_users_id_fk" FOREIGN KEY ("returned_by_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sections" ADD CONSTRAINT "sections_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "crm"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."uat_test_results" ADD CONSTRAINT "uat_test_results_run_id_uat_test_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "crm"."uat_test_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."uat_test_results" ADD CONSTRAINT "uat_test_results_test_id_uat_test_cases_test_id_fk" FOREIGN KEY ("test_id") REFERENCES "crm"."uat_test_cases"("test_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."uat_test_runs" ADD CONSTRAINT "uat_test_runs_triggered_by_user_id_users_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "crm"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "crm"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "crm"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."users" ADD CONSTRAINT "users_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "crm"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."users" ADD CONSTRAINT "users_salutation_id_salutations_id_fk" FOREIGN KEY ("salutation_id") REFERENCES "crm"."salutations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_contacts_account_id" ON "crm"."account_contacts" USING btree ("account_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_contacts_email" ON "crm"."account_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ix_accounts_match_key" ON "crm"."accounts" USING btree ("match_key");--> statement-breakpoint
CREATE INDEX "ix_accounts_org_type" ON "crm"."accounts" USING btree ("organization_type_id");--> statement-breakpoint
CREATE INDEX "ix_accounts_state" ON "crm"."accounts" USING btree ("state_code");--> statement-breakpoint
CREATE INDEX "ix_audit_time" ON "crm"."audit_log" USING btree ("event_time");--> statement-breakpoint
CREATE INDEX "ix_audit_actor" ON "crm"."audit_log" USING btree ("actor_user_id","event_time");--> statement-breakpoint
CREATE INDEX "ix_audit_target" ON "crm"."audit_log" USING btree ("target_entity","target_id","event_time");--> statement-breakpoint
CREATE INDEX "ix_audit_correlation" ON "crm"."audit_log" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "ix_audit_event_type" ON "crm"."audit_log" USING btree ("event_type","event_time");--> statement-breakpoint
CREATE INDEX "ix_ledger_status" ON "crm"."cmd_webhook_ledger" USING btree ("status","received_at");--> statement-breakpoint
CREATE INDEX "ix_leads_owner_status" ON "crm"."leads" USING btree ("owner_user_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_leads_section_status" ON "crm"."leads" USING btree ("owner_section_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_leads_organization_name" ON "crm"."leads" USING btree ("organization_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_product_sub_category" ON "crm"."product_sub_categories" USING btree ("category_id","code");--> statement-breakpoint
CREATE INDEX "ix_products_category" ON "crm"."products" USING btree ("category_id","sub_category_id");--> statement-breakpoint
CREATE INDEX "ix_products_name" ON "crm"."products" USING btree ("product_name");--> statement-breakpoint
CREATE INDEX "ix_proposals_lead_id" ON "crm"."proposals" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "ix_proposals_owner" ON "crm"."proposals" USING btree ("owner_user_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_proposals_section" ON "crm"."proposals" USING btree ("owner_section_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_quotation_lines_quotation" ON "crm"."quotation_lines" USING btree ("quotation_id","line_order");--> statement-breakpoint
CREATE INDEX "ix_quotations_owner_status" ON "crm"."quotations" USING btree ("owner_user_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_quotations_section_status" ON "crm"."quotations" USING btree ("owner_section_id","status_id");--> statement-breakpoint
CREATE INDEX "ix_quotations_root" ON "crm"."quotations" USING btree ("root_quotation_id","revision_letter");--> statement-breakpoint
CREATE INDEX "ix_quotations_account" ON "crm"."quotations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ix_quotations_lead" ON "crm"."quotations" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_section" ON "crm"."sections" USING btree ("department_id","code");--> statement-breakpoint
CREATE INDEX "ix_uat_cases_module" ON "crm"."uat_test_cases" USING btree ("module","script");--> statement-breakpoint
CREATE INDEX "ix_uat_results_run" ON "crm"."uat_test_results" USING btree ("run_id","outcome");--> statement-breakpoint
CREATE INDEX "ix_uat_results_test" ON "crm"."uat_test_results" USING btree ("test_id","executed_at");--> statement-breakpoint
CREATE INDEX "ix_uat_runs_started" ON "crm"."uat_test_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "ix_users_email" ON "crm"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ix_users_section" ON "crm"."users" USING btree ("section_id","role_id");