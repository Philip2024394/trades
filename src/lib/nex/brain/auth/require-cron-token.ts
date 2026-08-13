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

export type CronAuthOk    = { ok: true; auth_mode?: "bearer" | "hmac" | "dev_open" };
export type CronAuthDeny  = { ok: false; status: 401 | 500; code: "unauthorized" | "misconfigured" | "hmac_expired" | "hmac_invalid"; message: string };
export type CronAuthResult = CronAuthOk | CronAuthDeny;

/**
 * Minimal request shape the checker needs. NextRequest satisfies this,
 * so does any test fake that exposes a `headers.get()` method.
 *
 * F14 · HMAC mode also reads `method` and either `pathname` from a
 * URL-like object OR `url` string, since HMAC signs "method + path".
 * Both are optional; if omitted, HMAC verification is skipped and only
 * the bearer path is exercised.
 */
export type RequestLike = {
  headers: { get(name: string): string | null };
  method?: string;
  url?: string;
  nextUrl?: { pathname: string };
};

/**
 * Injectable environment for tests. In production this reads
 * process.env; tests can pass an explicit object.
 *
 * D4 · Scoped cron tokens. When `checkCronAuth(req, env, { scope })` is
 * called, the checker looks for `CRON_SECRET_<SCOPE>` in the env FIRST.
 * If present, only that scoped token can authorise this endpoint —
 * rotating one scope's key doesn't require touching every other
 * endpoint. If the scoped env var is absent, the shared tokens
 * (CRON_SECRET / NEX_BRAIN_CRON_TOKEN) apply as before.
 *
 * Scope normalisation: uppercased, hyphens/dots → underscores. So
 * `scope: "brain-cycle"` reads `CRON_SECRET_BRAIN_CYCLE`.
 */
export type CronAuthEnv = {
  NODE_ENV?: string;
  CRON_SECRET?: string;
  NEX_BRAIN_CRON_TOKEN?: string;
  // Scoped tokens live at CRON_SECRET_<SCOPE> · read reflectively.
  [envKey: string]: string | undefined;
};

