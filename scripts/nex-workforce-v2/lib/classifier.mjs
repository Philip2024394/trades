// NEX Workforce v2 · Slice 1c · Failure Classifier
// ─────────────────────────────────────────────────────────────────────────────
// Classifies a step's exception/result into one of the doctrine's action classes.
// Default policy is defense-in-depth: unknown class → catastrophic (safe fail).
//
// A step-library may register domain-specific rules by passing a `customRules`
// array to `classify()`. Each rule is { match(err) → boolean, class, reason }.
//
// Classes (locked doctrine):
//   ok            → step succeeded
//   transient     → network blip / DB timeout / retryable error
//   rate_limit    → 429 / quota exceeded
//   partial       → one item in the batch failed but others may succeed
//   permanent     → one item is bad, dead-letter it, continue with others
//   lease_lost    → heartbeat returned false, agent must abort immediately
//   catastrophic  → OOM / DB down / config invalid — stop heartbeat, exit

export const FailureClass = Object.freeze({
  OK:                  "ok",
  TRANSIENT:           "transient",
  RATE_LIMIT:          "rate_limit",
  PARTIAL:             "partial",
  PERMANENT:           "permanent",
  LEASE_LOST:          "lease_lost",
  CATASTROPHIC:        "catastrophic",
  // Added Slice 1f (Philip 2026-09-04 correction #1):
  // Retries were exhausted on a transient/rate_limit failure. Distinct from
  // catastrophic — the external source is misbehaving, our code is fine.
  // Agent routes this to fail_soft with bounded backoff · NEVER to complete
  // with fabricated records_rejected.
  TRANSIENT_EXHAUSTED: "transient_exhausted",
});

const isNetworkTransient = (err) => {
  if (!err) return false;
  const code = err.code || err.cause?.code;
  if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "ECONNREFUSED"].includes(code)) return true;
  if (err.name === "AbortError") return true;
  const status = err.status ?? err.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  return false;
};

const isRateLimit = (err) => {
  const status = err?.status ?? err?.response?.status;
  return status === 429;
};

const isDbTimeout = (err) => {
  // pg client statement/query timeouts
  return err?.code === "57014"     // query_canceled (statement_timeout)
      || err?.message?.includes("query_timeout")
      || err?.message?.includes("statement timeout");
};

const isConfigOrOOM = (err) => {
  if (!err) return false;
  const code = err.code || err.cause?.code;
  if (code === "ENOMEM") return true;
  if (err.name === "ConfigError") return true;
  if (err.message?.includes("Cannot find module")) return true;
  return false;
};

// classify(err, { customRules = [], consecutiveDbTimeouts = 0 })
export function classify(err, ctx = {}) {
  if (err === null || err === undefined) {
    return { class: FailureClass.OK, reason: null };
  }

  // Special sentinel: heartbeat returned false → lease lost
  if (err === LEASE_LOST_SENTINEL || err?.__leaseLost === true) {
    return { class: FailureClass.LEASE_LOST, reason: "heartbeat returned false" };
  }

  // Custom rules run first · step-library authoritative for its domain
  for (const rule of ctx.customRules ?? []) {
    if (rule.match(err)) {
      return { class: rule.class, reason: rule.reason ?? rule.match.name };
    }
  }

  if (isConfigOrOOM(err)) return { class: FailureClass.CATASTROPHIC, reason: "config or OOM" };
  if (isRateLimit(err))    return { class: FailureClass.RATE_LIMIT, reason: `HTTP 429`, retryAfterSec: parseRetryAfter(err) };
  if (isDbTimeout(err)) {
    // Third consecutive DB timeout → catastrophic (DB is unhealthy)
    if ((ctx.consecutiveDbTimeouts ?? 0) >= 2) {
      return { class: FailureClass.CATASTROPHIC, reason: "3+ consecutive DB timeouts" };
    }
    return { class: FailureClass.TRANSIENT, reason: "DB timeout" };
  }
  if (isNetworkTransient(err)) return { class: FailureClass.TRANSIENT, reason: `network: ${err.code || err.name}` };

  // Unknown → catastrophic (safe default per doctrine)
  return { class: FailureClass.CATASTROPHIC, reason: `unclassified: ${err.name || err.constructor?.name}: ${err.message}` };
}

function parseRetryAfter(err) {
  const h = err?.response?.headers?.["retry-after"] ?? err?.headers?.["retry-after"];
  if (!h) return null;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.min(n, 60);
  return null;
}

// Sentinel used by heartbeat manager to signal lease loss to the work loop
export const LEASE_LOST_SENTINEL = Symbol.for("nex_workforce.lease_lost");

export class LeaseLostError extends Error {
  constructor() {
    super("lease lost · heartbeat returned false");
    this.name = "LeaseLostError";
    this.__leaseLost = true;
  }
}
