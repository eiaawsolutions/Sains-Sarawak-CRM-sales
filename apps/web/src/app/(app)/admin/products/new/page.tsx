import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { createProductAction } from "@/server/admin-actions";

export default async function NewProductPage() {
  const cats = await db.select().from(schema.productCategories).orderBy(asc(schema.productCategories.sortOrder));
  const subs = await db.select().from(schema.productSubCategories).orderBy(asc(schema.productSubCategories.sortOrder));

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Create product</h1>
        <p className="mt-1 text-sm text-charcoal-soft">Admin &gt; Product Catalogue &gt; Create New.</p>
      </header>

      <form action={createProductAction} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <Field label="Product Code *" name="productCode" required />
        <Field label="Product Name *" name="productName" required />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Category *</label>
          <select name="categoryId" required className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2">
            <option value="">— select category —</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Sub-category</label>
          <select name="subCategoryId" className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2">
            <option value="">— none —</option>
            {subs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Retail Price (MYR)" name="retailPrice" type="number" step="0.01" />
          <Field label="Cost Price (MYR)"   name="costPrice"   type="number" step="0.01" />
          <Field label="Default Tax %"      name="defaultTaxPct" type="number" step="0.01" />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Description</label>
          <textarea name="description" rows={3} className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">Save</button>
          <Link href="/admin/products" className="rounded-pill border border-hairline px-6 py-3 font-semibold">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required, step }: { label: string; name: string; type?: string; required?: boolean; step?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{label}</label>
      <input type={type} name={name} required={required} step={step} className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
    </div>
  );
}
