import { db, schema } from "@/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

/**
 * FSD §3.1 Contact Module — read-only mirror of SAINS CMD. CRM neither creates nor edits;
 * records arrive via the CMD webhook (apps/web/src/app/api/cmd/webhook).
 */
export default async function AccountsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

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
      <PageHeader
        title="Accounts & Contacts"
        description="Read-only. Source of truth: SAINS CMD. Sync via webhook (FSD §3.1.2)."
        actions={
          <Badge tone="neutral" dot>
            {rows.length} records
          </Badge>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No accounts synced yet"
          description="Accounts are mirrored from SAINS CMD via webhook. They will appear here automatically."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-hairline bg-white">
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
              {rows.map(a => (
                <tr key={a.id}>
                  <td className="font-medium text-ink">{a.organizationName}</td>
                  <td className="text-ink-soft">{a.organizationShortName ?? "—"}</td>
                  <td className="font-mono text-xs text-ink-soft">{a.officePhone ?? "—"}</td>
                  <td className="text-ink-soft">{[a.city, a.stateCode].filter(Boolean).join(", ") || "—"}</td>
                  <td className="text-xs text-ink-faint tabular-nums">{a.cmdLastUpdated?.toLocaleString() ?? "—"}</td>
                  <td>
                    <Link href={`/accounts/${a.id}`} className="text-sm font-medium text-accent hover:text-accent-deep transition-colors duration-sains ease-sains">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
