import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { Alert, Button, Field, Input } from "@/components/ui";
import { SainsLogo } from "@/components/shell";

/**
 * SAINS CRM login page. Backed by Auth.js v5 Credentials provider. Error messages are
 * normalised to match UAT LOGIN-005 / LOGIN-006 / LOGIN-007 expectations.
 */
export default async function SignInPage({
  searchParams,
}: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  const sp = await searchParams;
  const error = sp.error ?? null;
  const callbackUrl = sp.callbackUrl ?? "/leads";

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      redirect("/auth/signin?error=BlankField");
    }

    const row = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!row || !row.isActive) {
      redirect("/auth/signin?error=Unregistered");
    }

    try {
      await signIn("credentials", { email, password, redirectTo: callbackUrl });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/auth/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`);
      }
      throw err;
    }
  }

  const errorMessage =
    error === "BlankField"        ? "Please fill out this field" :
    error === "Unregistered"      ? 'We could not find an active user with that email.' :
    error === "CredentialsSignin" ? 'We could not find an active user with that email and password combination.' :
    error                         ? "Sign-in failed. Please try again." :
    null;

  return (
    <div className="relative min-h-screen bg-paper-2">
      {/* Subtle hairline grid backdrop — quiet, gov-credible */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-10 lg:grid-cols-2 lg:px-10">
        {/* Left — identity + context */}
        <div className="hidden flex-col justify-between lg:flex">
          <div className="flex items-center gap-3">
            <SainsLogo size={40} />
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight text-ink">SAINS CRM</div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Sales · Sarawak Information Systems</div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl font-semibold tracking-tight text-ink leading-tight">
              From lead to customer,<br />in one trusted workspace.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Pipeline discipline, quotation governance and sales insight for
              account managers, section heads and directors across SAINS sales teams.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 text-sm">
              <FeatureRow k="Ambient capture" v="Calls, email, meetings — logged without typing." />
              <FeatureRow k="PDPA-ready" v="Audit-trailed, permission-scoped, Malaysia-resident." />
              <FeatureRow k="Vetting built-in" v="Section & Unit Head approval flows on every quote." />
              <FeatureRow k="QPR in one click" v="Quotation performance report with XLSX export." />
            </dl>
          </div>

          <p className="text-[11px] text-ink-faint">
            Sarawak Information Systems Sdn. Bhd. · Kuching · v1.0
          </p>
        </div>

        {/* Right — sign-in card */}
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-card border border-hairline bg-white p-7 shadow-ink-2">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <SainsLogo size={32} />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight text-ink">SAINS CRM</div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Sales</div>
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-xl font-semibold tracking-tight text-ink">Sign in</h1>
              <p className="mt-1 text-sm text-ink-soft">Use your SAINS corporate credentials.</p>
            </div>

            {errorMessage && (
              <div className="mb-4">
                <Alert tone="error" title="Sign-in failed">{errorMessage}</Alert>
              </div>
            )}

            <form action={loginAction} className="space-y-4">
              <Field label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@sains.com.my"
                />
              </Field>

              <Field label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </Field>

              <input type="hidden" name="callbackUrl" value={callbackUrl} />

              <Button type="submit" tone="primary" size="lg" className="w-full">
                Sign in
              </Button>
            </form>

            <p className="mt-6 border-t border-hairline pt-4 text-center text-[11px] text-ink-faint">
              FSD v1.3 · Protected access · Activity is audit-logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-accent-deep">
        <span className="h-1 w-1 rounded-full bg-accent" />
        {k}
      </dt>
      <dd className="mt-1 text-ink-soft">{v}</dd>
    </div>
  );
}

export function generateMetadata() {
  return { title: "Sign in · SAINS CRM" };
}
