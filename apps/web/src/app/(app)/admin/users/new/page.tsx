import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { createUserAction } from "@/server/admin-actions";

export default async function NewUserPage() {
  const roles = await db.select().from(schema.roles).orderBy(asc(schema.roles.sortOrder));

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Create New User</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Admin &gt; User &gt; Create New. Fill all mandatory fields.
        </p>
      </header>

      <form action={createUserAction} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <Field label="Full Name *" name="fullName" required />
        <Field label="Email *" name="email" type="email" required />
        <Field label="UID" name="uid" />
        <Field label="Mobile" name="mobile" />
        <Field label="Job Title" name="jobTitle" />

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Role *</label>
          <select name="roleId" required className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2">
            <option value="">— select role —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <Field label="Password *" name="password" type="password" required minLength={8} />
        <p className="text-xs text-charcoal-soft">Password must be at least 8 characters.</p>

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

function Field({ label, name, type = "text", required, minLength }: { label: string; name: string; type?: string; required?: boolean; minLength?: number }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        minLength={minLength}
        className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2"
      />
    </div>
  );
}
