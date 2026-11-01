"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate, fmtRelative, humanize } from "@/lib/client";
import { SeverityBadge, SlaBadge, StatusBadge } from "@/components/Badges";
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

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useUser();
  const meta = useMeta();
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = useCallback(() => {
    api<Detail>(`/api/incidents/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  // Runs a write, shows the server's message on failure, reloads on success
  async function act(fn: () => Promise<unknown>, success?: string) {
    setFlash("");
    setError("");
    try {
      await fn();
      if (success) setFlash(success);
      load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }

  if (!d) return error ? <p className="text-critical">{error}</p> : <p className="text-ink-3">Loading...</p>;

  const i = d.incident;
  const writable = canWrite(user);
  const isOpen = !["RESOLVED", "CLOSED"].includes(i.status);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/incidents" className="text-[14px] text-ink-3 hover:text-ink">Incidents</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[13px] text-ink-3">{i.reference_code}</span>
          <SeverityBadge value={i.severity} />
          <StatusBadge value={i.status} />
          <SlaBadge value={i.sla_state} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{i.title}</h1>
      </div>

      {(error || flash) && (
        <p role="status" className={`rounded-md px-3 py-2 text-[14px] ${error ? "bg-critical/8 text-critical" : "bg-good/10 text-[#087008]"}`}>
          {error || flash}
        </p>
      )}

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-10 lg:col-span-2">
          <section>
            <h2 className="section-title mb-2">Description</h2>
            <p className="whitespace-pre-wrap leading-relaxed">{i.description}</p>
            {i.resolution_summary && (
              <>
                <h2 className="section-title mb-2 mt-6">Resolution</h2>
                <p className="whitespace-pre-wrap leading-relaxed">{i.resolution_summary}</p>
              </>
            )}
          </section>

          {writable && d.next_statuses.length > 0 && (
            <StatusChanger current={i.status} options={d.next_statuses} existingSummary={i.resolution_summary}
              onSubmit={(body) => act(() => api(`/api/incidents/${id}`, { method: "PATCH", json: body }), "Status updated")} />
          )}

          <Tasks d={d} writable={writable && isOpen} incidentId={id} act={act} />
          <Assets d={d} writable={writable && isOpen} incidentId={id} act={act} assets={meta?.assets ?? []} />

          <section>
            <h2 className="section-title mb-3">History</h2>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {d.history.map((h) => (
                <li key={h.history_id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-ink-3" />
                  <div className="flex flex-wrap items-center gap-2 text-[14px]">
                    {h.old_status ? (<><StatusBadge value={h.old_status} /><span className="text-ink-3">to</span></>) : <span className="text-ink-3">Opened as</span>}
                    <StatusBadge value={h.new_status} />
                    <span className="text-ink-3">by {h.changed_by_name ?? "system"} · {fmtDate(h.changed_at)}</span>
                  </div>
                  {h.note && <p className="mt-1 text-[14px] text-ink-2">{h.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="space-y-3 text-[14px]">
            <Field label="Category">{humanize(i.category)}</Field>
            <Field label="Reported by">{i.reporter_name}</Field>
            <Field label="Detected">{fmtDate(String(i.detected_at))}</Field>
            <Field label="Reported">{fmtDate(String(i.created_at))}</Field>
            <Field label="Respond by">
              {fmtDate(String(i.respond_by))}
              {i.first_response_at ? <span className="text-ink-3"> · responded {fmtDate(String(i.first_response_at))}</span> : null}
            </Field>
            <Field label="Resolve by">
              {fmtDate(String(i.resolve_by))}
              {isOpen && <span className="text-ink-3"> · {fmtRelative(String(i.resolve_by))}</span>}
            </Field>
            {i.resolved_at && <Field label="Resolved">{fmtDate(String(i.resolved_at))}</Field>}
            {i.source_alert_id && <Field label="Source alert"><span className="font-mono text-[12px]">{i.source_alert_id}</span></Field>}
          </section>

          <section>
            <h2 className="section-title mb-2">Owner</h2>
            <p className="mb-3">{i.assignee_name ?? <span className="text-ink-3">Unassigned</span>}</p>
            {writable && isOpen && (
              <div className="flex flex-wrap gap-2">
                {i.assignee_id !== user.user_id && (
                  <button className="btn-ghost" onClick={() => act(() => api(`/api/incidents/${id}/assign`, { method: "POST", json: { assignee_id: user.user_id } }), "Assigned to you")}>
                    Take it
                  </button>
                )}
                <button className="btn-ghost" onClick={() => act(() => api(`/api/incidents/${id}/assign`, { method: "POST", json: { assignee_id: null } }), "Auto-assigned")}>
                  Auto-assign
                </button>
                {user.role === "ADMIN" && meta && (
                  <select className="input w-auto" value="" aria-label="Assign to"
                          onChange={(e) => e.target.value && act(() => api(`/api/incidents/${id}/assign`, { method: "POST", json: { assignee_id: Number(e.target.value) } }), "Reassigned")}>
                    <option value="">Assign to...</option>
                    {meta.assignees.map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
                  </select>
                )}
              </div>
            )}
          </section>

          {writable && isOpen && meta && (
            <section>
              <h2 className="section-title mb-2">Severity</h2>
              <select className="input" value={i.severity}
                      onChange={(e) => act(() => api(`/api/incidents/${id}`, { method: "PATCH", json: { severity: e.target.value } }), "Severity changed, SLA clock restarted")}>
                {meta.severities.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </select>
            </section>
          )}

          {writable && isOpen && (
            <section>
              <h2 className="section-title mb-2">Playbooks</h2>
              {d.playbooks.length === 0 ? (
                <p className="text-[14px] text-ink-3">No unused playbook fits this category.</p>
              ) : (
                <ul className="space-y-2">
                  {d.playbooks.map((p) => (
                    <li key={p.playbook_id} className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[14px]">{p.name}</div>
                        <div className="text-[12px] text-ink-3">{p.step_count} steps · about {Math.round(p.total_minutes / 6) / 10} h</div>
                      </div>
                      <button className="btn-ghost py-1"
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
      <div>{children}</div>
    </div>
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
    <form onSubmit={submit} className="space-y-3 border-y border-line py-5">
      <h2 className="section-title">Move from {humanize(current)}</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((s) => (
          <button type="button" key={s} onClick={() => setTo(s)}
                  className={`rounded-full border px-3 py-1 text-[14px] ${to === s ? "border-accent bg-accent text-white" : "border-line bg-panel hover:border-ink-3"}`}>
            {humanize(s)}
          </button>
        ))}
      </div>
      {to && (
        <>
          {needsSummary && (
            <textarea className="input min-h-24" required minLength={10} placeholder="Resolution summary: root cause and what fixed it"
                      value={summary} onChange={(e) => setSummary(e.target.value)} />
          )}
          <input className="input" maxLength={500} placeholder="Note for the history (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary">Move to {humanize(to)}</button>
        </>
      )}
    </form>
  );
}

function Tasks({ d, writable, incidentId, act }: {
  d: Detail; writable: boolean; incidentId: string; act: (fn: () => Promise<unknown>, msg?: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const done = d.tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="section-title">Tasks</h2>
        {d.tasks.length > 0 && <span className="text-[13px] text-ink-3">{done} of {d.tasks.length} done</span>}
      </div>
      {d.tasks.length === 0 && <p className="mb-3 text-[14px] text-ink-3">No tasks yet. Apply a playbook or add one below.</p>}
      <ul className="divide-y divide-line">
        {d.tasks.map((t) => (
          <li key={t.task_id} className="flex items-start gap-3 py-2.5">
            <div className="flex-1">
              <div className={`text-[14px] ${t.status === "DONE" || t.status === "SKIPPED" ? "text-ink-3 line-through" : ""}`}>
                {t.step_no ? <span className="mr-1 text-ink-3">{t.step_no}.</span> : null}{t.title}
              </div>
              <div className="text-[12px] text-ink-3">
                {t.playbook_name ?? "Manual"}
                {t.assignee_name ? ` · ${t.assignee_name}` : ""}
                {t.due_at && !t.completed_at ? <span className={t.is_overdue ? " text-critical" : ""}> · due {fmtRelative(t.due_at)}</span> : ""}
                {t.completed_at ? ` · finished ${fmtDate(t.completed_at)}` : ""}
              </div>
            </div>
            {writable ? (
              <select className="input w-auto py-1 text-[13px]" value={t.status} aria-label="Task status"
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
        ))}
      </ul>
      {writable && (
        <form className="mt-3 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act(() => api(`/api/incidents/${incidentId}/tasks`, { method: "POST", json: { title } }), "Task added")) setTitle("");
              }}>
          <input className="input" placeholder="Add a task" minLength={3} maxLength={150} required value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn-ghost">Add</button>
        </form>
      )}
    </section>
  );
}

function Assets({ d, writable, incidentId, act, assets }: {
  d: Detail; writable: boolean; incidentId: string; assets: { asset_id: number; hostname: string }[];
  act: (fn: () => Promise<unknown>, msg?: string) => Promise<boolean>;
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
          <li key={a.asset_id} className="flex items-center gap-3 py-2 text-[14px]">
            <span className="font-mono text-[13px]">{a.hostname}</span>
            <span className="flex-1 text-[12px] text-ink-3">{a.ip_address ?? "no IP"} · {a.department} · criticality {a.criticality}</span>
            <span className="text-ink-2">{humanize(a.impact)}</span>
            {writable && (
              <button className="text-[13px] text-ink-3 hover:text-critical"
                      onClick={() => act(() => api(`/api/incidents/${incidentId}/assets/${a.asset_id}`, { method: "DELETE" }))}>
                Remove
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
          <select className="input" required value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">Link an asset...</option>
            {assets.filter((a) => !linked.has(a.asset_id)).map((a) => <option key={a.asset_id} value={a.asset_id}>{a.hostname}</option>)}
          </select>
          <select className="input w-auto" value={impact} onChange={(e) => setImpact(e.target.value)}>
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
