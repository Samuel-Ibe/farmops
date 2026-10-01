/**
 * Structured (JSON-lines) server logging with request IDs.
 *
 * - One JSON object per line: `{ ts, level, msg, requestId?, ...fields }`
 * - Sensitive keys are redacted before serialization; secrets and raw user
 *   credentials must never reach the log stream.
 * - `logRouteError` attaches the `x-request-id` propagated by middleware so a
 *   client-visible error can be correlated with the server log line.
 */

type Level = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const SENSITIVE_KEY = /^(password|token|secret|authorization|cookie|api[-_]?key|session|credential)/i;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 50);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }
  return value;
}

function emit(level: Level, msg: string, fields?: LogFields): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
  };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) entry[k] = redactValue(k, v);
  }
  let line: string;
  try {
    line = JSON.stringify(entry);
  } catch {
    line = JSON.stringify({ ts: entry.ts, level, msg, error: "unserializable log fields" });
  }
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(base: LogFields): Logger;
}

function makeLogger(base: LogFields = {}): Logger {
  const withBase = (fields?: LogFields): LogFields | undefined =>
    fields || Object.keys(base).length ? { ...base, ...fields } : undefined;
  return {
    debug: (msg, fields) => emit("debug", msg, withBase(fields)),
    info: (msg, fields) => emit("info", msg, withBase(fields)),
    warn: (msg, fields) => emit("warn", msg, withBase(fields)),
    error: (msg, fields) => emit("error", msg, withBase(fields)),
    child: (extra) => makeLogger({ ...base, ...extra }),
  };
}

export const logger: Logger = makeLogger();

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Structured error log bound to the request's correlation ID. */
export function logRouteError(request: Request, message: string, error: unknown): void {
  logger.error(message, {
    requestId: request.headers.get("x-request-id") || undefined,
    method: request.method,
    path: (() => {
      try {
        return new URL(request.url).pathname;
      } catch {
        return undefined;
      }
    })(),
    error,
  });
}
