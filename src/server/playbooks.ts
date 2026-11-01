import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CurrentUser } from "@/lib/auth";

type Step = { title: string; instructions: string; expected_minutes: number };

export function listPlaybooks() {
  return query(
    `SELECT p.playbook_id, p.name, p.category, p.description, p.is_active, p.created_at,
            u.full_name AS created_by_name,
            (SELECT count(*)::INT FROM playbook_steps s WHERE s.playbook_id = p.playbook_id) AS step_count,
            (SELECT COALESCE(sum(expected_minutes), 0)::INT FROM playbook_steps s WHERE s.playbook_id = p.playbook_id) AS total_minutes,
            (SELECT count(DISTINCT t.incident_id)::INT FROM incident_tasks t WHERE t.playbook_id = p.playbook_id) AS times_used
       FROM playbooks p
       LEFT JOIN users u ON u.user_id = p.created_by
      ORDER BY p.is_active DESC, p.category NULLS LAST, p.name`,
  );
}

export async function getPlaybook(id: number) {
  const playbook = await queryOne(
    `SELECT p.*, (SELECT count(DISTINCT incident_id)::INT FROM incident_tasks t WHERE t.playbook_id = p.playbook_id) AS times_used
       FROM playbooks p WHERE p.playbook_id = $1`,
    [id],
  );
  if (!playbook) throw new HttpError(404, "Playbook not found");
  const steps = await query(
    `SELECT step_no, title, instructions, expected_minutes FROM playbook_steps WHERE playbook_id = $1 ORDER BY step_no`,
    [id],
  );
  return { playbook, steps };
}

async function insertSteps(c: PoolClient, playbookId: number, steps: Step[]) {
  // One multi-row INSERT using unnest over parallel arrays
  await c.query(
    `INSERT INTO playbook_steps (playbook_id, step_no, title, instructions, expected_minutes)
     SELECT $1, s.ord, s.title, s.instructions, s.mins
       FROM unnest($2::TEXT[], $3::TEXT[], $4::INT[]) WITH ORDINALITY AS s(title, instructions, mins, ord)`,
    [playbookId, steps.map((s) => s.title), steps.map((s) => s.instructions), steps.map((s) => s.expected_minutes)],
  );
}

export async function createPlaybook(
  user: CurrentUser,
  input: { name: string; category: string | null; description: string; steps: Step[] },
) {
  return withTransaction(user.user_id, async (c) => {
    const { rows } = await c.query<{ playbook_id: number }>(
      `INSERT INTO playbooks (name, category, description, created_by)
       VALUES ($1, $2::incident_category, $3, $4) RETURNING playbook_id`,
      [input.name, input.category, input.description, user.user_id],
    );
    await insertSteps(c, rows[0].playbook_id, input.steps);
    return rows[0];
  });
}

export async function updatePlaybook(
  user: CurrentUser,
  id: number,
  input: { name?: string; category?: string | null; description?: string; is_active?: boolean },
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [col, cast] of [["name", ""], ["category", "::incident_category"], ["description", ""], ["is_active", ""]] as const) {
    const v = input[col];
    if (v !== undefined) {
      params.push(v);
      sets.push(`${col} = $${params.length}${cast}`);
    }
  }
  params.push(id);
  return withTransaction(user.user_id, async (c) => {
    if (input.category !== undefined) await assertUnused(c, id, "change its category");
    const { rowCount } = await c.query(`UPDATE playbooks SET ${sets.join(", ")} WHERE playbook_id = $${params.length}`, params);
    if (!rowCount) throw new HttpError(404, "Playbook not found");
  });
}

/** Replace all steps. Only allowed while no incident has used the playbook. */
export async function replaceSteps(user: CurrentUser, id: number, steps: Step[]) {
  return withTransaction(user.user_id, async (c) => {
    await assertUnused(c, id, "edit its steps");
    await c.query(`DELETE FROM playbook_steps WHERE playbook_id = $1`, [id]);
    await insertSteps(c, id, steps);
  });
}

export async function deletePlaybook(user: CurrentUser, id: number) {
  return withTransaction(user.user_id, async (c) => {
    await assertUnused(c, id, "delete");
    const { rowCount } = await c.query(`DELETE FROM playbooks WHERE playbook_id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, "Playbook not found");
  });
}

// Tasks keep a reference to the step they came from, so a used playbook is
// frozen; deactivate it and create a new version instead.
async function assertUnused(c: PoolClient, id: number, action: string) {
  const { rows } = await c.query<{ n: number }>(
    `SELECT count(DISTINCT incident_id)::INT AS n FROM incident_tasks WHERE playbook_id = $1`,
    [id],
  );
  if (rows[0].n > 0) {
    throw new HttpError(409, `This playbook has been used on ${rows[0].n} incident(s), so you cannot ${action} it. Deactivate it and create a new version instead.`);
  }
}
