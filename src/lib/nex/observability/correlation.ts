// src/lib/nex/observability/correlation.ts
//
// W-OBS-1 Path A Layer 1 · correlation-ID threading through
// request → worker → audit chain.
//
// Provides three helpers:
//   · getCorrelationId()                       — read current CID (null outside scope)
//   · runWithCorrelationId(cid, fn)            — establish CID scope
//   · runFromRequest(req, opts?, fn)           — resolve CID from HTTP request
//
// Backed by node:async_hooks AsyncLocalStorage. Works in Node.js runtime
// only (Next.js API routes with `runtime: "nodejs"`). Edge-runtime
// route handlers cannot use ALS — the middleware (which does run in
// edge) is responsible ONLY for setting the request+response header ·
// the ALS scope is established later inside a Node route handler.
//
// F12 boundary check · this file lives under observability/, not
// storage/. Brain adapters may import getCorrelationId to attach CID
// to audit rows without violating AI4 (no cross-runtime import).
//
// Explicit CID always wins over ALS. When emitSignal or any audit
// emitter is called with an explicit correlation_id, that value is
// used verbatim. ALS is a FALLBACK, never an override. This preserves
// existing journeys/attribution/error-envelope semantics — see
// §11 of WORLD-CLASS-OPS-W-OBS-1-PATH-A-PLAN.md.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

// ── Module-scoped singleton ─────────────────────────────────────────
// CADP3 requires exactly one ALS instance across src/lib/nex/**.
// Do NOT construct another one elsewhere · use these helpers.

const correlationStore = new AsyncLocalStorage<string>();

// ── Format validation ───────────────────────────────────────────────
// CID must match /^[A-Za-z0-9-]{16,64}$/ to cover UUIDv4 (36), UUIDv7
// (36), ULID (26), and existing journey format prefixes like
// `analytics:${event_id}` (colon rejected · journeys' explicit CIDs
// bypass validation because they never pass through this helper —
// they are set directly on the signal payload · see plan §11).

const CID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

