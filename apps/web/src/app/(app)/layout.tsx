import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShellClient } from "@/components/shell/app-shell-client";

/**
 * Authenticated app shell. Shared layout for Leads / Accounts / Proposals /
 * Quotations / Reports / Admin. Everything under `(app)/` is protected —
 * unauthenticated hits bounce to FIM SSO.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const role = session.user.roleCode;
  const userName = session.user.name ?? session.user.email ?? "User";
  const userEmail = session.user.email ?? undefined;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <AppShellClient
      role={role}
      userName={userName}
      userEmail={userEmail}
      signOutAction={handleSignOut}
    >
      {children}
    </AppShellClient>
  );
}
