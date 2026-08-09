// src/lib/nex/api/error-envelope.ts
//
// Wave 11 remediation · closes F24 (leaky error responses).
//
// Every API route that surfaces an error to a client MUST route through
// toClientError() rather than returning `err.message` directly.
//
// The problem being fixed:
//   Multiple routes returned `{ error: err.message }` where err.message
//   commonly contains:
//     · absolute filesystem paths (ENOENT: /data/nex-brains/...)
//     · database error text with column/schema names
//     · provider credentials embedded in URLs
//     · stack traces via toString on nested errors
//
//   Any of these leaks pieces of the internal architecture to callers,
//   including unauthenticated ones.
//
// The design:
//   · Client receives a stable safe CODE (e.g. "read_failed") + a
//     correlation_id so support/ops can find the full detail in logs.
//   · Server logs the FULL error object with the correlation_id.
//   · No message text ever crosses the API boundary unless it is on
//     the explicit safe-code allowlist.

import { randomBytes } from "node:crypto";

export type ClientError = {
  ok: false;
  error: string;
  correlation_id: string;
};

// Codes that are safe to surface to clients. Free-form only if the
// caller passes { safeMessage: "..." } (see toClientError options).
const SAFE_CODES = new Set<string>([
  "internal_error",
  "read_failed",
  "write_failed",
  "not_found",
  "invalid_json",
  "invalid_body",
  "invalid_param",
  "invalid_status",
  "unauthorized",
  "misconfigured",
  "path_escape",
  "unknown_brain",
  "provider_unavailable",
  "rate_limited",
  "conflict",
  "not_queued",
  "no_files",
  "invalid_form",
  "job_not_found",
  "already_routed",
  "no_target_brains",
  "run_failed",
]);

function newCorrelationId(): string {
  // 12-char base36-ish id · short enough for humans, long enough for uniqueness.
  return randomBytes(6).toString("hex");
}

function coerceSafeCode(code: unknown, fallback: string): string {
  if (typeof code !== "string") return fallback;
  const trimmed = code.trim();
  if (!trimmed) return fallback;
  // Allow only known safe codes. Unknown codes collapse to the fallback
  // so a rogue thrown error can't leak its message via `err.code`.
  if (SAFE_CODES.has(trimmed)) return trimmed;
  return fallback;
}

export type ToClientErrorOptions = {
  /** The default code emitted when err.code is missing or unknown. */
  defaultCode?: string;
  /**
   * A tag identifying the route/subsystem. Prefixed to the server-side
   * log for grep-ability. Not surfaced to the client.
   */
  logTag?: string;
};

/**
 * Convert an internal error into a safe client-facing envelope.
 *
 * Full detail (including the raw err object) is logged to console.error
 * with the correlation_id, so operators can trace an incident from a
 * client-reported id back to the full stack.
 */
export function toClientError(err: unknown, opts: ToClientErrorOptions = {}): ClientError {
  const correlation_id = newCorrelationId();
  const tag = opts.logTag ? `[${opts.logTag}] ` : "";
  const rawCode = (err as { code?: unknown } | null)?.code;
  const code = coerceSafeCode(rawCode, opts.defaultCode ?? "internal_error");

  // Server-side log · this line contains the raw error + correlation id.
  // NEVER omit or truncate — grep-ability is the point.
  // eslint-disable-next-line no-console
  console.error(`${tag}correlation=${correlation_id} code=${code}`, err);

  return { ok: false, error: code, correlation_id };
}

/**
 * Test helper · exposed so tests can assert the safe-code allowlist
 * without duplicating the set here.
 */
export function _safeCodesForTests(): ReadonlySet<string> {
  return SAFE_CODES;
}
