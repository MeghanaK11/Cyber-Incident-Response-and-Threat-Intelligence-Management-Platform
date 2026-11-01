"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, humanize } from "@/lib/client";
import { useUser } from "@/components/UserContext";
import { useMeta } from "@/components/useMeta";
import { Flash } from "@/components/Badges";

type U = {
  user_id: number; full_name: string; email: string; role: string; is_active: boolean;
  created_at: string; last_login_at: string | null; open_assigned: number;
};

const EMPTY = { full_name: "", email: "", role: "ANALYST", password: "" };

export default function UsersPage() {
  const me = useUser();
  const meta = useMeta();
  const [users, setUsers] = useState<U[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api<{ items: U[] }>("/api/users").then((r) => setUsers(r.items)).catch((e) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (await run(() => api("/api/users", { method: "POST", json: form }), `Created ${form.email}`)) setForm(EMPTY);
  }

  function resetPassword(u: U) {
    const password = window.prompt(`New password for ${u.email} (10+ chars, letter, digit, symbol)`);
    if (password) run(() => api(`/api/users/${u.user_id}`, { method: "PATCH", json: { password } }), "Password reset");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Users</h1>
        <p className="mt-1 text-ink-2">Passwords are hashed with bcrypt before they reach the database.</p>
      </div>

      <Flash msg={msg} />

      <form onSubmit={create} className="panel grid items-end gap-3 p-5 md:grid-cols-5">
        <div>
          <label className="label" htmlFor="n">Full name</label>
          <input id="n" className="input" required minLength={2} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="e">Email</label>
          <input id="e" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="r">Role</label>
          <select id="r" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {meta?.roles.map((r) => <option key={r.role_id} value={r.role_name} title={r.description}>{humanize(r.role_name)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p">Initial password</label>
          <input id="p" type="password" className="input" required minLength={10} autoComplete="new-password"
                 value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn-primary">Add user</button>
      </form>

      <table className="w-full text-[14px]">
        <thead className="border-b border-line-2 text-left text-[12px] text-ink-3">
          <tr>
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Email</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 pr-8 text-right font-medium">Open incidents</th>
            <th className="py-2 font-medium">Last sign-in</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((u) => {
            const self = u.user_id === me.user_id;
            return (
              <tr key={u.user_id} className={u.is_active ? "" : "text-ink-3"}>
                <td className="py-2.5">{u.full_name}{self && <span className="text-ink-3"> (you)</span>}</td>
                <td className="py-2.5">{u.email}</td>
                <td className="py-2.5">
                  <select className="input w-auto py-1 text-[13px]" value={u.role} disabled={self}
                          onChange={(e) => run(() => api(`/api/users/${u.user_id}`, { method: "PATCH", json: { role: e.target.value } }), "Role updated")}>
                    {meta?.roles.map((r) => <option key={r.role_id} value={r.role_name}>{humanize(r.role_name)}</option>)}
                  </select>
                </td>
                <td className="py-2.5 pr-8 text-right tabular-nums">{u.open_assigned}</td>
                <td className="py-2.5">{u.last_login_at ? fmtDate(u.last_login_at) : "Never"}</td>
                <td className="py-2.5">{u.is_active ? "Active" : "Deactivated"}</td>
                <td className="space-x-3 py-2.5 text-right text-[13px]">
                  <button className="text-accent hover:underline" onClick={() => resetPassword(u)}>Reset password</button>
                  {!self && (
                    <button className="text-ink-2 hover:underline"
                            onClick={() => run(() => api(`/api/users/${u.user_id}`, { method: "PATCH", json: { is_active: !u.is_active } }), u.is_active ? "User deactivated" : "User reactivated")}>
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
