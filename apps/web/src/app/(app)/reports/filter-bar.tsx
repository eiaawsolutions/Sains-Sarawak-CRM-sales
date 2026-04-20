"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { FILTER_FIELDS, MAX_FILTER_ROWS, type FilterField, type FilterRow } from "./filters";

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const initial = useMemo<FilterRow[]>(() => {
    const fields = sp.getAll("f");
    const values = sp.getAll("v");
    const rows: FilterRow[] = [];
    for (let i = 0; i < fields.length && rows.length < MAX_FILTER_ROWS; i++) {
      rows.push({ field: (fields[i] as FilterField) || "quotation_no", value: values[i] ?? "" });
    }
    return rows.length > 0 ? rows : [{ field: "quotation_no", value: "" }];
  }, [sp]);

  const [rows, setRows] = useState<FilterRow[]>(initial);

  const updateRow = (i: number, patch: Partial<FilterRow>) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
  const addRow = () => {
    if (rows.length >= MAX_FILTER_ROWS) return;
    setRows(prev => [...prev, { field: "quotation_no", value: "" }]);
  };

  const apply = () => {
    const params = new URLSearchParams();
    for (const r of rows) {
      if (!r.value.trim()) continue;
      params.append("f", r.field);
      params.append("v", r.value.trim());
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const clear = () => {
    setRows([{ field: "quotation_no", value: "" }]);
    router.push(pathname);
  };

  return (
    <div className="rounded-lg border border-hairline bg-gradient-surface p-4 shadow-claritas-1">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Filters</h3>
        <span className="text-xs text-charcoal-faint">{rows.length}/{MAX_FILTER_ROWS} rows</span>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={row.field}
              onChange={e => updateRow(i, { field: e.target.value as FilterField })}
              className="rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson focus:outline-none"
            >
              {FILTER_FIELDS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={row.value}
              onChange={e => updateRow(i, { value: e.target.value })}
              placeholder="value…"
              className="flex-1 rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              className="rounded-md border border-hairline px-2 py-2 text-xs text-charcoal-soft hover:border-crimson hover:text-crimson disabled:opacity-40"
              aria-label="Remove row"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_FILTER_ROWS}
          className="rounded-pill border border-hairline px-4 py-1.5 text-xs font-medium text-charcoal-soft hover:border-crimson hover:text-crimson disabled:opacity-40"
        >
          + Click to add row
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-pill border border-hairline px-4 py-1.5 text-xs font-medium text-charcoal-soft hover:border-crimson hover:text-crimson"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded-pill bg-gradient-accent px-5 py-1.5 text-xs font-semibold text-white shadow-accent-glow"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}
