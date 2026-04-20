/**
 * Auth.js v5 — SSO for SAINS CRM. Providers:
 *   - FIM 2.0 (custom OIDC) — the canonical SAINS path
 *   - Google — convenience for development / non-SAINS testing
 *
 * On first login the user record is materialised via the `signIn` callback. Role defaults to
 * Viewer; an Administrator must promote — same behaviour as ADR-0004.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      roleId: number;
      roleCode: string;
      sectionId: string | null;
      departmentId: string | null;
      staffPrefix: string | null;
    };
  }
}

// Custom FIM 2.0 OIDC provider. Any OIDC-compliant server works with the standard oauth provider.
const fim = {
  id: "fim",
  name: "SAINS FIM 2.0",
  type: "oidc" as const,
  issuer: process.env.FIM_ISSUER || "https://fim2.sarawak.gov.my",
  clientId: process.env.FIM_CLIENT_ID,
  clientSecret: process.env.FIM_CLIENT_SECRET,
  authorization: { params: { scope: "openid email cn mobile" } },
  idToken: true,
  checks: ["pkce", "state"] as const,
  profile(p: Record<string, unknown>) {
    return {
      id: String(p.sub ?? p.cn ?? p.email),
      name: String(p.cn ?? p.name ?? p.email ?? "(anonymous)"),
      email: String(p.mail ?? p.email ?? ""),
      image: null,
    };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  session: { strategy: "database", maxAge: 12 * 60 * 60 },
  providers: [
    // Google is only enabled when env var is present — Railway lets you add/remove at will.
    ...(process.env.GOOGLE_CLIENT_ID
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    ...(process.env.FIM_CLIENT_ID ? [fim] : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // First-login provisioning — default role is Viewer (2961) per ADR-0004.
      const existing = await db.query.users.findFirst({ where: eq(schema.users.email, user.email) });
      if (!existing) {
        await db.insert(schema.users).values({
          oidcSub: user.id!,
          fullName: user.name ?? user.email,
          email: user.email,
          roleId: 2961,
        });
      }
      return true;
    },

    async session({ session, user }) {
      const row = await db.query.users.findFirst({ where: eq(schema.users.email, user.email!) });
      if (!row) return session;
      const role = await db.query.roles.findFirst({ where: eq(schema.roles.id, row.roleId) });
      session.user.id = row.id;
      session.user.roleId = row.roleId;
      session.user.roleCode = role?.code ?? "Viewer";
      session.user.sectionId = row.sectionId ?? null;
      session.user.departmentId = row.departmentId ?? null;
      session.user.staffPrefix = row.staffPrefix ?? null;
      return session;
    },
  },
});
