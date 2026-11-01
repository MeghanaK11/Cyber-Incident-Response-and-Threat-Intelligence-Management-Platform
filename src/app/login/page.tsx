"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      // only follow same-site relative paths
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5">
      <div>
        <h2 className="font-display text-[26px] font-semibold tracking-wide">Sign in</h2>
        <p className="mt-1 text-ink-2">Use the account your administrator created for you.</p>
      </div>
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input id="email" type="email" autoComplete="username" required className="input"
               value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required className="input"
               value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="text-[14px] text-[#ff8da1]" role="alert">{error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Left: a large radar scope, the console's mark at full size */}
      <section className="relative hidden overflow-hidden border-r border-line bg-[#0a1526] lg:block">
        <svg viewBox="0 0 600 600" className="absolute left-1/2 top-1/2 h-[120%] -translate-x-1/2 -translate-y-1/2 opacity-90" aria-hidden>
          <defs>
            <radialGradient id="sweep" cx="300" cy="300" r="280" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#59b2ff" stopOpacity="0.35" />
              <stop offset="1" stopColor="#59b2ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[70, 140, 210, 280].map((r) => (
            <circle key={r} cx="300" cy="300" r={r} fill="none" stroke="#1b2c45" strokeWidth="1.5" />
          ))}
          <line x1="20" y1="300" x2="580" y2="300" stroke="#1b2c45" />
          <line x1="300" y1="20" x2="300" y2="580" stroke="#1b2c45" />
          <path d="M300 300 L300 20 A280 280 0 0 1 542 160 Z" fill="url(#sweep)" />
          <line x1="300" y1="300" x2="542" y2="160" stroke="#59b2ff" strokeWidth="2" />
          {/* contacts, coloured by severity */}
          <circle cx="410" cy="170" r="6" fill="#f2385a" />
          <circle cx="455" cy="250" r="4.5" fill="#f0803c" />
          <circle cx="215" cy="410" r="4" fill="#e3b341" />
          <circle cx="160" cy="210" r="3.5" fill="#6b8fbf" />
          <circle cx="360" cy="455" r="3.5" fill="#6b8fbf" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <span className="font-display text-[22px] font-semibold tracking-wider">CIRT</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-wide">
              Every alert, triaged and tracked to closure.
            </h1>
            <p className="mt-4 text-[16px] text-ink-2">
              Incident response for the security operations team: SLAs, playbooks and a record of every decision.
            </p>
          </div>
        </div>
      </section>

      <section className="grid place-items-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Logo size={30} />
            <span className="font-display text-[20px] font-semibold tracking-wider">CIRT</span>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
