"use client";

import { useState } from "react";

type Reason = { id: number; name: string; requiresText: boolean };

export function RejectForm({
  quotationId,
  reasons,
  action,
}: {
  quotationId: string;
  reasons: Reason[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [reasonId, setReasonId] = useState<number>(reasons[0]?.id ?? 0);
  const [reasonOther, setReasonOther] = useState("");
  const [remark, setRemark] = useState("");

  const current = reasons.find(r => r.id === reasonId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!reasonId) {
      e.preventDefault();
      alert("Please select a status.");
      return;
    }
    if (current?.requiresText && !reasonOther.trim()) {
      e.preventDefault();
      alert(`"${current.name}" requires a free-text reason.`);
      return;
    }
    if (!window.confirm("Save this rejection? The quotation will become terminal.")) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={quotationId} />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">
          Status <span className="text-crimson">*</span>
        </label>
        <select
          name="reasonId"
          required
          value={reasonId}
          onChange={(e) => setReasonId(Number(e.target.value))}
          className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
        >
          {reasons.map(r => (
            <option key={r.id} value={r.id}>Reject / Expired — {r.name}</option>
          ))}
        </select>
      </div>

      {current?.requiresText && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">
            Free-text reason <span className="text-crimson">*</span>
          </label>
          <input
            name="reasonOther"
            required
            value={reasonOther}
            onChange={(e) => setReasonOther(e.target.value)}
            maxLength={500}
            className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Remark</label>
        <textarea
          name="remark"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
          placeholder="Optional notes to keep alongside the rejection record."
        />
      </div>

      <div className="flex items-center gap-3 border-t border-hairline pt-4">
        <a
          href={`/quotations/${quotationId}`}
          className="rounded-pill border border-hairline bg-white px-5 py-2 text-sm hover:border-crimson hover:text-crimson"
        >
          Cancel
        </a>
        <button
          type="submit"
          className="rounded-pill bg-crimson px-6 py-2.5 text-sm font-semibold text-white hover:bg-crimson-dark"
        >
          Save
        </button>
      </div>
    </form>
  );
}
