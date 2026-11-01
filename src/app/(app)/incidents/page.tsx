"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, fmtDate, fmtRelative, humanize } from "@/lib/client";
import { SeverityBadge, SlaBadge, StatusBadge } from "@/components/Badges";
import { canWrite, useUser } from "@/components/UserContext";
import { useMeta } from "@/components/useMeta";

type Item = {
  incident_id: number;
  reference_code: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  sla_state: string;
  resolve_by: string;
  created_at: string;
  assignee_name: string | null;
  total_tasks: number;
  done_tasks: number;
};
type ListResponse = { items: Item[]; total: number; page: number; page_size: number };

const FILTERS = ["q", "status", "severity", "category", "assignee", "sla", "open", "sort", "page"] as const;

function IncidentList() {
  const user = useUser();
  const meta = useMeta();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") ?? "");

  const queryString = params.toString();
  useEffect(() => {
    setError("");
    api<ListResponse>(`/api/incidents?${queryString}`).then(setData).catch((e) => setError(e.message));
  }, [queryString]);

  function setFilter(key: (typeof FILTERS)[number], value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const page = data?.page ?? 1;
  const anyFilter = FILTERS.some((f) => f !== "sort" && params.get(f));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-ink-2">{data ? `${data.total} matching` : "Loading..."}</p>
        </div>
        {canWrite(user) && <Link href="/incidents/new" className="btn-primary">Report incident</Link>}
      </div>

      {/* Filters sit in one row above the table */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(e) => { e.preventDefault(); setFilter("q", search.trim()); }} className="min-w-64 flex-1">
          <input className="input" placeholder='Search title, description or INC code (supports "quotes" and -exclude)'
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <Select label="Status" value={params.get("status")} options={meta?.statuses} onChange={(v) => setFilter("status", v)} />
        <Select label="Severity" value={params.get("severity")} options={meta?.severities} onChange={(v) => setFilter("severity", v)} />
        <Select label="Category" value={params.get("category")} options={meta?.categories} onChange={(v) => setFilter("category", v)} />
        <Select label="SLA" value={params.get("sla")} options={["ON_TRACK", "AT_RISK", "BREACHED", "MET"]} onChange={(v) => setFilter("sla", v)} />
        <select className="input w-auto" value={params.get("assignee") ?? ""} onChange={(e) => setFilter("assignee", e.target.value)}>
          <option value="">Any owner</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {meta?.assignees.map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
        </select>
        <select className="input w-auto" value={params.get("open") ?? ""} onChange={(e) => setFilter("open", e.target.value)}>
          <option value="">Open and closed</option>
          <option value="true">Open only</option>
          <option value="false">Resolved or closed</option>
        </select>
        <select className="input w-auto" value={params.get("sort") ?? "newest"} onChange={(e) => setFilter("sort", e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="severity">Severity</option>
          <option value="deadline">Nearest deadline</option>
        </select>
        {anyFilter && (
          <button className="text-[14px] text-accent hover:underline" onClick={() => { setSearch(""); router.replace(pathname); }}>
            Clear
          </button>
        )}
      </div>

      {error && <p className="text-critical">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="border-b border-line text-left text-[12px] text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-medium">Reference</th>
              <th className="py-2 pr-3 font-medium">Title</th>
              <th className="py-2 pr-3 font-medium">Severity</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">SLA</th>
              <th className="py-2 pr-3 font-medium">Owner</th>
              <th className="py-2 pr-3 font-medium">Tasks</th>
              <th className="py-2 font-medium">Reported</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((i) => (
              <tr key={i.incident_id} className="cursor-pointer hover:bg-panel" onClick={() => router.push(`/incidents/${i.incident_id}`)}>
                <td className="py-2.5 pr-3 font-mono text-[12px] text-ink-3">{i.reference_code}</td>
                <td className="max-w-md py-2.5 pr-3">
                  <Link href={`/incidents/${i.incident_id}`} className="block truncate font-medium hover:text-accent">{i.title}</Link>
                  <span className="text-[12px] text-ink-3">{humanize(i.category)}</span>
                </td>
                <td className="py-2.5 pr-3"><SeverityBadge value={i.severity} /></td>
                <td className="py-2.5 pr-3"><StatusBadge value={i.status} /></td>
                <td className="py-2.5 pr-3">
                  <SlaBadge value={i.sla_state} />
                  {["ON_TRACK", "AT_RISK", "BREACHED"].includes(i.sla_state) && (
                    <div className="text-[12px] text-ink-3">due {fmtRelative(i.resolve_by)}</div>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-ink-2">{i.assignee_name ?? <span className="text-ink-3">Unassigned</span>}</td>
                <td className="py-2.5 pr-3 tabular-nums text-ink-2">{i.total_tasks ? `${i.done_tasks}/${i.total_tasks}` : "-"}</td>
                <td className="whitespace-nowrap py-2.5 text-ink-2">{fmtDate(i.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && (
          <p className="py-10 text-center text-ink-3">No incidents match these filters.</p>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-3 text-[14px]">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setFilter("page", String(page - 1))}>Previous</button>
          <span className="text-ink-2">Page {page} of {pages}</span>
          <button className="btn-ghost" disabled={page >= pages} onClick={() => setFilter("page", String(page + 1))}>Next</button>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, options, onChange }: {
  label: string; value: string | null; options?: string[]; onChange: (v: string) => void;
}) {
  return (
    <select className="input w-auto" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{`Any ${label.toLowerCase()}`}</option>
      {options?.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
    </select>
  );
}

export default function IncidentsPage() {
  return (
    <Suspense>
      <IncidentList />
    </Suspense>
  );
}
