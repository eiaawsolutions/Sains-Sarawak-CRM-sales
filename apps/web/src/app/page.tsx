import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { SainsLogo } from "@/components/shell";

/**
 * Public landing — unauthenticated visitors only. Authenticated users are redirected to
 * /leads by the middleware layer. Intentionally quiet: government-credible, no marketing
 * gloss. One primary CTA (sign in), one secondary (docs).
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper-2">
      <header className="border-b border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-3">
            <SainsLogo size={32} />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-ink">SAINS CRM</div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">Sales</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/docs" className="hidden text-sm text-ink-soft hover:text-ink sm:inline-block">Documentation</Link>
            <ButtonLink href="/auth/signin" tone="primary" size="md">Sign in</ButtonLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-24">
        <section className="grid gap-12 lg:grid-cols-5 lg:gap-16">
          <div className="lg:col-span-3">
            <span className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-white px-3 py-1 text-[11px] font-medium text-ink-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              Live · FSD v1.3 · PDPA compliant
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              The sales workspace for <span className="text-accent-deep">Sarawak Information Systems</span>.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft">
              Lead → Proposal → Quotation → Customer. One pipeline,
              audit-trailed, governed by Section &amp; Unit Head approvals,
              instrumented for quotation performance reporting.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/auth/signin" tone="primary" size="lg">
                Sign in
              </ButtonLink>
              <ButtonLink href="/docs" tone="secondary" size="lg">
                How it works
              </ButtonLink>
            </div>
          </div>

          <aside className="lg:col-span-2">
            <div className="rounded-card border border-hairline bg-white p-6 shadow-ink-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Pipeline at a glance</div>
              <ol className="mt-4 space-y-0">
                <StageRow n={1} label="Lead" hint="Captured from CMD / FIM / manual entry" />
                <StageRow n={2} label="Proposal" hint="Drafted, reviewed, versioned" />
                <StageRow n={3} label="Quotation" hint="Section & Unit Head approval" />
                <StageRow n={4} label="Customer" hint="Won → QPR → renewal" last />
              </ol>
            </div>
          </aside>
        </section>

        <section className="mt-24 grid gap-px overflow-hidden rounded-card border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          <Capability
            title="Ambient capture"
            body="Calls, email and meetings logged without typing. Rep stays on the phone, not the form."
          />
          <Capability
            title="Multi-agent AI"
            body="Specialist agents for enrichment, dedup, draft and forecast. Human in the loop on every send."
          />
          <Capability
            title="Vetting workflow"
            body="Section &amp; Unit Head approval on every quotation. FSD-compliant, audit-trailed end to end."
          />
          <Capability
            title="QPR in one click"
            body="Quotation Performance Report filtered, paginated, exportable to XLSX up to 50,000 rows."
          />
        </section>
      </main>

      <footer className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-[11px] text-ink-faint sm:flex-row lg:px-10">
          <div>Sarawak Information Systems Sdn. Bhd. · Kuching, Sarawak</div>
          <div>SAINS CRM Sales · v1.0</div>
        </div>
      </footer>
    </div>
  );
}

function StageRow({ n, label, hint, last }: { n: number; label: string; hint: string; last?: boolean }) {
  return (
    <li className="relative flex items-start gap-4 py-3">
      <div className="relative flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-faint text-[11px] font-semibold text-accent-deep">
          {n}
        </span>
        {!last && <span className="mt-1 h-6 w-px bg-hairline" aria-hidden />}
      </div>
      <div className="pt-0.5">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-[12px] text-ink-soft">{hint}</div>
      </div>
    </li>
  );
}

function Capability({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-white p-6">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</div>
    </div>
  );
}
