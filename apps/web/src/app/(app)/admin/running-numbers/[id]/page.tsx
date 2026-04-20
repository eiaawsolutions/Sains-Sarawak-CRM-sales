import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function RunningNumberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const row = await db.query.quotationSequences.findFirst({ where: eq(schema.quotationSequences.agentUserId, id) });
  if (!row) notFound();

  const agent = await db.query.users.findFirst({ where: eq(schema.users.id, id) });

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Running Number detail</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Read-only.</p>
        </div>
        <Link href="/admin/running-numbers" className="rounded-pill border border-hairline px-5 py-2 text-sm font-semibold">← Back</Link>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-hairline bg-gradient-surface p-6 text-sm shadow-claritas-1">
        <DT label="Agent"           value={agent?.fullName ?? row.agentUserId} />
        <DT label="Staff Prefix"    value={agent?.staffPrefix ?? "—"} mono />
        <DT label="User ID"         value={row.agentUserId} mono />
        <DT label="Current Volume"  value={String(row.currentVolume)} mono />
        <DT label="Next Running No" value={String(row.nextRunningNo)} mono />
        <DT label="Last Used"       value={row.updatedAt?.toLocaleString() ?? "—"} />
      </dl>

      <p className="mt-4 text-xs text-charcoal-soft italic">
        Editing is not allowed due to impact on system logic.
      </p>
    </div>
  );
}

function DT({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{label}</dt>
      <dd className={`mt-1 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
