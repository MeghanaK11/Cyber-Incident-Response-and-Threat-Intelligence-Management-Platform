import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/http";
import { signupSchema } from "@/lib/validation";
import { registerUser } from "@/server/users";
import { SESSION_COOKIE, SESSION_HOURS, signSession, type Role } from "@/lib/session";
 
// Viewer is open to anyone. Analyst and Admin each need their own code from .env.
// An empty or missing code turns sign-up for that role off completely.
const ROLE_CODES: Record<Exclude<Role, "VIEWER">, { env: string; label: string }> = {
  ANALYST: { env: "ANALYST_SIGNUP_CODE", label: "Analyst" },
  ADMIN: { env: "ADMIN_SIGNUP_CODE", label: "Admin" },
};
 
function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
 
function checkRoleCode(role: Role, typed: string | undefined) {
  if (role === "VIEWER") return;
  const { env, label } = ROLE_CODES[role];
  const expected = process.env[env]?.trim();
  if (!expected) {
    throw new HttpError(403, `${label} sign-up is turned off. Sign up as a Viewer and ask an admin to change your role.`);
  }
  if (!typed || !sameText(typed.trim(), expected)) {
    throw new HttpError(403, `The ${label.toLowerCase()} code is incorrect`);
  }
}
 
// Creates the account with the chosen role and signs the new user in straight away.
export const POST = route(async (req) => {
  const input = signupSchema.parse(await req.json());
  checkRoleCode(input.role, input.role_code);
 
  const user = await registerUser(input);
  const token = await signSession({ sub: String(user.user_id), name: user.full_name, role: user.role });
 
  const res = NextResponse.json({ user }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res; 
});
 