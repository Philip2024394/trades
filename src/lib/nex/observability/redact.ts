// src/lib/nex/observability/redact.ts
//
// E9 · Sensitive-data redaction helper.
//
// Compliance-audit finding: Event Bus payloads are spread as-is, so a
// future caller could accidentally leak API keys / passwords / emails
// / phone numbers into audit rows. This helper walks any JSON-shaped
// value and replaces sensitive keys with the marker string
// "[REDACTED]".
//
// Sensitive-key detection is heuristic (regex on the key name), not
// content-aware. Callers who need stronger guarantees (e.g., masking
// email addresses inside a free-text `message` field) must layer their
// own logic on top.
//
// USAGE
//   emitAuditEvent({ ..., details: redactSensitiveData(rawDetails) });

const KEY_RE = /^(email|phone|apikey|api_key|secret|token|password|passwd|authorization|auth_header|bearer|cookie|session|jwt|refresh_token|access_token|private_key|service_role_key|stripe.*key)$/i;
const REDACTED = "[REDACTED]";

/** Recursively walk a value and redact fields whose key matches KEY_RE.
 *  Non-object values pass through unchanged. Arrays are traversed element-wise. */
export function redactSensitiveData<T>(value: T): T {
  return _walk(value) as T;
}

function _walk(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.map(_walk);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, sub] of Object.entries(v as Record<string, unknown>)) {
      if (KEY_RE.test(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = _walk(sub);
      }
    }
    return out;
  }
  return v; // primitives (string, number, boolean, bigint) pass through
}

/** Exposed for tests. */
export const _REDACT_KEY_RE_FOR_TESTS = KEY_RE;
