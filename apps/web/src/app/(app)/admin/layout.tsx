import { auth } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user.roleCode !== "Administrator") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="mt-4 rounded-lg border border-hairline bg-rose-50 p-4 text-sm text-rose-900">
          Access denied. Administrators only.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
