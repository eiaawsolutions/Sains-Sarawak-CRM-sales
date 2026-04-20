/**
 * Inngest functions — the TS-native equivalent of the .NET Hangfire jobs in the archive.
 * Every job here is durable, retried automatically, and visible in the Inngest dashboard.
 */
import { inngest } from "./client";
import { db, schema } from "@/db";
import { eq, and } from "drizzle-orm";
import { runHarness } from "@/uat/runner";

// ---------- CMD webhook processor ----------

export const processCmdWebhook = inngest.createFunction(
  { id: "cmd-webhook-process", retries: 5 },
  { event: "cmd/webhook.received" },
  async ({ event, step }) => {
    const { idempotencyKey } = event.data;

    const payload = await step.run("load-payload", async () => {
      const ledger = await db.query.cmdWebhookLedger.findFirst({
        where: eq(schema.cmdWebhookLedger.idempotencyKey, idempotencyKey),
      });
      if (!ledger?.payloadRef) throw new Error("payload_ref missing");
      const p = await db.query.cmdWebhookPayloads.findFirst({
        where: eq(schema.cmdWebhookPayloads.id, ledger.payloadRef),
      });
      return p?.bodyJson;
    });

    if (!payload) throw new Error("payload body missing");

    const envelope = JSON.parse(payload) as {
      Module?: string; SpKey?: string; data?: Record<string, unknown>;
    };

    if (envelope.Module !== "Account" || envelope.SpKey !== "LeadData") {
      await markFailed(idempotencyKey, "Unsupported Module/SpKey");
      return { skipped: true };
    }

    const d = envelope.data ?? {};
    const orgName = String(d.organization_name ?? "").trim();
    const matchKey = orgName.toLowerCase();

    const resolvedId = await step.run("upsert-account", async () => {
      const existing = await db.query.accounts.findFirst({
        where: eq(schema.accounts.matchKey, matchKey),
        with: { contacts: true },
      });

      const addr = (d.address ?? {}) as Record<string, unknown>;
      const base = {
        organizationName: orgName,
        organizationShortName: (d.organization_short_name as string) ?? null,
        organizationTypeId: (d.organization_type as number) ?? null,
        website: (d.website as string) ?? null,
        officePhone: (d.office_phone as string) ?? null,
        fax: (d.fax as string) ?? null,
        line1: (addr.line_1 as string) ?? null,
        line2: (addr.line_2 as string) ?? null,
        line3: (addr.line_3 as string) ?? null,
        city: (addr.city as string) ?? null,
        postcode: (addr.postcode as string) ?? null,
        stateCode: (addr.state as string) ?? null,
        countryCode: ((addr.country as string) ?? "MY") as string,
        remark: (d.remark as string) ?? null,
        description: (d.description as string) ?? null,
        cmdLastUpdated: new Date(),
      };

      let id: string;
      if (existing) {
        await db.update(schema.accounts).set(base).where(eq(schema.accounts.id, existing.id));
        id = existing.id;
        // replace contacts — simple strategy
        await db.delete(schema.accountContacts).where(eq(schema.accountContacts.accountId, id));
      } else {
        const [row] = await db.insert(schema.accounts).values(base).returning({ id: schema.accounts.id });
        id = row!.id;
      }

      const incomingContacts = Array.isArray(d.contact_person) ? (d.contact_person as Array<Record<string, unknown>>) : [];
      for (const c of incomingContacts) {
        await db.insert(schema.accountContacts).values({
          accountId: id,
          salutationId: (c.Salutation as number) ?? null,
          fullName: String(c.FullName ?? "(unknown)"),
          email: (c.Email as string) ?? null,
          mobile: (c.Mobile as string) ?? null,
          businessPhone: (c.BusinessPhone as string) ?? null,
          fax: (c.Fax as string) ?? null,
          designationId: (c.Designation as number) ?? null,
          profileImg: (c.profile_img as string) ?? null,
          remark: (c.Remark as string) ?? null,
          personalRemark: (c.PersonalRemark as string) ?? null,
          statusId: 1,
        });
      }

      return id;
    });

    await db
      .update(schema.cmdWebhookLedger)
      .set({ status: 2, processedAt: new Date(), resolvedEntity: "account", resolvedId })
      .where(eq(schema.cmdWebhookLedger.idempotencyKey, idempotencyKey));

    return { ok: true, accountId: resolvedId };
  },
);

async function markFailed(idempotencyKey: string, message: string) {
  await db
    .update(schema.cmdWebhookLedger)
    .set({ status: 3, errorMessage: message, processedAt: new Date() })
    .where(eq(schema.cmdWebhookLedger.idempotencyKey, idempotencyKey));
}

// ---------- Nightly UAT run (cron 19:00 UTC = 03:00 MYT) ----------

export const nightlyUat = inngest.createFunction(
  { id: "uat-nightly", retries: 0 },
  { cron: "0 19 * * *" },
  async ({ step }) => {
    const runId = await step.run("run", () => runHarness({ trigger: "nightly_cron" }));
    return { runId };
  },
);

// ---------- On-demand UAT run ----------

export const uatOnDemand = inngest.createFunction(
  { id: "uat-on-demand", retries: 0 },
  { event: "uat/run.requested" },
  async ({ event, step }) => {
    const runId = await step.run("run", () =>
      runHarness({
        trigger: "manual_ui",
        moduleFilter: event.data.moduleFilter,
        triggeredByUserId: event.data.triggeredByUserId,
      }),
    );
    return { runId };
  },
);
