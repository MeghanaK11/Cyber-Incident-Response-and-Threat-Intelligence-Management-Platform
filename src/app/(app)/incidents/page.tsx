"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api, fmtDate, fmtRelative, humanize } from "@/lib/client";
import { SeverityBadge, SlaBadge, StatusBadge } from "@/components/Badges";
import { canWrite, useUser } from "@/components/UserContext";
import { useMeta } from "@/components/useMeta";
import { MatchBar } from "@/components/MatchBar";

type Item = {
  incident_id: number;
  reference_code: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  sla_state: string;
  resolve_by?: string;
  created_at: string;
  assignee_name: string | null;
  total_tasks?: number;
  done_tasks?: number;
  similarity?: string;
};
type ListResponse = { items: Item[]; total: number; page: number; page_size: number };

const FILTERS = ["q", "status", "severity", "category", "assignee", "sla", "open", "sort", "page", "mode"] as const;

function IncidentList() {
  const user = useUser();
  const meta = useMeta();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const semantic = params.get("mode") === "meaning";

  const queryString = params.toString();
  useEffect(() => {
    setError("");
    const q = params.get("q");
    if (semantic) {
      if (!q) { setData({ items: [], total: 0, page: 1, page_size: 10 }); return; }
      setData(null);
      api<{ items: Item[] }>(`/api/incidents/semantic?q=${encodeURIComponent(q)}`)
        .then((r) => setData({ items: r.items, total: r.items.length, page: 1, page_size: 10 }))
        .catch((e) => setError(e.message));
    } else {
      api<ListResponse>(`/api/incidents?${queryString}`).then(setData).catch((e) => setError(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const anyFilter = FILTERS.some((f) => !["sort", "mode"].includes(f) && params.get(f));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Incidents</h1>
          <p className="mt-1 text-ink-2">
            {!data ? "Searching..." : semantic ? (params.get("q") ? `${data.total} closest matches by meaning` : "Describe what happened in your own words") : `${data.total} matching`}
          </p>
        </div>
        {canWrite(user) && <Link href="/incidents/new" className="btn-primary">Report incident</Link>}
      </div>

      <div className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); setFilter("q", search.trim()); }} className="flex gap-2">
          <div className="flex rounded-md border border-line p-0.5" role="tablist" aria-label="Search mode">
            {[["", "Keywords"], ["meaning", "Meaning"]].map(([m, label]) => (
              <button key={m} type="button" role="tab" aria-selected={(params.get("mode") ?? "") === m}
                      onClick={() => setFilter("mode", m)}
                      className={`rounded px-3 py-1.5 text-[13px] ${(params.get("mode") ?? "") === m ? "bg-panel-2 text-ink" : "text-ink-3 hover:text-ink-2"}`}>
                {label}
              </button>
            ))}
          </div>
          <input className="input flex-1"
                 placeholder={semantic ? "e.g. someone logged in from another country with a stolen password" : 'Search title, description or INC code. Supports "exact phrase" and -exclude'}
                 value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-ghost">Search</button>
        </form>

        {!semantic && (
          <div className="flex flex-wrap items-center gap-2">
            <Select label="Status" value={params.get("status")} options={meta?.statuses} onChange={(v) => setFilter("status", v)} />
            <Select label="Severity" value={params.get("severity")} options={meta?.severities} onChange={(v) => setFilter("severity", v)} />
            <Select label="Category" value={params.get("category")} options={meta?.categories} onChange={(v) => setFilter("category", v)} />
            <select className="input w-auto" aria-label="SLA" value={params.get("sla") ?? ""} onChange={(e) => setFilter("sla", e.target.value)}>
              <option value="">Any SLA state</option>
              <option value="ON_TRACK">On track</option>
              <option value="AT_RISK">At risk</option>
              <option value="BREACHED">Breached</option>
              <option value="MET">Met</option>
            </select>
            <select className="input w-auto" aria-label="Owner" value={params.get("assignee") ?? ""} onChange={(e) => setFilter("assignee", e.target.value)}>
              <option value="">Any owner</option>
              <option value="me">Assigned to me</option>
              <option value="none">Unassigned</option>
              {meta?.assignees.map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
            </select>
            <select className="input w-auto" aria-label="Open or closed" value={params.get("open") ?? ""} onChange={(e) => setFilter("open", e.target.value)}>
              <option value="">Open and closed</option>
              <option value="true">Open only</option>
              <option value="false">Resolved or closed</option>
            </select>
            <select className="input w-auto" aria-label="Sort" value={params.get("sort") ?? "newest"} onChange={(e) => setFilter("sort", e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="severity">Most severe first</option>
              <option value="deadline">Nearest deadline</option>
            </select>
            {anyFilter && (
              <button className="px-2 text-[14px] text-accent hover:underline" onClick={() => { setSearch(""); router.replace(pathname); }}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-critical">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="text-left text-[12px] text-ink-3">
            <tr className="border-b border-line-2">
              <th className="py-2.5 pr-4 font-medium">Reference</th>
              <th className="py-2.5 pr-4 font-medium">Incident</th>
              <th className="py-2.5 pr-4 font-medium">Severity</th>
              <th className="py-2.5 pr-4 font-medium">Status</th>
              <th className="py-2.5 pr-4 font-medium">SLA</th>
              <th className="py-2.5 pr-4 font-medium">Owner</th>
              {semantic ? <th className="py-2.5 font-medium">Match</th> : (
                <>
                  <th className="py-2.5 pr-4 font-medium">Tasks</th>
                  <th className="py-2.5 font-medium">Reported</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.items.map((i) => (
              <tr key={i.incident_id} className="cursor-pointer hover:bg-panel-2/40" onClick={() => router.push(`/incidents/${i.incident_id}`)}>
                <td className="code whitespace-nowrap py-3 pr-4">{i.reference_code}</td>
                <td className="max-w-md py-3 pr-4">
                  <Link href={`/incidents/${i.incident_id}`} className="block truncate font-medium hover:text-accent">{i.title}</Link>
                  <span className="text-[12px] text-ink-3">{humanize(i.category)}</span>
                </td>
                <td className="py-3 pr-4"><SeverityBadge value={i.severity} /></td>
                <td className="py-3 pr-4"><StatusBadge value={i.status} /></td>
                <td className="py-3 pr-4">
                  <SlaBadge value={i.sla_state} />
                  {i.resolve_by && ["ON_TRACK", "AT_RISK", "BREACHED"].includes(i.sla_state) && (
                    <div className="text-[12px] text-ink-3">due {fmtRelative(i.resolve_by)}</div>
                  )}
                </td>
                <td className="py-3 pr-4 text-ink-2">{i.assignee_name ?? <span className="text-ink-3">Unassigned</span>}</td>
                {semantic ? (
                  <td className="py-3"><MatchBar value={Number(i.similarity)} /></td>
                ) : (
                  <>
                    <td className="py-3 pr-4 tabular-nums text-ink-2">{i.total_tasks ? `${i.done_tasks}/${i.total_tasks}` : "-"}</td>
                    <td className="whitespace-nowrap py-3 text-ink-2">{fmtDate(i.created_at)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && (
          <p className="py-12 text-center text-ink-3">
            {semantic ? "Type a description above and press Search." : "No incidents match these filters."}
          </p>
        )}
      </div>

      {!semantic && pages > 1 && (
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
