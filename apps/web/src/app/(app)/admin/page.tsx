import Link from "next/link";

const TILES: { href: string; title: string; blurb: string }[] = [
  { href: "/admin/users",           title: "User Maintenance",     blurb: "Create, view, and edit CRM user accounts. Must be registered in SAINS SSO." },
  { href: "/admin/roles",           title: "Role Maintenance",     blurb: "View and edit role metadata." },
  { href: "/admin/system-settings", title: "System Setting",       blurb: "Vetting thresholds, feature flags, numeric configuration." },
  { href: "/admin/products",        title: "Product Catalogue",    blurb: "Products used in quotations and proposals." },
  { href: "/admin/pick-lists",      title: "Pick List",            blurb: "Edit lookup lists. Changing these is not recommended without CRM support confirmation." },
  { href: "/admin/running-numbers", title: "Running Number",       blurb: "Per-agent quotation running-number sequences. Read-only." },
  { href: "/admin/audit-trail",     title: "Audit Trail",          blurb: "Search and export system activity logs." },
  { href: "/admin/uat",             title: "UAT Test Harness",     blurb: "Auto-execute SAINS test scripts and reconcile results." },
];

export default function AdminIndexPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="mt-1 max-w-3xl text-sm text-charcoal-soft">
          Core CRM configuration — user access, roles, system settings, pick lists, running numbers, audit logs.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className="block rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1 transition hover:border-crimson hover:shadow-accent-glow"
          >
            <div className="text-lg font-semibold">{t.title}</div>
            <div className="mt-1 text-xs text-charcoal-soft">{t.blurb}</div>
            <div className="mt-3 text-xs font-semibold text-crimson">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
