// src/lib/nex/config/timeouts.ts
//
// Wave 3 · H3 · shared timeout-budget configuration.
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md
//
// PURPOSE
//   Single authoritative reader for every H3 timeout value used by NEX
//   infrastructure. Every env var is optional · every default is drawn from
//   WORLD-CLASS-OPS-W-C-TIMEOUT-BUDGETS-DESIGN.md §3 (a PROPOSAL until
//   production P99 measurement lands).
//
// CONTRACT
//   · Default values match the design proposal (T-1 30s · T-3 10s · T-4 60s).
//   · Every non-zero value is clamped to a sanity range · out-of-range values
//     fall back to the default (silent to callers · warn to console once).
//   · T-6 / T-7 default to 0 (DISABLED) so worker cycles / jobs remain uncapped
//     until per-worker-type P99 data supports a value. Operators opt in with
//     an explicit env-var value.
//
// SAFETY
//   · No side effects at import time · every reader is a pure function of the
//     environment (or an injected `env` object for tests).
//   · Never throws on missing env vars · returns defaults.
//
// See §4.1 of the design doc for the sanity ranges + rationale.

export type TimeoutClass =
  | "statement"
  | "pool_acquire"
  | "idle_transaction"
  | "worker_cycle"
  | "job_budget";

export type TimeoutErrorCode =
  | "timeout-statement"
  | "timeout-pool-acquire"
  | "timeout-idle-transaction"
  | "timeout-worker-cycle"
  | "timeout-job-budget";

export class TimeoutError extends Error {
  readonly code: TimeoutErrorCode;
  readonly timeout_class: TimeoutClass;
  readonly budget_ms: number;
  constructor(cls: TimeoutClass, budget_ms: number, message?: string) {
    const code = `timeout-${cls.replace(/_/g, "-")}` as TimeoutErrorCode;
    super(message ?? `${code} · budget ${budget_ms}ms exceeded`);
    this.name = "TimeoutError";
    this.code = code;
    this.timeout_class = cls;
    this.budget_ms = budget_ms;
  }
}

export function isTimeoutError(x: unknown): x is TimeoutError {
  return x instanceof TimeoutError
    || (typeof x === "object" && x !== null && typeof (x as { code?: unknown }).code === "string"
        && (x as { code: string }).code.startsWith("timeout-"));
}

// Injection point for tests · production callers pass no argument.
export type TimeoutEnv = {
  NEX_PG_STATEMENT_TIMEOUT_MS?: string;
  NEX_PG_CONNECTION_TIMEOUT_MS?: string;
  NEX_PG_IDLE_TX_TIMEOUT_MS?: string;
  NEX_WORKER_CYCLE_DEADLINE_MS?: string;
  NEX_WORKER_JOB_BUDGET_MS?: string;
};

type SanityRange = { min: number; max: number };

const DEFAULTS = {
  NEX_PG_STATEMENT_TIMEOUT_MS: 30_000,     // T-1 · 30s
  NEX_PG_CONNECTION_TIMEOUT_MS: 10_000,    // T-3 · 10s
  NEX_PG_IDLE_TX_TIMEOUT_MS: 60_000,       // T-4 · 60s
  NEX_WORKER_CYCLE_DEADLINE_MS: 0,         // T-6 · DISABLED until per-worker P99 lands
  NEX_WORKER_JOB_BUDGET_MS: 0,             // T-7 · DISABLED (same rationale)
} as const;

const RANGES: Record<keyof typeof DEFAULTS, SanityRange> = {
  NEX_PG_STATEMENT_TIMEOUT_MS: { min: 1000, max: 600_000 },    // 1s – 10m
  NEX_PG_CONNECTION_TIMEOUT_MS: { min: 1000, max: 60_000 },    // 1s – 60s
  NEX_PG_IDLE_TX_TIMEOUT_MS: { min: 1000, max: 600_000 },      // 1s – 10m
  NEX_WORKER_CYCLE_DEADLINE_MS: { min: 60_000, max: 3_600_000 }, // 1m – 60m (or 0 = disabled)
  NEX_WORKER_JOB_BUDGET_MS: { min: 30_000, max: 1_800_000 },   // 30s – 30m (or 0 = disabled)
};

// One-time warning tracking so a bad env var doesn't spam the log.
const warned = new Set<string>();

function readEnv(env?: TimeoutEnv): TimeoutEnv {
  return env ?? (process.env as TimeoutEnv);
}

function resolve(
  name: keyof typeof DEFAULTS,
  env?: TimeoutEnv,
  { allowZero }: { allowZero: boolean } = { allowZero: false },
): number {
  const raw = readEnv(env)[name];
  if (raw === undefined || raw === null || raw === "") return DEFAULTS[name];
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[nex-timeouts] ${name}="${raw}" is not a non-negative number · falling back to default ${DEFAULTS[name]}`);
    }
    return DEFAULTS[name];
  }
  if (n === 0) return allowZero ? 0 : DEFAULTS[name];
  const range = RANGES[name];
  if (n < range.min || n > range.max) {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[nex-timeouts] ${name}=${n}ms is outside sanity range [${range.min}, ${range.max}]ms · falling back to default ${DEFAULTS[name]}`);
    }
    return DEFAULTS[name];
  }
  return n;
}

/** T-1 · Postgres server-side per-statement cap (ms). */
export function statementTimeoutMs(env?: TimeoutEnv): number {
  return resolve("NEX_PG_STATEMENT_TIMEOUT_MS", env);
}

/** T-3 · pool-acquisition cap (ms). */
export function connectionTimeoutMs(env?: TimeoutEnv): number {
  return resolve("NEX_PG_CONNECTION_TIMEOUT_MS", env);
}

/** T-4 · Postgres server-side idle-in-transaction cap (ms). */
export function idleInTransactionTimeoutMs(env?: TimeoutEnv): number {
  return resolve("NEX_PG_IDLE_TX_TIMEOUT_MS", env);
}

/** T-6 · worker cycle deadline (ms). Returns 0 when disabled. */
export function workerCycleDeadlineMs(env?: TimeoutEnv): number {
  return resolve("NEX_WORKER_CYCLE_DEADLINE_MS", env, { allowZero: true });
}

/** T-7 · per-job budget (ms). Returns 0 when disabled. */
export function jobBudgetMs(env?: TimeoutEnv): number {
  return resolve("NEX_WORKER_JOB_BUDGET_MS", env, { allowZero: true });
}

/** Snapshot of every value for observability endpoints. */
export function snapshotTimeouts(env?: TimeoutEnv): Record<string, number> {
  return {
    statement_timeout_ms: statementTimeoutMs(env),
    connection_timeout_ms: connectionTimeoutMs(env),
    idle_in_transaction_timeout_ms: idleInTransactionTimeoutMs(env),
    worker_cycle_deadline_ms: workerCycleDeadlineMs(env),
    job_budget_ms: jobBudgetMs(env),
  };
}

/** TEST-ONLY · reset one-time warnings so repeated tests can re-observe them. */
export function _resetWarnedForTests(): void {
  warned.clear();
}
