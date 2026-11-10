"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "./UserContext";
import { RoleBadge, useSignOut } from "./AccountMenu";
import { Logo } from "./Logo";
import { postureInfo, type Posture } from "./Posture";

const LINKS = [
  { href: "/dashboard", label: "Overview", icon: "M3 12h4l3-8 4 16 3-8h4" },
  { href: "/incidents", label: "Incidents", icon: "M12 3 2 20h20L12 3zm0 6v5m0 3v.5" },
  { href: "/assets", label: "Assets", icon: "M4 5h16v10H4zM8 19h8M12 15v4" },
  { href: "/playbooks", label: "Playbooks", icon: "M6 3h10l3 3v15H6zM9 9h7M9 13h7M9 17h4" },
  { href: "/alerts", label: "Security Alerts", icon: "M12 3 2 20h20L12 3zm0 6v5m0 3v.5" },
  { href: "/threat-intelligence", label: "Threat Intelligence", icon: "M12 3v18m-9-9h18M5.6 5.6l12.8 12.8m0-12.8L5.6 18.4" },
];
const ADMIN_LINKS = [{ href: "/admin/users", label: "Users", icon: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 10a6 6 0 0 1 12 0M17 11a3 3 0 1 0 0-6M21 21a5 5 0 0 0-4-4.9" }];

export function Nav({ posture }: { posture: Posture | null }) {
  const user = useUser();
  const path = usePathname();
  const signOut = useSignOut();
  const p = postureInfo(posture?.level ?? "GUARDED");

  const item = (l: { href: string; label: string; icon: string }) => {
    const active = path === l.href || path.startsWith(l.href + "/");
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-[14px] transition-colors ${
          active ? "bg-[#E9EEE5] text-[#34432F] shadow-[inset_3px_0_0_#718568]" : "text-[#687264] hover:bg-[#F0F3EC] hover:text-[#252C24]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round" className={active ? "text-[#718568]" : "text-[#899283] group-hover:text-[#586B50]"} aria-hidden>
          <path d={l.icon} />
        </svg>
        {l.label}
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-[#E1E6DC] bg-[#FFFFFF] px-3.5 py-5">
      <Link href="/dashboard" className="mb-7 flex items-center gap-3 px-2">
        <Logo />
        <span className="font-display text-[18px] font-semibold tracking-[0.16em] text-[#252C24]">CIRT</span>
      </Link>

      {/* Posture indicator, visible on every page */}
      <Link href="/dashboard" className="mb-7 rounded-xl border border-[#E1E6DC] bg-[#F6F7F2] px-3.5 py-3 transition-colors hover:border-[#B8C5B0]"
            title={`Threat posture score ${posture?.score ?? 0}`}>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#899283]">Threat posture</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color, boxShadow: `0 0 10px ${p.color}` }} aria-hidden />
          <span className="font-display text-[14px] font-semibold tracking-wide" style={{ color: p.color }}>{p.label}</span>
        </div>
      </Link>

      <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#899283]">Workspace</div><nav className="flex flex-col gap-1">{LINKS.map(item)}</nav>
      {user.role === "ADMIN" && (
        <>
          <div className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#899283]">Administration</div>
          <nav className="flex flex-col gap-1">{ADMIN_LINKS.map(item)}</nav>
        </>
      )}

      <div className="mt-auto border-t border-[#E1E6DC] px-2 pt-4">
        <div className="truncate text-[14px] text-ink">{user.full_name}</div>
        <div className="mt-1"><RoleBadge role={user.role} /></div>
        <button onClick={signOut} className="mt-3 rounded-md text-[12px] text-[#687264] transition-colors hover:text-[#718568]">Sign out</button>
      </div>
    </aside>
  );
}