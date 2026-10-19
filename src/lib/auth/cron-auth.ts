import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time check of `Authorization: Bearer <secret>` for the scheduled jobs (Vercel Cron sends the
 * project's CRON_SECRET this way). No early exit on the first wrong byte; a different length is simply
 * "no". The caller must already have refused when no secret is configured (fail closed).
 */
export function hasValidCronSecret(request: Request, secret: string): boolean {
  const match = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "");
  if (!match?.[1]) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
