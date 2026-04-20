"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function Pagination({ page, totalPages, totalRows }: { page: number; totalPages: number; totalRows: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const go = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(p));
    router.push(`${pathname}?${params.toString()}`);
  };

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const disableBack = page <= 1;
  const disableFwd = page >= totalPages;

  return (
    <div className="mt-3 flex items-center justify-between border-t border-hairline px-4 py-3 text-xs">
      <span className="text-charcoal-soft">
        Page <strong>{page}</strong> of {totalPages} · {totalRows} total
      </span>
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
