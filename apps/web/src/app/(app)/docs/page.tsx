import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Browses repo-level markdown docs (ADRs, briefs, CHANGELOG). Discovered at request time,
 * so adding a file to docs/ on the next deploy shows up without code changes.
 */
export default async function DocsIndexPage() {
  const docsRoot = path.resolve(process.cwd(), "src", "content", "docs");
  let adrFiles: string[] = [];
  let briefFiles: string[] = [];
  let hasChangelog = false;
  let available = true;

  try {
    adrFiles = (await fs.readdir(path.join(docsRoot, "adr"))).filter(f => f.endsWith(".md")).sort();
    briefFiles = (await fs.readdir(path.join(docsRoot, "briefs"))).filter(f => f.endsWith(".md")).sort();
    await fs.access(path.join(docsRoot, "CHANGELOG.md"));
    hasChangelog = true;
  } catch {
    available = false;
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Docs</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Architecture Decision Records, briefs, and changelog for the SAINS CRM build.
        </p>
      </header>

      {!available && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          Docs directory not bundled in this deploy. Bundling and retrying will populate this page.
        </div>
      )}

      {available && (
        <div className="grid gap-6">
          {hasChangelog && (
            <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Changelog</h2>
              <Link href="/docs/CHANGELOG" className="text-crimson hover:underline">Read CHANGELOG →</Link>
            </section>
          )}

          <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Architecture Decision Records ({adrFiles.length})</h2>
            <ul className="space-y-1 text-sm">
              {adrFiles.map(f => (
                <li key={f}>
                  <Link href={`/docs/adr/${f.replace(/\.md$/, "")}`} className="text-crimson hover:underline">
                    {f.replace(/\.md$/, "").replace(/-/g, " ")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Briefs ({briefFiles.length})</h2>
            <ul className="space-y-1 text-sm">
              {briefFiles.map(f => (
                <li key={f}>
                  <Link href={`/docs/briefs/${f.replace(/\.md$/, "")}`} className="text-crimson hover:underline">
                    {f.replace(/\.md$/, "").replace(/-/g, " ")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
