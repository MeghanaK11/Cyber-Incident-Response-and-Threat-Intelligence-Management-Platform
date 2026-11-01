"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, humanize } from "@/lib/client";
import { useUser } from "./UserContext";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/incidents", label: "Incidents" },
];

export function Nav() {
  const user = useUser();
  const path = usePathname();
  const router = useRouter();
  const links = user.role === "ADMIN" ? [...LINKS, { href: "/admin/users", label: "Users" }] : LINKS;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[11px] font-bold text-white">IR</span>
          CIRT
        </Link>
        <nav className="flex gap-1">
          {links.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-[14px] ${active ? "bg-surface font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-[14px]">
          <span className="text-ink-2">
            {user.full_name} <span className="text-ink-3">· {humanize(user.role)}</span>
          </span>
          <button onClick={logout} className="text-ink-2 hover:text-ink">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
