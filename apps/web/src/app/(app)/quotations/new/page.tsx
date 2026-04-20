import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";
import Link from "next/link";

/**
 * New quotation (FSD §3.2 / QUOTE-001..010). Renders a form with:
 *  - Account picker (combined Lead + Customer list; Account entries have cmdRefId set)
 *  - Contact picker (scoped to selected account; rendered progressive-enhancement style
 *    via a second GET with ?accountId=…)
 *  - Copy from Account button (QUOTE-009) — triggers a server action that reads the
 *    selected account's address and pre-fills the correspondence fields
 *  - Quotation type, subject, valid until, notes
 * Status defaults to Draft (statusId=1).
 */
export default async function NewQuotationPage({
  searchParams,
}: { searchParams: Promise<{ accountId?: string; leadId?: string; contactId?: string; copyAddress?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");
  const role = session.user.roleCode;
  if (!["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role)) {
    return <p className="text-charcoal-soft">You do not have permission to create quotations.</p>;
  }

  const sp = await searchParams;

  const accounts = await db
    .select({
      id: schema.accounts.id,
      organizationName: schema.accounts.organizationName,
      organizationShortName: schema.accounts.organizationShortName,
      source: schema.accounts.cmdRefId,
    })
    .from(schema.accounts)
    .orderBy(asc(schema.accounts.organizationName));

  const leads = await db
    .select({
      id: schema.leads.id,
      organizationName: schema.leads.organizationName,
    })
    .from(schema.leads)
    .orderBy(asc(schema.leads.organizationName));

  const selectedAccount = sp.accountId
    ? await db.query.accounts.findFirst({ where: eq(schema.accounts.id, sp.accountId) })
    : null;

  const contacts = selectedAccount
    ? await db
        .select({
          id: schema.accountContacts.id,
          fullName: schema.accountContacts.fullName,
          email: schema.accountContacts.email,
          mobile: schema.accountContacts.mobile,
        })
        .from(schema.accountContacts)
        .where(eq(schema.accountContacts.accountId, selectedAccount.id))
        .orderBy(asc(schema.accountContacts.fullName))
    : [];

  const selectedContact = sp.contactId
    ? await db.query.accountContacts.findFirst({ where: eq(schema.accountContacts.id, sp.contactId) })
    : null;

  const quotationTypes = await db.select().from(schema.quotationTypes).orderBy(asc(schema.quotationTypes.id));
  const fundSources = await db.select().from(schema.fundSources).orderBy(asc(schema.fundSources.id));

  const copyAddress = sp.copyAddress === "1";
  const addr = copyAddress && selectedAccount ? {
    line1: selectedAccount.line1 ?? "",
    line2: selectedAccount.line2 ?? "",
    line3: selectedAccount.line3 ?? "",
    city: selectedAccount.city ?? "",
    postcode: selectedAccount.postcode ?? "",
    stateCode: selectedAccount.stateCode ?? "",
    phone: selectedAccount.officePhone ?? "",
  } : { line1: "", line2: "", line3: "", city: "", postcode: "", stateCode: "", phone: "" };

  async function createQuotation(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");

    const subject = String(formData.get("subject") ?? "").trim();
    const accountId = String(formData.get("accountId") ?? "").trim();
    const contactId = String(formData.get("contactId") ?? "").trim();
    const leadId = String(formData.get("leadId") ?? "").trim();
    const typeId = Number(formData.get("typeId") ?? 1);
    const sourceOfFundId = formData.get("sourceOfFundId") ? Number(formData.get("sourceOfFundId")) : null;
    const validUntil = String(formData.get("validUntil") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (!subject) redirect("/quotations/new?error=subject_required");
    if (!accountId && !leadId) redirect("/quotations/new?error=account_or_lead_required");

    const acc = accountId ? await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) }) : null;
    const ld = leadId ? await db.query.leads.findFirst({ where: eq(schema.leads.id, leadId) }) : null;
    const contact = contactId ? await db.query.accountContacts.findFirst({ where: eq(schema.accountContacts.id, contactId) }) : null;

    const snapLine1 = String(formData.get("snapLine1") ?? (acc?.line1 ?? ""));
    const snapLine2 = String(formData.get("snapLine2") ?? (acc?.line2 ?? ""));
    const snapLine3 = String(formData.get("snapLine3") ?? (acc?.line3 ?? ""));
    const snapCity = String(formData.get("snapCity") ?? (acc?.city ?? ""));
    const snapPostcode = String(formData.get("snapPostcode") ?? (acc?.postcode ?? ""));
    const snapStateCode = String(formData.get("snapStateCode") ?? (acc?.stateCode ?? ""));
    const snapPhone = String(formData.get("snapPhone") ?? (acc?.officePhone ?? ""));

    const now = new Date();
    const yr = now.getFullYear();
    const ts = now.getTime().toString().slice(-7);
    const quotationNo = `QTN-${yr}-${ts}`;
    const newId = crypto.randomUUID();

    await db.insert(schema.quotations).values({
      id: newId,
      quotationNo,
      rootQuotationId: newId,
      revisionLetter: "a",
      accountId: acc?.id ?? null,
      leadId: ld?.id ?? null,
      ownerUserId: s.user.id,
      statusId: 1,
      typeId: typeId || 1,
      sourceOfFundId: sourceOfFundId ?? null,
      subject,
      note: note || null,
      validUntil: validUntil || null,
      snapOrganizationName: acc?.organizationName ?? ld?.organizationName ?? null,
      snapLine1: snapLine1 || null,
      snapLine2: snapLine2 || null,
      snapLine3: snapLine3 || null,
      snapCity: snapCity || null,
      snapPostcode: snapPostcode || null,
      snapStateCode: snapStateCode || null,
      snapCountryCode: acc?.countryCode ?? "MY",
      snapPhone: snapPhone || null,
      quotationDate: now.toISOString().slice(0, 10),
      ownerDepartmentId: s.user.departmentId ?? null,
      ownerSectionId: s.user.sectionId ?? null,
    });

    redirect(`/quotations/${newId}`);
  }

  return (
    <div className="max-w-3xl">
      <nav className="mb-4 text-sm text-charcoal-soft">
        <Link href="/quotations" className="hover:text-crimson">Quotations</Link>
        <span className="mx-2">/</span>
        <span>New</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl font-semibold">New quotation</h1>
        <p className="mt-1 text-sm text-charcoal-soft">
          Status: <span className="rounded-pill bg-gray-100 px-2 py-0.5 text-xs font-semibold">Draft</span> (default) · FSD §3.2
        </p>
      </header>

      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          This field is required. ({sp.error})
        </div>
      )}

      {/* Account & Contact pickers — submit to the same page to load contacts + copy address */}
      <form method="GET" action="/quotations/new" className="mb-6 rounded-lg border border-hairline bg-white p-5 shadow-claritas-1">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Quotation Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Account folder (Lead or Customer)</label>
            <select name="accountId" defaultValue={sp.accountId ?? ""} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
              <option value="">— Select account (combined Lead + Customer) —</option>
              <optgroup label="Customers (from CMD)">
                {accounts.filter(a => a.source).map(a => (
                  <option key={a.id} value={a.id}>{a.organizationName}{a.organizationShortName ? ` (${a.organizationShortName})` : ""}</option>
                ))}
              </optgroup>
              <optgroup label="Leads">
                {leads.map(l => <option key={`L-${l.id}`} value={`lead:${l.id}`}>{l.organizationName}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-charcoal-soft">Contact folder</label>
            <select name="contactId" defaultValue={sp.contactId ?? ""} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" disabled={!selectedAccount}>
              <option value="">{selectedAccount ? "— Select contact —" : "— Select account first —"}</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.fullName}{c.email ? ` · ${c.email}` : ""}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="submit" className="rounded-pill border border-hairline bg-white px-4 py-2 text-sm hover:border-crimson hover:text-crimson">
            Load
          </button>
          <button type="submit" name="copyAddress" value="1" className="rounded-pill border border-hairline bg-white px-4 py-2 text-sm hover:border-crimson hover:text-crimson" disabled={!selectedAccount}>
            Copy from Account
          </button>
        </div>
        {selectedAccount && (
          <p className="mt-3 text-xs text-charcoal-soft">
            Organization: <strong>{selectedAccount.organizationName}</strong>
            {selectedContact && <> · Contact: <strong>{selectedContact.fullName}</strong>{selectedContact.email ? ` (${selectedContact.email})` : ""}</>}
          </p>
        )}
      </form>

      {/* Main save form */}
      <form action={createQuotation} className="rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1 space-y-5">
        <input type="hidden" name="accountId" value={selectedAccount?.id ?? ""} />
        <input type="hidden" name="contactId" value={selectedContact?.id ?? ""} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Subject *</label>
            <input name="subject" required className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Quotation Type</label>
            <select name="typeId" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
              {quotationTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Source of Fund</label>
            <select name="sourceOfFundId" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
              <option value="">—</option>
              {fundSources.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Valid Until</label>
            <input type="date" name="validUntil" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-charcoal-soft">Correspondence Address</legend>
          <div className="space-y-3">
            <input name="snapLine1" defaultValue={addr.line1} placeholder="Address line 1" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
            <input name="snapLine2" defaultValue={addr.line2} placeholder="Address line 2" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
            <input name="snapLine3" defaultValue={addr.line3} placeholder="Address line 3" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <input name="snapCity" defaultValue={addr.city} placeholder="City" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
              <input name="snapPostcode" defaultValue={addr.postcode} placeholder="Postcode" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
              <input name="snapStateCode" defaultValue={addr.stateCode} placeholder="State code" maxLength={1} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
            </div>
            <input name="snapPhone" defaultValue={addr.phone} placeholder="Phone" className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
          </div>
        </fieldset>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Notes</label>
          <textarea name="note" rows={3} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 border-t border-hairline pt-5">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
            Save
          </button>
          <a href="/quotations" className="rounded-pill border border-hairline px-6 py-3 font-medium">Cancel</a>
        </div>
      </form>

      <p className="mt-4 text-xs text-charcoal-faint">
        After save, the quotation appears under <Link href="/quotations" className="text-crimson hover:underline">My Quotations</Link> with status <strong>Draft</strong>.
      </p>
    </div>
  );
}
