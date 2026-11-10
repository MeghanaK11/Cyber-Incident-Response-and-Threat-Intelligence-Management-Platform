"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import type { Role } from "@/lib/session";
import { useUser } from "./UserContext";

export const ROLE_INFO: Record<Role, { label: string; color: string; bg: string; can: string }> = {
  ADMIN: {
    label: "Admin",
    color: "#A05E2C",
    bg: "#F6EDE4",
    can: "Full access, including managing users, reassigning work and deleting incidents.",
  },
  ANALYST: {
    label: "Analyst",
    color: "#4E6247",
    bg: "#E9EEE5",
    can: "Report and work incidents, take or auto-assign them, apply playbooks and manage tasks.",
  },
  VIEWER: {
    label: "Viewer",
    color: "#46627F",
    bg: "#E7EDF3",
    can: "Read-only access to the dashboard, incidents, alerts and threat intelligence.",
  },
};

export function RoleBadge({ role }: { role: Role }) {
  const r = ROLE_INFO[role];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: r.color, background: r.bg }}>
      {r.label}
    </span>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login?signed_out=1");
    router.refresh();
  };
}

/** Avatar button in the top-right corner that opens a small account card */
export function AccountMenu() {
  const user = useUser();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const r = ROLE_INFO[user.role];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu"
              className="flex items-center gap-3 rounded-full border border-line bg-panel py-1 pl-1 pr-3 transition-colors hover:border-line-2">
        <span className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white"
              style={{ background: r.color }} aria-hidden>
          {initials(user.full_name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block max-w-[160px] truncate text-[13px] font-medium leading-tight text-ink">{user.full_name}</span>
          <span className="block text-[11px] leading-tight" style={{ color: r.color }}>{r.label}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-3" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(37,44,36,0.12)]">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[14px] font-semibold text-white"
                  style={{ background: r.color }} aria-hidden>
              {initials(user.full_name)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-ink">{user.full_name}</div>
              <div className="truncate text-[12px] text-ink-2">{user.email}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-panel-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Role</span>
              <RoleBadge role={user.role} />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{r.can}</p>
          </div>
          {user.role === "ADMIN" && (
            <Link href="/admin/users" onClick={() => setOpen(false)}
                  className="mt-3 block rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-panel-2 hover:text-ink" role="menuitem">
              Manage users
            </Link>
          )}
          <button onClick={signOut} role="menuitem"
                  className="mt-2 w-full rounded-md border border-line px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-critical/40 hover:bg-critical/5 hover:text-critical">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** One-time banner after sign-in or sign-up that says who you are and what your role allows */
export function WelcomeBanner() {
  const user = useUser();
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const kind = params.get("welcome");
  const [hidden, setHidden] = useState(false);
  if (!kind || hidden) return null;

  const r = ROLE_INFO[user.role];
  const first = user.full_name.split(" ")[0];

  function dismiss() {
    setHidden(true);
    router.replace(path); // drop ?welcome from the address bar
  }

  return (
    <div className="mb-6 flex items-start gap-4 rounded-xl border px-4 py-3.5" style={{ borderColor: r.bg, background: r.bg }} role="status">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-ink">
          {kind === "new" ? `Welcome to CIRT, ${first}. Your account is ready.` : `Welcome back, ${first}.`}
          <span className="text-[13px] font-normal text-ink-2">Signed in as</span>
          <RoleBadge role={user.role} />
        </div>
        <p className="mt-1 text-[13px] text-ink-2">{r.can}</p>
      </div>
      <button onClick={dismiss} className="text-[13px] text-ink-2 hover:text-ink" aria-label="Dismiss">✕</button>
    </div>
  );
}
