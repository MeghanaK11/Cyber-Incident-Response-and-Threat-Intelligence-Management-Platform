"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtRelative, humanize } from "@/lib/client";
import { SeverityBadge, SlaBadge, StatusBadge } from "@/components/Badges";
import { POSTURE_LEVELS, postureInfo, type Posture } from "@/components/Posture";

type Row = Record<string, string | number | null>;
type Dashboard = {
  posture: Posture;
  activity: Row[];
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
const SEV_COLOR: Record<string, string> = { CRITICAL: "#f2385a", HIGH: "#f0803c", MEDIUM: "#e3b341", LOW: "#6b8fbf" };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dashboard>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-critical">{error}</p>;
  if (!data) return <p className="text-ink-3">Loading the operations picture...</p>;

  const k = data.kpis;
  const sevMax = Math.max(1, ...data.by_severity.map((s) => s.count));
  const monthMax = Math.max(1, ...data.monthly.map((m) => m.incidents));

  return (
    <div className="space-y-12">
      <PostureHero posture={data.posture} activity={data.activity} />

      {/* Headline numbers, plain type on the grid rather than boxed cards */}
      <section className="grid grid-cols-2 gap-x-10 gap-y-6 md:grid-cols-4">
        <Stat label="Waiting for an owner" value={k.unassigned} href="/incidents?open=true&assignee=none" alert={Number(k.unassigned) > 0} />
        <Stat label="Reported this week" value={k.new_last_7d} href="/incidents?sort=newest" />
        <Stat label="Mean time to respond" value={k.mttr_respond_minutes_30d} unit="min" note="last 30 days" />
        <Stat label="Mean time to resolve" value={k.mttr_resolve_hours_30d} unit="h" note="last 30 days" />
      </section>

      <div className="grid gap-12 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <h2 className="section-title mb-5">Open incidents by severity</h2>
          <div className="space-y-4">
            {SEV_ORDER.map((sev) => {
              const count = data.by_severity.find((s) => s.severity === sev)?.count ?? 0;
              return (
                <Link key={sev} href={`/incidents?open=true&severity=${sev}`} className="group block" title={`${humanize(sev)}: ${count} open`}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                    <span className="text-ink-2 group-hover:text-ink">{humanize(sev)}</span>
                    <span className="font-display text-[18px] font-semibold tabular-nums">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-line">
                    <div className="h-2 rounded-full transition-[filter] group-hover:brightness-125"
                         style={{ width: `${(count / sevMax) * 100}%`, minWidth: count ? 8 : 0, background: SEV_COLOR[sev] }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-3">
          <h2 className="section-title mb-5">Incidents reported per month</h2>
          {data.monthly.length === 0 ? (
            <Empty text="No incidents in the last six months." />
          ) : (
            <>
              <div className="flex h-48 items-end gap-4 border-b border-line-2">
                {data.monthly.map((m) => (
                  <div key={m.label} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                    <div className="pointer-events-none absolute -top-1 z-10 hidden w-max -translate-y-full rounded-md border border-line-2 bg-panel px-3 py-2 text-[12px] text-ink-2 shadow-lg group-hover:block">
                      <div className="font-medium text-ink">{m.label}</div>
                      <div>{m.incidents} incidents, {m.high_or_critical} high or critical</div>
                      {m.mean_hours_to_resolve && <div>{m.mean_hours_to_resolve} h mean to resolve</div>}
                    </div>
                    <span className="mb-1.5 text-[12px] tabular-nums text-ink-3 group-hover:text-ink">{m.incidents}</span>
                    <div className="flex w-full max-w-14 flex-col justify-end overflow-hidden rounded-t-[4px]"
                         style={{ height: `${(m.incidents / monthMax) * 82}%`, minHeight: 4 }}>
                      {/* high or critical share sits on the baseline in the hot colour */}
                      <div className="w-full bg-accent/70 group-hover:bg-accent" style={{ flexGrow: Math.max(m.incidents - m.high_or_critical, 0) }} />
                      <div className="w-full border-t-2 border-surface bg-sev-3/85 group-hover:bg-sev-3" style={{ flexGrow: m.high_or_critical }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-4">
                {data.monthly.map((m) => (
                  <span key={m.label} className="flex-1 text-center text-[12px] text-ink-3">{m.label.slice(0, 3)}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-5 text-[12px] text-ink-2">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/70" />Low or medium</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sev-3/85" />High or critical</span>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="section-title mb-4">Deadlines at risk</h2>
          {data.at_risk.length === 0 ? (
            <Empty text="Every open incident is inside its SLA." />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {data.at_risk.map((r) => (
                <li key={r.incident_id}>
                  <Link href={`/incidents/${r.incident_id}`} className="flex items-center gap-4 py-3 hover:bg-panel-2/40">
                    <span className="code w-32 shrink-0">{r.reference_code}</span>
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <SlaBadge value={String(r.sla_state)} />
                    <span className="w-20 text-right text-[13px] tabular-nums text-ink-3">{fmtRelative(String(r.resolve_by))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="section-title mb-4">Analyst workload</h2>
          {data.workload.length === 0 ? (
            <Empty text="No active analysts yet. Add them from Users." />
          ) : (
            <table className="w-full text-[14px]">
              <thead className="text-left text-[12px] text-ink-3">
                <tr className="border-b border-line">
                  <th className="pb-2 font-medium">Analyst</th>
                  <th className="pb-2 text-right font-medium">Open</th>
                  <th className="pb-2 text-right font-medium">Critical</th>
                  <th className="pb-2 text-right font-medium">Past SLA</th>
                  <th className="pb-2 text-right font-medium">Closed 30d</th>
                  <th className="pb-2 text-right font-medium">Avg hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.workload.map((w) => (
                  <tr key={w.user_id}>
                    <td className="py-2.5">{w.full_name}</td>
                    <td className="py-2.5 text-right tabular-nums">{w.open_incidents}</td>
                    <td className={`py-2.5 text-right tabular-nums ${Number(w.open_critical) ? "text-sev-4" : "text-ink-3"}`}>{w.open_critical}</td>
                    <td className={`py-2.5 text-right tabular-nums ${Number(w.open_breached) ? "text-sev-4" : "text-ink-3"}`}>{w.open_breached}</td>
                    <td className="py-2.5 text-right tabular-nums">{w.resolved_last_30d}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-2">{w.avg_hours_to_resolve ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        <section>
          <h2 className="section-title mb-4">Where incidents stand</h2>
          <ul className="space-y-2.5">
            {data.by_status.map((s) => (
              <li key={s.status} className="flex items-center justify-between">
                <StatusBadge value={s.status} />
                <span className="tabular-nums text-ink-2">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="section-title mb-4">Repeat categories, last 90 days</h2>
          {data.recurring_categories.length === 0 ? (
            <Empty text="No category has come up twice in the last 90 days." />
          ) : (
            <ul className="space-y-2.5">
              {data.recurring_categories.map((c) => (
                <li key={c.category} className="flex justify-between gap-3">
                  <Link href={`/incidents?category=${c.category}`} className="hover:text-accent">{humanize(String(c.category))}</Link>
                  <span className="tabular-nums text-ink-2">
                    {c.incidents}
                    {c.avg_hours_to_resolve ? <span className="text-ink-3"> / {c.avg_hours_to_resolve} h avg</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="section-title mb-4">Most targeted assets</h2>
          {data.hot_assets.length === 0 ? (
            <Empty text="No asset has been hit more than the rest." />
          ) : (
            <ul className="space-y-2.5">
              {data.hot_assets.map((a) => (
                <li key={a.asset_id} className="flex items-center justify-between gap-3">
                  <span className="code truncate text-ink">{String(a.hostname).split(".")[0]}</span>
                  <span className="whitespace-nowrap text-[13px] tabular-nums text-ink-2">
                    {a.incidents} incidents <span className="text-ink-3">/ criticality {a.criticality}</span>
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

function PostureHero({ posture, activity }: { posture: Posture; activity: Row[] }) {
  const info = postureInfo(posture.level);
  return (
    <section className="grid gap-10 border-b border-line pb-10 xl:grid-cols-[1.35fr_1fr]">
      <div>
        <div className="flex items-baseline justify-between text-[13px] text-ink-3">
          <span>Threat posture</span>
          <span className="tabular-nums" title="Weighted open incidents: critical 8, high 4, medium 2, low 1, plus 3 per SLA breach">
            Score {posture.score}
          </span>
        </div>
        <h1 className="font-display text-[84px] font-semibold leading-[0.95] tracking-wide"
            style={{ color: info.color, textShadow: `0 0 42px ${info.color}55` }}>
          {info.label}
        </h1>
        <p className="mt-3 max-w-xl text-[17px] text-ink-2">{info.text}</p>

        {/* Segmented meter: one segment per level, filled up to the current one */}
        <div className="mt-8 grid grid-cols-4 gap-1.5" role="meter" aria-valuemin={1} aria-valuemax={4}
             aria-valuenow={posture.level_rank} aria-valuetext={info.label}>
          {POSTURE_LEVELS.map((lvl, i) => {
            const on = i < posture.level_rank;
            return (
              <div key={lvl.level}>
                <div className="h-3 overflow-hidden rounded-[3px] bg-line">
                  {on && (
                    <div className="h-full origin-left animate-meter"
                         style={{ background: lvl.color, animationDelay: `${i * 160}ms`, boxShadow: `0 0 14px ${lvl.color}88` }} />
                  )}
                </div>
                <div className={`mt-2 text-[12px] ${i === posture.level_rank - 1 ? "text-ink" : "text-ink-3"}`}>{lvl.label}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-10 gap-y-3">
          <HeroFigure value={posture.open_incidents} label="open incidents" href="/incidents?open=true" />
          <HeroFigure value={posture.open_critical} label="critical" href="/incidents?open=true&severity=CRITICAL" hot={posture.open_critical > 0} />
          <HeroFigure value={posture.open_breached} label="past their SLA" href="/incidents?open=true&sla=BREACHED" hot={posture.open_breached > 0} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="section-title">Latest activity</h2>
          <Link href="/incidents" className="text-[13px] text-accent hover:underline">All incidents</Link>
        </div>
        {activity.length === 0 ? (
          <Empty text="Nothing has happened yet. Report the first incident to get started." />
        ) : (
          <ol className="relative space-y-3.5 border-l border-line-2 pl-5">
            {activity.map((a) => (
              <li key={a.history_id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-surface"
                      style={{ background: SEV_COLOR[String(a.severity)] }} aria-hidden />
                <Link href={`/incidents/${a.incident_id}`} className="block hover:text-accent">
                  <div className="truncate text-[14px]">{a.title}</div>
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-3">
                  <span className="code text-[11.5px]">{a.reference_code}</span>
                  <span>{a.old_status ? `${humanize(String(a.old_status))} to` : "Opened as"}</span>
                  <StatusBadge value={String(a.new_status)} />
                  <span>{a.changed_by_name ?? "system"}, {fmtRelative(String(a.changed_at))}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function HeroFigure({ value, label, href, hot }: { value: number; label: string; href: string; hot?: boolean }) {
  return (
    <Link href={href} className="group flex items-baseline gap-2">
      <span className={`font-display text-[34px] font-semibold tabular-nums ${hot ? "text-sev-4" : "text-ink"}`}>{value}</span>
      <span className="text-[14px] text-ink-2 group-hover:text-ink">{label}</span>
    </Link>
  );
}

function Stat({ label, value, unit, note, href, alert }: {
  label: string; value: number | string | null | undefined; unit?: string; note?: string; href?: string; alert?: boolean;
}) {
  const body = (
    <>
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={`mt-1 font-display text-[30px] font-semibold tabular-nums leading-none ${alert ? "text-sev-3" : "text-ink"}`}>
        {value ?? "-"}
        {value != null && unit ? <span className="ml-1 font-sans text-[14px] font-normal text-ink-3">{unit}</span> : null}
      </div>
      {note && <div className="mt-1 text-[12px] text-ink-3">{note}</div>}
    </>
  );
  return href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : <div>{body}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-[14px] text-ink-3">{text}</p>;
}
