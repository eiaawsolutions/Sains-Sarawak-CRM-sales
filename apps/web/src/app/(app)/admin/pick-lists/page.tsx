import Link from "next/link";

const LISTS: { href: string; title: string }[] = [
  { href: "/admin/pick-lists/organizationTypes", title: "Organization Types" },
  { href: "/admin/pick-lists/salutations",       title: "Salutations" },
  { href: "/admin/pick-lists/designations",      title: "Designations" },
  { href: "/admin/pick-lists/productCategories", title: "Product Categories" },
  { href: "/admin/pick-lists/rejectionReasons",  title: "Rejection Reasons" },
  { href: "/admin/pick-lists/quotationTypes",    title: "Quotation Types" },
  { href: "/admin/pick-lists/fundSources",       title: "Source of Fund" },
];

export default function PickListsIndexPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Pick List Maintenance</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Admin &gt; Pick List. Changing pick lists is not recommended without CRM support confirmation.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LISTS.map(l => (
          <Link key={l.href} href={l.href}
            className="block rounded-lg border border-hairline bg-gradient-surface p-5 shadow-claritas-1 transition hover:border-crimson hover:shadow-accent-glow">
            <div className="font-semibold">{l.title}</div>
            <div className="mt-3 text-xs font-semibold text-crimson">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
