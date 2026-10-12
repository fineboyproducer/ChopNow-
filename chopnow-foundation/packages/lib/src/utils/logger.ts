/* eslint-disable no-console */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/**
 * Minimum level that actually gets printed. In production we drop debug
 * noise by default; set NEXT_PUBLIC_LOG_LEVEL to override.
 */
function minLevel(): LogLevel {
  const fromEnv = process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel | undefined;
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel()];
}

function format(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${message}`;
  return context && Object.keys(context).length > 0 ? `${base} ${JSON.stringify(context)}` : base;
}

/**
 * Scoped logger factory. Use one logger per module/feature so log lines
 * are traceable back to their source without manually prefixing every
 * call site:
 *
 *   const log = createLogger("dispatch-engine");
 *   log.info("Assigned rider", { orderId, riderId });
 *
 * In production this is a thin wrapper around console methods with
 * structured, greppable output. Swap the implementation for a real sink
 * (Sentry, Logtail, Axiom) by replacing the bodies below — call sites
 * never need to change.
 */
export function createLogger(scope: string) {
  return {
    debug(message: string, context?: LogContext) {
      if (shouldLog("debug")) console.debug(format("debug", scope, message, context));
    },
    info(message: string, context?: LogContext) {
      if (shouldLog("info")) console.info(format("info", scope, message, context));
    },
    warn(message: string, context?: LogContext) {
      if (shouldLog("warn")) console.warn(format("warn", scope, message, context));
    },
    error(message: string, error?: unknown, context?: LogContext) {
      if (!shouldLog("error")) return;
      const errorContext =
        error instanceof Error
          ? { ...context, errorMessage: error.message, stack: error.stack }
          : { ...context, error };
      console.error(format("error", scope, message, errorContext));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
