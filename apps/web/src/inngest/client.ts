import { Inngest } from "inngest";

/**
 * Single Inngest client. On Railway we run Inngest in dev mode (self-hosted via the `inngest-cli`
 * sidecar). In production, set `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` to the Inngest Cloud
 * project — or self-host against another Railway service.
 */
export const inngest = new Inngest({ id: "sains-crm" });

// Event type catalogue
export type Events = {
  "cmd/webhook.received": { data: { idempotencyKey: string } };
  "quotation/approved":   { data: { quotationId: string } };
  "uat/nightly.scheduled":{ data: Record<string, never> };
  "uat/run.requested":    { data: { moduleFilter?: string; triggeredByUserId?: string } };
  "lead/win.writeback":   { data: { quotationId: string; leadId: string } };
};
