"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { AuthShell, PasswordInput } from "@/components/AuthShell";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const signedOut = params.get("signed_out") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      // only follow same-site relative paths
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard?welcome=1");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full space-y-5">
      {signedOut && !error && (
        <p className="rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-[14px] text-ink-2" role="status">
          You have been signed out.
        </p>
      )}
      <div>
        <h2 className="font-display text-[26px] font-semibold tracking-wide">Sign in</h2>
        <p className="mt-1 text-ink-2">Welcome back. Sign in to the response console.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input id="email" type="email" autoComplete="username" required className="input"
               value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword}
                       show={show} onToggle={() => setShow(!show)} />
      </div>
      {error && <p className="text-[14px] text-[#A13E3A]" role="alert">{error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      <p className="text-center text-[14px] text-ink-2">
        New to CIRT?{" "}
        <Link href="/signup" className="font-medium text-accent-dark underline-offset-2 hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}