// src/lib/nex/brain/auth/require-cron-token.ts
//
// Shared cron-authentication boundary for every endpoint that drives
// the NEX brain pipeline (cron-tick, run-once, and future brain-cycle
// triggers).
//
// Wave 11 remediation · closes F14 · F15 · F30.
//
// The design goal is a SINGLE authentication contract for every
// pipeline-triggering endpoint — no per-route bespoke logic. Both routes
// used to implement their own auth block with slightly different rules,
// and both had the same defect: in a production deploy where the
// operator forgot to set the required env vars, the endpoint was
// silently open.
//
// INVARIANT · MUST HOLD IN PRODUCTION
//
//   NODE_ENV === "production" AND (CRON_SECRET is set OR NEX_BRAIN_CRON_TOKEN is set)
//     AND the request supplies a matching token
//
// If the first half (at least one env var set) is false in production,
// the endpoint fails-closed with 500 misconfigured — the deploy is
// broken and we refuse to serve rather than accept anonymous traffic.
//
// If the request does not carry a matching token when tokens ARE set,
// the endpoint returns 401 unauthorized.
//
// DEVELOPMENT CONVENIENCE · MUST HOLD IN NON-PRODUCTION
//
//   NODE_ENV !== "production" AND both env vars unset
//     → allow (with a one-time warn log so the developer notices)
//
// This is the behaviour that made these routes convenient to test
// locally; F14/F15's problem was NOT the dev behaviour, it was the
// production behaviour. We preserve the dev convenience.
//
// If EITHER token is set in dev, the check is enforced. A developer
// who wants to test the auth path just sets one of the vars.

export type CronAuthOk    = { ok: true };
export type CronAuthDeny  = { ok: false; status: 401 | 500; code: "unauthorized" | "misconfigured"; message: string };
export type CronAuthResult = CronAuthOk | CronAuthDeny;

/**
 * Minimal request shape the checker needs. NextRequest satisfies this,
 * so does any test fake that exposes a `headers.get()` method.
 */
export type RequestLike = {
  headers: { get(name: string): string | null };
};

/**
 * Injectable environment for tests. In production this reads
 * process.env; tests can pass an explicit object.
 */
export type CronAuthEnv = {
  NODE_ENV?: string;
  CRON_SECRET?: string;
  NEX_BRAIN_CRON_TOKEN?: string;
};

// One-time-per-process dev warning latch. We warn the FIRST time a
// request slips through without any configured token in a non-prod
// environment, so the developer knows the endpoint is open. Warning
// again on every request would be spam.
let devOpenWarningEmitted = false;

// Test hook · resets the latch so tests can assert the warning fires
// again for a fresh scenario.
export function _resetDevOpenWarningForTests(): void {
  devOpenWarningEmitted = false;
}

/**
 * Check whether the incoming request satisfies cron authentication
 * under the current environment. Pure function · no side effects
 * except the one-time dev warn log.
 */
export function checkCronAuth(req: RequestLike, env: CronAuthEnv = process.env): CronAuthResult {
  const isProd = env.NODE_ENV === "production";
  const vercelSecret = env.CRON_SECRET ?? "";
  const brainToken   = env.NEX_BRAIN_CRON_TOKEN ?? "";
  const hasVercel    = vercelSecret.length > 0;
  const hasBrain     = brainToken.length > 0;
  const anyConfigured = hasVercel || hasBrain;

  // Production fail-closed: at least one token MUST be configured.
  if (isProd && !anyConfigured) {
    return {
      ok: false,
      status: 500,
      code: "misconfigured",
      message: "NEX brain cron endpoint requires CRON_SECRET or NEX_BRAIN_CRON_TOKEN in production",
    };
  }

  // Dev convenience: if nothing is configured, warn ONCE and allow.
  if (!isProd && !anyConfigured) {
    if (!devOpenWarningEmitted) {
      devOpenWarningEmitted = true;
      console.warn(
        "[NEX cron-auth] running with no CRON_SECRET / NEX_BRAIN_CRON_TOKEN configured. " +
        "This is fine for local dev but MUST NOT reach production. " +
        "The brain pipeline endpoints are unauthenticated in this environment.",
      );
    }
    return { ok: true };
  }

  // At least one token is configured (in dev or prod). Enforce match.
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const cronHeader = req.headers.get("x-brain-cron-token") ?? "";

  const vercelMatch = hasVercel && bearer === vercelSecret;
  const brainMatch  = hasBrain  && (bearer === brainToken || cronHeader === brainToken);

  if (vercelMatch || brainMatch) return { ok: true };

  return {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "missing or invalid cron token",
  };
}

/**
 * Helper that constructs the standard error response body from a
 * denial result. Kept as a separate helper so callers can log
 * differently (e.g. warn on misconfigured, info on unauthorized)
 * before responding.
 */
export function cronAuthErrorBody(deny: CronAuthDeny): { ok: false; error: string } {
  return { ok: false, error: deny.code };
}
