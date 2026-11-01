import { query, withTransaction } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CurrentUser } from "@/lib/auth";

type AssetInput = {
  hostname?: string;
  ip_address?: string | null;
  asset_type?: string;
  operating_system?: string | null;
  department?: string;
  criticality?: number;
  is_internet_facing?: boolean;
};

const COLUMNS = ["hostname", "ip_address", "asset_type", "operating_system", "department", "criticality", "is_internet_facing"] as const;

export function listAssets() {
  // Exposure per asset: how many incidents touched it, how many are still open
  return query(
    `SELECT a.asset_id, a.hostname, host(a.ip_address) AS ip_address, a.asset_type, a.operating_system,
            a.department, a.criticality, a.is_internet_facing, a.created_at,
            count(ia.incident_id)::INT AS incident_count,
            (count(ia.incident_id) FILTER (WHERE i.status NOT IN ('RESOLVED', 'CLOSED')))::INT AS open_incidents,
            (count(ia.incident_id) FILTER (WHERE ia.impact = 'COMPROMISED'))::INT AS times_compromised,
            max(i.created_at) AS last_incident_at
       FROM assets a
       LEFT JOIN incident_assets ia ON ia.asset_id = a.asset_id
       LEFT JOIN incidents i        ON i.incident_id = ia.incident_id
      GROUP BY a.asset_id
      ORDER BY a.criticality DESC, a.hostname`,
  );
}

export async function createAsset(user: CurrentUser, input: AssetInput) {
  return withTransaction(user.user_id, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO assets (hostname, ip_address, asset_type, operating_system, department, criticality, is_internet_facing)
       VALUES ($1, $2::INET, $3, $4, $5, $6, $7)
       RETURNING asset_id`,
      [input.hostname, input.ip_address || null, input.asset_type, input.operating_system || null,
       input.department, input.criticality, input.is_internet_facing ?? false],
    );
    return rows[0];
  });
}

export async function updateAsset(user: CurrentUser, id: number, input: AssetInput) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const col of COLUMNS) {
    if (input[col] !== undefined) {
      params.push(col === "ip_address" || col === "operating_system" ? input[col] || null : input[col]);
      sets.push(`${col} = $${params.length}${col === "ip_address" ? "::INET" : ""}`);
    }
  }
  params.push(id);
  return withTransaction(user.user_id, async (c) => {
    const { rowCount } = await c.query(`UPDATE assets SET ${sets.join(", ")} WHERE asset_id = $${params.length}`, params);
    if (!rowCount) throw new HttpError(404, "Asset not found");
  });
}

export async function deleteAsset(user: CurrentUser, id: number) {
  return withTransaction(user.user_id, async (c) => {
    // FK incident_assets.asset_id is ON DELETE RESTRICT, so a linked asset raises 23503
    const { rowCount } = await c.query(`DELETE FROM assets WHERE asset_id = $1`, [id]);
    if (!rowCount) throw new HttpError(404, "Asset not found");
  });
}
