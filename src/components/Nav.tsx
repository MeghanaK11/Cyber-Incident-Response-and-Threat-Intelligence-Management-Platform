"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, humanize } from "@/lib/client";
import { useUser } from "./UserContext";
import { Logo } from "./Logo";
import { postureInfo, type Posture } from "./Posture";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/incidents", label: "Incidents", icon: "M12 3 2 20h20L12 3zm0 6v5m0 3v.5" },
  { href: "/assets", label: "Assets", icon: "M4 5h16v10H4zM8 19h8M12 15v4" },
  { href: "/playbooks", label: "Playbooks", icon: "M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4" },
];
const ADMIN_LINKS = [{ href: "/admin/users", label: "Users", icon: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 10a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 21a5 5 0 0 0-4-4.9" }];

export function Nav({ posture }: { posture: Posture | null }) {
  const user = useUser();
  const path = usePathname();
  const router = useRouter();
  const p = postureInfo(posture?.level ?? "GUARDED");

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  const item = (l: { href: string; label: string; icon: string }) => {
    const active = path === l.href || path.startsWith(l.href + "/");
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors ${
          active ? "bg-panel-2 text-ink" : "text-ink-2 hover:bg-panel-2/60 hover:text-ink"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round" className={active ? "text-accent" : "text-ink-3 group-hover:text-ink-2"} aria-hidden>
          <path d={l.icon} />
        </svg>
        {l.label}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-[#0a1526]/95 px-3 py-5">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5 px-2">
        <Logo />
        <span className="font-display text-[19px] font-semibold tracking-wider">CIRT</span>
      </Link>

      {/* Posture indicator, visible on every page */}
      <Link href="/dashboard" className="mb-6 rounded-md border border-line px-3 py-2.5 hover:border-line-2"
            title={`Threat posture score ${posture?.score ?? 0}`}>
        <div className="text-[12px] text-ink-3">Threat posture</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} aria-hidden />
          <span className="font-display text-[16px] font-semibold tracking-wide" style={{ color: p.color }}>{p.label}</span>
        </div>
      </Link>

      <nav className="flex flex-col gap-0.5">{LINKS.map(item)}</nav>
      {user.role === "ADMIN" && (
        <>
          <div className="mb-1 mt-6 px-3 text-[12px] text-ink-3">Administration</div>
          <nav className="flex flex-col gap-0.5">{ADMIN_LINKS.map(item)}</nav>
        </>
      )}

      <div className="mt-auto border-t border-line px-2 pt-4">
        <div className="truncate text-[14px] text-ink">{user.full_name}</div>
        <div className="text-[12px] text-ink-3">{humanize(user.role)}</div>
        <button onClick={logout} className="mt-3 text-[13px] text-ink-2 hover:text-ink">Sign out</button>
      </div>
    </aside>
  );
}
