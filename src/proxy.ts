import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// First line of defence: no page or API route is reachable without a valid
// session. Route handlers still check roles themselves (requireUser), so this
// file is not the only guard.

const PUBLIC_PATHS = new Set(["/login", "/signup", "/api/auth/login", "/api/auth/signup"]);
// Pages a signed-in user has no reason to see again
const SIGNED_OUT_ONLY = new Set(["/login", "/signup"]);

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // Already signed in: skip the login and sign-up pages, like most websites do
  if (session && SIGNED_OUT_ONLY.has(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};