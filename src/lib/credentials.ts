import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { normalizeLocale, type AppLocale } from "@/i18n/config";

export type AuthenticatedUser = {
  id: string;
  email: string;
  username: string | null;
  role: string;
  language: AppLocale;
};

/** Finds a user by email (case-insensitive) or username. */
async function findUserByLogin(identifier: string) {
  if (identifier.includes("@")) {
    const [u] = await db
      .select()
      .from(userTable)
      .where(sql`LOWER(${userTable.email}) = LOWER(${identifier})`);
    return u;
  }
  try {
    const [u] = await db.select().from(userTable).where(eq(userTable.username, identifier));
    return u;
  } catch {
    // username column may not exist in older DBs; try matching as email
    const [u] = await db
      .select()
      .from(userTable)
      .where(sql`LOWER(${userTable.email}) = LOWER(${identifier})`);
    return u;
  }
}

/**
 * Checks an email/username + password pair. Shared by the web sign-in and the
 * native app token endpoint so both accept exactly the same credentials.
 */
export async function verifyCredentials(
  login: string | undefined | null,
  password: string | undefined | null,
): Promise<AuthenticatedUser | null> {
  const identifier = login?.trim();
  if (!identifier || !password) return null;
  const u = await findUserByLogin(identifier);
  if (!u) return null;
  if (!(await bcrypt.compare(password, u.passwordHash))) return null;
  return {
    id: u.id,
    email: u.email,
    username: u.username ?? null,
    role: u.role,
    language: normalizeLocale(u.language ?? "es"),
  };
}
