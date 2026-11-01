import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/server/users";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";

export const POST = route(async (req) => {
  const { email, password } = loginSchema.parse(await req.json());
  const user = await authenticate(email, password);
  const token = await signSession({ sub: String(user.user_id), name: user.full_name, role: user.role });

  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
});
