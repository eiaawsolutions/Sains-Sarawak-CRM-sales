"use client";

/**
 * Client wrapper that adds a native window.confirm popup before firing a
 * quotation-lifecycle server action. Matches the UAT script exactly:
 * "Click Submit → Confirmation popup is displayed → Click OK".
 */
import Link from "next/link";
import { QuotationStatus } from "@/server/quotation-state-machine";

type Props = {
  quotationId: string;
  statusId: number;
  canSubmit: boolean;
  canVetApprove: boolean;
  canMarkSent: boolean;
  canWinOrReject: boolean;
  submitAction: (fd: FormData) => Promise<void>;
  vetApproveAction: (fd: FormData) => Promise<void>;
  markSentAction: (fd: FormData) => Promise<void>;
};

function confirming(message: string) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) e.preventDefault();
  };
}

export function QuotationActionsBar(props: Props) {
  const {
    quotationId, statusId,
    canSubmit, canVetApprove, canMarkSent, canWinOrReject,
    submitAction, vetApproveAction, markSentAction,
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/quotations/${quotationId}/pdf`}
        className="rounded-pill border border-hairline bg-white px-4 py-2 text-sm font-semibold hover:border-crimson hover:text-crimson"
      >
        Print Quotation
      </a>

      {canSubmit && (
        <form action={submitAction} onSubmit={confirming("Submit this quotation for approval?")}>
          <input type="hidden" name="id" value={quotationId} />
          <button
            type="submit"
            className="rounded-pill bg-gradient-accent px-5 py-2 text-sm font-semibold text-white shadow-accent-glow"
          >
            Submit
          </button>
        </form>
      )}

      {canVetApprove && (
        <form action={vetApproveAction} onSubmit={confirming("Approve this quotation? Status will move to Approved.")}>
          <input type="hidden" name="id" value={quotationId} />
          <button
            type="submit"
            className="rounded-pill bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Approve
          </button>
        </form>
      )}

      {canMarkSent && (
        <form action={markSentAction} onSubmit={confirming("Mark this quotation as Sent to the customer?")}>
          <input type="hidden" name="id" value={quotationId} />
          <button
            type="submit"
            className="rounded-pill bg-gradient-accent px-5 py-2 text-sm font-semibold text-white shadow-accent-glow"
          >
            Sent Quotation
          </button>
        </form>
      )}

      {canWinOrReject && (
        <>
          <Link
            href={`/quotations/${quotationId}/won`}
            className="rounded-pill bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            WON
          </Link>
          <Link
            href={`/quotations/${quotationId}/reject`}
            className="rounded-pill border border-hairline bg-white px-5 py-2 text-sm font-semibold text-charcoal hover:border-crimson hover:text-crimson"
          >
            Reject
          </Link>
        </>
      )}

      {statusId === QuotationStatus.Closed && (
        <span className="rounded-pill bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Closed Won</span>
      )}
      {statusId === QuotationStatus.RejectedExpired && (
        <span className="rounded-pill bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">Rejected / Expired</span>
      )}
    </div>
  );
}
