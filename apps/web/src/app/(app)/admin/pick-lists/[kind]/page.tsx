import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePickListAction } from "@/server/admin-actions";

const KIND_META: Record<string, { label: string; table: any; hasActive: boolean }> = {
  organizationTypes: { label: "Organization Types", table: schema.organizationTypes, hasActive: true },
  salutations:       { label: "Salutations",        table: schema.salutations,       hasActive: true },
  designations:      { label: "Designations",       table: schema.designations,      hasActive: true },
  productCategories: { label: "Product Categories", table: schema.productCategories, hasActive: true },
  rejectionReasons:  { label: "Rejection Reasons",  table: schema.rejectionReasons,  hasActive: true },
  quotationTypes:    { label: "Quotation Types",    table: schema.quotationTypes,    hasActive: true },
  fundSources:       { label: "Source of Fund",     table: schema.fundSources,       hasActive: false },
};

export default async function PickListEditPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = KIND_META[kind];
  if (!meta) notFound();

  const rows = await db.select().from(meta.table as any).orderBy(asc((meta.table as any).id));

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{meta.label}</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Edit item names and active status.</p>
        </div>
        <Link href="/admin/pick-lists" className="rounded-pill border border-hairline px-5 py-2 text-sm font-semibold">← Back</Link>
      </header>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="rounded-lg border border-hairline bg-gradient-surface p-6 text-center text-charcoal-faint shadow-claritas-1">
            No items in this list.
          </div>
        )}
        {rows.map((row: any) => {
          const update = updatePickListAction.bind(null, kind as any, row.id);
          return (
            <form
              key={row.id}
              action={update}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-gradient-surface p-4 shadow-claritas-1"
            >
              <span className="font-mono text-xs text-charcoal-soft">#{row.id}</span>
              <input
                name="name"
                defaultValue={row.name}
                required
                className="flex-1 rounded-md border border-hairline bg-white px-3 py-2 min-w-[240px]"
              />
              {meta.hasActive && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={row.isActive} />
                  Active
                </label>
              )}
              <button type="submit" className="rounded-pill bg-gradient-accent px-5 py-2 text-sm font-semibold text-white shadow-accent-glow">
                Save
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
