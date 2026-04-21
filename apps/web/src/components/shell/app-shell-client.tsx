"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "./index";

/**
 * Thin client wrapper so the server layout can render `<AppShellClient>` and
 * still have the active-nav-item derived from the current pathname.
 */
export function AppShellClient({
  role,
  userName,
  userEmail,
  signOutAction,
  children,
}: {
  role: string;
  userName: string;
  userEmail?: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  return (
    <AppShell
      role={role}
      userName={userName}
      userEmail={userEmail}
      pathname={pathname}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