export function isValidCorrelationId(v: unknown): v is string {
  return typeof v === "string" && CID_PATTERN.test(v);
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Read the current CID from the ambient AsyncLocalStorage scope.
 * Returns null outside any scope (documented degradation · not an
 * error). Callers MUST treat null as "no CID available" rather than
 * synthesizing one — a caller synthesizing here would break the
 * "explicit CID wins" invariant.
 */
export function getCorrelationId(): string | null {
  const cid = correlationStore.getStore();
  return typeof cid === "string" && cid.length > 0 ? cid : null;
}

/**
 * Establish a CID scope for the duration of fn().
 *
 * Nested calls: the innermost scope wins for reads made within it.
 * When the inner fn returns, the outer scope is restored automatically.
 *
 * Async: ALS follows await chains and microtask queues. Parallel
 * `Promise.all([...])` inside the scope all see the same CID.
 * Explicit worker-thread spawning does NOT inherit (not used in NEX).
 *
 * The provided cid is used verbatim · validation is the caller's
 * responsibility (typically runFromRequest handles format validation).
 * runWithCorrelationId is the low-level primitive · use runFromRequest
 * for HTTP boundaries.
 */
export function runWithCorrelationId<T>(cid: string, fn: () => T): T {
  return correlationStore.run(cid, fn);
}

// ── HTTP request integration ────────────────────────────────────────

export interface RunFromRequestOptions {
  /**
   * When true, an inbound `x-request-id` header is TRUSTED if it
   * passes format validation. When false (default), inbound headers
   * are always overwritten with a fresh CID.
   *
   * Trust matrix (per plan §4):
   *   · public-facing routes         → false (default · overwrite)
   *   · cron routes (post-token-check) → true
   *   · Vercel Cron platform         → true
   *   · service-to-service           → true (once auth verified)
   *
   * Format validation runs BEFORE trust check — a malformed inbound
   * CID is regenerated even from a trusted source.
   */
  trustInbound?: boolean;
}

/**
 * Resolve the CID for an inbound HTTP request and establish an
 * AsyncLocalStorage scope for the handler body.
 *
 * Rules (plan §3 · §4):
 *   1. Read the `x-request-id` request header (case-insensitive)
 *   2. Validate against CID_PATTERN
 *   3. If valid AND trustInbound=true → adopt inbound
 *   4. Otherwise → generate a fresh crypto.randomUUID()
 *   5. Establish ALS scope wrapping fn()
 *
 * The route handler wraps its body:
 *   export async function GET(req: NextRequest) {
 *     return runFromRequest(req, async () => {
 *       // handler body reads getCorrelationId() as needed
 *     });
 *   }
 *
 * The wrapper does NOT set the response header — that is the
 * middleware's job (route handlers may or may not run · middleware
 * always does · setting the header at the edge guarantees the client
 * always sees it in the response).
 */
export function runFromRequest<T>(
  req: { headers: { get(name: string): string | null } },
  optsOrFn: RunFromRequestOptions | (() => T),
  maybeFn?: () => T,
): T {
  const opts: RunFromRequestOptions =
    typeof optsOrFn === "function" ? {} : optsOrFn;
  const fn: () => T =
    typeof optsOrFn === "function" ? optsOrFn : (maybeFn as () => T);

  const inbound = req.headers.get("x-request-id");
  let cid: string;

  if (isValidCorrelationId(inbound) && opts.trustInbound === true) {
    cid = inbound;
  } else {
    cid = randomUUID();
  }

  return correlationStore.run(cid, fn);
}

// ── Test/introspection helpers ──────────────────────────────────────

/**
 * Test-only · reads whether ALS scope is currently active without
 * exposing the CID value. Used by drift-catchers to prove that a
 * given code path IS scoped, without leaking the value.
 */
export function _hasCorrelationScopeForTests(): boolean {
  return correlationStore.getStore() !== undefined;
}

// ── Worker CID inheritance ──────────────────────────────────────────

/**
 * Extract the correlation-ID from a worker job's input_payload and
 * establish an ALS scope for the duration of fn(). If the job has
 * no correlation_id (legacy · non-HTTP-triggered · older row) fn()
 * runs without a scope — signals emitted downstream fall back to
 * the null/absent CID branch (documented degradation · not an error).
 *
 * Callable-wrapper form. Prefer `enterJobCorrelationScope(job)` for
 * minimal-touch worker integration where wrapping the entire remaining
 * function body is impractical.
 */
export function withJobCorrelation<T>(
  job: { input_payload?: Record<string, unknown> | null } | null | undefined,
  fn: () => T,
): T {
  const payload = job?.input_payload;
  const cid = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).correlation_id
    : undefined;
  if (typeof cid === "string" && cid.length > 0) {
    return correlationStore.run(cid, fn);
  }
  return fn();
}

/**
 * Minimal-touch variant of `withJobCorrelation` for worker files.
 * Uses `AsyncLocalStorage.enterWith(cid)` which sets the store for
 * the CURRENT async execution context and all subsequent awaits in
 * that context (no fn wrapping needed).
 *
 *   const job = await store.claimNextJob(...);
 *   if (!job) return null;
 *   enterJobCorrelationScope(job);      // one line · everything downstream inherits
 *   try {
 *     // ...existing worker body unchanged...
 *   }
 *
 * When job has no correlation_id · this is a no-op · legacy behavior
 * preserved.
 */
export function enterJobCorrelationScope(
  job: { input_payload?: Record<string, unknown> | null } | null | undefined,
): void {
  const payload = job?.input_payload;
  const cid = payload && typeof payload === "object"
    ? (payload as Record<string, unknown>).correlation_id
    : undefined;
  if (typeof cid === "string" && cid.length > 0) {
    correlationStore.enterWith(cid);
  }
}
