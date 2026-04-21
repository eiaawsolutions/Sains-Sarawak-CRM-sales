import Link from "next/link";
import { Badge, Card, Kpi, PageHeader } from "@/components/ui";

export const metadata = { title: "System Overview · SAINS CRM" };

const MODULES: { href: string; title: string; blurb: string; owner: string; glyph: React.ReactNode }[] = [
  { href: "/leads",      title: "Leads",      owner: "Account Manager", blurb: "Inbound enquiries and cold prospects. Reassign, qualify, and convert to Accounts.", glyph: <IconUsers /> },
  { href: "/accounts",   title: "Accounts",   owner: "Account Manager", blurb: "Organisations synchronised from CMD. 360° view of contacts, proposals and quotation history.", glyph: <IconBuilding /> },
  { href: "/proposals",  title: "Proposals",  owner: "Account Manager", blurb: "Pre-sales narrative + costing workbook. Feeds into formal quotations once scope is agreed.", glyph: <IconFileText /> },
  { href: "/quotations", title: "Quotations", owner: "Account Manager → Vetter", blurb: "New / Revised / Discounted / AOQ PDFs aligned to SAINS sample designs. Vetting + approval chain.", glyph: <IconReceipt /> },
  { href: "/reports",    title: "Reports",    owner: "All roles",        blurb: "QPR pipeline export (XLSX 50k cap) + PDF summaries with Inter-embedded rendering.", glyph: <IconBarChart /> },
  { href: "/admin",      title: "Administration", owner: "Administrator", blurb: "Users, roles, pick lists, product catalogue, running numbers, audit trail, UAT harness.", glyph: <IconShield /> },
];

const ROLES = [
  { code: "AccountManager", label: "Account Manager", scope: "Owns leads, accounts, proposals, quotations within assigned unit." },
  { code: "UnitHead",       label: "Unit Head",       scope: "Oversees unit pipeline + reassignment. Can vet quotations within threshold." },
  { code: "SectionHead",    label: "Section Head",    scope: "Vets quotations against policy thresholds. Final approver for mid-tier values." },
  { code: "Director",       label: "Director",        scope: "Approves high-value quotations and discount deviations." },
  { code: "Finance",        label: "Finance",         scope: "Consumes AOQ / Proposal Costing exports. Read-only on operational data." },
  { code: "Administrator",  label: "Administrator",   scope: "Platform configuration, audit trail, UAT harness, pick-list maintenance." },
];

const STACK = [
  { layer: "Web",        items: ["Next.js 15 (App Router)", "React Server Components", "Tailwind CSS", "SAINS design primitives"] },
  { layer: "Runtime",    items: ["Node.js on Railway", "Route handlers for PDF/XLSX streaming", "Inter TTF embedded for reports"] },
  { layer: "Auth",       items: ["FIM 2.0 OIDC (Authorization Code + PKCE)", "LDAP profile resolution via Smart-XChange", "Role table keyed on FIM sub"] },
  { layer: "Data",       items: ["MSSQL 2022 (PROD)", "Drizzle ORM", "Temporal Tables for audit", "Row-Level Security per user_id"] },
  { layer: "Integration",items: ["CMD webhook (HMAC-SHA256) for account sync", "LDAP Bearer query", "SAINS Outlook outbound (v1.1)"] },
  { layer: "Ops",        items: ["GitHub → Railway CI", "UAT harness with seed + Playwright E2E", "QPR export tuned with pageSize + 50k cap"] },
];

