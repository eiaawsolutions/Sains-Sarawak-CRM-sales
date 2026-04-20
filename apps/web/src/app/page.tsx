import Link from "next/link";

/**
 * Landing — if authenticated, the shell redirects to /leads. Unauth visitors see this hero
 * and a single CTA to kick off the FIM OIDC flow.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-hero">
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">SAINS CRM Sales</span>
        </div>
        <Link
          href="/auth/signin"
          className="inline-flex items-center gap-2 rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow transition hover:bg-gradient-cta-hover"
        >
          Sign in with SAINS SSO
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-8 pt-24 pb-16 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-charcoal md:text-6xl">
          Lead → Proposal → Quotation → <span className="text-crimson">Customer</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-charcoal-soft">
          A world-class CRM for Sarawak Information Systems. Built on the signed FSD v1.3 with
          confirmed v1.1 upgrades: ambient capture, multi-agent AI, intent graphs, PDPA-grade
          trust layer.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/auth/signin" className="rounded-pill bg-gradient-accent px-8 py-4 font-semibold text-white shadow-accent-glow transition hover:bg-gradient-cta-hover">
            Get started
          </Link>
          <Link href="/docs" className="rounded-pill border border-hairline px-8 py-4 font-medium text-charcoal transition hover:border-crimson hover:text-crimson">
            How it works
          </Link>
        </div>
      </section>

      <footer className="mt-16 px-8 pb-8 text-center text-xs text-charcoal-faint">
        Claritas × EIAAW Solutions · SAINS Sarawak · v1.0
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="url(#g)" stroke="#3f3f3f" strokeWidth="0.5" />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#721011" />
          <stop offset="100%" stopColor="#3f3f3f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
