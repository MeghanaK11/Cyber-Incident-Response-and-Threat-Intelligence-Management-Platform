"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, fmtRelative, humanize } from "@/lib/client";
import { Flash } from "@/components/Badges";
import { useUser } from "@/components/UserContext";

type Asset = {
  asset_id: number; hostname: string; ip_address: string | null; asset_type: string; operating_system: string | null;
  department: string; criticality: number; is_internet_facing: boolean; incident_count: number;
  open_incidents: number; times_compromised: number; last_incident_at: string | null;
};

const TYPES = ["SERVER", "WORKSTATION", "NETWORK_DEVICE", "CLOUD_INSTANCE", "DATABASE", "APPLICATION", "IOT"];
const EMPTY = { hostname: "", ip_address: "", asset_type: "SERVER", operating_system: "", department: "", criticality: "3", is_internet_facing: false };
const CRIT_COLOR = ["", "#82977F", "#82977F", "#B99A64", "#D18B57", "#CF6F68"];

export default function AssetsPage() {
  const user = useUser();
  const isAdmin = user.role === "ADMIN";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api<{ items: Asset[] }>("/api/assets").then((r) => setAssets(r.items)).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => [a.hostname, a.ip_address, a.department, a.asset_type, a.operating_system].some((v) => v?.toLowerCase().includes(q)));
  }, [assets, filter]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      load();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      return false;
    }
  }

  function startEdit(a: Asset) {
    setEditing(a.asset_id);
    setShowForm(true);
    setForm({
      hostname: a.hostname, ip_address: a.ip_address ?? "", asset_type: a.asset_type, operating_system: a.operating_system ?? "",
      department: a.department, criticality: String(a.criticality), is_internet_facing: a.is_internet_facing,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, criticality: Number(form.criticality), ip_address: form.ip_address || null, operating_system: form.operating_system || null };
    const ok = editing
      ? await run(() => api(`/api/assets/${editing}`, { method: "PATCH", json: body }), `Saved ${form.hostname}`)
      : await run(() => api("/api/assets", { method: "POST", json: body }), `Added ${form.hostname}`);
    if (ok) { setForm(EMPTY); setEditing(null); setShowForm(false); }
  }

  const exposed = assets.filter((a) => a.open_incidents > 0).length;

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Assets</h1>
          <p className="mt-1 text-ink-2">
            {assets.length} systems we defend. {exposed > 0 ? `${exposed} involved in open incidents right now.` : "None involved in open incidents."}
          </p>
        </div>
        {isAdmin && !showForm && (
          <button className="btn-primary" onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }}>Add asset</button>
        )}
      </div>

      <Flash msg={msg} />

      {isAdmin && showForm && (
        <form onSubmit={save} className="panel grid gap-4 p-5 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="label" htmlFor="h">Hostname</label>
            <input id="h" className="input font-mono" required placeholder="web-portal-02.corp.internal"
                   value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ip">IP address</label>
            <input id="ip" className="input font-mono" placeholder="Leave blank if none"
                   value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="t">Type</label>
            <select id="t" className="input" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="os">Operating system</label>
            <input id="os" className="input" value={form.operating_system} onChange={(e) => setForm({ ...form, operating_system: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="dep">Department</label>
            <input id="dep" className="input" required minLength={2} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c">Criticality</label>
            <select id="c" className="input" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 5 ? "(business critical)" : n === 1 ? "(low impact)" : ""}</option>)}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-[14px]">
            <input type="checkbox" checked={form.is_internet_facing} onChange={(e) => setForm({ ...form, is_internet_facing: e.target.checked })} />
            Reachable from the internet
          </label>
          <div className="flex gap-3 md:col-span-4">
            <button className="btn-primary">{editing ? "Save changes" : "Add asset"}</button>
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY); }}>Cancel</button>
          </div>
        </form>
      )}

      <input className="input max-w-md" placeholder="Filter by hostname, IP, department or type"
             value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter assets" />

      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="text-left text-[12px] text-ink-3">
            <tr className="border-b border-line-2">
              <th className="py-2.5 pr-4 font-medium">Hostname</th>
              <th className="py-2.5 pr-4 font-medium">Type</th>
              <th className="py-2.5 pr-4 font-medium">Department</th>
              <th className="py-2.5 pr-4 font-medium">Criticality</th>
              <th className="py-2.5 pr-4 text-right font-medium">Incidents</th>
              <th className="py-2.5 pr-4 text-right font-medium">Open</th>
              <th className="py-2.5 pr-4 text-right font-medium">Compromised</th>
              <th className="py-2.5 pr-4 font-medium">Last incident</th>
              {isAdmin && <th className="py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((a) => (
              <tr key={a.asset_id} className="hover:bg-panel-2/40">
                <td className="py-3 pr-4">
                  <div className="code text-ink">{a.hostname}</div>
                  <div className="text-[12px] text-ink-3">
                    {a.ip_address ?? "no IP"}{a.operating_system ? `, ${a.operating_system}` : ""}
                    {a.is_internet_facing && <span className="ml-2 rounded border border-sev-3/40 px-1 text-[11px] text-sev-3">internet facing</span>}
                  </div>
                </td>
                <td className="py-3 pr-4 text-ink-2">{humanize(a.asset_type)}</td>
                <td className="py-3 pr-4 text-ink-2">{a.department}</td>
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-1" title={`Criticality ${a.criticality} of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: n <= a.criticality ? CRIT_COLOR[a.criticality] : "#E1E6DC" }} />
                    ))}
                    <span className="ml-1.5 text-[12px] text-ink-3">{a.criticality}</span>
                  </span>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{a.incident_count}</td>
                <td className={`py-3 pr-4 text-right tabular-nums ${a.open_incidents ? "text-sev-3" : "text-ink-3"}`}>{a.open_incidents}</td>
                <td className={`py-3 pr-4 text-right tabular-nums ${a.times_compromised ? "text-sev-4" : "text-ink-3"}`}>{a.times_compromised}</td>
                <td className="py-3 pr-4 text-ink-2">{a.last_incident_at ? fmtRelative(a.last_incident_at) : <span className="text-ink-3">never</span>}</td>
                {isAdmin && (
                  <td className="space-x-3 whitespace-nowrap py-3 text-right text-[13px]">
                    <button className="text-accent hover:underline" onClick={() => startEdit(a)}>Edit</button>
                    <button className="text-ink-3 hover:text-critical"
                            onClick={() => window.confirm(`Delete ${a.hostname}?`) && run(() => api(`/api/assets/${a.asset_id}`, { method: "DELETE" }), `Deleted ${a.hostname}`)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="py-12 text-center text-ink-3">
            {assets.length === 0 ? (isAdmin ? "No assets yet. Add the systems your team defends." : "No assets have been registered yet.") : "No assets match that filter."}
          </p>
        )}
      </div>
    </div>
  );
}
