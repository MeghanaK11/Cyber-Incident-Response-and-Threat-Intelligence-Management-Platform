// Demo seed: analysts, assets, playbooks and about six months of incidents.
//
//   npm run seed                 # insert demo data and embed every incident
//   npm run seed -- --no-embed   # skip the embedding step
//
// Every incident is driven through the real workflow (stored procedures,
// triggers, status transitions), with app.event_time set before each step so
// timestamps, SLAs and history look like they happened over months.
// Analyst accounts get random passwords, printed once at the end.

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { getPool } from "../src/lib/db";
import { refreshEmbeddings } from "../src/server/embeddings";
import { ASSETS, FALSE_POSITIVE_NOTES, PLAYBOOKS, TEMPLATES, type Template } from "./seed-data";

const DAYS = 180;
const INCIDENTS = 64;
const MIN = 60_000;

// Small seeded PRNG so a re-run on an empty database gives the same story
let state = 20261101;
function rand() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));

const DOC_RANGES = ["192.0.2.", "198.51.100.", "203.0.113."];
const docIp = () => pick(DOC_RANGES) + int(2, 254);

const SLA_HOURS: Record<string, { respond: number; resolve: number }> = {
  CRITICAL: { respond: 0.25, resolve: 4 },
  HIGH: { respond: 1, resolve: 24 },
  MEDIUM: { respond: 4, resolve: 72 },
  LOW: { respond: 24, resolve: 168 },
};

const STAFF = [
  { name: "Arjun Mehta", role: "ANALYST" },
  { name: "Priya Raghavan", role: "ANALYST" },
  { name: "Karthik Iyer", role: "ANALYST" },
  { name: "Sneha Kulkarni", role: "ANALYST" },
  { name: "Rohan Desai", role: "VIEWER" },
];

async function main() {
  const embedAfter = !process.argv.includes("--no-embed");
  const domain = process.env.SEED_EMAIL_DOMAIN ?? "cirt.local";
  const pool = getPool();

  const { rows: admins } = await pool.query<{ user_id: number }>(
    `SELECT u.user_id FROM users u JOIN roles r USING (role_id) WHERE r.role_name = 'ADMIN' AND u.is_active ORDER BY u.user_id LIMIT 1`,
  );
  if (!admins[0]) throw new Error("Create an admin first: npm run create-admin -- \"Name\" email");
  const adminId = admins[0].user_id;

  const { rows: existing } = await pool.query<{ n: number }>(`SELECT count(*)::INT AS n FROM incidents`);
  if (existing[0].n > 0) {
    throw new Error(`The database already has ${existing[0].n} incidents. Seed only runs on an empty incidents table.`);
  }

  // Staff accounts ------------------------------------------------------------
  const credentials: { email: string; password: string; role: string }[] = [];
  const analystIds: number[] = [];
  for (const s of STAFF) {
    const email = `${s.name.split(" ")[0].toLowerCase()}.${s.name.split(" ")[1].toLowerCase()}@${domain}`;
    const found = await pool.query<{ user_id: number }>(`SELECT user_id FROM users WHERE email = $1`, [email]);
    let id = found.rows[0]?.user_id;
    if (!id) {
      const password = randomBytes(9).toString("base64url") + "!7";
      const { rows } = await pool.query<{ user_id: number }>(
        `INSERT INTO users (full_name, email, password_hash, role_id)
         VALUES ($1, $2, $3, (SELECT role_id FROM roles WHERE role_name = $4)) RETURNING user_id`,
        [s.name, email, await bcrypt.hash(password, 12), s.role],
      );
      id = rows[0].user_id;
      credentials.push({ email, password, role: s.role });
    }
    if (s.role === "ANALYST") analystIds.push(id);
  }
  const workers = [...analystIds, adminId];

  // Assets ----------------------------------------------------------------------
  const assetIds = new Map<string, number>();
  for (const a of ASSETS) {
    const { rows } = await pool.query<{ asset_id: number }>(
      `INSERT INTO assets (hostname, ip_address, asset_type, operating_system, department, criticality, is_internet_facing, created_at)
       VALUES ($1, $2::INET, $3, $4, $5, $6, $7, now() - INTERVAL '200 days')
       ON CONFLICT (hostname) DO UPDATE SET hostname = EXCLUDED.hostname
       RETURNING asset_id`,
      [a.hostname, a.ip, a.type, a.os, a.dept, a.crit, a.internet],
    );
    assetIds.set(a.hostname, rows[0].asset_id);
  }

  // Playbooks -------------------------------------------------------------------
  const playbookByCategory = new Map<string, number>();
  for (const p of PLAYBOOKS) {
    const { rows } = await pool.query<{ playbook_id: number }>(
      `INSERT INTO playbooks (name, category, description, created_by, created_at)
       VALUES ($1, $2::incident_category, $3, $4, now() - INTERVAL '190 days')
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING playbook_id`,
      [p.name, p.category, p.description, adminId],
    );
    const id = rows[0].playbook_id;
    await pool.query(
      `INSERT INTO playbook_steps (playbook_id, step_no, title, instructions, expected_minutes)
       SELECT $1, s.ord, s.title, s.instr, s.mins
         FROM unnest($2::TEXT[], $3::TEXT[], $4::INT[]) WITH ORDINALITY AS s(title, instr, mins, ord)
       ON CONFLICT DO NOTHING`,
      [id, p.steps.map((s) => s[0]), p.steps.map((s) => s[1]), p.steps.map((s) => s[2])],
    );
    if (p.category) playbookByCategory.set(p.category, id);
  }

  // Incidents ---------------------------------------------------------------------
  // Spread over the window with a slight lean towards recent weeks, plus a
  // handful in the last two days so the live queue has open work.
  const now = Date.now();
  const starts: number[] = [];
  for (let i = 0; i < INCIDENTS - 6; i++) starts.push(now - Math.pow(rand(), 0.8) * DAYS * 24 * 60 * MIN);
  for (let i = 0; i < 6; i++) starts.push(now - between(20, 48 * 60) * MIN);
  starts.sort((a, b) => a - b);

  const counts = { closed: 0, resolved: 0, open: 0, falsePositive: 0 };
  for (const start of starts) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const outcome = await playIncident(client, pick(TEMPLATES), start, now, workers, assetIds, playbookByCategory);
      counts[outcome]++;
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(`Seeded ${assetIds.size} assets, ${PLAYBOOKS.length} playbooks and ${starts.length} incidents`);
  console.log(`  ${counts.closed} closed, ${counts.resolved} resolved, ${counts.open} open, ${counts.falsePositive} false positives`);

  if (embedAfter) {
    console.log("Embedding incidents (first run downloads the model, about 90 MB)...");
    const written = await refreshEmbeddings();
    console.log(`  ${written} embeddings written`);
  }

  if (credentials.length) {
    console.log("\nNew accounts (passwords are shown only once):");
    for (const c of credentials) console.log(`  ${c.role.padEnd(8)} ${c.email.padEnd(32)} ${c.password}`);
  }
  await pool.end();
}

