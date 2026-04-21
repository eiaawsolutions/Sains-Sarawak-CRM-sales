import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "System Logic · SAINS CRM" };

const LIFECYCLE = [
  { step: "01", title: "Lead created",           who: "Account Manager",             rule: "Mandatory fields: organisation, contact, source. Status starts at 'New'." },
  { step: "02", title: "Lead qualified",         who: "Account Manager",             rule: "Qualified leads are convertible to Accounts. Disqualified leads stay for audit." },
  { step: "03", title: "Account synchronised",   who: "CMD (automated)",             rule: "CMD webhook is source of truth. CRM mirrors. Manual edits are flagged." },
  { step: "04", title: "Proposal drafted",       who: "Account Manager",             rule: "Narrative + costing workbook. Finance reviews the AOQ surface before quotation." },
  { step: "05", title: "Quotation raised",       who: "Account Manager",             rule: "Type selected from {New, Revised, Discounted, AOQ}. Running number assigned per owner." },
  { step: "06", title: "Quotation vetted",       who: "Unit Head / Section Head",    rule: "Routing depends on value + discount. Vetter can Approve, Return for revision, or Reject." },
  { step: "07", title: "Customer-signed Won",    who: "Account Manager",             rule: "Upload signed copy. Triggers audit-log entry + CMD account mark." },
  { step: "08", title: "Closed (Won / Rejected)",who: "System",                      rule: "Terminal state. Emits event for Reports (QPR) + dashboards." },
];

const APPROVAL = [
  { tier: "Tier 0", threshold: "< threshold A",           approver: "Unit Head",    rule: "Straight-through. No Section Head required." },
  { tier: "Tier 1", threshold: "≥ threshold A, < B",      approver: "Section Head", rule: "Unit Head pre-review recommended but not blocking." },
  { tier: "Tier 2", threshold: "≥ threshold B, < C",      approver: "Section Head + Director", rule: "Dual sign-off. Section Head first, Director last." },
  { tier: "Tier 3", threshold: "≥ threshold C OR discount > policy", approver: "Director",     rule: "Director-only final approver. Always HITL; never auto-approved regardless of v1.1 agents." },
];

const INTEGRATIONS = [
  { name: "FIM 2.0",           dir: "Browser → FIM → CRM",    proto: "OIDC Auth Code + PKCE",      note: "Access token TTL 3600s. Scopes: openid email cn mobile." },
  { name: "LDAP (Smart-XChange)", dir: "CRM → Smart-XChange → LDAP", proto: "OAuth2 client_credentials → Bearer", note: "On-demand profile resolution from FIM sub." },
  { name: "CMD",               dir: "CMD → CRM",              proto: "HMAC-SHA256 POST",           note: "Idempotency key = SHA256(request body). Real-time on CMD writes + batch CSV initial load." },
  { name: "SAINS Outlook",     dir: "CRM → Outlook",          proto: "SMTP + OAuth2 (v1.1)",        note: "Vetting notifications. Requires app-server outbound internet." },
  { name: "QPR Report",        dir: "CRM → Finance",          proto: "PDF + XLSX stream",          note: "50,000-row cap on XLSX. Inter TTF embedded for PDF consistency." },
];

const GUARDRAILS = [
  { n: 1, label: "Tool allowlist",         impl: "Parameterised queries only. No dynamic SQL." },
  { n: 2, label: "Permission propagation", impl: "MSSQL Row-Level Security keyed on SESSION_CONTEXT(user_id)." },
  { n: 3, label: "Rate limits",            impl: "Per-user / per-tool token bucket on auth + public endpoints." },
  { n: 4, label: "PII redaction",          impl: "Presidio wrapper at LLM gateway — name/email/mobile/IC/passport (v1.1)." },
  { n: 5, label: "Output schema validation", impl: "JSON Schema enforced on LLM outputs before downstream use (v1.1)." },
  { n: 6, label: "HITL triggers",          impl: "Quotation vetting IS the HITL gate. Thresholded escalation is non-bypassable." },
  { n: 7, label: "Kill switch",            impl: "feature_flags.agents_enabled row checked on every invocation (v1.1)." },
  { n: 8, label: "Append-only audit",      impl: "Temporal Tables + INSTEAD OF UPDATE/DELETE triggers on audit_log." },
];

