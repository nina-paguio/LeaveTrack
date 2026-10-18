import { z } from "zod";

// Every variable is optional on Day 0: the app must boot with no credentials.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SESSION_COOKIE_NAME: z.string().min(1).default("leavetrack-session"),
  SESSION_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 8),
  // Signs the session cookie; at least 32 characters. Without it sign-in is refused (fails closed).
  // Generate: openssl rand -hex 32
  SESSION_SECRET: z.string().optional(),
  // Optional extra restriction: when set, only addresses at exactly this domain may sign in.
  ALLOWED_EMAIL_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  // Optional on purpose: env.ts is imported everywhere (including proxy.ts), and Day 0 must boot
  // without credentials. Code that needs them goes through lib/supabase/server.ts.
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  // Public by design (RLS is on); used only for the password sign-in call.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
