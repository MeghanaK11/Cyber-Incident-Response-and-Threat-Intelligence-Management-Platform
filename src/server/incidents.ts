import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CurrentUser } from "@/lib/auth";
import type { IncidentListParams } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Listing with filters, full-text search, sorting and pagination
// ---------------------------------------------------------------------------

const SORTS: Record<IncidentListParams["sort"], string> = {
  newest: "o.created_at DESC",
  oldest: "o.created_at ASC",
  severity: "o.severity DESC, o.created_at DESC", // enum order LOW < ... < CRITICAL
  deadline: "o.resolve_by ASC NULLS LAST",
};

export async function listIncidents(p: IncidentListParams, user: CurrentUser) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };

  if (p.status) add("o.status = ?::incident_status", p.status);
  if (p.severity) add("o.severity = ?::incident_severity", p.severity);
  if (p.category) add("o.category = ?::incident_category", p.category);
  if (p.sla) add("o.sla_state = ?", p.sla);
  if (p.open === "true") where.push("o.status NOT IN ('RESOLVED', 'CLOSED')");
  if (p.open === "false") where.push("o.status IN ('RESOLVED', 'CLOSED')");
  if (p.assignee === "me") add("o.assignee_id = ?", user.user_id);
  else if (p.assignee === "none") where.push("o.assignee_id IS NULL");
  else if (typeof p.assignee === "number") add("o.assignee_id = ?", p.assignee);

  let rankSelect = "NULL::REAL AS rank";
  let orderBy = SORTS[p.sort];
  if (p.q) {
    // websearch_to_tsquery accepts Google-style input: quotes, OR, -exclude
    params.push(p.q);
    const qi = params.length;
    where.push(`(i.search_tsv @@ websearch_to_tsquery('english', $${qi}) OR o.reference_code ILIKE '%' || $${qi} || '%')`);
    rankSelect = `ts_rank(i.search_tsv, websearch_to_tsquery('english', $${qi})) AS rank`;
    orderBy = `rank DESC, ${orderBy}`;
  }

  params.push(p.page_size, (p.page - 1) * p.page_size);
  const sql = `
    SELECT o.*, ${rankSelect}, count(*) OVER ()::INT AS total
      FROM v_incident_overview o
      JOIN incidents i ON i.incident_id = o.incident_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY ${orderBy}
     LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const rows = await query<Record<string, unknown> & { total: number }>(sql, params);
  return { items: rows.map(({ total: _t, ...r }) => r), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size };
}

// ---------------------------------------------------------------------------
// Single incident with everything the detail page needs
// ---------------------------------------------------------------------------

export async function getIncident(id: number) {
  const incident = await queryOne(
    `SELECT o.*, i.description, i.resolution_summary
       FROM v_incident_overview o
       JOIN incidents i ON i.incident_id = o.incident_id
      WHERE o.incident_id = $1`,
    [id],
  );
  if (!incident) throw new HttpError(404, "Incident not found");

  const [assets, tasks, history, playbooks] = await Promise.all([
    query(
      `SELECT a.asset_id, a.hostname, host(a.ip_address) AS ip_address, a.asset_type,
              a.department, a.criticality, a.is_internet_facing, ia.impact, ia.added_at
         FROM incident_assets ia
         JOIN assets a ON a.asset_id = ia.asset_id
        WHERE ia.incident_id = $1
        ORDER BY a.criticality DESC, a.hostname`,
      [id],
    ),
    query(
      `SELECT t.task_id, t.title, t.details, t.status, t.due_at, t.completed_at, t.created_at,
              t.playbook_id, t.step_no, p.name AS playbook_name,
              t.assigned_to, u.full_name AS assignee_name,
              (t.status IN ('TODO', 'DOING') AND t.due_at < now()) AS is_overdue
         FROM incident_tasks t
         LEFT JOIN playbooks p ON p.playbook_id = t.playbook_id
         LEFT JOIN users u     ON u.user_id = t.assigned_to
        WHERE t.incident_id = $1
        ORDER BY t.playbook_id NULLS LAST, t.step_no, t.created_at`,
      [id],
    ),
    query(
      `SELECT h.history_id, h.old_status, h.new_status, h.changed_at, h.note,
              u.full_name AS changed_by_name
         FROM incident_status_history h
         LEFT JOIN users u ON u.user_id = h.changed_by
        WHERE h.incident_id = $1
        ORDER BY h.changed_at, h.history_id`,
      [id],
    ),
    // Playbooks that fit this incident's category and are not yet applied
    query(
      `SELECT p.playbook_id, p.name, p.category,
              (SELECT count(*)::INT FROM playbook_steps s WHERE s.playbook_id = p.playbook_id) AS step_count,
              (SELECT sum(expected_minutes)::INT FROM playbook_steps s WHERE s.playbook_id = p.playbook_id) AS total_minutes
         FROM playbooks p
        WHERE p.is_active
          AND (p.category IS NULL OR p.category = (SELECT category FROM incidents WHERE incident_id = $1))
          AND NOT EXISTS (SELECT 1 FROM incident_tasks t WHERE t.incident_id = $1 AND t.playbook_id = p.playbook_id)
          AND EXISTS (SELECT 1 FROM playbook_steps s WHERE s.playbook_id = p.playbook_id)
        ORDER BY p.category NULLS LAST, p.name`,
      [id],
    ),
  ]);

  // Allowed next statuses come from the transitions table, not from app code
  const nextStatuses = await query<{ to_status: string }>(
    `SELECT t.to_status
       FROM incident_status_transitions t
       JOIN incidents i ON i.status = t.from_status
      WHERE i.incident_id = $1
      ORDER BY t.to_status`,
    [id],
  );

  return { incident, assets, tasks, history, playbooks, next_statuses: nextStatuses.map((r) => r.to_status) };
}

// ---------------------------------------------------------------------------
// Writes. Each runs in one transaction so triggers see the acting user.
// ---------------------------------------------------------------------------

type CreateInput = {
  title: string;
  description: string;
  category: string;
  severity: string;
  detected_at: Date;
  assets: { asset_id: number; impact: string }[];
  auto_assign: boolean;
};

export async function createIncident(user: CurrentUser, input: CreateInput) {
  return withTransaction(user.user_id, async (c) => {
    const { rows } = await c.query<{ incident_id: number; reference_code: string }>(
      `INSERT INTO incidents (title, description, category, severity, reported_by, detected_at)
       VALUES ($1, $2, $3::incident_category, $4::incident_severity, $5, $6)
       RETURNING incident_id, reference_code`,
      [input.title, input.description, input.category, input.severity, user.user_id, input.detected_at],
    );
    const created = rows[0];

    for (const a of input.assets) {
      await c.query(
        `INSERT INTO incident_assets (incident_id, asset_id, impact) VALUES ($1, $2, $3)`,
        [created.incident_id, a.asset_id, a.impact],
      );
    }

    if (input.auto_assign) {
      await c.query(`CALL sp_assign_incident($1, NULL)`, [created.incident_id]);
    }
    return created;
  });
}

type UpdateInput = {
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  status?: string;
  resolution_summary?: string;
  note?: string;
};

const UPDATABLE: Record<string, string> = {
  title: "",
  description: "",
  category: "::incident_category",
  severity: "::incident_severity",
  status: "::incident_status",
  resolution_summary: "",
};

export async function updateIncident(user: CurrentUser, id: number, input: UpdateInput) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [field, cast] of Object.entries(UPDATABLE)) {
    const value = input[field as keyof UpdateInput];
    if (value !== undefined) {
      params.push(value);
      sets.push(`${field} = $${params.length}${cast}`);
    }
  }
  if (!sets.length) throw new HttpError(400, "Nothing to update");
  params.push(id);

  return withTransaction(
    user.user_id,
    async (c) => {
      const { rows } = await c.query(
        `UPDATE incidents SET ${sets.join(", ")} WHERE incident_id = $${params.length}
         RETURNING incident_id, status, severity`,
        params,
      );
      if (!rows[0]) throw new HttpError(404, "Incident not found");
      return rows[0];
    },
    { statusNote: input.note },
  );
}

export async function assignIncident(user: CurrentUser, id: number, assigneeId: number | null) {
  return withTransaction(user.user_id, async (c) => {
    const { rows } = await c.query<{ p_assignee: number }>(`CALL sp_assign_incident($1, $2)`, [id, assigneeId]);
    return { assignee_id: rows[0].p_assignee };
  });
}

export async function applyPlaybook(user: CurrentUser, id: number, playbookId: number) {
  return withTransaction(user.user_id, async (c) => {
    const { rows } = await c.query<{ p_tasks_created: number }>(
      `CALL sp_apply_playbook($1, $2)`,
      [id, playbookId],
    );
    return { tasks_created: rows[0].p_tasks_created };
  });
}

export async function deleteIncident(user: CurrentUser, id: number) {
  return withTransaction(user.user_id, async (c) => {
    const { rowCount } = await c.query(`DELETE FROM incidents WHERE incident_id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, "Incident not found");
  });
}

