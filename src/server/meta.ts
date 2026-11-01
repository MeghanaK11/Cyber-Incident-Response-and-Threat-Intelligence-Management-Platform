import { query } from "@/lib/db";

// Dropdown values come straight from the database (enum types and lookup
// tables), so the UI never drifts from the schema.
export async function getMeta() {
  const [enums, roles, assignees, assets, sla] = await Promise.all([
    query<{ name: string; values: string[] }>(
      `SELECT t.typname AS name, array_agg(e.enumlabel::TEXT ORDER BY e.enumsortorder) AS values
         FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname IN ('incident_severity', 'incident_status', 'incident_category')
        GROUP BY t.typname`,
    ),
    query(`SELECT role_id, role_name, description FROM roles ORDER BY role_id`),
    query(
      `SELECT u.user_id, u.full_name, r.role_name AS role
         FROM users u JOIN roles r ON r.role_id = u.role_id
        WHERE u.is_active AND r.role_name IN ('ADMIN', 'ANALYST')
        ORDER BY u.full_name`,
    ),
    query(
      `SELECT asset_id, hostname, host(ip_address) AS ip_address, asset_type, department, criticality
         FROM assets ORDER BY hostname`,
    ),
    query(
      `SELECT severity,
              EXTRACT(EPOCH FROM respond_within)::INT / 60 AS respond_minutes,
              EXTRACT(EPOCH FROM resolve_within)::INT / 60 AS resolve_minutes
         FROM severity_sla ORDER BY severity`,
    ),
  ]);

  const byName = Object.fromEntries(enums.map((e) => [e.name, e.values]));
  return {
    severities: byName.incident_severity ?? [],
    statuses: byName.incident_status ?? [],
    categories: byName.incident_category ?? [],
    roles,
    assignees,
    assets,
    sla,
  };
}
