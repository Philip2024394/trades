// NEX Workforce V2 · Supervisor · Structured logger
// ─────────────────────────────────────────────────────────────────────────────
// Boring · deterministic · JSON-per-line to stderr. No buffering. No async
// writer. Fits the C8 "supervisor must be boring" rule.

const noop = () => {};

export function createLogger({ component = "supervisor", stream = process.stderr, enabled = true } = {}) {
  if (!enabled) return { info: noop, warn: noop, error: noop, critical: noop, close: noop };
  const emit = (level, obj) => {
    try {
      const line = JSON.stringify({ ts: new Date().toISOString(), level, component, ...obj });
      stream.write(line + "\n");
    } catch {
      // Logging must never crash the supervisor
    }
  };
  return {
    info:     (msg, ctx = {}) => emit("info",     { msg, ...ctx }),
    warn:     (msg, ctx = {}) => emit("warn",     { msg, ...ctx }),
    error:    (msg, ctx = {}) => emit("error",    { msg, ...ctx }),
    critical: (msg, ctx = {}) => emit("critical", { msg, ...ctx }),
    close:    () => {},
  };
}