// --- Assets on an incident ----------------------------------------------------

export async function addIncidentAsset(user: CurrentUser, id: number, assetId: number, impact: string) {
  return withTransaction(user.user_id, async (c) => {
    await assertIncidentOpen(c, id);
    await c.query(
      `INSERT INTO incident_assets (incident_id, asset_id, impact) VALUES ($1, $2, $3)`,
      [id, assetId, impact],
    );
  });
}

export async function removeIncidentAsset(user: CurrentUser, id: number, assetId: number) {
  return withTransaction(user.user_id, async (c) => {
    await assertIncidentOpen(c, id);
    const { rowCount } = await c.query(
      `DELETE FROM incident_assets WHERE incident_id = $1 AND asset_id = $2`,
      [id, assetId],
    );
    if (!rowCount) throw new HttpError(404, "That asset is not linked to this incident");
  });
}

// --- Tasks ----------------------------------------------------------------------

type TaskCreate = { title: string; details?: string; assigned_to?: number | null; due_at?: Date | null };

export async function createTask(user: CurrentUser, id: number, input: TaskCreate) {
  return withTransaction(user.user_id, async (c) => {
    await assertIncidentOpen(c, id);
    const { rows } = await c.query(
      `INSERT INTO incident_tasks (incident_id, title, details, assigned_to, due_at)
       VALUES ($1, $2, $3, COALESCE($4, (SELECT assigned_to FROM incidents WHERE incident_id = $1)), $5)
       RETURNING task_id`,
      [id, input.title, input.details ?? null, input.assigned_to ?? null, input.due_at ?? null],
    );
    return rows[0];
  });
}

