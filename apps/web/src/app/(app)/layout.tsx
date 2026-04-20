import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * Authenticated app shell. Shared layout for Leads / Quotations / Proposals / Reports / Admin.
 * Everything under `(app)/` is protected — unauthenticated hits bounce to FIM SSO.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const role = session.user.roleCode;
  const isAdmin = role === "Administrator";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-gradient-hero">
        <header className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <Logo />
            <Link href="/leads" className="font-semibold tracking-tight">SAINS CRM Sales</Link>
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <NavLink href="/leads">Leads</NavLink>
            <NavLink href="/quotations">Quotations</NavLink>
            <NavLink href="/proposals">Proposals</NavLink>
            <NavLink href="/reports">Reports</NavLink>
            {isAdmin && <NavLink href="/admin/uat">UAT</NavLink>}
            {isAdmin && <NavLink href="/admin">Admin</NavLink>}
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button className="rounded-pill border border-hairline px-4 py-2 font-medium transition hover:border-crimson hover:text-crimson">
                Sign out
              </button>
            </form>
          </nav>
        </header>
      </div>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-8">{children}</main>

      <footer className="mx-auto w-full max-w-[1400px] px-8 py-6 text-center text-xs text-charcoal-faint">
        Claritas × EIAAW Solutions · {role} · v1.0
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-charcoal-soft transition hover:text-crimson">{children}</Link>;
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="url(#g2)" stroke="#3f3f3f" strokeWidth="0.5" />
      <defs>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#721011" />
          <stop offset="100%" stopColor="#3f3f3f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
