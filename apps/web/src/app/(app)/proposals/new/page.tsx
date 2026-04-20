import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { asc, eq } from "drizzle-orm";

/**
 * FSD §3.4.2 — Proposal created from a Business Lead. Status defaults to Open (1).
 * Proposal No uses a simple timestamp-based identifier — distinct from quotation numbering.
 */
export default async function NewProposalPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = session.user.roleCode;
  if (!["AccountManager", "UnitHead", "SectionHead", "Administrator"].includes(role)) {
    return <p className="text-charcoal-soft">You do not have permission to create proposals.</p>;
  }

  const sp = await searchParams;
  const presetLeadId = sp.leadId;

  const leads = await db
    .select({ id: schema.leads.id, organizationName: schema.leads.organizationName })
    .from(schema.leads)
    .orderBy(asc(schema.leads.organizationName))
    .limit(500);

  async function createProposal(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user.id) throw new Error("unauth");

    const leadId = String(formData.get("leadId") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    if (!leadId || !subject) throw new Error("Lead and Subject are required");

    const now = new Date();
    const yr = now.getFullYear();
    const ts = now.getTime().toString().slice(-6);
    const proposalNo = `PROP-${yr}-${ts}`;

    await db.insert(schema.proposals).values({
      leadId,
      ownerUserId: s.user.id,
      ownerSectionId: s.user.sectionId ?? null,
      ownerDepartmentId: s.user.departmentId ?? null,
      proposalNo,
      subject,
      statusId: 1,
      note: (formData.get("note") as string) || null,
    });

    await db.update(schema.leads)
      .set({ needsProposal: true, updatedAt: new Date() })
      .where(eq(schema.leads.id, leadId));

    redirect("/proposals");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-semibold">New proposal</h1>
      <form action={createProposal} className="space-y-5 rounded-lg border border-hairline bg-gradient-surface p-6 shadow-claritas-1">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Linked Lead *</label>
          <select name="leadId" required defaultValue={presetLeadId ?? ""} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm">
            <option value="">— Select lead —</option>
            {leads.map(l => <option key={l.id} value={l.id}>{l.organizationName}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Subject *</label>
          <input name="subject" required className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-charcoal-soft">Notes</label>
          <textarea name="note" rows={5} className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson" />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow">
            Create proposal
          </button>
          <a href="/proposals" className="rounded-pill border border-hairline px-6 py-3 font-medium">Cancel</a>
        </div>
      </form>
    </div>
  );
}
