import Link from "next/link";
import { PageHeader } from "@/components/ui";

const TILES: { href: string; title: string; blurb: string; glyph: React.ReactNode }[] = [
  { href: "/admin/users",           title: "User Maintenance",  blurb: "Create, view, and edit CRM user accounts. Must be registered in SAINS SSO.", glyph: <IconUser /> },
  { href: "/admin/roles",           title: "Role Maintenance",  blurb: "View and edit role metadata.", glyph: <IconShield /> },
  { href: "/admin/system-settings", title: "System Setting",    blurb: "Vetting thresholds, feature flags, numeric configuration.", glyph: <IconSliders /> },
  { href: "/admin/products",        title: "Product Catalogue", blurb: "Products used in quotations and proposals.", glyph: <IconBox /> },
  { href: "/admin/pick-lists",      title: "Pick List",         blurb: "Edit lookup lists. Changing these is not recommended without CRM support confirmation.", glyph: <IconList /> },
  { href: "/admin/running-numbers", title: "Running Number",    blurb: "Per-agent quotation running-number sequences. Read-only.", glyph: <IconHash /> },
  { href: "/admin/audit-trail",     title: "Audit Trail",       blurb: "Search and export system activity logs.", glyph: <IconClipboard /> },
  { href: "/admin/uat",             title: "UAT Test Harness",  blurb: "Auto-execute SAINS test scripts and reconcile results.", glyph: <IconBeaker /> },
];

export default function AdminIndexPage() {
  return (
    <div>
      <PageHeader
        title="Administration"
        description="Core CRM configuration — user access, roles, system settings, pick lists, running numbers, audit logs."
      />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(t => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col bg-white p-5 transition-colors duration-sains ease-sains hover:bg-paper-2"
          >
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-paper-2 text-ink-soft group-hover:border-accent/30 group-hover:text-accent group-hover:bg-accent-faint transition-colors duration-sains ease-sains">
              {t.glyph}
            </div>
            <div className="text-sm font-semibold text-ink">{t.title}</div>
            <div className="mt-1 flex-1 text-[12px] leading-relaxed text-ink-soft">{t.blurb}</div>
            <div className="mt-3 text-[12px] font-medium text-accent group-hover:text-accent-deep transition-colors duration-sains ease-sains">
              Open →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function IconUser()      { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconShield()    { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>; }
function IconSliders()   { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>; }
function IconBox()       { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 16V8a2 2 0 0 0-1-1.7L13 2.3a2 2 0 0 0-2 0L4 6.3A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12 20.73 6.96"/><line x1="12" y1="22" x2="12" y2="12"/></svg>; }
function IconList()      { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>; }
function IconHash()      { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>; }
function IconClipboard() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>; }
function IconBeaker()    { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 14h10"/></svg>; }
