import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";

export default async function ProductsPage() {
  const rows = await db
    .select({
      id:           schema.products.id,
      productCode:  schema.products.productCode,
      productName:  schema.products.productName,
      retailPrice:  schema.products.retailPrice,
      taxPct:       schema.products.defaultTaxPct,
      isActive:     schema.products.isActive,
      categoryName: schema.productCategories.name,
    })
    .from(schema.products)
    .leftJoin(schema.productCategories, eq(schema.productCategories.id, schema.products.categoryId))
    .orderBy(asc(schema.products.productName))
    .limit(500);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Product Catalogue Management</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Admin &gt; Product Catalogue. Products used in quotations and proposals.
          </p>
        </div>
        <Link href="/admin/products/new" className="rounded-pill bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-white shadow-accent-glow">
          Create New
        </Link>
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Retail (MYR)</th>
              <th>Tax %</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-charcoal-faint">No products yet.</td></tr>
            )}
            {rows.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.productCode}</td>
                <td className="font-medium">{p.productName}</td>
                <td>{p.categoryName ?? "—"}</td>
                <td className="text-right font-mono">{Number(p.retailPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="text-right font-mono">{p.taxPct}</td>
                <td>
                  <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${p.isActive ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-charcoal-soft"}`}>
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
