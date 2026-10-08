// scripts/nex-canonical/secret-scan.ts
//
// Pure shared utility · credential/secret pattern scanner.
// No DB · no network · no filesystem · no environment reads.
//
// Previously lived inside extract-candidates.ts. Extracted here so both
// the producer surface (extract-candidates.ts) and the consumer surface
// (candidate-approval.ts) can import the same patterns without reopening
// any sealed boundary.
//
// Behavioural contract
//   · Input: an arbitrary string of untrusted content.
//   · Output: a readonly list of pattern NAMES (e.g. "password-pair")
//     for every pattern that fired against the input.
//   · The scanner is a defensive signal, not a scrubber · callers decide
//     whether to refuse, redact, or warn.
//   · Patterns are frozen at module load · no runtime mutation.

export const CREDENTIAL_PATTERNS: readonly {
  readonly name: string;
  readonly re: RegExp;
}[] = Object.freeze([
  Object.freeze({
    name: "postgres-url",
    re: /postgres(?:ql)?:\/\/[^:\s]*:[^@\s]*@[^\s"']+/i,
  }),
  Object.freeze({
    name: "password-pair",
    re: /\bpassword\s*=\s*(?:"[^"]+"|'[^']+'|\S+)/i,
  }),
  Object.freeze({
    name: "api-key",
    re: /\bapi[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9+/._-]{16,}/i,
  }),
  Object.freeze({
    name: "service-role-key",
    re: /\bservice[_-]?role[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9+/._-]{16,}/i,
  }),
  Object.freeze({
    name: "bearer-token",
    re: /\bbearer\s+[A-Za-z0-9+/._-]{20,}/i,
  }),
  Object.freeze({
    name: "secret-pair",
    re: /\bsecret\s*[:=]\s*['"]?[A-Za-z0-9+/._-]{16,}/i,
  }),
] as const);

/** Scan a text buffer for likely-credential patterns. Returns the names
 *  of every pattern that matched. Pure · no I/O. */
export function scanForLikelyCredentials(text: string): readonly string[] {
  const findings: string[] = [];
  for (const p of CREDENTIAL_PATTERNS) {
    if (p.re.test(text)) findings.push(p.name);
  }
  return findings;
}