export type CronAuthOptions = {
  /** D4 · optional scope name · reads `CRON_SECRET_<SCOPE>` first. */
  scope?: string;
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
export function checkCronAuth(req: RequestLike, env: CronAuthEnv = process.env, opts: CronAuthOptions = {}): CronAuthResult {
  const isProd = env.NODE_ENV === "production";
  // D4 · scoped token overrides. When `opts.scope` is set AND
  // `CRON_SECRET_<SCOPE>` exists, only that key can auth this endpoint.
  // Otherwise fall through to shared tokens as before.
  const scopedKey = opts.scope
    ? `CRON_SECRET_${opts.scope.replace(/[-.]/g, "_").toUpperCase()}`
    : null;
  const scopedSecret = scopedKey ? (env[scopedKey] ?? "") : "";
  const hasScoped = scopedSecret.length > 0;

  const vercelSecret = env.CRON_SECRET ?? "";
  const brainToken   = env.NEX_BRAIN_CRON_TOKEN ?? "";
  // When a scoped secret is present, it TAKES OVER for this call —
  // rotating one scope's key must not silently fall back to the shared
  // key (that would defeat the purpose). When scoped is absent, the
  // shared tokens are the active tokens.
  const activeTokens: string[] = hasScoped
    ? [scopedSecret]
    : [vercelSecret, brainToken].filter((s) => s.length > 0);
  const hasVercel    = !hasScoped && vercelSecret.length > 0;
  const hasBrain     = !hasScoped && brainToken.length > 0;
  const anyConfigured = hasScoped || hasVercel || hasBrain;

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

  // F14 · HMAC mode. If the caller supplies X-Signature + X-Timestamp,
  // verify the HMAC first. Present-but-invalid HMAC denies (never falls
  // through to bearer — falling through would defeat the stronger auth).
  // Present-and-valid HMAC allows regardless of bearer.
  const sigHeader = req.headers.get("x-signature") ?? "";
  const tsHeader  = req.headers.get("x-timestamp") ?? "";
  if (sigHeader && tsHeader) {
    const hmacResult = verifyHmac({
      sigHeader,
      tsHeader,
      method: req.method ?? "GET",
      path:   extractPath(req),
      // D4 · when a scope is active, only the scoped secret is a valid
      // HMAC signing key. When no scope, both shared tokens qualify.
      secrets: activeTokens,
    });
    if (hmacResult.ok) return { ok: true, auth_mode: "hmac" };
    return hmacResult; // hmac_expired | hmac_invalid
  }

  // Bearer path (Vercel Cron, historical external callers).
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const cronHeader = req.headers.get("x-brain-cron-token") ?? "";

  // D4 · when a scope is active, only the scoped token is a match.
  const scopedMatch = hasScoped && (bearer === scopedSecret || cronHeader === scopedSecret);
  const vercelMatch = hasVercel && bearer === vercelSecret;
  const brainMatch  = hasBrain  && (bearer === brainToken || cronHeader === brainToken);

  if (scopedMatch || vercelMatch || brainMatch) return { ok: true, auth_mode: "bearer" };

  return {
    ok: false,
    status: 401,
    code: "unauthorized",
    message: "missing or invalid cron token",
  };
}

// ── F14 · HMAC verification ─────────────────────────────────────────
// Signing scheme:
//   sig = "sha256=" + hex( HMAC-SHA256(secret, `${ts}.${METHOD}.${path}`) )
//   where ts is Unix seconds (integer, UTC) and METHOD is uppercase.
// Replay window: |now - ts| must be ≤ 300 seconds (5 min).
//
// The signature is compared against every configured secret using
// timing-safe equality — if either the vercel secret or the brain
// token matches, the request is allowed. That preserves the "either
// token works" semantics of the bearer path.

const HMAC_REPLAY_WINDOW_SEC = 300;
const HMAC_PREFIX = "sha256=";

function extractPath(req: RequestLike): string {
  if (req.nextUrl && typeof req.nextUrl.pathname === "string") return req.nextUrl.pathname;
  if (typeof req.url === "string") {
    try { return new URL(req.url).pathname; } catch { /* fallthrough */ }
  }
  return "";
}

function verifyHmac(input: {
  sigHeader: string;
  tsHeader: string;
  method: string;
  path: string;
  secrets: string[];
}): CronAuthResult {
  if (!input.sigHeader.startsWith(HMAC_PREFIX)) {
    return { ok: false, status: 401, code: "hmac_invalid", message: "X-Signature missing sha256= prefix" };
  }
  const providedHex = input.sigHeader.slice(HMAC_PREFIX.length);
  if (!/^[0-9a-fA-F]+$/.test(providedHex) || providedHex.length !== 64) {
    return { ok: false, status: 401, code: "hmac_invalid", message: "X-Signature not 64-char hex" };
  }
  const ts = Number(input.tsHeader);
  if (!Number.isFinite(ts) || !Number.isInteger(ts)) {
    return { ok: false, status: 401, code: "hmac_invalid", message: "X-Timestamp not an integer" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > HMAC_REPLAY_WINDOW_SEC) {
    return { ok: false, status: 401, code: "hmac_expired", message: `X-Timestamp outside ±${HMAC_REPLAY_WINDOW_SEC}s window` };
  }
  const message = `${ts}.${input.method.toUpperCase()}.${input.path}`;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require("node:crypto") as typeof import("node:crypto");
  for (const secret of input.secrets) {
    if (!secret) continue;
    const expected = createHmac("sha256", secret).update(message).digest();
    const provided = Buffer.from(providedHex, "hex");
    if (expected.length !== provided.length) continue;
    if (timingSafeEqual(expected, provided)) return { ok: true, auth_mode: "hmac" };
  }
  return { ok: false, status: 401, code: "hmac_invalid", message: "X-Signature does not match any configured secret" };
}

/**
 * Helper that constructs the standard error response body from a
 * denial result. Kept as a separate helper so callers can log
 * differently (e.g. warn on misconfigured, info on unauthorized)
 * before responding.
 */
export function cronAuthErrorBody(deny: CronAuthDeny): { ok: false; error: string; detail?: string } {
  // F14 · propagate the detail message for HMAC failures so operators
  // can diagnose without server logs (e.g. "X-Timestamp outside ±300s window").
  if (deny.code === "hmac_expired" || deny.code === "hmac_invalid") {
    return { ok: false, error: deny.code, detail: deny.message };
  }
  return { ok: false, error: deny.code };
}
