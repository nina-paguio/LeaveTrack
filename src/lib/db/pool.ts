import { env } from "@/lib/env";

export interface DatabaseConfig {
  connectionString: string;
  max: number;
}

/**
 * Day 0: configuration only. No connection is opened anywhere in the scaffold.
 * Day 1 passes this to the Postgres client.
 *
 * Supabase must be reached through the pooler (port 6543 / "pooler" host), never the direct
 * connection, so 800 concurrent staff do not exhaust Postgres connections.
 */
export function getDatabaseConfig(): DatabaseConfig {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (Day 1).");
  const isPooler = url.includes("pooler") || url.includes(":6543");
  if (!isPooler)
    throw new Error("DATABASE_URL must be the Supabase pooler URL, not a direct connection.");
  return { connectionString: url, max: 10 };
}
