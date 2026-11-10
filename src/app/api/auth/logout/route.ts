import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

function clear(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

// Called by the Sign out button
export async function POST() {
  return clear(NextResponse.json({ ok: true }));
}

// Used when a cookie is still valid but the account was deactivated:
// clear it and send the user to the login page.
export async function GET(req: Request) {
  return clear(NextResponse.redirect(new URL("/login?signed_out=1", req.url)));
}