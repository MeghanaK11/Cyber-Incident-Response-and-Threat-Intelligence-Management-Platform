import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/http";
import { signupSchema } from "@/lib/validation";
import { registerUser } from "@/server/users";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";

/** Compares the typed admin code with ADMIN_SIGNUP_CODE from .env */
function adminCodeOk(typed: string | undefined): boolean {
  const expected = process.env.ADMIN_SIGNUP_CODE;
  if (!expected || !typed) return false;
  const a = Buffer.from(typed);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Creates the account with the chosen role and signs the new user in straight away.
export const POST = route(async (req) => {
  const input = signupSchema.parse(await req.json());
  if (input.role === "ADMIN" && !adminCodeOk(input.admin_code)) {
    throw new HttpError(403, "The admin code is incorrect");
  }

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