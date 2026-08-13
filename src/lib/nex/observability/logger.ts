// src/lib/nex/observability/logger.ts
//
// F4 · Structured logging helper.
//
// Ops-audit finding: hundreds of plain `console.log` calls across
// worker code, no JSON wrapping, no correlation_id, no subsystem tag.
// When a log drain lands (F3), these are hard to search or aggregate.
//
// This helper produces one line of JSON per event, always including:
//   · ts (ISO)
//   · level (debug | info | warn | error)
//   · subsystem (e.g. "manager", "worker.image-analyst")
//   · msg (short human-readable summary)
//   · correlation_id (from ALS or explicit) — nullable
//   · fields (caller-supplied structured context)
//
// Sensitive fields in `fields` are automatically redacted via
// redactSensitiveData (E9) so an accidental `apiKey` never lands in logs.
//
// USAGE
//   import { logger } from "@/lib/nex/observability/logger";
//   const log = logger("manager");
//   log.info("dispatch_start", { scanned: 10 });
//   log.warn("degraded", { reason: "ENOENT" });
//
// Backwards compat: this does NOT replace existing console.log calls
// automatically — it's opt-in per call site. Migrate hot paths first.

import { getCorrelationId } from "./correlation";
import { redactSensitiveData } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (msg: string, fields?: LogFields) => void;
  info:  (msg: string, fields?: LogFields) => void;
  warn:  (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
};

/** Create a logger scoped to a subsystem. */
export function logger(subsystem: string): Logger {
  return {
    debug: (msg, fields) => emit("debug", subsystem, msg, fields),
    info:  (msg, fields) => emit("info",  subsystem, msg, fields),
    warn:  (msg, fields) => emit("warn",  subsystem, msg, fields),
    error: (msg, fields) => emit("error", subsystem, msg, fields),
  };
}

function emit(level: LogLevel, subsystem: string, msg: string, fields?: LogFields): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    subsystem,
    msg,
    correlation_id: getCorrelationId(),
    ...(fields ? { fields: redactSensitiveData(fields) } : {}),
  };
  const serialised = JSON.stringify(line);
  // Send to the corresponding console method so log-drain tooling
  // (Datadog Agent, Better Stack) can route by level even if it can't
  // parse JSON out of the box.
  if (level === "error") console.error(serialised);
  else if (level === "warn") console.warn(serialised);
  else console.log(serialised);
}
