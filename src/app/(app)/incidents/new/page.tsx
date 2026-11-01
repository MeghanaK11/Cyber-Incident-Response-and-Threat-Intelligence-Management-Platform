"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, humanize } from "@/lib/client";
import { canWrite, useUser } from "@/components/UserContext";
import { useMeta } from "@/components/useMeta";

function localNow() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fmtMinutes(m: number) {
  return m < 60 ? `${m} min` : m < 1440 ? `${m / 60} h` : `${m / 1440} days`;
}

export default function NewIncidentPage() {
  const user = useUser();
  const meta = useMeta();
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    severity: "",
    detected_at: localNow(),
    auto_assign: true,
  });
  const [assets, setAssets] = useState<{ asset_id: number; impact: string }[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!canWrite(user)) return <p className="text-ink-2">Viewers cannot report incidents.</p>;

  const sla = meta?.sla.find((s) => s.severity === form.severity);
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  function toggleAsset(id: number) {
    setAssets((a) => (a.some((x) => x.asset_id === id) ? a.filter((x) => x.asset_id !== id) : [...a, { asset_id: id, impact: "AFFECTED" }]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await api<{ incident_id: number }>("/api/incidents", {
        method: "POST",
        json: { ...form, detected_at: new Date(form.detected_at).toISOString(), assets },
      });
      router.push(`/incidents/${created.incident_id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Report an incident</h1>
        <p className="text-ink-2">Deadlines are set from the severity you pick and restart if severity changes later.</p>
      </div>

      <div>
        <label className="label" htmlFor="title">Title</label>
        <input id="title" className="input" required minLength={5} maxLength={200}
               value={form.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      <div>
        <label className="label" htmlFor="description">What happened</label>
        <textarea id="description" className="input min-h-36" required minLength={20}
                  placeholder="What was seen, where, by whom, and what has been done so far"
                  value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="category">Category</label>
          <select id="category" className="input" required value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option value="" disabled>Choose...</option>
            {meta?.categories.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="severity">Severity</label>
          <select id="severity" className="input" required value={form.severity} onChange={(e) => set("severity", e.target.value)}>
            <option value="" disabled>Choose...</option>
            {meta?.severities.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
          {sla && (
            <p className="mt-1 text-[12px] text-ink-3">
              Respond within {fmtMinutes(sla.respond_minutes)}, resolve within {fmtMinutes(sla.resolve_minutes)}
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="detected">Detected at</label>
          <input id="detected" type="datetime-local" className="input" required max={localNow()}
                 value={form.detected_at} onChange={(e) => set("detected_at", e.target.value)} />
        </div>
      </div>

      <div>
        <span className="label">Affected assets</span>
        {meta && meta.assets.length === 0 && <p className="text-[14px] text-ink-3">No assets registered yet.</p>}
        <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-panel">
          {meta?.assets.map((a) => {
            const picked = assets.find((x) => x.asset_id === a.asset_id);
            return (
              <div key={a.asset_id} className="flex items-center gap-3 px-3 py-2">
                <input type="checkbox" id={`asset-${a.asset_id}`} checked={!!picked} onChange={() => toggleAsset(a.asset_id)} />
                <label htmlFor={`asset-${a.asset_id}`} className="flex-1 cursor-pointer">
                  <span className="font-mono text-[13px]">{a.hostname}</span>
                  <span className="ml-2 text-[12px] text-ink-3">
                    {a.ip_address ?? "no IP"} · {humanize(a.asset_type)} · {a.department} · criticality {a.criticality}
                  </span>
                </label>
                {picked && (
                  <select className="input w-auto py-1 text-[13px]" value={picked.impact}
                          onChange={(e) => setAssets((all) => all.map((x) => (x.asset_id === a.asset_id ? { ...x, impact: e.target.value } : x)))}>
                    <option value="TARGETED">Targeted</option>
                    <option value="AFFECTED">Affected</option>
                    <option value="COMPROMISED">Compromised</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[14px]">
        <input type="checkbox" checked={form.auto_assign} onChange={(e) => set("auto_assign", e.target.checked)} />
        Assign automatically to the analyst with the lightest workload
      </label>

      {error && <p className="text-critical" role="alert">{error}</p>}

      <div className="flex gap-3">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Create incident"}</button>
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}
