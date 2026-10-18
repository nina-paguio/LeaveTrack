import { createHmac, timingSafeEqual } from "node:crypto";
import { isRole } from "@/lib/roles";
import type { Role } from "@/types/domain";

export interface SessionClaims {
  email: string;
  role: Role;
}

const MIN_SECRET_LENGTH = 32;

const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

export function isUsableSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

/** Signed `<payload>.<mac>` cookie value. The role inside cannot be edited without the secret. */
export function createSessionToken(
  claims: SessionClaims,
  secret: string,
  maxAgeSeconds: number,
  now = Date.now(),
): string {
  const exp = Math.floor(now / 1000) + maxAgeSeconds;
  const body = Buffer.from(JSON.stringify({ e: claims.email, r: claims.role, x: exp })).toString(
    "base64url",
  );
  return `${body}.${sign(body, secret)}`;
}

/** Returns the claims, or null for anything missing, forged, malformed or expired. Never throws. */
export function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): SessionClaims | null {
  if (!token || !isUsableSecret(secret)) return null;
  const parts = token.split(".");
  const [body, mac] = parts;
  if (parts.length !== 2 || !body || !mac) return null;

  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      e?: unknown;
      r?: unknown;
      x?: unknown;
    };
    if (typeof data.e !== "string" || !isRole(data.r)) return null;
    if (typeof data.x !== "number" || data.x * 1000 <= now) return null;
    return { email: data.e, role: data.r };
  } catch {
    return null;
  }
}