export async function updateTask(
  user: CurrentUser,
  incidentId: number,
  taskId: number,
  input: { status?: string; assigned_to?: number | null },
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.status !== undefined) {
    params.push(input.status);
    sets.push(`status = $${params.length}`);
  }
  if (input.assigned_to !== undefined) {
    params.push(input.assigned_to);
    sets.push(`assigned_to = $${params.length}`);
  }
  params.push(taskId, incidentId);

  return withTransaction(user.user_id, async (c) => {
    await assertIncidentOpen(c, incidentId);
    const { rows } = await c.query(
      `UPDATE incident_tasks SET ${sets.join(", ")}
        WHERE task_id = $${params.length - 1} AND incident_id = $${params.length}
        RETURNING task_id, status, completed_at`,
      params,
    );
    if (!rows[0]) throw new HttpError(404, "Task not found on this incident");
    return rows[0];
  });
}

async function assertIncidentOpen(c: PoolClient, id: number) {
  const { rows } = await c.query<{ status: string }>(
    `SELECT status FROM incidents WHERE incident_id = $1 FOR UPDATE`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, "Incident not found");
  if (rows[0].status === "RESOLVED" || rows[0].status === "CLOSED") {
    throw new HttpError(400, `Incident is ${rows[0].status}; reopen it first`);
  }
}
