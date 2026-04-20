"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PAGE_SIZE_OPTIONS } from "./filters";

export function Pagination({ page, pageSize, totalPages, totalRows }: { page: number; pageSize: number; totalPages: number; totalRows: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const go = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  const changePageSize = (n: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("pageSize", String(n));
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const disableBack = page <= 1;
  const disableFwd = page >= totalPages;

  return (
    <div className="mt-3 flex items-center justify-between border-t border-hairline px-4 py-3 text-xs">
      <div className="flex items-center gap-3 text-charcoal-soft">
        <span>Page <strong>{page}</strong> of {totalPages} · {totalRows} total</span>
        <label className="flex items-center gap-1">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={e => changePageSize(Number(e.target.value))}
            className="rounded-md border border-hairline bg-white px-2 py-1 text-xs focus:border-crimson focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => go(1)}
          disabled={disableBack}
          className="rounded-md border border-hairline px-3 py-1 hover:border-crimson hover:text-crimson disabled:opacity-40"
        >
          First Page
        </button>
        <button
          type="button"
          onClick={() => go(prev)}
          disabled={disableBack}
          className="rounded-md border border-hairline px-3 py-1 hover:border-crimson hover:text-crimson disabled:opacity-40"
        >
          Previous Page
        </button>
        <button
          type="button"
          onClick={() => go(next)}
          disabled={disableFwd}
          className="rounded-md border border-hairline px-3 py-1 hover:border-crimson hover:text-crimson disabled:opacity-40"
        >
          Next Page
        </button>
        <button
          type="button"
          onClick={() => go(totalPages)}
          disabled={disableFwd}
          className="rounded-md border border-hairline px-3 py-1 hover:border-crimson hover:text-crimson disabled:opacity-40"
        >
          Last Page
        </button>
      </div>
    </div>
  );
}
