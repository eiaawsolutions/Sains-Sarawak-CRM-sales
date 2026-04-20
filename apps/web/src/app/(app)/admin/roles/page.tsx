import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";

export default async function RolesListPage() {
  const roles = await db.select().from(schema.roles).orderBy(asc(schema.roles.sortOrder));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Role Maintenance</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Admin &gt; Role. Roles drive visibility, approval routing, and admin access.
        </p>
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Code</th>
              <th>Description</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-charcoal-faint">No roles defined.</td></tr>
            )}
            {roles.map(r => (
              <tr key={r.id}>
                <td className="font-medium">
                  <Link href={`/admin/roles/${r.id}`} className="text-crimson hover:underline">{r.name}</Link>
                </td>
                <td className="font-mono text-xs">{r.code}</td>
                <td className="text-charcoal-soft">{r.description ?? "—"}</td>
                <td>
                  <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${r.isActive ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-charcoal-soft"}`}>
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td><Link href={`/admin/roles/${r.id}`} className="text-crimson hover:underline">Edit →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
