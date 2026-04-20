/**
 * Drizzle Postgres schema — port of the MSSQL migrations (V0001–V0013).
 * Every canonical field preserved; IDs and lookups match verbatim so the JSON payloads
 * from SAINS CMD still round-trip unchanged.
 */
import {
  pgTable, pgSchema, uuid, text, varchar, integer, smallint, boolean,
  decimal, timestamp, date, bigint, jsonb, char, primaryKey, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const crm = pgSchema("crm");

// ---------- Lookup tables (IDs preserved from SAINS Integration API v1.2) ----------

export const organizationTypes = crm.table("organization_types", {
  id:         smallint("id").primaryKey(),     // 3,6,9,12,15,18,...,50
  name:       varchar("name", { length: 100 }).notNull().unique(),
  isActive:   boolean("is_active").notNull().default(true),
  sortOrder:  smallint("sort_order").notNull().default(0),
});

export const salutations = crm.table("salutations", {
  id:        smallint("id").primaryKey(),      // 3,6,9,...,52
  name:      varchar("name", { length: 50 }).notNull().unique(),
  isActive:  boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const designations = crm.table("designations", {
  id:        smallint("id").primaryKey(),      // 3,6,9,...,31
  name:      varchar("name", { length: 100 }).notNull().unique(),
  isActive:  boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
});

export const myStates = crm.table("my_states", {
  code:    char("code", { length: 1 }).primaryKey(),    // E=Sarawak, W=KL, ...
  name:    varchar("name", { length: 50 }).notNull().unique(),
  isActive:boolean("is_active").notNull().default(true),
});

export const quotationStatuses = crm.table("quotation_statuses", {
  id:          smallint("id").primaryKey(),     // 1..6
  code:        varchar("code", { length: 32 }).notNull().unique(),
  name:        varchar("name", { length: 64 }).notNull(),
  isTerminal:  boolean("is_terminal").notNull().default(false),
  isEditable:  boolean("is_editable").notNull().default(false),
  sortOrder:   smallint("sort_order").notNull().default(0),
});

export const quotationTypes = crm.table("quotation_types", {
  id:   smallint("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const rejectionReasons = crm.table("rejection_reasons", {
  id:            smallint("id").primaryKey(),
  code:          varchar("code", { length: 32 }).notNull().unique(),
  name:          varchar("name", { length: 100 }).notNull(),
  requiresText:  boolean("requires_text").notNull().default(false),
  isActive:      boolean("is_active").notNull().default(true),
  sortOrder:     smallint("sort_order").notNull().default(0),
});

export const productCategories = crm.table("product_categories", {
  id:       smallint("id").primaryKey(),
  code:     varchar("code", { length: 32 }).notNull().unique(),
  name:     varchar("name", { length: 100 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder:smallint("sort_order").notNull().default(0),
});

export const productSubCategories = crm.table("product_sub_categories", {
  id:          smallint("id").primaryKey().generatedByDefaultAsIdentity(),
  categoryId:  smallint("category_id").notNull().references(() => productCategories.id),
  code:        varchar("code", { length: 64 }).notNull(),
  name:        varchar("name", { length: 100 }).notNull(),
  isActive:    boolean("is_active").notNull().default(true),
  sortOrder:   smallint("sort_order").notNull().default(0),
}, t => ({
  uxCatCode: uniqueIndex("ux_product_sub_category").on(t.categoryId, t.code),
}));

export const roles = crm.table("roles", {
  id:          integer("id").primaryKey(),      // 2949, 2950, 2961, 2963, 2965, 2966
  code:        varchar("code", { length: 32 }).notNull().unique(),
  name:        varchar("name", { length: 64 }).notNull(),
  description: varchar("description", { length: 500 }),
  isActive:    boolean("is_active").notNull().default(true),
  sortOrder:   smallint("sort_order").notNull().default(0),
});

export const fundSources = crm.table("fund_sources", {
  id:   smallint("id").primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 64 }).notNull(),
});

export const proposalStatuses = crm.table("proposal_statuses", {
  id:         smallint("id").primaryKey(),
  code:       varchar("code", { length: 32 }).notNull().unique(),
  name:       varchar("name", { length: 64 }).notNull(),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

export const leadStatuses = crm.table("lead_statuses", {
  id:         smallint("id").primaryKey(),
  code:       varchar("code", { length: 32 }).notNull().unique(),
  name:       varchar("name", { length: 64 }).notNull(),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

export const departments = crm.table("departments", {
  id:       uuid("id").primaryKey().defaultRandom(),
  code:     varchar("code", { length: 32 }).notNull().unique(), // "8-40"
  name:     varchar("name", { length: 200 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const sections = crm.table("sections", {
  id:           uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id").notNull().references(() => departments.id),
  code:         varchar("code", { length: 32 }).notNull(),      // "011"
  name:         varchar("name", { length: 200 }).notNull(),
  isActive:     boolean("is_active").notNull().default(true),
}, t => ({ uxSec: uniqueIndex("ux_section").on(t.departmentId, t.code) }));

// ---------- Users ----------

export const users = crm.table("users", {
  id:            uuid("id").primaryKey().defaultRandom(),
  oidcSub:       varchar("oidc_sub", { length: 128 }).notNull().unique(),
  uid:           varchar("uid", { length: 64 }),
  staffPrefix:   varchar("staff_prefix", { length: 16 }),
  fullName:      varchar("full_name", { length: 200 }).notNull(),
  email:         varchar("email", { length: 320 }).notNull(),
  mobile:        varchar("mobile", { length: 50 }),
  roleId:        integer("role_id").notNull().references(() => roles.id),
  departmentId:  uuid("department_id").references(() => departments.id),
  sectionId:     uuid("section_id").references(() => sections.id),
  jobTitle:      varchar("job_title", { length: 200 }),
  salutationId:  smallint("salutation_id").references(() => salutations.id),
  isActive:      boolean("is_active").notNull().default(true),
  passwordHash:  varchar("password_hash", { length: 100 }),
  lastLoginAt:   timestamp("last_login_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixEmail:   index("ix_users_email").on(t.email),
  ixSection: index("ix_users_section").on(t.sectionId, t.roleId),
}));

export const featureFlags = crm.table("feature_flags", {
  key:         varchar("key", { length: 64 }).primaryKey(),
  isEnabled:   boolean("is_enabled").notNull(),
  numericValue:decimal("numeric_value", { precision: 18, scale: 2 }),
  description: varchar("description", { length: 500 }),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy:   uuid("updated_by_user_id").references(() => users.id),
});

// ---------- Accounts (CMD mirror, read-only writes) ----------

export const accounts = crm.table("accounts", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  cmdRefId:               uuid("cmd_ref_id").unique(),
  organizationName:       varchar("organization_name", { length: 200 }).notNull(),
  organizationShortName:  varchar("organization_short_name", { length: 200 }),
  organizationTypeId:     smallint("organization_type_id").references(() => organizationTypes.id),
  website:                varchar("website", { length: 200 }),
  officePhone:            varchar("office_phone", { length: 30 }),
  fax:                    varchar("fax", { length: 30 }),
  line1:                  varchar("line_1", { length: 100 }),
  line2:                  varchar("line_2", { length: 100 }),
  line3:                  varchar("line_3", { length: 100 }),
  city:                   varchar("city", { length: 50 }),
  postcode:               varchar("postcode", { length: 10 }),
  stateCode:              char("state_code", { length: 1 }).references(() => myStates.code),
  countryCode:            char("country_code", { length: 2 }).notNull().default("MY"),
  remark:                 text("remark"),
  description:            text("description"),
  matchKey:               text("match_key").generatedAlwaysAs(sql`LOWER(TRIM("organization_name"))`, { mode: "stored" }),
  cmdLastUpdated:         timestamp("cmd_last_updated", { withTimezone: true }),
  createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixMatchKey:  index("ix_accounts_match_key").on(t.matchKey),
  ixOrgType:   index("ix_accounts_org_type").on(t.organizationTypeId),
  ixState:     index("ix_accounts_state").on(t.stateCode),
}));

export const accountContacts = crm.table("account_contacts", {
  id:              uuid("id").primaryKey().defaultRandom(),
  accountId:       uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  salutationId:    smallint("salutation_id").references(() => salutations.id),
  fullName:        varchar("full_name", { length: 200 }).notNull(),
  email:           varchar("email", { length: 320 }),
  mobile:          varchar("mobile", { length: 50 }),
  businessPhone:   varchar("business_phone", { length: 30 }),
  fax:             varchar("fax", { length: 30 }),
  designationId:   smallint("designation_id").references(() => designations.id),
  profileImg:      varchar("profile_img", { length: 500 }),
  remark:          text("remark"),
  personalRemark:  text("personal_remark"),
  statusId:        smallint("status_id").notNull().default(1),    // 1=Active, 2=Inactive
  cmdLastUpdated:  timestamp("cmd_last_updated", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixAcct:  index("ix_contacts_account_id").on(t.accountId, t.statusId),
  ixEmail: index("ix_contacts_email").on(t.email),
}));

// ---------- Leads ----------

export const leads = crm.table("leads", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  ownerUserId:           uuid("owner_user_id").notNull().references(() => users.id),
  accountId:             uuid("account_id").references(() => accounts.id),
  convertedToAccountId:  uuid("converted_to_account_id").references(() => accounts.id),  // v1.1 only
  organizationName:      varchar("organization_name", { length: 200 }).notNull(),
  primaryContactName:    varchar("primary_contact_name", { length: 200 }),
  primaryContactPhone:   varchar("primary_contact_phone", { length: 50 }),
  primaryContactEmail:   varchar("primary_contact_email", { length: 320 }),
  source:                varchar("source", { length: 100 }),
  statusId:              smallint("status_id").notNull().references(() => leadStatuses.id),
  needsProposal:         boolean("needs_proposal").notNull().default(false),
  notes:                 text("notes"),
  ownerDepartmentId:     uuid("owner_department_id"),
  ownerSectionId:        uuid("owner_section_id"),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixOwner:    index("ix_leads_owner_status").on(t.ownerUserId, t.statusId),
  ixSection:  index("ix_leads_section_status").on(t.ownerSectionId, t.statusId),
  ixOrgName:  index("ix_leads_organization_name").on(t.organizationName),
}));

// ---------- Proposals ----------

export const proposals = crm.table("proposals", {
  id:                      uuid("id").primaryKey().defaultRandom(),
  leadId:                  uuid("lead_id").notNull().references(() => leads.id),
  ownerUserId:             uuid("owner_user_id").notNull().references(() => users.id),
  proposalNo:              varchar("proposal_no", { length: 64 }).notNull().unique(),
  subject:                 varchar("subject", { length: 500 }).notNull(),
  statusId:                smallint("status_id").notNull().references(() => proposalStatuses.id),
  note:                    text("note"),
  convertedQuotationId:    uuid("converted_quotation_id"),
  ownerDepartmentId:       uuid("owner_department_id"),
  ownerSectionId:          uuid("owner_section_id"),
  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixLead:    index("ix_proposals_lead_id").on(t.leadId),
  ixOwner:   index("ix_proposals_owner").on(t.ownerUserId, t.statusId),
  ixSection: index("ix_proposals_section").on(t.ownerSectionId, t.statusId),
}));

// ---------- Products ----------

export const products = crm.table("products", {
  id:                uuid("id").primaryKey().defaultRandom(),
  productCode:       varchar("product_code", { length: 64 }).notNull().unique(),
  productName:       varchar("product_name", { length: 200 }).notNull(),
  categoryId:        smallint("category_id").notNull().references(() => productCategories.id),
  subCategoryId:     smallint("sub_category_id").references(() => productSubCategories.id),
  costPrice:         decimal("cost_price_myr", { precision: 18, scale: 2 }),
  retailPrice:       decimal("retail_price_myr", { precision: 18, scale: 2 }).notNull().default("0"),
  defaultTaxPct:     decimal("default_tax_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  description:       text("description"),
  allowsChildItems:  boolean("allows_child_items").notNull().default(false),
  isActive:          boolean("is_active").notNull().default(true),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixCat:  index("ix_products_category").on(t.categoryId, t.subCategoryId),
  ixName: index("ix_products_name").on(t.productName),
}));

// ---------- Quotations (same-row revision per FSD §3.2.3/§3.2.9 #1) ----------

export const quotationSequences = crm.table("quotation_sequences", {
  agentUserId:      uuid("agent_user_id").primaryKey().references(() => users.id),
  currentVolume:    integer("current_volume").notNull().default(1),
  nextRunningNo:    integer("next_running_no").notNull().default(1),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotations = crm.table("quotations", {
  id:                      uuid("id").primaryKey().defaultRandom(),
  quotationNo:             varchar("quotation_no", { length: 64 }).notNull().unique(),
  rootQuotationId:         uuid("root_quotation_id").notNull(),  // self on first version
  parentQuotationId:       uuid("parent_quotation_id"),
  revisionLetter:          varchar("revision_letter", { length: 4 }).notNull().default("a"),

  accountId:               uuid("account_id").references(() => accounts.id),
  leadId:                  uuid("lead_id").references(() => leads.id),
  proposalId:              uuid("proposal_id").references(() => proposals.id),
  ownerUserId:             uuid("owner_user_id").notNull().references(() => users.id),
  statusId:                smallint("status_id").notNull().references(() => quotationStatuses.id),
  typeId:                  smallint("quotation_type_id").notNull().references(() => quotationTypes.id),
  sourceOfFundId:          smallint("source_of_fund_id").references(() => fundSources.id),

  // address snapshot at quote time
  snapOrganizationName:    varchar("snap_organization_name", { length: 200 }),
  snapLine1:               varchar("snap_line_1", { length: 100 }),
  snapLine2:               varchar("snap_line_2", { length: 100 }),
  snapLine3:               varchar("snap_line_3", { length: 100 }),
  snapCity:                varchar("snap_city", { length: 50 }),
  snapPostcode:            varchar("snap_postcode", { length: 10 }),
  snapStateCode:           char("snap_state_code", { length: 1 }),
  snapCountryCode:         char("snap_country_code", { length: 2 }),
  snapPhone:               varchar("snap_phone", { length: 30 }),
  snapFax:                 varchar("snap_fax", { length: 30 }),

  currency:                char("currency", { length: 3 }).notNull().default("MYR"),
  subtotalMyr:             decimal("subtotal_myr", { precision: 18, scale: 2 }).notNull().default("0"),
  discountMyr:             decimal("discount_myr", { precision: 18, scale: 2 }).notNull().default("0"),
  taxMyr:                  decimal("tax_myr", { precision: 18, scale: 2 }).notNull().default("0"),
  totalMyr:                decimal("total_myr", { precision: 18, scale: 2 }).notNull().default("0"),

  subject:                 varchar("subject", { length: 500 }),
  termsConditions:         text("terms_conditions"),
  note:                    text("note"),
  referenceNumber:         varchar("reference_number", { length: 64 }),
  quotationDate:           date("quotation_date"),
  validUntil:              date("valid_until"),

  isAccepted:              boolean("is_accepted").notNull().default(false),
  acceptedAt:              timestamp("accepted_at", { withTimezone: true }),
  acceptedVia:             varchar("accepted_via", { length: 16 }),
  wotReference:            varchar("wot_reference", { length: 256 }),

  rejectionReasonId:       smallint("rejection_reason_id").references(() => rejectionReasons.id),
  rejectionReasonOther:    varchar("rejection_reason_other", { length: 500 }),

  submittedAt:             timestamp("submitted_at", { withTimezone: true }),
  approvedAt:              timestamp("approved_at", { withTimezone: true }),
  approvedByUserId:        uuid("approved_by_user_id").references(() => users.id),
  returnedAt:              timestamp("returned_at", { withTimezone: true }),
  returnedByUserId:        uuid("returned_by_user_id").references(() => users.id),
  returnedNotes:           text("returned_notes"),
  sentAt:                  timestamp("sent_at", { withTimezone: true }),
  closedAt:                timestamp("closed_at", { withTimezone: true }),

  ownerDepartmentId:       uuid("owner_department_id"),
  ownerSectionId:          uuid("owner_section_id"),

  createdAt:               timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixOwnerStatus:    index("ix_quotations_owner_status").on(t.ownerUserId, t.statusId),
  ixSectionStatus:  index("ix_quotations_section_status").on(t.ownerSectionId, t.statusId),
  ixRoot:           index("ix_quotations_root").on(t.rootQuotationId, t.revisionLetter),
  ixAccount:        index("ix_quotations_account").on(t.accountId),
  ixLead:           index("ix_quotations_lead").on(t.leadId),
}));

export const quotationLines = crm.table("quotation_lines", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  quotationId:         uuid("quotation_id").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  productId:           uuid("product_id").references(() => products.id),
  parentLineId:        uuid("parent_line_id"),
  lineOrder:           smallint("line_order").notNull(),
  categoryId:          smallint("category_id").references(() => productCategories.id),
  subCategoryId:       smallint("sub_category_id").references(() => productSubCategories.id),
  description:         text("description").notNull(),
  quantity:            decimal("quantity", { precision: 18, scale: 4 }).notNull().default("1"),
  unitPriceMyr:        decimal("unit_price_myr", { precision: 18, scale: 2 }).notNull().default("0"),
  discountAmountMyr:   decimal("discount_amount_myr", { precision: 18, scale: 2 }).notNull().default("0"),
  taxPct:              decimal("tax_pct", { precision: 5, scale: 2 }).notNull().default("0"),
  isOptional:          boolean("is_optional").notNull().default(false),
}, t => ({
  ixQuot: index("ix_quotation_lines_quotation").on(t.quotationId, t.lineOrder),
}));

// ---------- Webhook ledger + audit log ----------

export const cmdWebhookLedger = crm.table("cmd_webhook_ledger", {
  idempotencyKey:  char("idempotency_key", { length: 64 }).primaryKey(),
  receivedAt:      timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt:     timestamp("processed_at", { withTimezone: true }),
  status:          smallint("status").notNull(),         // 1 Pending, 2 Processed, 3 Failed, 4 DeadLetter
  attemptCount:    smallint("attempt_count").notNull().default(0),
  module:          varchar("module", { length: 32 }),
  spKey:           varchar("sp_key", { length: 32 }),
  payloadRef:      uuid("payload_ref"),
  resolvedEntity:  varchar("resolved_entity", { length: 32 }),
  resolvedId:      uuid("resolved_id"),
  errorMessage:    text("error_message"),
  correlationId:   uuid("correlation_id"),
}, t => ({
  ixStatus: index("ix_ledger_status").on(t.status, t.receivedAt),
}));

export const cmdWebhookPayloads = crm.table("cmd_webhook_payloads", {
  id:               uuid("id").primaryKey().defaultRandom(),
  receivedAt:       timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  bodyJson:         text("body_json").notNull(),
  bodyBytes:        integer("body_bytes").notNull(),
  clientIdHeader:   varchar("client_id_header", { length: 128 }),
  unixTimeHeader:   varchar("unix_time_header", { length: 16 }),
  signatureHeader:  varchar("signature_header", { length: 128 }),
  sourceIp:         varchar("source_ip", { length: 45 }),
});

export const auditLog = crm.table("audit_log", {
  id:              bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  eventTime:       timestamp("event_time", { withTimezone: true }).notNull().defaultNow(),
  eventType:       varchar("event_type", { length: 64 }).notNull(),
  actorUserId:     uuid("actor_user_id"),
  actorRoleId:     integer("actor_role_id"),
  actorIp:         varchar("actor_ip", { length: 45 }),
  actorUserAgent:  varchar("actor_user_agent", { length: 512 }),
  targetEntity:    varchar("target_entity", { length: 64 }),
  targetId:        uuid("target_id"),
  beforeValue:     jsonb("before_value"),
  afterValue:      jsonb("after_value"),
  outcome:         varchar("outcome", { length: 16 }).notNull(),
  latencyMs:       integer("latency_ms"),
  llmProvider:     varchar("llm_provider", { length: 32 }),
  llmModel:        varchar("llm_model", { length: 64 }),
  llmTokensIn:     integer("llm_tokens_in"),
  llmTokensOut:    integer("llm_tokens_out"),
  llmCostUsd:      decimal("llm_cost_usd", { precision: 10, scale: 6 }),
  reason:          text("reason"),
  correlationId:   uuid("correlation_id"),
}, t => ({
  ixTime:   index("ix_audit_time").on(t.eventTime),
  ixActor:  index("ix_audit_actor").on(t.actorUserId, t.eventTime),
  ixTarget: index("ix_audit_target").on(t.targetEntity, t.targetId, t.eventTime),
  ixCorr:   index("ix_audit_correlation").on(t.correlationId),
  ixType:   index("ix_audit_event_type").on(t.eventType, t.eventTime),
}));

// ---------- UAT harness (179 cases, auto-scored) ----------

export const uatTestCases = crm.table("uat_test_cases", {
  testId:          varchar("test_id", { length: 64 }).primaryKey(),
  sheet:           varchar("sheet", { length: 100 }).notNull(),
  module:          varchar("module", { length: 32 }).notNull(),
  script:          varchar("script", { length: 200 }),
  ordinal:         varchar("ordinal", { length: 8 }),
  scenario:        varchar("scenario", { length: 500 }).notNull(),
  steps:           text("steps").notNull(),
  expected:        text("expected").notNull(),
  sainsActual:     varchar("sains_actual", { length: 24 }).notNull().default("Pending"),
  sainsRemark:     text("sains_remark"),
  claritasRemark:  text("claritas_remark"),
  severity:        varchar("severity", { length: 16 }).notNull().default("Medium"),
  executorType:    varchar("executor_type", { length: 32 }).notNull().default("manual"),
  executorConfig:  jsonb("executor_config"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixModule: index("ix_uat_cases_module").on(t.module, t.script),
}));

export const uatTestRuns = crm.table("uat_test_runs", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  startedAt:           timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:         timestamp("completed_at", { withTimezone: true }),
  triggeredByUserId:   uuid("triggered_by_user_id").references(() => users.id),
  triggerSource:       varchar("trigger_source", { length: 32 }).notNull(),
  moduleFilter:        varchar("module_filter", { length: 32 }),
  totalCases:          integer("total_cases").notNull().default(0),
  passCount:           integer("pass_count").notNull().default(0),
  failCount:           integer("fail_count").notNull().default(0),
  skipCount:           integer("skip_count").notNull().default(0),
  errorCount:          integer("error_count").notNull().default(0),
  scorePct:            decimal("score_pct", { precision: 5, scale: 2 }),
  status:              varchar("status", { length: 16 }).notNull().default("running"),
  notes:               varchar("notes", { length: 1000 }),
}, t => ({
  ixStarted: index("ix_uat_runs_started").on(t.startedAt),
}));

export const uatTestResults = crm.table("uat_test_results", {
  id:             bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  runId:          uuid("run_id").notNull().references(() => uatTestRuns.id, { onDelete: "cascade" }),
  testId:         varchar("test_id", { length: 64 }).notNull().references(() => uatTestCases.testId),
  outcome:        varchar("outcome", { length: 16 }).notNull(),
  latencyMs:      integer("latency_ms"),
  evidence:       text("evidence"),
  failureReason:  text("failure_reason"),
  matchesSains:   boolean("matches_sains").notNull().default(false),
  executedAt:     timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  ixRun:  index("ix_uat_results_run").on(t.runId, t.outcome),
  ixTest: index("ix_uat_results_test").on(t.testId, t.executedAt),
}));
