import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { queryOne } from "./db";
import { HttpError } from "./http";
import { SESSION_COOKIE, verifySession, type Role } from "./session";

const BCRYPT_COST = 12;

export type CurrentUser = {
  user_id: number;
  full_name: string;
  email: string;
  role: Role;
};

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Reads the session cookie and re-checks the user in the database, so a
 * deactivated user or a changed role takes effect on the next request even
 * if their token has not expired yet.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  return queryOne<CurrentUser>(
    `SELECT u.user_id, u.full_name, u.email::TEXT AS email, r.role_name AS role
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE u.user_id = $1 AND u.is_active`,
    [Number(session.sub)],
  );
}

/** Throws 401 if not signed in, 403 if the role is not in the allowed list. */
export async function requireUser(allowed?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in");
  if (allowed && !allowed.includes(user.role)) {
    throw new HttpError(403, `This action needs one of: ${allowed.join(", ")}`);
  }
  return user;
}

export const CAN_WRITE: Role[] = ["ADMIN", "ANALYST"];
export const ADMIN_ONLY: Role[] = ["ADMIN"];
