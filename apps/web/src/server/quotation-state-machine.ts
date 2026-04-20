/**
 * Pure state machine for Quotation (FSD §3.2.9). Mirrors ADR-0011 exactly:
 *   Return-for-revision mutates the SAME row, flipping status back to Draft and
 *   incrementing the revision letter (a→b→c).
 *
 * No framework deps — trivially unit-testable.
 */

export enum QuotationStatus {
  Draft = 1,
  UnderVetting = 2,
  Approved = 3,
  QuotationSent = 4,
  Closed = 5,
  RejectedExpired = 6,
}

export enum RejectionReason {
  CustomerWithdrawal = 1,
  OtherVendor = 2,
  BudgetConstraint = 3,
  Others = 4,
}

export enum AcceptanceChannel { Wot = "WOT", Aoq = "AOQ", Loa = "LOA" }

export type RoleCode = "Administrator" | "AccountManager" | "Viewer" | "SectionHead" | "Director" | "UnitHead";

export interface Actor { userId: string; role: RoleCode; }

export interface QuotationState {
  id: string;
  ownerUserId: string;
  status: QuotationStatus;
  revisionLetter: string;
  quotationNo: string;
  linesCount: number;
  total: number;
  isAccepted?: boolean;
}

export type Ok = { ok: true };
export type Err = { ok: false; code: string; message: string };
export type Result = Ok | Err;

const ok = (): Ok => ({ ok: true });
const err = (code: string, message: string): Err => ({ ok: false, code, message });

const vetters: RoleCode[] = ["SectionHead", "UnitHead", "Director", "Administrator"];

export function submit(q: QuotationState, actor: Actor, vettingThreshold: number): Result {
  if (q.ownerUserId !== actor.userId && actor.role !== "Administrator")
    return err("quot.submit.forbidden", "Only the owner may submit.");
  if (q.status !== QuotationStatus.Draft)
    return err("quot.submit.invalid_status", `Cannot submit from ${QuotationStatus[q.status]}.`);
  if (q.linesCount === 0)
    return err("quot.submit.no_lines", "Quotation must have at least one line.");
  return ok();
}

/** Compute the resulting status of submit(): < threshold → Approved; else UnderVetting */
export function resolveSubmitOutcome(q: QuotationState, threshold: number): QuotationStatus {
  return q.total < threshold ? QuotationStatus.Approved : QuotationStatus.UnderVetting;
}

export function vetApprove(q: QuotationState, actor: Actor): Result {
  if (!vetters.includes(actor.role)) return err("quot.vet.forbidden", "User not authorised.");
  if (q.status !== QuotationStatus.UnderVetting)
    return err("quot.vet.invalid_status", `Cannot approve from ${QuotationStatus[q.status]}.`);
  return ok();
}

export function returnForRevision(q: QuotationState, actor: Actor, notes: string): Result {
  if (!vetters.includes(actor.role)) return err("quot.return.forbidden", "User not authorised.");
  if (q.status !== QuotationStatus.UnderVetting)
    return err("quot.return.invalid_status", `Cannot return from ${QuotationStatus[q.status]}.`);
  if (!notes?.trim()) return err("quot.return.notes_required", "Return notes are mandatory.");
  return ok();
}

export function markSent(q: QuotationState, actor: Actor): Result {
  if (q.ownerUserId !== actor.userId && actor.role !== "Administrator")
    return err("quot.send.forbidden", "Only the owner may mark as sent.");
  if (q.status !== QuotationStatus.Approved)
    return err("quot.send.invalid_status", `Cannot mark sent from ${QuotationStatus[q.status]}.`);
  return ok();
}

export function accept(q: QuotationState, actor: Actor): Result {
  if (q.ownerUserId !== actor.userId && actor.role !== "Administrator")
    return err("quot.accept.forbidden", "Only the owner may record acceptance.");
  if (q.status !== QuotationStatus.QuotationSent)
    return err("quot.accept.invalid_status", `Cannot accept from ${QuotationStatus[q.status]}.`);
  return ok();
}

export function reject(q: QuotationState, actor: Actor, reason: RejectionReason, otherText?: string): Result {
  if (q.ownerUserId !== actor.userId && actor.role !== "Administrator")
    return err("quot.reject.forbidden", "Only the owner may reject.");
  if (q.status !== QuotationStatus.QuotationSent)
    return err("quot.reject.invalid_status", `Cannot reject from ${QuotationStatus[q.status]}.`);
  if (reason === RejectionReason.Others && !otherText?.trim())
    return err("quot.reject.other_text_required", "Free-text reason required for 'Others'.");
  return ok();
}

export function incrementRevision(currentLetter: string, currentNo: string): { letter: string; no: string } {
  const next = nextRevisionLetter(currentLetter);
  const rebuilt = currentNo.replace(/(\d+)[a-z]+\)$/, `$1${next})`);
  return { letter: next, no: rebuilt };
}

function nextRevisionLetter(current: string): string {
  if (!current) return "a";
  const chars = Array.from(current);
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i]! < "z") { chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1); return chars.join(""); }
    chars[i] = "a";
  }
  return "a".repeat(chars.length + 1);
}