export default function SystemOverviewPage() {
  return (
    <div>
      <PageHeader
        title="System Overview"
        description="What the SAINS CRM Sales does, who uses it, and what lives inside each module. A one-page brief for new users, auditors and stakeholders."
        breadcrumbs={[{ label: "Help", href: "/docs" }, { label: "System Overview" }]}
      />

      {/* KPIs — at-a-glance scope numbers */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Core modules" value="6" hint="Leads → Accounts → Proposals → Quotations → Reports → Admin" />
        <Kpi label="User roles"   value="6" tone="accent" hint="FIM SSO + CRM role table" />
        <Kpi label="Quotation types" value="4" tone="teal" hint="New · Revised · Discounted · AOQ" />
        <Kpi label="Environments" value="2" hint="UAT + PROD on SAINS Data Centre" />
      </section>

      {/* Product summary */}
      <section className="mb-10">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-faint">What it is</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            <strong className="font-semibold text-ink">SAINS CRM Sales</strong> is the opportunity-to-quotation system for Sarawak Information Systems Sdn. Bhd.
            It replaces the legacy ClaritasTM CRM surface and anchors the sales workflow on a sovereign Windows / MSSQL / .NET stack
            hosted in SAINS Sarawak Data Centre. Accounts flow in from CMD via an HMAC-signed webhook; users sign in via FIM 2.0 OIDC;
            quotations are drafted by Account Managers, vetted by Section Heads, and exported as SAINS-branded PDFs aligned to the four
            sample designs (New / Revised / Discounted / AOQ + Proposal Costing).
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            v1.0 ships the deterministic workflow. v1.1 opens the trust-layered agent track (Quotation Drafter, Lead Enricher, Forecast
            Narrator) at L1–L2 autonomy via a hierarchical topology — all invocations PII-redacted at the LiteLLM gateway before egress.
          </p>
        </Card>
      </section>

      {/* Modules */}
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Modules</h2>
            <p className="mt-0.5 text-sm text-ink-soft">The six surfaces that make up the CRM.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(m => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex flex-col bg-white p-5 transition-colors duration-sains ease-sains hover:bg-paper-2"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-paper-2 text-ink-soft group-hover:border-accent/30 group-hover:bg-accent-faint group-hover:text-accent transition-colors duration-sains ease-sains">
                {m.glyph}
              </div>
              <div className="text-sm font-semibold text-ink">{m.title}</div>
              <div className="mt-1 flex-1 text-[12px] leading-relaxed text-ink-soft">{m.blurb}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-ink-faint">{m.owner}</span>
                <span className="text-[12px] font-medium text-accent group-hover:text-accent-deep transition-colors duration-sains ease-sains">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Who uses it</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Six roles with distinct scopes. RBAC enforced at route + DB via RLS.</p>
        </div>
        <Card padded={false}>
          <div className="divide-y divide-hairline">
            {ROLES.map(r => (
              <div key={r.code} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6">
                <div className="w-48 shrink-0">
                  <Badge tone="neutral">{r.label}</Badge>
                </div>
                <div className="text-sm text-ink-soft">{r.scope}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Tech stack */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Tech stack</h2>
          <p className="mt-0.5 text-sm text-ink-soft">The layers behind each screen.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STACK.map(s => (
            <Card key={s.layer}>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{s.layer}</div>
              <ul className="space-y-1.5 text-sm text-ink">
                {s.items.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* Cross-link */}
      <section>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">Want to see how the pieces fit together?</div>
            <div className="mt-0.5 text-sm text-ink-soft">
              The <strong>System Logic</strong> page walks through the quotation lifecycle, approval chain, and integration flow end-to-end.
            </div>
          </div>
          <Link
            href="/system-logic"
            className="inline-flex items-center gap-2 self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-ink-1 transition-colors duration-sains ease-sains hover:bg-accent-deep sm:self-auto"
          >
            Open System Logic →
          </Link>
        </Card>
      </section>
    </div>
  );
}

// ---- Icons (match the app-shell + admin-hub glyph family) --------
function IconUsers()     { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconBuilding()  { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/></svg>; }
function IconFileText()  { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>; }
function IconReceipt()   { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>; }
function IconBarChart()  { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="13" y="8" width="3" height="10"/><rect x="19" y="4" width="3" height="14"/></svg>; }
function IconShield()    { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>; }
