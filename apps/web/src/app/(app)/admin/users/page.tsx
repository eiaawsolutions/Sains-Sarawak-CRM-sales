import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";

export default async function UsersListPage() {
  const rows = await db
    .select({
      id:        schema.users.id,
      fullName:  schema.users.fullName,
      email:     schema.users.email,
      uid:       schema.users.uid,
      isActive:  schema.users.isActive,
      roleCode:  schema.roles.code,
      roleName:  schema.roles.name,
    })
    .from(schema.users)
    .leftJoin(schema.roles, eq(schema.roles.id, schema.users.roleId))
    .orderBy(asc(schema.users.fullName))
    .limit(500);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">User Maintenance</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Admin &gt; User. Ensure the user&rsquo;s login username/email/password is registered in SAINS SSO
            and is consistent with the CRM User Maintenance module.
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-pill bg-gradient-accent px-5 py-2.5 text-sm font-semibold text-white shadow-accent-glow"
        >
          Create New
        </Link>
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>UID</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-charcoal-faint">No users yet.</td></tr>
            )}
            {rows.map(u => (
              <tr key={u.id}>
                <td className="font-medium">
                  <Link href={`/admin/users/${u.id}`} className="text-crimson hover:underline">{u.fullName}</Link>
                </td>
                <td className="text-charcoal-soft">{u.email}</td>
                <td className="font-mono text-xs">{u.uid ?? "—"}</td>
                <td>{u.roleName ?? u.roleCode ?? "—"}</td>
                <td>
                  <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-charcoal-soft"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td><Link href={`/admin/users/${u.id}`} className="text-crimson hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
