"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate, fmtRelative, humanize } from "@/lib/client";
import { Flash, SeverityBadge, SlaBadge, StatusBadge } from "@/components/Badges";
import { MatchBar } from "@/components/MatchBar";
import { canWrite, useUser } from "@/components/UserContext";
import { useMeta } from "@/components/useMeta";

type Incident = Record<string, string | number | null> & {
  incident_id: number; reference_code: string; title: string; description: string; status: string;
  severity: string; category: string; sla_state: string; assignee_id: number | null;
  resolution_summary: string | null;
};
type Task = {
  task_id: number; title: string; details: string | null; status: string; due_at: string | null;
  completed_at: string | null; playbook_name: string | null; step_no: number | null;
  assignee_name: string | null; is_overdue: boolean;
};
type Detail = {
  incident: Incident;
  assets: { asset_id: number; hostname: string; ip_address: string | null; asset_type: string; department: string; criticality: number; impact: string }[];
  tasks: Task[];
  history: { history_id: number; old_status: string | null; new_status: string; changed_at: string; note: string | null; changed_by_name: string | null }[];
  playbooks: { playbook_id: number; name: string; category: string | null; step_count: number; total_minutes: number }[];
  next_statuses: string[];
};
type Similar = {
  incident_id: number; reference_code: string; title: string; category: string; severity: string;
  status: string; resolution_summary: string | null; similarity: string; created_at: string;
};
type Act = (fn: () => Promise<unknown>, msg?: string) => Promise<boolean>;

