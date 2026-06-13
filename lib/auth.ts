import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "lecturer_session";
const SALT_ROUNDS = 12;

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.WEBHOOK_SECRET || "change-me-session-secret";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function signToken(payload: string): string {
  const hmac = crypto.createHmac("sha256", getSecret());
  hmac.update(payload);
  return `${payload}.${hmac.digest("hex")}`;
}

function verifyToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  if (signature !== expected) return null;
  return payload;
}

export function getSessionId(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function createSessionCookie(value: string) {
  const token = signToken(value);
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  };
}

// Helper: returns NextResponse for unauthorized error
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export function requireSession(req: NextRequest): { sessionId: string | null; response: NextResponse | null } {
  const sid = getSessionId(req);
  if (!sid) {
    return { sessionId: null, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { sessionId: sid, response: null };
}
