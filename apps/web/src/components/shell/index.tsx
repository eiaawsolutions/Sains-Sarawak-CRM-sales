import Link from "next/link";
import * as React from "react";
import { cn } from "@/components/ui";

/**
 * SAINS CRM — app shell.
 *
 * Persistent left sidebar on lg+, off-canvas on mobile (CSS-only, peer checkbox).
 * All server-safe; no client JS required. Active-state highlighting is done by
 * the caller passing `currentPath` (usually via `usePathname` in a wrapper) OR
 * via the anchor matching — we keep it pathname-agnostic here and let each
 * NavItem derive its own active state at click/render time using href prefix
 * matching against the caller-supplied `pathname` string.
 */

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

/**
 * Official SAINS lockup. Renders /sains-logo.svg (the corporate mark + "sains"
 * wordmark, native aspect ratio 447:190 ≈ 2.35:1). The `size` prop sets the
 * rendered HEIGHT in px; width scales to preserve aspect.
 */
export function SainsLogo({ size = 32 }: { size?: number }) {
  const width = Math.round((size * 447) / 190);
  return (
    <img
      src="/sains-logo.svg"
      alt="SAINS"
      width={width}
      height={size}
      style={{ width, height: size }}
      className="block select-none"
      draggable={false}
    />
  );
}

export function AppShell({
  role,
  userName,
  userEmail,
  pathname,
  signOutAction,
  children,
}: {
  role: string;
  userName: string;
  userEmail?: string;
  pathname: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const isAdmin = role === "Administrator";
  const isVetter = ["SectionHead", "UnitHead", "Director", "Administrator"].includes(role);

  const groups: NavGroup[] = [
    {
      items: [
        { href: "/leads",      label: "Leads",      icon: <IconUsers /> },
        { href: "/accounts",   label: "Accounts",   icon: <IconBuilding /> },
        { href: "/proposals",  label: "Proposals",  icon: <IconFileText /> },
        { href: "/quotations", label: "Quotations", icon: <IconReceipt /> },
      ],
    },
    ...(isVetter ? [{
      label: "Approvals",
      items: [{ href: "/quotations/approval", label: "Quotation vetting", icon: <IconCheckCircle /> }],
    }] : []),
    {
      label: "Insight",
      items: [{ href: "/reports", label: "Reports", icon: <IconBarChart /> }],
    },
    ...(isAdmin ? [{
      label: "Administration",
      items: [
        { href: "/admin",     label: "Admin hub", icon: <IconShield /> },
        { href: "/admin/uat", label: "UAT harness", icon: <IconBeaker /> },
      ],
    }] : []),
    {
      label: "Help",
      items: [
        { href: "/system-overview", label: "System Overview", icon: <IconMap /> },
        { href: "/system-logic",    label: "System Logic",    icon: <IconGitBranch /> },
        { href: "/docs",            label: "Documentation",   icon: <IconBook /> },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-paper-2">
      {/* Off-canvas toggle (CSS-only). Checked = drawer open on mobile. */}
      <input id="sains-nav" type="checkbox" className="peer sr-only" />

      {/* Mobile overlay */}
      <label
        htmlFor="sains-nav"
        aria-hidden
        className="fixed inset-0 z-30 hidden cursor-pointer bg-overlay peer-checked:block lg:peer-checked:hidden"
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] -translate-x-full flex-col border-r border-hairline bg-white",
          "transition-transform duration-sains ease-sains",
          "peer-checked:translate-x-0 lg:translate-x-0"
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-hairline px-5">
          <SainsLogo size={22} />
          <div className="ml-auto leading-tight text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">CRM</div>
            <div className="text-[9px] font-medium uppercase tracking-wider text-ink-faint">Sales</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-5")}>
              {g.label && (
                <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  {g.label}
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = isPathActive(pathname, it.href);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={cn(
                          "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors duration-sains ease-sains",
                          active
                            ? "bg-accent-faint text-accent-deep font-medium"
                            : "text-ink-soft hover:bg-paper-2 hover:text-ink"
                        )}
                      >
                        <span className={cn("shrink-0", active ? "text-accent" : "text-ink-faint group-hover:text-ink-soft")}>
                          {it.icon}
                        </span>
                        <span className="truncate">{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-hairline p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-faint text-[12px] font-semibold text-accent-deep">
              {getInitials(userName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{userName}</div>
              <div className="truncate text-[11px] text-ink-faint">{roleLabel(role)}</div>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline2 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-sains ease-sains hover:bg-paper-2 hover:text-ink"
            >
              <IconSignOut /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-[260px]">
        {/* Topbar (mobile gets the nav trigger; desktop gets the search/context bar) */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-hairline bg-white/85 px-4 backdrop-blur lg:px-8">
          <label
            htmlFor="sains-nav"
            aria-label="Open navigation"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-hairline2 text-ink-soft hover:bg-paper-2 lg:hidden"
          >
            <IconMenu />
          </label>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden text-[11px] font-medium uppercase tracking-wider text-ink-faint sm:block">
              {moduleLabelFromPath(pathname)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-pill border border-hairline px-2.5 py-1 text-[11px] font-medium text-ink-soft sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-teal" />
              {roleLabel(role)}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>

        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-8 pt-4 text-center text-[11px] text-ink-faint lg:px-8">
          Sarawak Information Systems Sdn. Bhd. · SAINS CRM Sales · v1.0
          {userEmail && <span className="ml-2 text-ink-faint/70">· {userEmail}</span>}
        </footer>
      </div>
    </div>
  );
}

// ---- helpers -----------------------------------------------------
function isPathActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // Match exact or as-a-prefix followed by "/", so /admin doesn't match /admin-something
  return pathname === href || pathname.startsWith(href + "/");
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function roleLabel(code: string) {
  const m: Record<string, string> = {
    Administrator: "Administrator",
    Director: "Director",
    SectionHead: "Section Head",
    UnitHead: "Unit Head",
    AccountManager: "Account Manager",
    Finance: "Finance",
  };
  return m[code] ?? code;
}

function moduleLabelFromPath(pathname: string) {
  if (pathname.startsWith("/leads"))      return "Leads";
  if (pathname.startsWith("/accounts"))   return "Accounts";
  if (pathname.startsWith("/proposals"))  return "Proposals";
  if (pathname.startsWith("/quotations")) return "Quotations";
  if (pathname.startsWith("/reports"))    return "Reports";
  if (pathname.startsWith("/admin"))      return "Administration";
  if (pathname.startsWith("/docs"))       return "Documentation";
  if (pathname.startsWith("/system-overview")) return "System Overview";
  if (pathname.startsWith("/system-logic"))    return "System Logic";
  return "";
}

// ---- Icons (16px, 1.75 stroke, pure geometry) --------------------
function IconUsers() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IconBuilding() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>;
}
function IconFileText() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>;
}
function IconReceipt() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>;
}
function IconCheckCircle() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>;
}
function IconBarChart() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="13" y="8" width="3" height="10"/><rect x="19" y="4" width="0.01" height="14"/><rect x="19" y="4" width="3" height="14"/></svg>;
}
function IconShield() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>;
}
function IconBeaker() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 14h10"/></svg>;
}
function IconBook() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;
}
function IconMap() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>;
}
function IconGitBranch() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>;
}
function IconMenu() {
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>;
}
function IconSignOut() {
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}
