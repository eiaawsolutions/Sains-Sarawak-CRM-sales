"use server";

/**
 * Quotation lifecycle server actions — UI wiring for FSD §3.2.9 / ADR-0003.
 * Delegates all state-transition decisions to the pure state machine in
 * ./quotation-state-machine.ts; this module only carries out the DB work,
 * writes audit rows, and enforces the <RM10,000 auto-approval rule.
 */
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { ensureBootstrapped } from "@/db/bootstrap";
import {
  QuotationStatus,
  RejectionReason,
  resolveSubmitOutcome,
  submit as validateSubmit,
  markSent as validateMarkSent,
  reject as validateReject,
  vetApprove as validateVetApprove,
  type Actor,
  type QuotationState,
  type RoleCode,
} from "./quotation-state-machine";

const AUTO_APPROVAL_THRESHOLD_MYR = 10_000;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per file

async function loadActorAndQuotation(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) throw new Error("Quotation not found");

  const linesCount = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(schema.quotationLines)
    .where(eq(schema.quotationLines.quotationId, id));

  const actor: Actor = {
    userId: session.user.id,
    role: session.user.roleCode as RoleCode,
  };
  const state: QuotationState = {
    id: q.id,
    ownerUserId: q.ownerUserId,
    status: q.statusId as QuotationStatus,
    revisionLetter: q.revisionLetter,
    quotationNo: q.quotationNo,
    linesCount: linesCount[0]?.c ?? 0,
    total: Number(q.totalMyr),
    isAccepted: q.isAccepted,
  };
  return { session, actor, q, state };
}

async function writeAudit(args: {
  eventType: string;
  actorUserId: string;
  actorRoleId: number;
  targetId: string;
  before: unknown;
  after: unknown;
  outcome: "success" | "denied" | "error";
  reason?: string;
}) {
  await db.insert(schema.auditLog).values({
    eventType: args.eventType,
    actorUserId: args.actorUserId,
    actorRoleId: args.actorRoleId,
    targetEntity: "quotation",
    targetId: args.targetId,
    beforeValue: args.before as never,
    afterValue: args.after as never,
    outcome: args.outcome,
    reason: args.reason,
  });
}

/* ---------- QUO-AA-001/002: Submit with auto-approval below threshold ---------- */

export async function submitQuotation(formData: FormData): Promise<void> {
  await ensureBootstrapped();
  const id = String(formData.get("id") ?? "");
  const { session, actor, q, state } = await loadActorAndQuotation(id);

  const gate = validateSubmit(state, actor, AUTO_APPROVAL_THRESHOLD_MYR);
  if (!gate.ok) {
    await writeAudit({
      eventType: "quotation.submit.denied", actorUserId: actor.userId,
      actorRoleId: session.user.roleId, targetId: id,
      before: { status: state.status }, after: null, outcome: "denied", reason: gate.message,
    });
    throw new Error(gate.message);
  }

  const outcome = resolveSubmitOutcome(state, AUTO_APPROVAL_THRESHOLD_MYR);
  const now = new Date();

  await db.update(schema.quotations)
    .set({
      statusId: outcome,
      submittedAt: now,
      approvedAt: outcome === QuotationStatus.Approved ? now : null,
      approvedByUserId: outcome === QuotationStatus.Approved ? actor.userId : null,
      updatedAt: now,
    })
    .where(eq(schema.quotations.id, id));

  await writeAudit({
    eventType: outcome === QuotationStatus.Approved
      ? "quotation.submit.auto_approved"
      : "quotation.submit.under_vetting",
    actorUserId: actor.userId, actorRoleId: session.user.roleId, targetId: id,
    before: { status: state.status }, after: { status: outcome, total: state.total },
    outcome: "success",
    reason: outcome === QuotationStatus.Approved
      ? `total ${q.totalMyr} MYR < ${AUTO_APPROVAL_THRESHOLD_MYR} threshold`
      : `total ${q.totalMyr} MYR >= ${AUTO_APPROVAL_THRESHOLD_MYR} threshold`,
  });

  redirect(`/quotations/${id}`);
}

/* ---------- QUO-VA-003/004/005: Section Head vet & approve ---------- */

export async function vetApproveQuotation(formData: FormData): Promise<void> {
  await ensureBootstrapped();
  const id = String(formData.get("id") ?? "");
  const { session, actor, state } = await loadActorAndQuotation(id);

  const gate = validateVetApprove(state, actor);
  if (!gate.ok) {
    await writeAudit({
      eventType: "quotation.vet_approve.denied", actorUserId: actor.userId,
      actorRoleId: session.user.roleId, targetId: id,
      before: { status: state.status }, after: null, outcome: "denied", reason: gate.message,
    });
    throw new Error(gate.message);
  }

  const now = new Date();
  await db.update(schema.quotations)
    .set({
      statusId: QuotationStatus.Approved,
      approvedAt: now,
      approvedByUserId: actor.userId,
      updatedAt: now,
    })
    .where(eq(schema.quotations.id, id));

  await writeAudit({
    eventType: "quotation.vet_approved", actorUserId: actor.userId,
    actorRoleId: session.user.roleId, targetId: id,
    before: { status: state.status },
    after: { status: QuotationStatus.Approved },
    outcome: "success",
  });

  redirect(`/quotations/${id}`);
}