export default function SystemLogicPage() {
  return (
    <div>
      <PageHeader
        title="System Logic"
        description="How the pieces fit together: quotation lifecycle, approval chain, integration flow, and the trust-layer guardrails that keep it defensible."
        breadcrumbs={[{ label: "Help", href: "/docs" }, { label: "System Logic" }]}
      />

      {/* Primary flow diagram */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">End-to-end flow</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Lead → Account → Proposal → Quotation → Vetting → Close. The spine of the system.</p>
        </div>
        <Card>
          <FlowDiagram />
        </Card>
      </section>

      {/* Lifecycle steps */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Lifecycle</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Every state transition, who drives it, and the rule that gates it.</p>
        </div>
        <Card padded={false}>
          <ol className="divide-y divide-hairline">
            {LIFECYCLE.map(s => (
              <li key={s.step} className="flex flex-col gap-2 p-5 sm:flex-row sm:gap-5">
                <div className="flex items-center gap-3 sm:w-52 sm:shrink-0">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-paper-2 text-[11px] font-semibold tabular-nums text-ink-soft">
                    {s.step}
                  </span>
                  <div className="text-sm font-semibold text-ink">{s.title}</div>
                </div>
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-ink-faint">Driver · {s.who}</div>
                  <div className="mt-1 text-sm text-ink-soft">{s.rule}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* Approval chain */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Approval chain</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Quotation routing is value-based. Discount deviations jump the tier automatically.</p>
        </div>
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-3 font-semibold">Tier</th>
                  <th className="px-5 py-3 font-semibold">Threshold</th>
                  <th className="px-5 py-3 font-semibold">Approver</th>
                  <th className="px-5 py-3 font-semibold">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {APPROVAL.map(t => (
                  <tr key={t.tier}>
                    <td className="px-5 py-3"><Badge tone="accent">{t.tier}</Badge></td>
                    <td className="px-5 py-3 text-ink">{t.threshold}</td>
                    <td className="px-5 py-3 font-medium text-ink">{t.approver}</td>
                    <td className="px-5 py-3 text-ink-soft">{t.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-2 text-[11px] text-ink-faint">
          Thresholds A / B / C are configured in <Link href="/admin/system-settings" className="text-accent hover:text-accent-deep">Admin · System Setting</Link> and
          audited on every change via the append-only trail.
        </p>
      </section>

      {/* Integration flow */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Integration flow</h2>
          <p className="mt-0.5 text-sm text-ink-soft">External systems the CRM trusts, and the protocol for each.</p>
        </div>
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-3 font-semibold">System</th>
                  <th className="px-5 py-3 font-semibold">Direction</th>
                  <th className="px-5 py-3 font-semibold">Protocol</th>
                  <th className="px-5 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {INTEGRATIONS.map(i => (
                  <tr key={i.name}>
                    <td className="px-5 py-3 font-medium text-ink">{i.name}</td>
                    <td className="px-5 py-3 text-ink-soft">{i.dir}</td>
                    <td className="px-5 py-3"><code className="rounded bg-paper-3 px-1.5 py-0.5 text-[12px] text-ink">{i.proto}</code></td>
                    <td className="px-5 py-3 text-ink-soft">{i.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Trust layer — 8 guardrails */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Trust layer · 8 guardrails</h2>
          <p className="mt-0.5 text-sm text-ink-soft">The non-negotiables. Every agent invocation (v1.1+) passes through all eight.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {GUARDRAILS.map(g => (
            <Card key={g.n}>
              <div className="flex items-start gap-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-paper-2 text-[11px] font-semibold tabular-nums text-ink-soft">
                  {g.n}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">{g.label}</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-ink-soft">{g.impl}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Data mastery */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Data mastery</h2>
          <p className="mt-0.5 text-sm text-ink-soft">Which system owns which record, and how conflicts resolve.</p>
        </div>
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-3 font-semibold">Entity</th>
                  <th className="px-5 py-3 font-semibold">Source of truth</th>
                  <th className="px-5 py-3 font-semibold">CRM role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                <tr><td className="px-5 py-3 font-medium text-ink">Accounts</td><td className="px-5 py-3 text-ink-soft">CMD</td><td className="px-5 py-3 text-ink-soft">Mirror — manual edits flagged for reconciliation.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-ink">Users · profile</td><td className="px-5 py-3 text-ink-soft">LDAP (via FIM)</td><td className="px-5 py-3 text-ink-soft">Mirror on login. Roles held locally.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-ink">Users · role</td><td className="px-5 py-3 text-ink-soft">CRM</td><td className="px-5 py-3 text-ink-soft">Owned by Administrator. Audited.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-ink">Leads</td><td className="px-5 py-3 text-ink-soft">CRM</td><td className="px-5 py-3 text-ink-soft">Fully owned.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-ink">Proposals / Quotations</td><td className="px-5 py-3 text-ink-soft">CRM</td><td className="px-5 py-3 text-ink-soft">Fully owned. PDFs streamed on demand.</td></tr>
                <tr><td className="px-5 py-3 font-medium text-ink">Audit log</td><td className="px-5 py-3 text-ink-soft">CRM (append-only)</td><td className="px-5 py-3 text-ink-soft">Temporal tables + triggers. No update / no delete.</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Cross-link */}
      <section>
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-ink">New to the system?</div>
            <div className="mt-0.5 text-sm text-ink-soft">
              The <strong>System Overview</strong> page covers modules, roles and the tech stack in one page.
            </div>
          </div>
          <Link
            href="/system-overview"
            className="inline-flex items-center gap-2 self-start rounded-md border border-hairline2 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors duration-sains ease-sains hover:bg-paper-2 sm:self-auto"
          >
            Open System Overview →
          </Link>
        </Card>
      </section>
    </div>
  );
}

/**
 * Primary end-to-end flow. Drawn as a responsive CSS grid of labelled nodes with
 * SVG connectors overlaid — server-safe, no JS, no mermaid build step.
 */
function FlowDiagram() {
  const NODES = [
    { code: "LEAD", label: "Lead",      sub: "Account Manager", tone: "neutral" as const },
    { code: "ACC",  label: "Account",   sub: "CMD mirror",      tone: "accent"  as const },
    { code: "PROP", label: "Proposal",  sub: "Narrative + costing", tone: "neutral" as const },
    { code: "QUOT", label: "Quotation", sub: "New/Revised/Discounted/AOQ", tone: "neutral" as const },
    { code: "VET",  label: "Vetting",   sub: "Unit / Section Head / Director", tone: "gold" as const },
    { code: "END",  label: "Won / Rejected", sub: "Terminal + audit", tone: "teal" as const },
  ];

  const TONE: Record<"neutral" | "accent" | "teal" | "gold", string> = {
    neutral: "border-hairline bg-white text-ink",
    accent:  "border-accent/25 bg-accent-faint text-accent-deep",
    teal:    "border-teal/25 bg-teal-faint text-teal",
    gold:    "border-gold/30 bg-gold-faint text-gold",
  };

  return (
    <div>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {NODES.map((n, i) => (
          <li key={n.code} className="relative">
            <div className={`rounded-md border px-3 py-3 text-center ${TONE[n.tone]}`}>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Step {String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-sm font-semibold">{n.label}</div>
              <div className="mt-0.5 text-[11px] leading-tight opacity-80">{n.sub}</div>
            </div>
            {i < NODES.length - 1 && (
              <span
                aria-hidden
                className="pointer-events-none absolute right-[-14px] top-1/2 hidden h-px w-7 -translate-y-1/2 bg-hairline2 lg:block"
              >
                <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 border-r border-t border-ink-faint" />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-ink-faint">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm border border-accent/40 bg-accent-faint" /> CMD-mastered</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm border border-gold/40 bg-gold-faint" /> HITL gate</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm border border-teal/40 bg-teal-faint" /> Terminal state</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm border border-hairline bg-white" /> CRM-owned</span>
      </div>
    </div>
  );
}