type Outcome = "closed" | "resolved" | "open" | "falsePositive";

async function playIncident(
  c: PoolClient,
  t: Template,
  start: number,
  now: number,
  workers: number[],
  assetIds: Map<string, number>,
  playbooks: Map<string, number>,
): Promise<Outcome> {
  const severity = pick(t.severities);
  const sla = SLA_HOURS[severity];
  const reporter = pick(workers);
  const owner = pick(workers.slice(0, -1)); // analysts do most of the work
  const hosts = [...assetIds.keys()].filter((h) => t.assets.some((prefix) => h.startsWith(prefix)));
  const chosen = [...new Set([pick(hosts), rand() < 0.4 ? pick(hosts) : null].filter(Boolean) as string[])];

  // Fill once so the description and resolution agree on numbers
  const nums = { ip: docIp(), ip2: docIp(), n: String(int(3, 40) * (t.category === "DATA_BREACH" ? 120 : 1)), m: String(int(2, 9)) };
  const apply = (s: string) =>
    s.replaceAll("{ip}", nums.ip).replaceAll("{ip2}", nums.ip2).replaceAll("{n}", nums.n)
      .replaceAll("{m}", nums.m).replaceAll("{host}", chosen[0].split(".")[0]);

  let clock = start;
  const at = async (ms: number, actor: number, note = "") => {
    clock = ms;
    await c.query(
      `SELECT set_config('app.event_time', $1, true), set_config('app.current_user_id', $2, true), set_config('app.status_note', $3, true)`,
      [new Date(ms).toISOString(), String(actor), note],
    );
  };
  const live = (ms: number) => ms < now - MIN;

  // Detection and report
  await at(start, reporter);
  const { rows } = await c.query<{ incident_id: number }>(
    `INSERT INTO incidents (title, description, category, severity, reported_by, detected_at)
     VALUES ($1, $2, $3::incident_category, $4::incident_severity, $5, $6) RETURNING incident_id`,
    [apply(t.title), apply(t.description), t.category, severity, reporter, new Date(start - between(3, 90) * MIN)],
  );
  const id = rows[0].incident_id;
  for (const h of chosen) {
    await c.query(`INSERT INTO incident_assets (incident_id, asset_id, impact, added_at) VALUES ($1, $2, $3, $4)`,
      [id, assetIds.get(h), t.impact, new Date(start)]);
  }

  // First response: usually inside the respond SLA, sometimes late
  const respondFactor = rand() < 0.15 ? between(1.1, 2.5) : between(0.2, 0.9);
  const triageAt = start + sla.respond * 60 * respondFactor * MIN;
  if (!live(triageAt)) return "open";
  const fresh = now - start < 36 * 60 * MIN;
  if (fresh && rand() < 0.3) return "open"; // still waiting in the queue

  await at(triageAt, owner);
  await c.query(`CALL sp_assign_incident($1, $2)`, [id, owner]);

  // About one in ten turn out to be benign
  if (rand() < 0.1) {
    await at(triageAt + between(5, 30) * MIN, owner, "Closed as false positive after triage");
    if (!live(clock)) return "open";
    await c.query(`UPDATE incidents SET status = 'CLOSED', resolution_summary = $2 WHERE incident_id = $1`, [id, pick(FALSE_POSITIVE_NOTES)]);
    return "falsePositive";
  }

  const playbookId = playbooks.get(t.category);
  if (playbookId) {
    await c.query(`CALL sp_apply_playbook($1, $2)`, [id, playbookId]);
  } else {
    await c.query(`UPDATE incidents SET status = 'TRIAGED' WHERE incident_id = $1`, [id]);
  }

  // Occasional escalation once the scope is clearer. The trigger restarts the
  // SLA clock from this moment with the tighter window.
  let slaStart = start;
  let resolveHours = sla.resolve;
  if (severity !== "CRITICAL" && rand() < 0.15) {
    await at(clock + between(10, 40) * MIN, owner);
    const up = severity === "LOW" ? "MEDIUM" : severity === "MEDIUM" ? "HIGH" : "CRITICAL";
    await c.query(`UPDATE incidents SET severity = $2::incident_severity WHERE incident_id = $1`, [id, up]);
    slaStart = clock;
    resolveHours = SLA_HOURS[up].resolve;
  }

  if (fresh && rand() < 0.4) return "open"; // triaged, work not started yet
  await at(clock + between(5, 25) * MIN, owner, "Working the playbook");
  if (!live(clock)) return "open";
  await c.query(`UPDATE incidents SET status = 'IN_PROGRESS' WHERE incident_id = $1`, [id]);

  // Resolution target: mostly inside SLA, about one in five late
  const resolveFactor = rand() < 0.15 ? between(1.1, 2.2) : between(0.25, 0.9);
  const resolveAt = slaStart + resolveHours * 60 * resolveFactor * MIN;

  // Work through the tasks in order, spreading them before the resolve time
  const { rows: tasks } = await c.query<{ task_id: number }>(
    `SELECT task_id FROM incident_tasks WHERE incident_id = $1 ORDER BY step_no`, [id]);
  // A few recent incidents stall (waiting on a vendor, a user, a change window)
  const stalls = now - start < 10 * 24 * 60 * MIN && rand() < 0.35;
  for (let i = 0; i < tasks.length; i++) {
    // Each task takes a share of the time that is left, so the last one lands before resolveAt
    const remaining = Math.max(resolveAt - clock, 10 * MIN);
    const doneAt = clock + (remaining * 0.8) / (tasks.length - i) * between(0.6, 1);
    if (stalls && i >= Math.floor(tasks.length / 2)) {
      await c.query(`UPDATE incident_tasks SET status = 'DOING' WHERE task_id = $1`, [tasks[i].task_id]);
      return "open";
    }
    if (!live(doneAt)) {
      // Mark the current task as in progress and leave the incident open
      await c.query(`UPDATE incident_tasks SET status = 'DOING' WHERE task_id = $1`, [tasks[i].task_id]);
      return "open";
    }
    await at(doneAt, owner);
    await c.query(`UPDATE incident_tasks SET status = $2 WHERE task_id = $1`,
      [tasks[i].task_id, i === tasks.length - 1 && rand() < 0.2 ? "SKIPPED" : "DONE"]);
    if (t.contain && i === 0) {
      await c.query(`UPDATE incidents SET status = 'CONTAINED' WHERE incident_id = $1`, [id]);
    }
  }

  const finishAt = Math.max(resolveAt, clock + 5 * MIN);
  if (!live(finishAt)) return "open";
  await at(finishAt, owner, "Root cause fixed and verified");
  await c.query(`UPDATE incidents SET status = 'RESOLVED', resolution_summary = $2 WHERE incident_id = $1`, [id, apply(t.resolution)]);

  const closeAt = finishAt + between(12, 72) * 60 * MIN;
  if (!live(closeAt)) return "resolved";
  await at(closeAt, pick(workers), "Reviewed and closed");
  await c.query(`UPDATE incidents SET status = 'CLOSED' WHERE incident_id = $1`, [id]);
  return "closed";
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
