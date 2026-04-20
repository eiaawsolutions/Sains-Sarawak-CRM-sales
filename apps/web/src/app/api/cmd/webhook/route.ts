/**
 * POST /api/cmd/webhook
 * Ports the ASP.NET `CmdWebhookController` — SAINS Integration API v1.2 receiver.
 * Verifies HMAC signature + timestamp window + idempotency, archives raw payload,
 * enqueues async processing via Inngest. Returns in <300ms.
 */
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { computeSignature2, verify, isWithinWindow } from "@/server/hmac";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(req: Request) {
  const clientId = req.headers.get("client_id") ?? "";
  const t = req.headers.get("t") ?? "";
  const sign = req.headers.get("sign") ?? "";

  if (!clientId || !t || !sign) return unauthorized();

  const tsMs = Number(t);
  if (!Number.isFinite(tsMs) || !isWithinWindow(tsMs, Date.now(), WINDOW_MS)) return unauthorized();

  const envClientId = process.env.CMD_CLIENT_ID;
  const envSecret = process.env.CMD_SECRET_KEY;
  const envToken = process.env.CMD_ACCESS_TOKEN;
  if (!envClientId || !envSecret || !envToken) {
    return NextResponse.json({ success: false, data: { error: "Webhook not configured" } }, { status: 503 });
  }
  if (clientId !== envClientId) return unauthorized();

  // Check kill switch
  const flag = await db.query.featureFlags.findFirst({ where: eq(schema.featureFlags.key, "cmd_webhook_enabled") });
  if (!flag?.isEnabled) {
    return NextResponse.json(
      { success: false, data: { error: "Service temporarily unavailable" } },
      { status: 503 },
    );
  }

  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.length > MAX_BODY_BYTES) {
    return NextResponse.json({ success: false, data: { error: "Payload too large" } }, { status: 413 });
  }

  const expected = computeSignature2(envSecret, envClientId, envToken, t);
  if (!verify(expected, sign.toUpperCase())) return unauthorized();

  const bodyJson = buffer.toString("utf8");
  const idempotencyKey = createHash("sha256").update(bodyJson).digest("hex");

  // Dedup
  const existing = await db.query.cmdWebhookLedger.findFirst({
    where: eq(schema.cmdWebhookLedger.idempotencyKey, idempotencyKey),
  });
  if (existing?.resolvedId) {
    return NextResponse.json({ success: true, data: { id: existing.resolvedId } });
  }

  // Archive raw payload + ledger row
  const [payload] = await db.insert(schema.cmdWebhookPayloads).values({
    bodyJson,
    bodyBytes: buffer.length,
    clientIdHeader: clientId,
    unixTimeHeader: t,
    signatureHeader: sign,
    sourceIp: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
  }).returning({ id: schema.cmdWebhookPayloads.id });

  const correlationId = crypto.randomUUID();
  await db.insert(schema.cmdWebhookLedger).values({
    idempotencyKey,
    status: 1,  // Pending
    payloadRef: payload!.id,
    correlationId,
  }).onConflictDoNothing();

  // Hand off to Inngest for async processing
  await inngest.send({ name: "cmd/webhook.received", data: { idempotencyKey } });

  return NextResponse.json({ success: true, data: { id: crypto.randomUUID() } });
}

function unauthorized() {
  return NextResponse.json({ success: false, data: { error: "Not authorized" } }, { status: 401 });
}
