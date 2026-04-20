import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateFeatureFlagAction } from "@/server/admin-actions";

export default async function SystemSettingEditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);

  const row = await db.query.featureFlags.findFirst({ where: eq(schema.featureFlags.key, key) });
  if (!row) notFound();

  const update = updateFeatureFlagAction.bind(null, key);

  return (
    <div className="max-w-3xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Edit setting</h1>
          <p className="mt-1 text-sm text-charcoal-soft">Key: <span className="font-mono">{key}</span></p>
        </div>
        <Link href="/admin/system-settings" className="rounded-pill border border-hairline px-5 py-2 text-sm font-semibold">← Back</Link>
      </header>

      <form action={update} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={row.isEnabled} />
          Enabled
        </label>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Numeric Value</label>
          <input name="numericValue" defaultValue={row.numericValue ?? ""} className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" placeholder="e.g. 100000" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Description</label>
          <textarea name="description" defaultValue={row.description ?? ""} rows={3} className="mt-1 w-full rounded-md border border-hairline bg-white px-3 py-2" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">Save</button>
          <Link href="/admin/system-settings" className="rounded-pill border border-hairline px-6 py-3 font-semibold">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
