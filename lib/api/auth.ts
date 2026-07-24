import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { NextRequest, NextResponse } from "next/server";

export type Session = JWTPayload & { role: "admin" | "agent"; id: number; name: string; email?: string };
const ADMIN_COOKIE = "aquathrill_admin";
const AGENT_COOKIE = "aquathrill_agent";

function secret() {
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required in production");
  }
  return new TextEncoder().encode(process.env.AUTH_SECRET || "aquathrill-development-secret-change-me");
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash.replace(/^\$2y\$/, "$2b$"));
}

export function createPasswordHash(password: string) {
  return hash(password, 12);
}

export async function createSession(session: Session) {
  return new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret());
}

export async function readSession(request: NextRequest, role: "admin" | "agent") {
  const token = request.cookies.get(role === "admin" ? ADMIN_COOKIE : AGENT_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === role ? payload as Session : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, role: "admin" | "agent", token: string) {
  response.cookies.set(role === "admin" ? ADMIN_COOKIE : AGENT_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response: NextResponse, role: "admin" | "agent") {
  response.cookies.set(role === "admin" ? ADMIN_COOKIE : AGENT_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
