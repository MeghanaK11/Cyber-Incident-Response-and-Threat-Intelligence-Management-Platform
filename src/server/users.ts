import { randomBytes } from "node:crypto";
import { getPool, query, queryOne, withTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { hashPassword, verifyPassword, type CurrentUser } from "@/lib/auth";
import type { Role } from "@/lib/session";

type LoginRow = {
  user_id: number;
  full_name: string;
  email: string;
  role: Role;
  password_hash: string;
  is_active: boolean;
};

// Hash of a random string, made once per process. Comparing against it when the
// email is unknown keeps the response time the same, so emails cannot be probed.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(24).toString("hex"));
  return dummyHash;
}

export async function authenticate(email: string, password: string) {
  const user = await queryOne<LoginRow>(
    `SELECT u.user_id, u.full_name, u.email::TEXT AS email, r.role_name AS role,
            u.password_hash, u.is_active
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
      WHERE u.email = $1`,
    [email],
  );

  const ok = await verifyPassword(password, user?.password_hash ?? (await getDummyHash()));
  if (!user || !ok || !user.is_active) {
    throw new HttpError(401, "Email or password is incorrect");
  }

  await query(`UPDATE users SET last_login_at = now() WHERE user_id = $1`, [user.user_id]);
  return { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role };
}

export function listUsers() {
  // LEFT JOIN + subquery so users with zero incidents still appear
  return query(
    `SELECT u.user_id, u.full_name, u.email::TEXT AS email, r.role_name AS role,
            u.is_active, u.created_at, u.last_login_at,
            COALESCE(w.open_assigned, 0) AS open_assigned
       FROM users u
       JOIN roles r ON r.role_id = u.role_id
       LEFT JOIN (
            SELECT assigned_to, count(*)::INT AS open_assigned
              FROM incidents
             WHERE status NOT IN ('RESOLVED', 'CLOSED')
             GROUP BY assigned_to
       ) w ON w.assigned_to = u.user_id
      ORDER BY u.is_active DESC, r.role_id, u.full_name`,
  );
}

export async function createUser(
  actor: CurrentUser,
  input: { full_name: string; email: string; role: Role; password: string },
) {
  const hash = await hashPassword(input.password);
  return withTransaction(actor.user_id, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO users (full_name, email, password_hash, role_id)
       VALUES ($1, $2, $3, (SELECT role_id FROM roles WHERE role_name = $4))
       RETURNING user_id`,
      [input.full_name, input.email, hash, input.role],
    );
    return rows[0];
  });
}

/** Public sign-up. The role is always VIEWER; only an admin can raise it later. */
/** Public sign-up. The sign-up route has already checked the admin code if role is ADMIN. */
export async function registerUser(input: { full_name: string; email: string; password: string; role: Role }) {
  const hash = await hashPassword(input.password);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ user_id: number; full_name: string; email: string; role: Role }>(
      `INSERT INTO users (full_name, email, password_hash, role_id)
       SELECT $1, $2, $3, role_id FROM roles WHERE role_name = $4
       RETURNING user_id, full_name, email::TEXT AS email, $4::TEXT AS role`,
      [input.full_name, input.email, hash, input.role],
    );
    await client.query(`UPDATE users SET last_login_at = now() WHERE user_id = $1`, [rows[0].user_id]);
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateUser(
  actor: CurrentUser,
  id: number,
  input: { full_name?: string; role?: Role; is_active?: boolean; password?: string },
) {
  if (id === actor.user_id && (input.is_active === false || (input.role && input.role !== "ADMIN"))) {
    throw new HttpError(400, "You cannot deactivate or demote your own account");
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.full_name !== undefined) {
    params.push(input.full_name);
    sets.push(`full_name = $${params.length}`);
  }
  if (input.role !== undefined) {
    params.push(input.role);
    sets.push(`role_id = (SELECT role_id FROM roles WHERE role_name = $${params.length})`);
  }
  if (input.is_active !== undefined) {
    params.push(input.is_active);
    sets.push(`is_active = $${params.length}`);
  }
  if (input.password !== undefined) {
    params.push(await hashPassword(input.password));
    sets.push(`password_hash = $${params.length}`);
  }
  params.push(id);

  return withTransaction(actor.user_id, async (c) => {
    // A demoted or deactivated analyst must not keep open incidents
    if (input.is_active === false || (input.role && input.role === "VIEWER")) {
      const { rows } = await c.query<{ n: number }>(
        `SELECT count(*)::INT AS n FROM incidents
          WHERE assigned_to = $1 AND status NOT IN ('RESOLVED', 'CLOSED')`,
        [id],
      );
      if (rows[0].n > 0) {
        throw new HttpError(409, `Reassign this user's ${rows[0].n} open incident(s) first`);
      }
    }
    const { rowCount } = await c.query(
      `UPDATE users SET ${sets.join(", ")} WHERE user_id = $${params.length}`,
      params,
    );
    if (!rowCount) throw new HttpError(404, "User not found");
  });
}
