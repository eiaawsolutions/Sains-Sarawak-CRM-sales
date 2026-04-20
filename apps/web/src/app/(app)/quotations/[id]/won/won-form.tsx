"use client";

/**
 * Client form for the WON flow:
 *  - Mandatory attachment (native `required` on the file input → browser shows
 *    "This field is required" — matches QUO-AA-008).
 *  - Max 5 files enforced on the client (QUO-AA-010/011); server re-validates.
 *  - Confirmation popup before POST (QUO-AA-012).
 */
import { useRef, useState } from "react";

const MAX = 5;

export function WonAttachmentForm({
  quotationId,
  action,
}: {
  quotationId: string;
  action: (fd: FormData) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length > MAX) {
      setError(`Maximum ${MAX} attachments — you selected ${list.length}.`);
      e.target.value = "";
      setPicked([]);
      return;
    }
    setError(null);
    setPicked(list);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (picked.length < 1) {
      setError("At least one attachment is required.");
      e.preventDefault();
      return;
    }
    if (picked.length > MAX) {
      setError(`Maximum ${MAX} attachments.`);
      e.preventDefault();
      return;
    }
    if (!window.confirm(`Confirm Close Won for this quotation and upload ${picked.length} file(s)?`)) {
      e.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={onSubmit} encType="multipart/form-data" className="space-y-4">
      <input type="hidden" name="id" value={quotationId} />

      <div>
        <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">
          Attachment <span className="text-crimson">*</span>
        </label>
        <input
          ref={inputRef}
          name="attachments"
          type="file"
          required
          multiple
          onChange={onChange}
          className="block w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
          aria-describedby="won-attachment-help"
        />
        <p id="won-attachment-help" className="mt-1 text-xs text-charcoal-faint">
          PDF, JPG, PNG. At least 1, maximum {MAX} files. Up to 5 MB per file.
        </p>
        {picked.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-charcoal-soft">
            {picked.map((f, i) => (
              <li key={i}>
                {f.name} <span className="text-charcoal-faint">({(f.size / 1024).toFixed(0)} KB)</span>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="mt-2 text-sm text-crimson">{error}</p>}
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
          className="rounded-pill bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Confirm
        </button>
      </div>
    </form>
  );
}
