import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateUserAction } from "@/server/admin-actions";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const row = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!row) notFound();

  const roles = await db.select().from(schema.roles).orderBy(asc(schema.roles.sortOrder));

  const update = updateUserAction.bind(null, id);

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">User details</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Edit and save changes.</p>
        </div>
        <Link href="/admin/users" className="rounded-pill border border-hairline px-5 py-2 text-sm font-semibold">← Back to list</Link>
      </header>

      <form action={update} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <Field label="Full Name *" name="fullName" defaultValue={row.fullName} required />
        <Field label="Email *" name="email" type="email" defaultValue={row.email} required />
        <Field label="UID" name="uid" defaultValue={row.uid ?? ""} />
        <Field label="Mobile" name="mobile" defaultValue={row.mobile ?? ""} />
        <Field label="Job Title" name="jobTitle" defaultValue={row.jobTitle ?? ""} />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Role *</label>
          <select name="roleId" required defaultValue={String(row.roleId)} className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2">
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={row.isActive} />
          Active
        </label>

        <Field label="New password (leave blank to keep current)" name="password" type="password" minLength={8} />

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
            Save
          </button>
          <Link href="/admin/users" className="rounded-pill border border-hairline px-6 py-3 font-semibold">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", defaultValue, required, minLength }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; minLength?: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{label}</label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        required={required}
        minLength={minLength}
        className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2"
      />
    </div>
  );
}
