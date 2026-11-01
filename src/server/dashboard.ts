import { query, queryOne } from "@/lib/db";

export async function getDashboard() {
  const [kpis, bySeverity, byStatus, monthly, workload, recurring, hotAssets, atRisk] = await Promise.all([
    // Headline numbers: aggregates with FILTER
    queryOne(
      `SELECT count(*) FILTER (WHERE status NOT IN ('RESOLVED', 'CLOSED'))::INT AS open_incidents,
              count(*) FILTER (WHERE status NOT IN ('RESOLVED', 'CLOSED') AND severity = 'CRITICAL')::INT AS open_critical,
              count(*) FILTER (WHERE status NOT IN ('RESOLVED', 'CLOSED') AND assigned_to IS NULL)::INT AS unassigned,
              count(*) FILTER (WHERE status NOT IN ('RESOLVED', 'CLOSED') AND now() > resolve_by)::INT AS open_breached,
              count(*) FILTER (WHERE created_at >= now() - INTERVAL '7 days')::INT AS new_last_7d,
              round(avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)
                    FILTER (WHERE created_at >= now() - INTERVAL '30 days')::NUMERIC, 1) AS mttr_respond_minutes_30d,
              round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
                    FILTER (WHERE resolved_at >= now() - INTERVAL '30 days')::NUMERIC, 1) AS mttr_resolve_hours_30d
         FROM incidents`,
    ),

    // Open incidents per severity (GROUP BY on an enum keeps the natural order)
    query(
      `SELECT severity, count(*)::INT AS count
         FROM incidents
        WHERE status NOT IN ('RESOLVED', 'CLOSED')
        GROUP BY severity
        ORDER BY severity DESC`,
    ),

    query(
      `SELECT status, count(*)::INT AS count
         FROM incidents
        GROUP BY status
        ORDER BY status`,
    ),

    // Six-month trend from the monthly stats view, summed across categories
    query(
      `SELECT to_char(month, 'Mon YYYY') AS label,
              month,
              sum(incidents)::INT AS incidents,
              sum(high_or_critical)::INT AS high_or_critical,
              round(avg(mean_hours_to_resolve), 1) AS mean_hours_to_resolve
         FROM v_incident_monthly_stats
        WHERE month >= date_trunc('month', now()) - INTERVAL '5 months'
        GROUP BY month
        ORDER BY month`,
    ),

    query(`SELECT * FROM v_analyst_workload ORDER BY open_incidents DESC, full_name`),

    // Categories that keep coming back: GROUP BY ... HAVING
    query(
      `SELECT category, count(*)::INT AS incidents,
              round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::NUMERIC, 1) AS avg_hours_to_resolve
         FROM incidents
        WHERE created_at >= now() - INTERVAL '90 days'
        GROUP BY category
       HAVING count(*) >= 2
        ORDER BY incidents DESC`,
    ),

    // Assets hit more often than the average asset: subquery inside HAVING
    query(
      `SELECT a.asset_id, a.hostname, a.department, a.criticality, count(*)::INT AS incidents
         FROM incident_assets ia
         JOIN assets a ON a.asset_id = ia.asset_id
        GROUP BY a.asset_id, a.hostname, a.department, a.criticality
       HAVING count(*) > (SELECT avg(n) FROM (SELECT count(*) AS n FROM incident_assets GROUP BY asset_id) per_asset)
        ORDER BY incidents DESC, a.criticality DESC
        LIMIT 8`,
    ),

    query(
      `SELECT incident_id, reference_code, title, severity, status, assignee_name, resolve_by, sla_state
         FROM v_incident_overview
        WHERE sla_state IN ('AT_RISK', 'BREACHED') AND status NOT IN ('RESOLVED', 'CLOSED')
        ORDER BY resolve_by
        LIMIT 8`,
    ),
  ]);

  return {
    kpis,
    by_severity: bySeverity,
    by_status: byStatus,
    monthly,
    workload,
    recurring_categories: recurring,
    hot_assets: hotAssets,
    at_risk: atRisk,
  };
}
