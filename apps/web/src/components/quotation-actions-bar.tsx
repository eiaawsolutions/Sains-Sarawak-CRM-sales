"use client";

/**
 * Client wrapper for quotation-lifecycle server actions. Replaces the native
 * `window.confirm` with a SAINS-styled modal confirm (ConfirmDialog). The form
 * still POSTs to the same server action on OK, preserving the UAT script
 * "Click Submit → Confirmation popup → Click OK → success".
 */
import { useRef, useState } from "react";
import { Button, ButtonLink, Badge } from "@/components/ui";
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
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-hairline2 bg-white px-4 text-sm font-medium text-ink transition-colors duration-sains ease-sains hover:bg-paper-2"
      >
        Print quotation
      </a>

      {canSubmit && (
        <ConfirmFormButton
          title="Submit quotation for approval"
          body="The quotation will move to Under Vetting status and the Section Head will be notified."
          confirmLabel="Submit for approval"
          action={submitAction}
          quotationId={quotationId}
          tone="primary"
        >
          Submit
        </ConfirmFormButton>
      )}

      {canVetApprove && (
        <ConfirmFormButton
          title="Approve this quotation?"
          body="Status will move to Approved. The Account Manager will be notified to send the quotation to the customer."
          confirmLabel="Approve"
          action={vetApproveAction}
          quotationId={quotationId}
          tone="primary"
        >
          Approve
        </ConfirmFormButton>
      )}

      {canMarkSent && (
        <ConfirmFormButton
          title="Mark as sent"
          body="Confirm you have sent this quotation to the customer. Status will move to Quotation Sent."
          confirmLabel="Mark as sent"
          action={markSentAction}
          quotationId={quotationId}
          tone="primary"
        >
          Sent quotation
        </ConfirmFormButton>
      )}

      {canWinOrReject && (
        <>
          <ButtonLink href={`/quotations/${quotationId}/won`} tone="primary" size="md">
            Won
          </ButtonLink>
          <ButtonLink href={`/quotations/${quotationId}/reject`} tone="secondary" size="md">
            Reject
          </ButtonLink>
        </>
      )}

      {statusId === QuotationStatus.Closed && (
        <Badge tone="teal" dot>Closed Won</Badge>
      )}
      {statusId === QuotationStatus.RejectedExpired && (
        <Badge tone="rose" dot>Rejected / Expired</Badge>
      )}
    </div>
  );
}

// ---- ConfirmFormButton ------------------------------------------
function ConfirmFormButton({
  title, body, confirmLabel,
  action, quotationId,
  tone = "primary",
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  action: (fd: FormData) => Promise<void>;
  quotationId: string;
  tone?: "primary" | "danger";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Button type="button" tone={tone} size="md" onClick={() => setOpen(true)}>
        {children}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-${quotationId}-title`}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-overlay"
          />
          <div className="relative w-full max-w-md rounded-card border border-hairline bg-white p-6 shadow-ink-3">
            <h3 id={`confirm-${quotationId}-title`} className="text-base font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>

            <form
              ref={formRef}
              action={action}
              className="mt-5 flex justify-end gap-2"
              onSubmit={() => setOpen(false)}
            >
              <input type="hidden" name="id" value={quotationId} />
              <Button type="button" tone="secondary" size="md" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" tone={tone} size="md">
                {confirmLabel}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
