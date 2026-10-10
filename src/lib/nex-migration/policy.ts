// NEX Migration Engine · policy layer
// Deterministic rejection of unsafe DDL patterns and unsafe SQL identifiers.
// Runs BEFORE any statement is generated — never as a suggestion an agent
// might override. Every rejection carries evidence.

import type { PolicyRejection } from "./types";

// A SQL identifier we're willing to emit into DDL. Matches PostgreSQL and
// SQLite common practice: starts with letter or underscore · letters, digits,
// underscores only. NO quoted identifiers accepted — protects against
// injection via strings like `users"; DROP TABLE users; --`.
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

// Destructive keywords the PM/Migration-Reviewer must reject upstream. We
// re-enforce here so a malformed prompt that bypassed the agent still cannot
// materialise a destructive statement from this engine.
const DESTRUCTIVE_PATTERNS: readonly { rx: RegExp; label: string }[] = [
  { rx: /\bDROP\s+TABLE\b/i, label: "DROP TABLE" },
  { rx: /\bDROP\s+COLUMN\b/i, label: "DROP COLUMN" },
  { rx: /\bDROP\s+INDEX\b/i, label: "DROP INDEX" },
  { rx: /\bTRUNCATE\b/i, label: "TRUNCATE" },
  { rx: /\bDELETE\s+FROM\b(?![\s\S]*\bWHERE\b)/i, label: "DELETE FROM without WHERE" },
];

export function isSafeIdentifier(id: string): boolean {
  return SAFE_IDENTIFIER.test(id);
}

/** Assert an identifier is safe or throw with a specific message. */
export function assertSafeIdentifier(id: string, role: string): void {
  if (!isSafeIdentifier(id)) {
    throw new Error(`nex-migration: unsafe ${role} identifier: ${JSON.stringify(id)}`);
  }
}

/**
 * Scan an arbitrary text buffer (a Founder prompt · a spec · a candidate DDL
 * statement) for destructive keywords. Used defensively before ledger writes
 * and by the migration reviewer.
 */
export function scanForDestructive(input: string): readonly PolicyRejection[] {
  const rejections: PolicyRejection[] = [];
  for (const p of DESTRUCTIVE_PATTERNS) {
    const m = input.match(p.rx);
    if (m) {
      rejections.push({
        kind: "DESTRUCTIVE_KEYWORD",
        reason: `${p.label} is not permitted by the NEX migration policy`,
        evidence: m[0],
      });
    }
  }
  return rejections;
}
