import { db, schema } from "@/db";
import { eq, asc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function QuotationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ productId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) notFound();

  const lines = await db
    .select()
    .from(schema.quotationLines)
    .where(eq(schema.quotationLines.quotationId, id))
    .orderBy(asc(schema.quotationLines.lineOrder));

  const status = await db.query.quotationStatuses.findFirst({ where: eq(schema.quotationStatuses.id, q.statusId) });
  const type = await db.query.quotationTypes.findFirst({ where: eq(schema.quotationTypes.id, q.typeId) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, q.ownerUserId) });

  const productCatalog = await db
    .select({
      id: schema.products.id,
      code: schema.products.productCode,
      name: schema.products.productName,
      unitPrice: schema.products.retailPrice,
      taxPct: schema.products.defaultTaxPct,
      categoryId: schema.products.categoryId,
      subCategoryId: schema.products.subCategoryId,
      description: schema.products.description,
    })
    .from(schema.products)
    .where(eq(schema.products.isActive, true))
    .orderBy(asc(schema.products.productName));

  const categories = await db.select().from(schema.productCategories).orderBy(asc(schema.productCategories.id));
  const subCategories = await db.select().from(schema.productSubCategories).orderBy(asc(schema.productSubCategories.id));

  const selectedProduct = sp.productId ? productCatalog.find(p => p.id === sp.productId) : null;

  const role = session.user.roleCode;
  const isEditable = q.statusId === 1; // Only Draft quotations accept new line items
  const canEdit = isEditable && ["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role);

  async function addQuotationLine(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");

    const quote = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
    if (!quote || quote.statusId !== 1) throw new Error("Quotation is not in Draft state");

    const productId = String(formData.get("productId") ?? "").trim() || null;
    const description = String(formData.get("description") ?? "").trim();
    const quantity = String(formData.get("quantity") ?? "1");
    const unitPriceMyr = String(formData.get("unitPriceMyr") ?? "0");
    const discountAmountMyr = String(formData.get("discountAmountMyr") ?? "0");
    const taxPct = String(formData.get("taxPct") ?? "0");
    const lineOrderRaw = Number(formData.get("lineOrder") ?? 0);
    const isOptional = formData.get("isOptional") === "on";
    const categoryId = formData.get("categoryId") ? Number(formData.get("categoryId")) : null;
    const subCategoryId = formData.get("subCategoryId") ? Number(formData.get("subCategoryId")) : null;

    if (!description) throw new Error("Description is required");

    // Determine line order — default to next available if user didn't specify
    const maxOrder = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${schema.quotationLines.lineOrder}), 0)` })
      .from(schema.quotationLines)
      .where(eq(schema.quotationLines.quotationId, id));
    const nextOrder = (maxOrder[0]?.maxOrder ?? 0) + 1;
    const lineOrder = lineOrderRaw > 0 ? lineOrderRaw : nextOrder;

    await db.insert(schema.quotationLines).values({
      quotationId: id,
      productId,
      lineOrder,
      categoryId,
      subCategoryId,
      description,
      quantity,
      unitPriceMyr,
      discountAmountMyr,
      taxPct,
      isOptional,
    });

    // Recalculate quotation totals from lines
    const all = await db.select().from(schema.quotationLines).where(eq(schema.quotationLines.quotationId, id));
    let subtotal = 0, discount = 0, tax = 0;
    for (const l of all) {
      const qty = Number(l.quantity);
      const price = Number(l.unitPriceMyr);
      const disc = Number(l.discountAmountMyr);
      const taxP = Number(l.taxPct);
      const lineGross = qty * price;
      const lineTax = (lineGross - disc) * (taxP / 100);
      subtotal += lineGross;
      discount += disc;
      tax += lineTax;
    }
    const total = subtotal - discount + tax;
    await db.update(schema.quotations)
      .set({
        subtotalMyr: subtotal.toFixed(2),
        discountMyr: discount.toFixed(2),
        taxMyr: tax.toFixed(2),
        totalMyr: total.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(schema.quotations.id, id));

    redirect(`/quotations/${id}`);
  }

  return (
    <div className="max-w-5xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/quotations" className="hover:text-crimson">Quotations</Link>
        <span className="mx-2">/</span>
        <span className="font-mono">{q.quotationNo}</span>
      </nav>

      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{q.subject ?? "(no subject)"}</h1>
          <p className="mt-1 font-mono text-sm text-charcoal-soft">
            {q.quotationNo}  ·  Rev {q.revisionLetter}  ·  {type?.name}  ·  Owner {owner?.fullName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-pill border border-hairline bg-white px-3 py-1 text-xs font-semibold">
            {status?.name ?? "?"}
          </span>
          <a
            href={`/api/quotations/${q.id}/pdf`}
            className="rounded-pill bg-gradient-accent px-5 py-2.5 font-semibold text-white shadow-accent-glow"
          >
            Download PDF
          </a>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Billed to</h2>
          <address className="not-italic text-sm">
            <div className="font-medium">{q.snapOrganizationName ?? "—"}</div>
            {q.snapLine1 && <div>{q.snapLine1}</div>}
            {q.snapLine2 && <div>{q.snapLine2}</div>}
            {q.snapLine3 && <div>{q.snapLine3}</div>}
            <div>{[q.snapCity, q.snapPostcode].filter(Boolean).join(" ")}</div>
            <div>{[q.snapStateCode, q.snapCountryCode].filter(Boolean).join(", ")}</div>
            {q.snapPhone && <div className="text-xs text-charcoal-soft">Phone: {q.snapPhone}</div>}
          </address>
        </section>

        <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Workflow</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Submitted" v={q.submittedAt?.toLocaleString()} />
            <Row k="Approved" v={q.approvedAt?.toLocaleString()} />
            <Row k="Sent" v={q.sentAt?.toLocaleString()} />
            <Row k="Closed" v={q.closedAt?.toLocaleString()} />
            <Row k="Returned" v={q.returnedAt?.toLocaleString()} />
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
        <div className="flex items-baseline justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-soft">
            Quotation Items ({lines.length})
          </h2>
          {!isEditable && (
            <span className="text-xs text-charcoal-faint">Read-only — quotation status is {status?.name}</span>
          )}
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit (MYR)</th>
              <th className="text-right">Tax %</th>
              <th className="text-right">Amount (MYR)</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-charcoal-faint">No line items</td></tr>
            )}
            {lines.map((l, i) => {
              const qty = Number(l.quantity);
              const price = Number(l.unitPriceMyr);
              const disc = Number(l.discountAmountMyr);
              const amt = qty * price - disc;
              return (
                <tr key={l.id}>
                  <td className="text-charcoal-soft">{i + 1}</td>
                  <td>{l.description}{l.isOptional ? <span className="ml-2 text-xs text-charcoal-faint">(optional)</span> : ""}</td>
                  <td className="text-right">{qty}</td>
                  <td className="text-right">{price.toLocaleString()}</td>
                  <td className="text-right">{Number(l.taxPct).toFixed(2)}</td>
                  <td className="text-right font-semibold">{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={5} className="text-right text-charcoal-soft">Subtotal</td><td className="text-right font-semibold">{Number(q.subtotalMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colSpan={5} className="text-right text-charcoal-soft">Discount</td><td className="text-right font-semibold">{Number(q.discountMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colSpan={5} className="text-right text-charcoal-soft">Tax</td><td className="text-right font-semibold">{Number(q.taxMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colSpan={5} className="text-right font-semibold text-crimson">Total (MYR)</td><td className="text-right font-bold text-crimson">{Number(q.totalMyr).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
          </tfoot>
        </table>
      </section>

      {canEdit && (
        <section className="mt-6 rounded-lg border border-hairline bg-white p-5 shadow-claritas-1" id="add-item">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Quotation Item — Management</h2>
              <p className="mt-1 text-xs text-charcoal-faint">Fill mandatory fields. Status for a newly added item is Active.</p>
            </div>
            <span className="rounded-pill bg-emerald-50 px-3 py-0.5 text-xs font-semibold text-emerald-800">Create New</span>
          </div>

          {/* Product picker — reloads the page with ?productId=… so the form pre-fills */}
          <form method="GET" action={`/quotations/${q.id}`} className="mb-4 flex items-end gap-3 border-b border-hairline pb-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Product Catalog</label>
              <select name="productId" defaultValue={sp.productId ?? ""} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
                <option value="">— Pick a product to auto-fill —</option>
                {productCatalog.map(p => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.name} · MYR {Number(p.unitPrice).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-pill border border-hairline bg-white px-4 py-2 text-sm hover:border-crimson hover:text-crimson" aria-label="Select product">
              📁 Load product
            </button>
          </form>

          <form action={addQuotationLine} className="space-y-4">
            <input type="hidden" name="productId" value={selectedProduct?.id ?? ""} />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Product Name / Description *</label>
                <input
                  name="description"
                  required
                  defaultValue={selectedProduct?.name ?? ""}
                  className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Category</label>
                <select name="categoryId" defaultValue={selectedProduct?.categoryId ?? ""} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
                  <option value="">—</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Unit Price (MYR) *</label>
                <input
                  name="unitPriceMyr"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={selectedProduct?.unitPrice ?? "0.00"}
                  className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Quantity *</label>
                <input
                  name="quantity"
                  type="number"
                  step="1"
                  min="1"
                  required
                  defaultValue="1"
                  className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Discount (MYR)</label>
                <input
                  name="discountAmountMyr"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0.00"
                  className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Tax %</label>
                <input
                  name="taxPct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={selectedProduct?.taxPct ?? "0.00"}
                  className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Ordering Number</label>
                <input
                  name="lineOrder"
                  type="number"
                  step="1"
                  min="1"
                  placeholder={`${lines.length + 1} (auto)`}
                  className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm font-mono"
                />
                <p className="mt-1 text-xs text-charcoal-faint">Positive integer. Blank = next in sequence.</p>
              </div>
              <div className="col-span-3 flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isOptional" className="h-4 w-4 rounded border-hairline accent-crimson" />
                  <span>Optional item (shown on quotation but excluded from total)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Note</label>
              <textarea
                name="note"
                rows={2}
                defaultValue={selectedProduct?.description ?? ""}
                className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm"
                placeholder="Additional note (optional)"
              />
            </div>

            <div className="flex items-center gap-3 border-t border-hairline pt-4">
              <span className="mr-auto rounded-pill bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                Status: Active
              </span>
              <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-2.5 font-semibold text-white shadow-accent-glow">
                Save item
              </button>
            </div>

            <p className="text-xs text-charcoal-faint">
              Formula: <code>Total = (Unit Price × Quantity − Discount) + Tax</code>. Quotation totals recalculate on save.
            </p>
          </form>
        </section>
      )}

      {q.note && (
        <section className="mt-6 rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Notes</h2>
          <p className="whitespace-pre-wrap text-sm">{q.note}</p>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-charcoal-soft">{k}</dt>
      <dd className="flex-1 text-charcoal">{v ?? "—"}</dd>
    </div>
  );
}
