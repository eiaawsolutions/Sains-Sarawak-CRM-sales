import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";

export default async function SystemSettingsPage() {
  const rows = await db.select().from(schema.featureFlags).orderBy(asc(schema.featureFlags.key));

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">System Setting Maintenance</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Admin &gt; System Setting. Numeric thresholds and feature flags (e.g.&nbsp;Vetting threshold).
        </p>
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Description</th>
              <th>Enabled</th>
              <th>Numeric Value</th>
              <th>Last Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-charcoal-faint">No settings yet.</td></tr>
            )}
            {rows.map(f => (
              <tr key={f.key}>
                <td className="font-mono text-sm">
                  <Link href={`/admin/system-settings/${encodeURIComponent(f.key)}`} className="text-crimson hover:underline">{f.key}</Link>
                </td>
                <td className="text-charcoal-soft">{f.description ?? "—"}</td>
                <td>
                  <span className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${f.isEnabled ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-charcoal-soft"}`}>
                    {f.isEnabled ? "On" : "Off"}
                  </span>
                </td>
                <td className="font-mono">{f.numericValue ?? "—"}</td>
                <td className="text-xs text-charcoal-soft">{f.updatedAt?.toLocaleString() ?? "—"}</td>
                <td><Link href={`/admin/system-settings/${encodeURIComponent(f.key)}`} className="text-crimson hover:underline">Edit →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
