"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/session";

export type SessionUser = { user_id: number; full_name: string; email: string; role: Role };

const Ctx = createContext<SessionUser | null>(null);

export function UserProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <Ctx.Provider value={user}>{children}</Ctx.Provider>;
}

export function useUser(): SessionUser {
  const u = useContext(Ctx);
  if (!u) throw new Error("useUser must be used inside UserProvider");
  return u;
}

export function canWrite(u: SessionUser) {
  return u.role === "ADMIN" || u.role === "ANALYST";
}
