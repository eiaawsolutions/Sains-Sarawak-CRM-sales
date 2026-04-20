import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

/**
 * Catch-all reader for docs/**. Renders markdown as a pre-formatted block to avoid adding
 * a markdown-parser dependency for what is essentially internal reference material.
 */
export default async function DocPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (!slug?.length) notFound();

  const docsRoot = path.resolve(process.cwd(), "src", "content", "docs");
  const safeSegments = slug.map(s => s.replace(/[^a-z0-9_\-.]/gi, ""));
  const candidatePath = path.join(docsRoot, ...safeSegments) + ".md";

  const resolved = path.resolve(candidatePath);
  if (!resolved.startsWith(docsRoot)) notFound();

  let content: string;
  try {
    content = await fs.readFile(resolved, "utf8");
  } catch {
    notFound();
  }

  const title = safeSegments[safeSegments.length - 1].replace(/-/g, " ");
  const breadcrumb = safeSegments.slice(0, -1).join(" / ");

  return (
    <div className="max-w-3xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/docs" className="hover:text-crimson">Docs</Link>
        {breadcrumb && <> <span className="mx-2">/</span> <span>{breadcrumb}</span></>}
      </nav>

      <header className="mb-4">
        <h1 className="text-2xl font-semibold capitalize">{title}</h1>
      </header>

      <article className="rounded-lg border border-hairline bg-white p-6 shadow-claritas-1">
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-charcoal">
          {content}
        </pre>
      </article>
    </div>
  );
}