const IMPACT_COLOR: Record<string, string> = { TARGETED: "#82977F", AFFECTED: "#B99A64", COMPROMISED: "#CF6F68" };

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const meta = useMeta();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(() => {
    api<Detail>(`/api/incidents/${id}`).then(setD).catch((e) => setLoadError(e.message));
  }, [id]);
  useEffect(load, [load]);

  // Runs a write, shows the server's message on failure, reloads on success
  const act: Act = async (fn, success) => {
    setMsg(null);
    try {
      await fn();
      if (success) setMsg({ ok: true, text: success });
      load();
      router.refresh(); // posture in the sidebar may have changed
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    }
  };

  if (!d) return loadError ? <p className="text-critical">{loadError}</p> : <p className="text-ink-3">Loading incident...</p>;

  const i = d.incident;
  const writable = canWrite(user);
  const isOpen = !["RESOLVED", "CLOSED"].includes(i.status);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/incidents" className="text-[14px] text-ink-3 hover:text-ink">Incidents</Link>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="code text-[13px]">{i.reference_code}</span>
          <SeverityBadge value={i.severity} />
          <StatusBadge value={i.status} />
          <SlaBadge value={i.sla_state} />
        </div>
        <h1 className="page-title mt-2 max-w-4xl">{i.title}</h1>
      </div>

      <Flash msg={msg} />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-11">
          <section>
            <h2 className="section-title mb-2">What happened</h2>
            <p className="max-w-[72ch] whitespace-pre-wrap leading-relaxed text-ink">{i.description}</p>
            {i.resolution_summary && (
              <div className="mt-6 max-w-[72ch] border-l-2 border-good/70 pl-4">
                <h2 className="section-title mb-1">How it was resolved</h2>
                <p className="whitespace-pre-wrap leading-relaxed text-ink-2">{i.resolution_summary}</p>
              </div>
            )}
          </section>

          {writable && d.next_statuses.length > 0 && (
            <StatusChanger current={i.status} options={d.next_statuses} existingSummary={i.resolution_summary}
              onSubmit={(body) => act(() => api(`/api/incidents/${id}`, { method: "PATCH", json: body }), `Moved to ${humanize(body.status)}`)} />
          )}

          <Tasks d={d} writable={writable && isOpen} incidentId={id} act={act} />
          <SimilarIncidents incidentId={id} />
          <Assets d={d} writable={writable && isOpen} incidentId={id} act={act} assets={meta?.assets ?? []} />

          <section>
            <h2 className="section-title mb-4">Timeline</h2>
            <ol className="relative space-y-4 border-l border-line-2 pl-5">
              {d.history.map((h) => (
                <li key={h.history_id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-surface bg-ink-3" aria-hidden />
                  <div className="flex flex-wrap items-center gap-2 text-[14px]">
                    {h.old_status ? (<><StatusBadge value={h.old_status} /><span className="text-ink-3">to</span></>) : <span className="text-ink-3">Opened as</span>}
                    <StatusBadge value={h.new_status} />
                    <span className="text-ink-3">by {h.changed_by_name ?? "system"}, {fmtDate(h.changed_at)}</span>
                  </div>
                  {h.note && <p className="mt-1 text-[14px] text-ink-2">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="panel space-y-3.5 p-5 text-[14px]">
            <Field label="Category">{humanize(i.category)}</Field>
            <Field label="Reported by">{i.reporter_name}</Field>
            <Field label="Detected">{fmtDate(String(i.detected_at))}</Field>
            <Field label="Respond by">
              {fmtDate(String(i.respond_by))}
              {i.first_response_at && <span className="block text-[12px] text-ink-3">first response {fmtDate(String(i.first_response_at))}</span>}
            </Field>
            <Field label="Resolve by">
              <span className={i.sla_state === "BREACHED" ? "text-sev-4" : ""}>{fmtDate(String(i.resolve_by))}</span>
              {isOpen && <span className="block text-[12px] text-ink-3">{fmtRelative(String(i.resolve_by))}</span>}
            </Field>
            {i.resolved_at && <Field label="Resolved">{fmtDate(String(i.resolved_at))}</Field>}
            {i.source_alert_id && <Field label="Source alert"><span className="code">{i.source_alert_id}</span></Field>}
          </section>

          <section>
            <h2 className="section-title mb-2">Owner</h2>
            <p className="mb-3">{i.assignee_name ?? <span className="text-ink-3">Nobody yet</span>}</p>
            {writable && isOpen && (
              <div className="flex flex-wrap gap-2">
                {i.assignee_id !== user.user_id && (
                  <button className="btn-ghost" onClick={() => act(() => api(`/api/incidents/${id}/assign`, { method: "POST", json: { assignee_id: user.user_id } }), "Assigned to you")}>
                    Take it
                  </button>
                )}
                <button className="btn-ghost" onClick={() => act(() => api(`/api/incidents/${id}/assign`, { method: "POST", json: { assignee_id: null } }), "Assigned to the analyst with the lightest load")}>
                  Auto-assign
                </button>
                {user.role === "ADMIN" && meta && (
                  <select className="input" value="" aria-label="Assign to"
                          onChange={(e) => e.target.value && act(() => api(`/api/incidents/${id}/assign`, { method: "POST", json: { assignee_id: Number(e.target.value) } }), "Reassigned")}>
                    <option value="">Assign to someone else...</option>
                    {meta.assignees.map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
                  </select>
                )}
              </div>
            )}
          </section>

          {writable && isOpen && meta && (
            <section>
              <h2 className="section-title mb-2">Severity</h2>
              <select className="input" value={i.severity} aria-label="Severity"
                      onChange={(e) => act(() => api(`/api/incidents/${id}`, { method: "PATCH", json: { severity: e.target.value } }), "Severity changed. The SLA clock restarted.")}>
                {meta.severities.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </select>
            </section>
          )}

          {writable && isOpen && (
            <section>
              <h2 className="section-title mb-3">Playbooks</h2>
              {d.playbooks.length === 0 ? (
                <p className="text-[14px] text-ink-3">No unused playbook fits this category.</p>
              ) : (
                <ul className="space-y-3">
                  {d.playbooks.map((p) => (
                    <li key={p.playbook_id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px]">{p.name}</div>
                        <div className="text-[12px] text-ink-3">{p.step_count} steps, about {Math.round(p.total_minutes / 6) / 10} h</div>
                      </div>
                      <button className="btn-ghost shrink-0 py-1.5"
                              onClick={() => act(() => api(`/api/incidents/${id}/playbooks`, { method: "POST", json: { playbook_id: p.playbook_id } }), `Applied ${p.name}`)}>
                        Apply
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {user.role === "ADMIN" && (
            <button className="btn-danger w-full"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${i.reference_code}? This cannot be undone.`)) return;
                      if (await act(() => api(`/api/incidents/${id}`, { method: "DELETE" }))) router.replace("/incidents");
                    }}>
              Delete incident
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="text-ink">{children}</div>
    </div>
  );
}

function SimilarIncidents({ incidentId }: { incidentId: string }) {
  const [items, setItems] = useState<Similar[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Similar[] }>(`/api/incidents/${incidentId}/similar`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, [incidentId]);

  return (
    <section>
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <h2 className="section-title">Similar past incidents</h2>
        <span className="text-[12px] text-ink-3">matched by meaning with pgvector</span>
      </div>
      <p className="mb-4 text-[14px] text-ink-3">Earlier incidents that read like this one, with how they were fixed.</p>
      {error && <p className="text-[14px] text-critical">Could not load matches: {error}</p>}
      {!items && !error && <p className="text-[14px] text-ink-3">Comparing against past incidents...</p>}
      {items && items.length === 0 && <p className="text-[14px] text-ink-3">Nothing close enough yet. Matches appear as more incidents are recorded.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {items.map((s) => (
            <li key={s.incident_id} className="py-3.5">
              <div className="flex items-start justify-between gap-4">
                <Link href={`/incidents/${s.incident_id}`} className="min-w-0 hover:text-accent">
                  <span className="code mr-2">{s.reference_code}</span>
                  <span className="font-medium">{s.title}</span>
                </Link>
                <MatchBar value={Number(s.similarity)} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
                <SeverityBadge value={s.severity} />
                <StatusBadge value={s.status} />
                <span>{fmtDate(s.created_at)}</span>
              </div>
              {s.resolution_summary && (
                <p className="mt-2 max-w-[72ch] text-[14px] text-ink-2">{s.resolution_summary}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusChanger({ current, options, existingSummary, onSubmit }: {
  current: string; options: string[]; existingSummary: string | null;
  onSubmit: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState(existingSummary ?? "");
  const needsSummary = to === "RESOLVED" || to === "CLOSED";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, string> = { status: to };
    if (note.trim()) body.note = note.trim();
    if (needsSummary && summary.trim() && summary.trim() !== existingSummary) body.resolution_summary = summary.trim();
    if (await onSubmit(body)) { setTo(""); setNote(""); }
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="section-title mr-2">Move from {humanize(current)}</h2>
        {options.map((s) => (
          <button type="button" key={s} onClick={() => setTo(s)} aria-pressed={to === s}
                  className={`rounded-md border px-3 py-1.5 text-[14px] transition-colors ${
                    to === s ? "border-accent bg-accent/15 text-ink" : "border-line-2 text-ink-2 hover:border-ink-3 hover:text-ink"
                  }`}>
            {humanize(s)}
          </button>
        ))}
      </div>
      {to && (
        <>
          {needsSummary && (
            <textarea className="input min-h-24" required minLength={10} placeholder="Root cause and what fixed it"
                      value={summary} onChange={(e) => setSummary(e.target.value)} />
          )}
          <input className="input" maxLength={500} placeholder="Note for the timeline (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary">Move to {humanize(to)}</button>
        </>
      )}
    </form>
  );
}

function Tasks({ d, writable, incidentId, act }: { d: Detail; writable: boolean; incidentId: string; act: Act }) {
  const [title, setTitle] = useState("");
  const done = d.tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
  const pct = d.tasks.length ? (done / d.tasks.length) * 100 : 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="section-title">Response tasks</h2>
        {d.tasks.length > 0 && (
          <span className="flex items-center gap-3 text-[13px] text-ink-2">
            <span className="h-1.5 w-28 rounded-full bg-line"><span className="block h-1.5 rounded-full bg-good" style={{ width: `${pct}%` }} /></span>
            {done} of {d.tasks.length} done
          </span>
        )}
      </div>
      {d.tasks.length === 0 && <p className="mb-3 text-[14px] text-ink-3">No tasks yet. Apply a playbook from the side panel or add one below.</p>}
      <ul className="divide-y divide-line">
        {d.tasks.map((t) => {
          const finished = t.status === "DONE" || t.status === "SKIPPED";
          return (
            <li key={t.task_id} className="flex items-start gap-4 py-3">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] ${
                finished ? "border-good/60 bg-good/15 text-good" : t.status === "DOING" ? "border-warn/60 text-warn" : "border-line-2 text-ink-3"
              }`} aria-hidden>
                {t.step_no ?? ""}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[14px] ${finished ? "text-ink-3 line-through decoration-ink-3/50" : ""}`}>{t.title}</div>
                <div className="text-[12px] text-ink-3">
                  {t.playbook_name ?? "Added by hand"}
                  {t.assignee_name ? `, ${t.assignee_name}` : ""}
                  {t.due_at && !t.completed_at ? <span className={t.is_overdue ? " text-sev-4" : ""}>, due {fmtRelative(t.due_at)}</span> : ""}
                  {t.completed_at ? `, finished ${fmtDate(t.completed_at)}` : ""}
                </div>
              </div>
              {writable ? (
                <select className="input w-auto py-1 text-[13px]" value={t.status} aria-label={`Status of ${t.title}`}
                        onChange={(e) => act(() => api(`/api/incidents/${incidentId}/tasks/${t.task_id}`, { method: "PATCH", json: { status: e.target.value } }))}>
                  <option value="TODO">To do</option>
                  <option value="DOING">Doing</option>
                  <option value="DONE">Done</option>
                  <option value="SKIPPED">Skipped</option>
                </select>
              ) : (
                <span className="text-[13px] text-ink-2">{humanize(t.status)}</span>
              )}
            </li>
          );
        })}
      </ul>
      {writable && (
        <form className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act(() => api(`/api/incidents/${incidentId}/tasks`, { method: "POST", json: { title } }), "Task added")) setTitle("");
              }}>
          <input className="input" placeholder="Add a task" minLength={3} maxLength={150} required value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn-ghost">Add task</button>
        </form>
      )}
    </section>
  );
}

function Assets({ d, writable, incidentId, act, assets }: {
  d: Detail; writable: boolean; incidentId: string; assets: { asset_id: number; hostname: string }[]; act: Act;
}) {
  const [assetId, setAssetId] = useState("");
  const [impact, setImpact] = useState("AFFECTED");
  const linked = new Set(d.assets.map((a) => a.asset_id));

  return (
    <section>
      <h2 className="section-title mb-3">Affected assets</h2>
      {d.assets.length === 0 && <p className="mb-3 text-[14px] text-ink-3">No assets linked.</p>}
      <ul className="divide-y divide-line">
        {d.assets.map((a) => (
          <li key={a.asset_id} className="flex items-center gap-4 py-2.5 text-[14px]">
            <span className="code text-ink">{a.hostname.split(".")[0]}</span>
            <span className="flex-1 text-[12px] text-ink-3">{a.ip_address ?? "no IP"}, {a.department}, criticality {a.criticality}</span>
            <span className="text-[13px] font-medium" style={{ color: IMPACT_COLOR[a.impact] }}>{humanize(a.impact)}</span>
            {writable && (
              <button className="text-[13px] text-ink-3 hover:text-critical"
                      onClick={() => act(() => api(`/api/incidents/${incidentId}/assets/${a.asset_id}`, { method: "DELETE" }), "Asset unlinked")}>
                Unlink
              </button>
            )}
          </li>
        ))}
      </ul>
      {writable && (
        <form className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act(() => api(`/api/incidents/${incidentId}/assets`, { method: "POST", json: { asset_id: Number(assetId), impact } }), "Asset linked")) setAssetId("");
              }}>
          <select className="input" required value={assetId} onChange={(e) => setAssetId(e.target.value)} aria-label="Asset">
            <option value="">Link an asset...</option>
            {assets.filter((a) => !linked.has(a.asset_id)).map((a) => <option key={a.asset_id} value={a.asset_id}>{a.hostname}</option>)}
          </select>
          <select className="input w-auto" value={impact} onChange={(e) => setImpact(e.target.value)} aria-label="Impact">
            <option value="TARGETED">Targeted</option>
            <option value="AFFECTED">Affected</option>
            <option value="COMPROMISED">Compromised</option>
          </select>
          <button className="btn-ghost">Link</button>
        </form>
      )}
    </section>
  );
}
