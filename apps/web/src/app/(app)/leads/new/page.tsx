import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";

/**
 * New Lead — server action saves straight via Drizzle. No client state, no hydration cost.
 * FSD §3.3.2 step 2: "The user who receives the lead shall manually create a Business Lead
 * entry in CRM."
 */
export default async function NewLeadPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const role = session.user.roleCode;
  if (!["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role)) {
    return <p className="text-charcoal-soft">You do not have permission to create leads.</p>;
  }

  async function createLead(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");

    const org = String(formData.get("organizationName") ?? "").trim();
    if (!org) throw new Error("Organization Name is required");

    await db.insert(schema.leads).values({
      ownerUserId: s.user.id,
      ownerSectionId: s.user.sectionId ?? null,
      ownerDepartmentId: s.user.departmentId ?? null,
      organizationName: org,
      primaryContactName: (formData.get("primaryContactName") as string) || null,
      primaryContactPhone: (formData.get("primaryContactPhone") as string) || null,
      primaryContactEmail: (formData.get("primaryContactEmail") as string) || null,
      source: (formData.get("source") as string) || null,
      statusId: 1, // Open
      notes: (formData.get("notes") as string) || null,
    });

    redirect("/leads");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-semibold">New lead</h1>
      <form action={createLead} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <Field label="Organization Name *" name="organizationName" required />
        <Field label="Primary Contact" name="primaryContactName" />
        <Field label="Contact Phone" name="primaryContactPhone" />
        <Field label="Contact Email" name="primaryContactEmail" type="email" />
        <Select label="Source" name="source" options={["Enquiry", "Referral", "Meeting", "Email", "Other"]} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Notes</label>
          <textarea name="notes" rows={4} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
            Create lead
          </button>
          <a href="/leads" className="rounded-pill border border-hairline px-6 py-3 font-medium">Cancel</a>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">{label}</label>
      <input name={name} type={type} required={required} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson" />
    </div>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">{label}</label>
      <select name={name} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
