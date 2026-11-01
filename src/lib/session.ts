import { SignJWT, jwtVerify } from "jose";

// Kept free of database imports so proxy.ts can use it.

export const SESSION_COOKIE = "cirt_session";
export const SESSION_HOURS = 8;

export type Role = "ADMIN" | "ANALYST" | "VIEWER";

export type SessionPayload = {
  sub: string; // user_id
  name: string;
  role: Role;
};

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { sub: payload.sub, name: String(payload.name ?? ""), role: payload.role as Role };
  } catch {
    return null;
  }
}