/* ---------- QUO-AA-004/005: Mark as Sent ---------- */

export async function markSentQuotation(formData: FormData): Promise<void> {
  await ensureBootstrapped();
  const id = String(formData.get("id") ?? "");
  const { session, actor, state } = await loadActorAndQuotation(id);

  const gate = validateMarkSent(state, actor);
  if (!gate.ok) {
    await writeAudit({
      eventType: "quotation.send.denied", actorUserId: actor.userId,
      actorRoleId: session.user.roleId, targetId: id,
      before: { status: state.status }, after: null, outcome: "denied", reason: gate.message,
    });
    throw new Error(gate.message);
  }

  const now = new Date();
  await db.update(schema.quotations)
    .set({ statusId: QuotationStatus.QuotationSent, sentAt: now, updatedAt: now })
    .where(eq(schema.quotations.id, id));

  await writeAudit({
    eventType: "quotation.sent", actorUserId: actor.userId,
    actorRoleId: session.user.roleId, targetId: id,
    before: { status: state.status }, after: { status: QuotationStatus.QuotationSent },
    outcome: "success",
  });

  redirect(`/quotations/${id}`);
}

/* ---------- QUO-AA-006..013: Close as Won with mandatory attachments ---------- */

export async function closeWonQuotation(formData: FormData): Promise<void> {
  await ensureBootstrapped();
  const id = String(formData.get("id") ?? "");
  const { session, actor, state } = await loadActorAndQuotation(id);

  if (state.status !== QuotationStatus.QuotationSent) {
    throw new Error(`Cannot close-won from ${QuotationStatus[state.status]}`);
  }
  if (actor.userId !== state.ownerUserId && actor.role !== "Administrator") {
    throw new Error("Only the owner may close.");
  }

  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < 1) throw new Error("At least one attachment is required to close as Won.");
  if (files.length > MAX_ATTACHMENTS) throw new Error(`Maximum ${MAX_ATTACHMENTS} attachments allowed.`);
  for (const f of files) {
    if (f.size > MAX_ATTACHMENT_BYTES) throw new Error(`"${f.name}" exceeds ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
  }

  const rows = await Promise.all(files.map(async (f) => {
    const buf = Buffer.from(await f.arrayBuffer());
    return {
      quotationId: id,
      fileName: f.name.slice(0, 255),
      mimeType: (f.type || "application/octet-stream").slice(0, 100),
      sizeBytes: f.size,
      content: buf.toString("base64"),
      uploadedByUserId: actor.userId,
    };
  }));

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(schema.quotationAttachments).values(rows);
    await tx.update(schema.quotations)
      .set({
        statusId: QuotationStatus.Closed,
        isAccepted: true,
        acceptedAt: now,
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.quotations.id, id));
  });

  await writeAudit({
    eventType: "quotation.closed_won", actorUserId: actor.userId,
    actorRoleId: session.user.roleId, targetId: id,
    before: { status: state.status },
    after: { status: QuotationStatus.Closed, attachmentCount: files.length },
    outcome: "success",
  });

  redirect(`/quotations/${id}`);
}

/* ---------- QUO-AA-014/015: Reject (Reject / Expired) ---------- */

export async function rejectQuotation(formData: FormData): Promise<void> {
  await ensureBootstrapped();
  const id = String(formData.get("id") ?? "");
  const reasonId = Number(formData.get("reasonId") ?? 0) as RejectionReason;
  const reasonOther = String(formData.get("reasonOther") ?? "").trim() || null;
  const remark = String(formData.get("remark") ?? "").trim() || null;

  const { session, actor, state } = await loadActorAndQuotation(id);
  const gate = validateReject(state, actor, reasonId, reasonOther ?? undefined);
  if (!gate.ok) {
    await writeAudit({
      eventType: "quotation.reject.denied", actorUserId: actor.userId,
      actorRoleId: session.user.roleId, targetId: id,
      before: { status: state.status }, after: null, outcome: "denied", reason: gate.message,
    });
    throw new Error(gate.message);
  }

  const now = new Date();
  await db.update(schema.quotations)
    .set({
      statusId: QuotationStatus.RejectedExpired,
      rejectionReasonId: reasonId,
      rejectionReasonOther: reasonOther ?? undefined,
      note: remark ? `${remark}\n` : undefined,
      closedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.quotations.id, id));

  await writeAudit({
    eventType: "quotation.rejected", actorUserId: actor.userId,
    actorRoleId: session.user.roleId, targetId: id,
    before: { status: state.status },
    after: { status: QuotationStatus.RejectedExpired, reasonId, reasonOther },
    outcome: "success", reason: remark ?? undefined,
  });

  redirect(`/quotations/${id}`);
}
