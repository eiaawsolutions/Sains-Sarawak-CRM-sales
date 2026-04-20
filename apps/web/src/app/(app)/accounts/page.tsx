import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * FSD §3.1 Contact Module — read-only mirror of SAINS CMD. CRM neither creates nor edits;
 * records arrive via the CMD webhook (apps/web/src/app/api/cmd/webhook).
 */
export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const rows = await db
    .select({
      id: schema.accounts.id,
      organizationName: schema.accounts.organizationName,
      organizationShortName: schema.accounts.organizationShortName,
      officePhone: schema.accounts.officePhone,
      city: schema.accounts.city,
      stateCode: schema.accounts.stateCode,
      cmdLastUpdated: schema.accounts.cmdLastUpdated,
    })
    .from(schema.accounts)
    .orderBy(asc(schema.accounts.organizationName))
    .limit(200);

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Accounts &amp; Contacts</h1>
          <p className="mt-1 text-sm text-charcoal-soft">
            Read-only. Source of truth: SAINS CMD. Sync via webhook (FSD §3.1.2).
          </p>
        </div>
        <span className="rounded-pill border border-hairline bg-white px-4 py-2 text-xs text-charcoal-soft">
          {rows.length} records
        </span>
      </header>

      <div className="rounded-lg border border-hairline bg-gradient-surface p-0 shadow-claritas-1">
        <table className="data-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Short name</th>
              <th>Phone</th>
              <th>City / State</th>
              <th>Last synced (CMD)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-charcoal-faint">
                  No accounts yet. CMD webhook will populate these automatically.
                </td>
              </tr>
            )}
            {rows.map(a => (
              <tr key={a.id}>
                <td className="font-medium">{a.organizationName}</td>
                <td className="text-charcoal-soft">{a.organizationShortName ?? "—"}</td>
                <td className="font-mono text-xs">{a.officePhone ?? "—"}</td>
                <td>{[a.city, a.stateCode].filter(Boolean).join(", ") || "—"}</td>
                <td className="text-xs text-charcoal-soft">{a.cmdLastUpdated?.toLocaleString() ?? "—"}</td>
                <td><Link href={`/accounts/${a.id}`} className="text-crimson hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
