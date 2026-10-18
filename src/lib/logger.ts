import { env } from "@/lib/env";

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function write(level: Level, message: string, context?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[env.LOG_LEVEL]) return;
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    appEnv: env.APP_ENV,
    message,
    ...context,
  });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: string, context?: Record<string, unknown>) => write("error", message, context),
};
