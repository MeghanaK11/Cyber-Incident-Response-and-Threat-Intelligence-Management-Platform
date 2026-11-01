"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtRelative, humanize } from "@/lib/client";
import { SeverityBadge, SlaBadge, StatusBadge } from "@/components/Badges";

type Row = Record<string, string | number | null>;
type Dashboard = {
  kpis: Record<string, number | string | null>;
  by_severity: { severity: string; count: number }[];
  by_status: { status: string; count: number }[];
  monthly: { label: string; incidents: number; high_or_critical: number; mean_hours_to_resolve: string | null }[];
  workload: Row[];
  recurring_categories: Row[];
  hot_assets: Row[];
  at_risk: Row[];
};

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SEV_FILL: Record<string, string> = {
  CRITICAL: "bg-sev-4",
  HIGH: "bg-sev-3",
  MEDIUM: "bg-sev-2",
  LOW: "bg-sev-1",
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-critical">{error}</p>;
  if (!data) return <p className="text-ink-3">Loading dashboard...</p>;

  const k = data.kpis;
  const sevMax = Math.max(1, ...data.by_severity.map((s) => s.count));
  const monthMax = Math.max(1, ...data.monthly.map((m) => m.incidents));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security operations</h1>
        <p className="text-ink-2">Live view of open incidents, SLA pressure and analyst load.</p>
      </div>

      {/* Headline numbers */}
      <section className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-line py-6 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Open incidents" value={k.open_incidents} href="/incidents?open=true" />
        <Stat label="Open critical" value={k.open_critical} href="/incidents?open=true&severity=CRITICAL" />
        <Stat label="SLA breached" value={k.open_breached} href="/incidents?open=true&sla=BREACHED" />
        <Stat label="Unassigned" value={k.unassigned} href="/incidents?open=true&assignee=none" />
        <Stat label="New this week" value={k.new_last_7d} />
        <Stat label="Mean time to respond" value={k.mttr_respond_minutes_30d} unit="min" note="last 30 days" />
        <Stat label="Mean time to resolve" value={k.mttr_resolve_hours_30d} unit="h" note="last 30 days" />
      </section>

      <div className="grid gap-10 lg:grid-cols-5">
        {/* Open by severity */}
        <section className="lg:col-span-2">
          <h2 className="section-title mb-4">Open incidents by severity</h2>
          <div className="space-y-3">
            {SEV_ORDER.map((sev) => {
              const count = data.by_severity.find((s) => s.severity === sev)?.count ?? 0;
              return (
                <Link key={sev} href={`/incidents?open=true&severity=${sev}`} className="group flex items-center gap-3"
                      title={`${humanize(sev)}: ${count} open`}>
                  <span className="w-20 text-[13px] text-ink-2">{humanize(sev)}</span>
                  <span className="relative h-6 flex-1">
                    <span className={`absolute inset-y-0 left-0 rounded-r ${SEV_FILL[sev]} group-hover:opacity-80`}
                          style={{ width: `${(count / sevMax) * 100}%`, minWidth: count ? 4 : 0 }} />
                  </span>
                  <span className="w-8 text-right text-[14px] font-medium tabular-nums">{count}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Monthly trend */}
        <section className="lg:col-span-3">
          <h2 className="section-title mb-4">Incidents per month</h2>
          {data.monthly.length === 0 ? (
            <Empty text="No incidents in the last six months." />
          ) : (
            <div className="flex h-44 items-end gap-3 border-b border-line">
              {data.monthly.map((m) => (
                <div key={m.label} className="group flex h-full flex-1 flex-col items-center justify-end"
                     title={`${m.label}: ${m.incidents} incidents, ${m.high_or_critical} high or critical` +
                            (m.mean_hours_to_resolve ? `, ${m.mean_hours_to_resolve}h mean to resolve` : "")}>
                  <span className="mb-1 text-[12px] tabular-nums text-ink-2 opacity-0 group-hover:opacity-100">{m.incidents}</span>
                  <span className="w-full max-w-12 rounded-t bg-accent group-hover:bg-accent-dark"
                        style={{ height: `${(m.incidents / monthMax) * 85}%`, minHeight: 4 }} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-3">
            {data.monthly.map((m) => (
              <span key={m.label} className="flex-1 text-center text-[12px] text-ink-3">{m.label.slice(0, 3)}</span>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="section-title mb-3">SLA at risk or breached</h2>
          {data.at_risk.length === 0 ? (
            <Empty text="Every open incident is inside its SLA." />
          ) : (
            <ul className="divide-y divide-line">
              {data.at_risk.map((r) => (
                <li key={r.incident_id}>
                  <Link href={`/incidents/${r.incident_id}`} className="flex items-center gap-3 py-2.5 hover:bg-panel">
                    <span className="font-mono text-[12px] text-ink-3">{r.reference_code}</span>
                    <span className="flex-1 truncate">{r.title}</span>
                    <SeverityBadge value={String(r.severity)} />
                    <SlaBadge value={String(r.sla_state)} />
                    <span className="w-16 text-right text-[13px] text-ink-3">{fmtRelative(String(r.resolve_by))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="section-title mb-3">Analyst workload</h2>
          {data.workload.length === 0 ? (
            <Empty text="No active analysts yet." />
          ) : (
            <table className="w-full text-[14px]">
              <thead className="text-left text-[12px] text-ink-3">
                <tr>
                  <th className="pb-2 font-medium">Analyst</th>
                  <th className="pb-2 text-right font-medium">Open</th>
                  <th className="pb-2 text-right font-medium">Critical</th>
                  <th className="pb-2 text-right font-medium">Breached</th>
                  <th className="pb-2 text-right font-medium">Resolved 30d</th>
                  <th className="pb-2 text-right font-medium">Avg hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.workload.map((w) => (
                  <tr key={w.user_id}>
                    <td className="py-2">{w.full_name}</td>
                    <td className="py-2 text-right tabular-nums">{w.open_incidents}</td>
                    <td className="py-2 text-right tabular-nums">{w.open_critical}</td>
                    <td className="py-2 text-right tabular-nums">{w.open_breached}</td>
                    <td className="py-2 text-right tabular-nums">{w.resolved_last_30d}</td>
                    <td className="py-2 text-right tabular-nums">{w.avg_hours_to_resolve ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        <section>
          <h2 className="section-title mb-3">Status breakdown</h2>
          <ul className="space-y-2">
            {data.by_status.map((s) => (
              <li key={s.status} className="flex items-center justify-between">
                <StatusBadge value={s.status} />
                <span className="tabular-nums">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="section-title mb-3">Recurring categories (90 days)</h2>
          {data.recurring_categories.length === 0 ? (
            <Empty text="No category has repeated in the last 90 days." />
          ) : (
            <ul className="space-y-2">
              {data.recurring_categories.map((c) => (
                <li key={c.category} className="flex justify-between">
                  <span>{humanize(String(c.category))}</span>
                  <span className="tabular-nums text-ink-2">
                    {c.incidents}
                    {c.avg_hours_to_resolve ? <span className="text-ink-3"> · {c.avg_hours_to_resolve}h avg</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="section-title mb-3">Most targeted assets</h2>
          {data.hot_assets.length === 0 ? (
            <Empty text="No asset stands out yet." />
          ) : (
            <ul className="space-y-2">
              {data.hot_assets.map((a) => (
                <li key={a.asset_id} className="flex justify-between gap-3">
                  <span className="truncate font-mono text-[13px]">{a.hostname}</span>
                  <span className="whitespace-nowrap tabular-nums text-ink-2">
                    {a.incidents} <span className="text-ink-3">· crit {a.criticality}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, note, href }: {
  label: string; value: number | string | null | undefined; unit?: string; note?: string; href?: string;
}) {
  const body = (
    <>
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
        {value ?? "-"}
        {value != null && unit ? <span className="ml-1 text-base font-normal text-ink-3">{unit}</span> : null}
      </div>
      {note && <div className="text-[12px] text-ink-3">{note}</div>}
    </>
  );
  return href ? <Link href={href} className="hover:opacity-75">{body}</Link> : <div>{body}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-[14px] text-ink-3">{text}</p>;
}
