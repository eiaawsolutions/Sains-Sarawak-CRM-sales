/**
 * Auth.js v5 — SSO for SAINS CRM. Providers:
 *   - FIM 2.0 (custom OIDC) — the canonical SAINS path
 *   - Google — convenience for development / non-SAINS testing
 *   - Credentials — email + password path used by UAT harness and local fallback
 *
 * On first login the user record is materialised via the `signIn` callback. Role defaults to
 * Viewer; an Administrator must promote — same behaviour as ADR-0004.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

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

const credentials = Credentials({
  name: "Email + password",
  credentials: {
    email:    { label: "Email",    type: "email",    placeholder: "you@sarawak.gov.my" },
    password: { label: "Password", type: "password" },
  },
  async authorize(raw) {
    const email = String(raw?.email ?? "").trim().toLowerCase();
    const password = String(raw?.password ?? "");
    if (!email || !password) return null;

    const row = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (!row || !row.passwordHash || !row.isActive) return null;

    const ok = await bcrypt.compare(password, row.passwordHash);
    if (!ok) return null;

    await db.update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, row.id));

    return {
      id: row.id,
      name: row.fullName,
      email: row.email,
      image: null,
    };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT strategy is required when any Credentials provider is used.
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  providers: [
    credentials,
    ...(process.env.GOOGLE_CLIENT_ID
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    ...(process.env.FIM_CLIENT_ID ? [fim] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // OAuth first-login provisioning (Credentials path already verified the user exists)
      if (account?.type === "oauth" || account?.type === "oidc") {
        const existing = await db.query.users.findFirst({ where: eq(schema.users.email, user.email) });
        if (!existing) {
          await db.insert(schema.users).values({
            oidcSub: user.id!,
            fullName: user.name ?? user.email,
            email: user.email,
            roleId: 2961,
          });
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },

    async session({ session, token }) {
      if (!token?.email) return session;
      const row = await db.query.users.findFirst({ where: eq(schema.users.email, String(token.email)) });
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
  pages: {
    signIn: "/auth/signin",
  },
});
