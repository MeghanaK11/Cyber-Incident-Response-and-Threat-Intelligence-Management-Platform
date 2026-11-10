"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { AuthShell, PasswordInput } from "@/components/AuthShell";

// Same rules as the server (src/lib/validation.ts), shown live as the user types
const RULES = [
  { label: "10 or more characters", test: (p: string) => p.length >= 10 },
  { label: "A letter", test: (p: string) => /[A-Za-z]/.test(p) },
  { label: "A digit", test: (p: string) => /[0-9]/.test(p) },
  { label: "A symbol", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const ROLE_OPTIONS = [
  { value: "VIEWER", label: "Viewer", hint: "Read-only" },
  { value: "ANALYST", label: "Analyst", hint: "Work incidents" },
  { value: "ADMIN", label: "Admin", hint: "Needs admin code" },
] as const;
type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<RoleValue>("VIEWER");
  const [adminCode, setAdminCode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    if (!RULES.every((r) => r.test(password))) return setError("Password does not meet the rules below");
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/signup", {
        method: "POST",
        json: {
          full_name: fullName,
          email,
          role,
          admin_code: role === "ADMIN" ? adminCode : undefined,
          password,
          confirm_password: confirm,
        },
      });
      router.replace("/dashboard?welcome=new");
      router.refresh();
    } catch (err) {
      // Server errors look like "email: Enter a valid email address"; drop the field prefix
      setError((err as Error).message.replace(/^\w+: /, ""));
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className="w-full space-y-5">
        <div>
          <h2 className="font-display text-[26px] font-semibold tracking-wide">Create an account</h2>
          <p className="mt-1 text-ink-2">Choose your role. Admin accounts need the admin code.</p>
        </div>
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" autoComplete="name" required minLength={2} maxLength={100} className="input"
                 value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">Work email</label>
          <input id="email" type="email" autoComplete="email" required className="input"
                 value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">Role</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((o) => {
              const active = role === o.value;
              return (
                <label key={o.value}
                       className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center transition-colors ${
                         active ? "border-accent bg-[#E9EEE5] ring-2 ring-accent/20" : "border-line bg-panel hover:border-line-2"
                       }`}>
                  <input type="radio" name="role" value={o.value} checked={active}
                         onChange={() => setRole(o.value)} className="sr-only" />
                  <span className={`block text-[14px] font-medium ${active ? "text-accent-dark" : "text-ink"}`}>{o.label}</span>
                  <span className="block text-[11px] text-ink-3">{o.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {role === "ADMIN" && (
          <div>
            <label className="label" htmlFor="admin_code">Admin code</label>
            <input id="admin_code" type="password" autoComplete="off" required className="input"
                   value={adminCode} onChange={(e) => setAdminCode(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword}
                         show={show} onToggle={() => setShow(!show)} />
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
            {RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={`flex items-center gap-1.5 ${ok ? "text-good" : "text-ink-3"}`}>
                  <span aria-hidden>{ok ? "✓" : "○"}</span>
                  {r.label}
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} show={show} />
          {mismatch && <p className="mt-1.5 text-[12px] text-[#A13E3A]">Passwords do not match</p>}
        </div>
        {error && <p className="text-[14px] text-[#A13E3A]" role="alert">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
        <p className="text-center text-[14px] text-ink-2">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-dark underline-offset-2 hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}