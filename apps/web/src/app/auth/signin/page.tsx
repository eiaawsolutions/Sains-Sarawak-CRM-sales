import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

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

    // LOGIN-007: blank field — HTML required handles the browser side;
    // server-side we still send an explicit error if they slipped past.
    if (!email || !password) {
      redirect("/auth/signin?error=BlankField");
    }

    // Distinguish "unregistered" (LOGIN-006) from "wrong password" (LOGIN-005)
    // using the same wording the FSD specifies.
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
    error === "Unregistered"      ? 'Error: "We could not find an active user with that email."' :
    error === "CredentialsSignin" ? 'Error: "We could not find an active user with that email and password combination."' :
    error                         ? "Sign-in failed. Please try again." :
    null;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <div className="w-full rounded-lg border border-hairline bg-white p-8 shadow-claritas-1">
          <div className="mb-6 flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-xl font-semibold">SAINS CRM</h1>
              <p className="text-xs text-charcoal-soft">Sign in to continue</p>
            </div>
          </div>

          {errorMessage && (
            <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {errorMessage}
            </div>
          )}

          <form action={loginAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-charcoal-soft">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-charcoal-soft">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm focus:border-crimson"
              />
            </div>

            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <button
              type="submit"
              className="w-full rounded-pill bg-gradient-accent px-6 py-3 font-semibold text-white shadow-accent-glow"
            >
              Login
            </button>
          </form>

          <p className="mt-6 border-t border-hairline pt-4 text-center text-xs text-charcoal-faint">
            Claritas × EIAAW Solutions · FSD v1.3
          </p>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="16" fill="url(#g3)" stroke="#3f3f3f" strokeWidth="0.5" />
      <defs>
        <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#721011" />
          <stop offset="100%" stopColor="#3f3f3f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function generateMetadata() {
  return { title: "Sign in · SAINS CRM" };
}
