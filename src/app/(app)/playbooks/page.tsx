"use client";

import { useCallback, useEffect, useState } from "react";
import { api, humanize } from "@/lib/client";
import { Flash } from "@/components/Badges";
import { useUser } from "@/components/UserContext";
import { useMeta } from "@/components/useMeta";

type Summary = {
  playbook_id: number; name: string; category: string | null; description: string; is_active: boolean;
  step_count: number; total_minutes: number; times_used: number; created_by_name: string | null;
};
type Step = { title: string; instructions: string; expected_minutes: number | string };
type Full = { playbook: Summary; steps: (Step & { step_no: number })[] };
type Draft = { name: string; category: string; description: string; steps: Step[] };

const BLANK_STEP: Step = { title: "", instructions: "", expected_minutes: 15 };
const BLANK: Draft = { name: "", category: "", description: "", steps: [{ ...BLANK_STEP }] };

function duration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = mins / 60;
  return h < 24 ? `${Math.round(h * 10) / 10} h` : `${Math.round((h / 24) * 10) / 10} days`;
}

export default function PlaybooksPage() {
  const user = useUser();
  const meta = useMeta();
  const isAdmin = user.role === "ADMIN";
  const [list, setList] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [full, setFull] = useState<Full | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null); // non-null while creating or editing
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadList = useCallback(() => {
    api<{ items: Summary[] }>("/api/playbooks").then((r) => {
      setList(r.items);
      setSelected((s) => s ?? r.items[0]?.playbook_id ?? null);
    }).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(loadList, [loadList]);

  useEffect(() => {
    if (selected == null) { setFull(null); return; }
    api<Full>(`/api/playbooks/${selected}`).then(setFull).catch((e) => setMsg({ ok: false, text: e.message }));
  }, [selected]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ ok: true, text: ok });
      loadList();
      return r ?? true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    }
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const steps = draft.steps.map((s) => ({ ...s, expected_minutes: Number(s.expected_minutes) }));
    if (full && editingId === full.playbook.playbook_id) {
      const id = full.playbook.playbook_id;
      const ok = await run(async () => {
        await api(`/api/playbooks/${id}`, { method: "PATCH", json: { name: draft.name, description: draft.description, ...(full.playbook.times_used === 0 ? { category: draft.category || null } : {}) } });
        if (full.playbook.times_used === 0) await api(`/api/playbooks/${id}/steps`, { method: "PUT", json: { steps } });
      }, "Playbook saved");
      if (ok) { setDraft(null); setEditingId(null); setSelected(null); setTimeout(() => setSelected(id), 0); }
    } else {
      const created = await run(() => api<{ playbook_id: number }>("/api/playbooks", { method: "POST", json: { ...draft, category: draft.category || null, steps } }), `Created ${draft.name}`);
      if (created && typeof created === "object") { setDraft(null); setSelected((created as { playbook_id: number }).playbook_id); }
    }
  }

  function startEdit() {
    if (!full) return;
    setEditingId(full.playbook.playbook_id);
    setDraft({
      name: full.playbook.name, category: full.playbook.category ?? "", description: full.playbook.description,
      steps: full.steps.map(({ title, instructions, expected_minutes }) => ({ title, instructions, expected_minutes })),
    });
  }

  const setStep = (i: number, patch: Partial<Step>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const moveStep = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  const stepsLocked = !!(draft && editingId && full && full.playbook.times_used > 0);

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Playbooks</h1>
          <p className="mt-1 text-ink-2">Step-by-step responses, applied to an incident as a set of tasks with due times.</p>
        </div>
        {isAdmin && !draft && (
          <button className="btn-primary" onClick={() => { setEditingId(null); setDraft({ ...BLANK, steps: [{ ...BLANK_STEP }] }); }}>New playbook</button>
        )}
      </div>

      <Flash msg={msg} />

      <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
        <ul className="space-y-1 self-start">
          {list.map((p) => (
            <li key={p.playbook_id}>
              <button onClick={() => { setDraft(null); setSelected(p.playbook_id); }}
                      className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                        selected === p.playbook_id && !draft ? "border-line-2 bg-panel-2" : "border-transparent hover:bg-panel-2/50"
                      } ${p.is_active ? "" : "opacity-55"}`}>
                <div className="text-[14px] font-medium">{p.name}</div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  {p.category ? humanize(p.category) : "Any category"}, {p.step_count} steps, {duration(p.total_minutes)}
                  {!p.is_active && ", inactive"}
                </div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-4 text-[14px] text-ink-3">No playbooks yet.</li>}
        </ul>

        {draft ? (
          <form onSubmit={saveDraft} className="space-y-6">
            <h2 className="section-title text-[18px]">{editingId ? "Edit playbook" : "New playbook"}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="label" htmlFor="pn">Name</label>
                <input id="pn" className="input" required minLength={3} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="pc">Used for</label>
                <select id="pc" className="input" value={draft.category} disabled={stepsLocked}
                        onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  <option value="">Any category</option>
                  {meta?.categories.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pd">What it is for</label>
              <textarea id="pd" className="input min-h-20" required minLength={10} value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <div>
              <h3 className="section-title mb-1">Steps</h3>
              {stepsLocked && (
                <p className="mb-3 text-[13px] text-warn">
                  This playbook has been used on incidents, so its steps and category are fixed. Deactivate it and create a new version to change them.
                </p>
              )}
              <ol className="space-y-3">
                {draft.steps.map((s, i) => (
                  <li key={i} className="panel grid gap-3 p-4 md:grid-cols-[2.5rem_1fr_7rem]">
                    <div className="font-display text-[22px] font-semibold text-ink-3">{i + 1}</div>
                    <div className="space-y-2">
                      <input className="input" placeholder="What to do" required minLength={3} disabled={stepsLocked}
                             value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} aria-label={`Step ${i + 1} title`} />
                      <textarea className="input min-h-16 text-[14px]" placeholder="How to do it" required minLength={5} disabled={stepsLocked}
                                value={s.instructions} onChange={(e) => setStep(i, { instructions: e.target.value })} aria-label={`Step ${i + 1} instructions`} />
                    </div>
                    <div className="space-y-2">
                      <label className="label text-[12px]" htmlFor={`m${i}`}>Minutes</label>
                      <input id={`m${i}`} type="number" min={1} max={10080} className="input" required disabled={stepsLocked}
                             value={s.expected_minutes} onChange={(e) => setStep(i, { expected_minutes: e.target.value })} />
                      {!stepsLocked && (
                        <div className="flex gap-2 text-[12px]">
                          <button type="button" className="text-ink-3 hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => moveStep(i, -1)} aria-label="Move up">Up</button>
                          <button type="button" className="text-ink-3 hover:text-ink disabled:opacity-30" disabled={i === draft.steps.length - 1} onClick={() => moveStep(i, 1)} aria-label="Move down">Down</button>
                          <button type="button" className="text-ink-3 hover:text-critical disabled:opacity-30" disabled={draft.steps.length === 1}
                                  onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}>Remove</button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {!stepsLocked && (
                <button type="button" className="btn-ghost mt-3" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { ...BLANK_STEP }] })}>Add step</button>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn-primary">{editingId ? "Save playbook" : "Create playbook"}</button>
              <button type="button" className="btn-ghost" onClick={() => { setDraft(null); setEditingId(null); }}>Cancel</button>
            </div>
          </form>
        ) : full ? (
          <article>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[24px] font-semibold tracking-wide">{full.playbook.name}</h2>
                <p className="mt-1 text-[14px] text-ink-3">
                  {full.playbook.category ? `For ${humanize(full.playbook.category).toLowerCase()} incidents` : "For any incident"}.
                  {" "}Used on {full.playbook.times_used} incident{full.playbook.times_used === 1 ? "" : "s"}.
                  {!full.playbook.is_active && " Inactive, so it is hidden from incidents."}
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={startEdit}>Edit</button>
                  <button className="btn-ghost"
                          onClick={() => run(() => api(`/api/playbooks/${full.playbook.playbook_id}`, { method: "PATCH", json: { is_active: !full.playbook.is_active } }),
                            full.playbook.is_active ? "Playbook deactivated" : "Playbook activated").then(() => {
                              const id = full.playbook.playbook_id; setSelected(null); setTimeout(() => setSelected(id), 0);
                            })}>
                    {full.playbook.is_active ? "Deactivate" : "Activate"}
                  </button>
                  {full.playbook.times_used === 0 && (
                    <button className="btn-danger"
                            onClick={() => window.confirm(`Delete ${full.playbook.name}?`) &&
                              run(() => api(`/api/playbooks/${full.playbook.playbook_id}`, { method: "DELETE" }), "Playbook deleted").then((ok) => ok && setSelected(null))}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-4 max-w-[72ch] text-ink-2">{full.playbook.description}</p>

            {/* The steps really are a sequence, and due times add up in this order */}
            <ol className="relative mt-8 space-y-6 border-l border-line-2 pl-8">
              {full.steps.map((s, i) => {
                const elapsed = full.steps.slice(0, i + 1).reduce((t, x) => t + Number(x.expected_minutes), 0);
                return (
                  <li key={s.step_no} className="relative">
                    <span className="absolute -left-[45px] top-0 grid h-7 w-7 place-items-center rounded-full border border-line-2 bg-surface font-display text-[13px] font-semibold text-accent">
                      {s.step_no}
                    </span>
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-[15px] font-medium">{s.title}</h3>
                      <span className="text-[12px] tabular-nums text-ink-3">{duration(Number(s.expected_minutes))}, due at +{duration(elapsed)}</span>
                    </div>
                    <p className="mt-1 max-w-[72ch] text-[14px] text-ink-2">{s.instructions}</p>
                  </li>
                );
              })}
            </ol>
          </article>
        ) : (
          <p className="text-ink-3">{list.length ? "Choose a playbook." : isAdmin ? "Create the first playbook to give analysts a standard response." : "No playbooks yet."}</p>
        )}
      </div>
    </div>
  );
}
