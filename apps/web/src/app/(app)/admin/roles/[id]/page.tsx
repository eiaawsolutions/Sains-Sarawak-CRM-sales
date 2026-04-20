import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateRoleAction } from "@/server/admin-actions";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roleId = Number(id);
  if (!Number.isFinite(roleId)) notFound();

  const row = await db.query.roles.findFirst({ where: eq(schema.roles.id, roleId) });
  if (!row) notFound();

  const update = updateRoleAction.bind(null, roleId);

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Edit role</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Code: <span className="font-mono">{row.code}</span> · ID: {row.id}
          </p>
        </div>
        <Link href="/admin/roles" className="rounded-pill border border-hairline px-5 py-2 text-sm font-semibold">← Back</Link>
      </header>

      <form action={update} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Name *</label>
          <input name="name" defaultValue={row.name} required className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Description</label>
          <textarea name="description" defaultValue={row.description ?? ""} rows={3} className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={row.isActive} />
          Active
        </label>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">Save</button>
          <Link href="/admin/roles" className="rounded-pill border border-hairline px-6 py-3 font-semibold">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
