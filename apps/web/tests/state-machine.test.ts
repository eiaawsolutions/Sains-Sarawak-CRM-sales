import { describe, it, expect } from "vitest";
import {
  QuotationStatus, submit, vetApprove, returnForRevision, markSent, accept, reject,
  resolveSubmitOutcome, incrementRevision, RejectionReason,
  type QuotationState, type Actor,
} from "@/server/quotation-state-machine";

const owner: Actor = { userId: "owner-1", role: "AccountManager" };
const vetter: Actor = { userId: "vetter-1", role: "SectionHead" };

function draft(overrides: Partial<QuotationState> = {}): QuotationState {
  return {
    id: "q1",
    ownerUserId: owner.userId,
    status: QuotationStatus.Draft,
    revisionLetter: "a",
    quotationNo: "SAINS 8-40/011/TEST Vol.1 (1a)",
    linesCount: 1,
    total: 500,
    ...overrides,
  };
}

describe("quotation state machine", () => {
  it("blocks submit with no lines", () => {
    const r = submit(draft({ linesCount: 0 }), owner, 10000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("quot.submit.no_lines");
  });

  it("auto-approves under threshold", () => {
    const q = draft({ total: 500 });
    expect(submit(q, owner, 10000).ok).toBe(true);
    expect(resolveSubmitOutcome(q, 10000)).toBe(QuotationStatus.Approved);
  });

  it("routes to vetting at or above threshold", () => {
    const q = draft({ total: 10000 });
    expect(resolveSubmitOutcome(q, 10000)).toBe(QuotationStatus.UnderVetting);
  });

  it("vetter can approve from UnderVetting only", () => {
    const q = draft({ status: QuotationStatus.UnderVetting });
    expect(vetApprove(q, vetter).ok).toBe(true);
    expect(vetApprove(draft(), vetter).ok).toBe(false);
  });

  it("owner can't vet their own quotation", () => {
    const r = vetApprove(draft({ status: QuotationStatus.UnderVetting }), owner);
    expect(r.ok).toBe(false);
  });

  it("return-for-revision requires notes", () => {
    const q = draft({ status: QuotationStatus.UnderVetting });
    expect(returnForRevision(q, vetter, "").ok).toBe(false);
    expect(returnForRevision(q, vetter, "fix the tax column").ok).toBe(true);
  });

  it("mark sent only from Approved", () => {
    const q = draft({ status: QuotationStatus.Approved });
    expect(markSent(q, owner).ok).toBe(true);
    expect(markSent(draft(), owner).ok).toBe(false);
  });

  it("rejection reason 'Others' requires text", () => {
    const q = draft({ status: QuotationStatus.QuotationSent });
    expect(reject(q, owner, RejectionReason.Others, "").ok).toBe(false);
    expect(reject(q, owner, RejectionReason.Others, "specific reason").ok).toBe(true);
    expect(reject(q, owner, RejectionReason.BudgetConstraint).ok).toBe(true);
  });

  it("accept works from QuotationSent only", () => {
    expect(accept(draft({ status: QuotationStatus.QuotationSent }), owner).ok).toBe(true);
    expect(accept(draft(), owner).ok).toBe(false);
  });
});

describe("revision letter increment", () => {
  it("a → b → c", () => {
    expect(incrementRevision("a", "SAINS 8-40/011/TEST Vol.1 (1a)").no).toBe("SAINS 8-40/011/TEST Vol.1 (1b)");
    expect(incrementRevision("b", "SAINS 8-40/011/TEST Vol.1 (1b)").letter).toBe("c");
  });

  it("z → aa", () => {
    expect(incrementRevision("z", "SAINS 8-40/011/TEST Vol.1 (1z)").letter).toBe("aa");
  });

  it("az → ba", () => {
    expect(incrementRevision("az", "SAINS 8-40/011/TEST Vol.1 (1az)").letter).toBe("ba");
  });
});
