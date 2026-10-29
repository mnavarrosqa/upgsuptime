import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeLocale } from "@/i18n/config";
import { verifyCredentials } from "@/lib/credentials";

const secret = process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && (typeof secret !== "string" || secret.length === 0)) {
  throw new Error("NEXTAUTH_SECRET is required in production");
}
const authDebugEnabled = process.env.NODE_ENV !== "production" && process.env.AUTH_DEBUG === "true";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        login: { label: "Email or username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (authDebugEnabled) {
          console.log("[auth] credentials:", credentials?.login?.trim() ? "identifier present" : "missing identifier", credentials?.password ? "password present" : "missing password");
        }
        const u = await verifyCredentials(credentials?.login, credentials?.password);
        if (authDebugEnabled) {
          console.log("[auth] sign-in:", u ? `ok for user id=${u.id}` : "rejected");
        }
        if (!u) return null;
        return {
          id: u.id,
          email: u.email,
          name: u.username ?? undefined,
          role: u.role,
          language: u.language,
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
        token.language = normalizeLocale((user as { language?: string }).language);
      }
      if (trigger === "update" && token.id) {
        const [row] = await db
          .select({ username: userTable.username, language: userTable.language })
          .from(userTable)
          .where(eq(userTable.id, token.id as string));
        if (row) {
          token.name = row.username ?? undefined;
          token.language = normalizeLocale(row.language ?? "es");
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { name?: string }).name = token.name as string | undefined;
        (session.user as { language?: "en" | "es" }).language = normalizeLocale(token.language as string);
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
