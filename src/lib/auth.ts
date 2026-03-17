import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const secret = process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && (typeof secret !== "string" || secret.length === 0)) {
  throw new Error("NEXTAUTH_SECRET is required in production");
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        login: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.login ?? credentials?.email)?.trim();
        const password = credentials?.password;
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console -- dev-only debug for login 401
          console.log("[auth] credentials:", identifier ? "identifier present" : "missing identifier", password ? "password present" : "missing password");
        }
        if (!identifier || !password) return null;
        const isEmail = identifier.includes("@");
        let u: { id: string; email: string; username: string | null; passwordHash: string; role: string } | undefined;
        if (isEmail) {
          [u] = await db
            .select()
            .from(userTable)
            .where(sql`LOWER(${userTable.email}) = LOWER(${identifier})`);
        } else {
          try {
            [u] = await db.select().from(userTable).where(eq(userTable.username, identifier));
          } catch {
            // username column may not exist in older DBs; try matching as email
            [u] = await db
              .select()
              .from(userTable)
              .where(sql`LOWER(${userTable.email}) = LOWER(${identifier})`);
          }
        }
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console -- dev-only debug for login 401
          console.log("[auth] user lookup:", u ? `found user id=${u.id}` : "no user found");
        }
        if (!u) return null;
        const ok = await bcrypt.compare(password, u.passwordHash);
        if (process.env.NODE_ENV !== "production" && !ok) {
          // eslint-disable-next-line no-console -- dev-only debug for login 401
          console.log("[auth] password mismatch for user id=", u.id);
        }
        if (!ok) return null;
        return {
          id: u.id,
          email: u.email,
          name: u.username ?? undefined,
          role: u.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.name = (user as { name?: string }).name;
      }
      if (trigger === "update" && token.id) {
        const [row] = await db
          .select({ username: userTable.username })
          .from(userTable)
          .where(eq(userTable.id, token.id as string));
        if (row) token.name = row.username ?? undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { name?: string }).name = token.name as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // refresh window 24 hours
  },
  secret: secret ?? undefined,
};
